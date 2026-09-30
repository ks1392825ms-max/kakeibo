// 同期・バックアップファイルの中身のチェックと、2つのデータの合体を担当するファイル
// ここではデータを保存しない（保存は storage.js が行う）。
//
// ファイルの形：
// {
//   format: "kakeibo-sync",       家計簿のファイルであることの目印
//   kind: "sync" または "backup",
//   exportedAt: "2026-09-30T...",  書き出した日時
//   data: { version, categories: [...], transactions: [...] }
// }
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;

  const FORMAT = 'kakeibo-sync';
  const DATA_VERSION = 1;
  const GROUPS = ['income', 'fixed', 'variable'];
  const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

  // ---- 書き出し用のファイルを作る ----
  function buildFile(data, kind) {
    return {
      format: FORMAT,
      kind,
      exportedAt: U.nowIso(),
      data: {
        version: data.version,
        categories: data.categories,
        transactions: data.transactions,
      },
    };
  }

  // ---- 読み込んだ記録のチェック（正しくないものは null を返して取り込まない） ----
  function isId(v) {
    return typeof v === 'string' && v.length > 0 && v.length <= 100;
  }

  function isValidDate(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const [y, m, d] = v.split('-').map(Number);
    return U.toDateStr(new Date(y, m - 1, d)) === v;
  }

  function cleanCategory(c) {
    if (!c || typeof c !== 'object') return null;
    const name = typeof c.name === 'string' ? c.name.trim() : '';
    if (
      !isId(c.id) ||
      !name ||
      name.length > 20 ||
      !GROUPS.includes(c.group) ||
      !/^#[0-9a-fA-F]{6}$/.test(String(c.color)) ||
      !Number.isFinite(c.order) ||
      !ISO_RE.test(c.createdAt) ||
      !ISO_RE.test(c.updatedAt) ||
      typeof c.deleted !== 'boolean'
    ) {
      return null;
    }
    return {
      id: c.id,
      name,
      group: c.group,
      color: c.color.toLowerCase(),
      order: c.order,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      deleted: c.deleted,
    };
  }

  function cleanTransaction(t) {
    if (!t || typeof t !== 'object') return null;
    const memo = typeof t.memo === 'string' ? t.memo.trim() : '';
    if (
      !isId(t.id) ||
      (t.type !== 'income' && t.type !== 'expense') ||
      !Number.isSafeInteger(t.amount) ||
      t.amount <= 0 ||
      t.amount > 999999999 ||
      !isValidDate(t.date) ||
      !isId(t.categoryId) ||
      memo.length > 100 ||
      !ISO_RE.test(t.createdAt) ||
      !ISO_RE.test(t.updatedAt) ||
      typeof t.deleted !== 'boolean'
    ) {
      return null;
    }
    return {
      id: t.id,
      type: t.type,
      amount: t.amount,
      date: t.date,
      categoryId: t.categoryId,
      memo,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      deleted: t.deleted,
    };
  }

  // ファイルの文字を読み取り、チェック済みのデータを返す。家計簿のファイルでなければエラー
  // 戻り値：{ kind, exportedAt, data: { categories, transactions }, skipped（取り込まなかった件数） }
  function parseFile(text) {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (err) {
      throw new Error('ファイルを読み込めませんでした。家計簿のファイルか確認してください。');
    }
    if (!obj || obj.format !== FORMAT || !obj.data || typeof obj.data !== 'object') {
      throw new Error('家計簿の同期ファイル・バックアップファイルではありません。');
    }
    if (typeof obj.data.version !== 'number' || obj.data.version > DATA_VERSION) {
      throw new Error('このアプリより新しい形式のファイルです。アプリを最新にしてください。');
    }

    const rawCategories = Array.isArray(obj.data.categories) ? obj.data.categories : [];
    const rawTransactions = Array.isArray(obj.data.transactions) ? obj.data.transactions : [];
    const categories = rawCategories.map(cleanCategory).filter(Boolean);
    const transactions = rawTransactions.map(cleanTransaction).filter(Boolean);
    if (categories.length === 0) {
      throw new Error('ファイルにカテゴリーが入っていません。家計簿のファイルか確認してください。');
    }

    return {
      kind: obj.kind === 'backup' ? 'backup' : 'sync',
      exportedAt: ISO_RE.test(obj.exportedAt) ? obj.exportedAt : null,
      data: { categories, transactions },
      skipped: rawCategories.length - categories.length + (rawTransactions.length - transactions.length),
    };
  }

  // 各グループに、使えるカテゴリーが最低1つあるようにする（なければ最後に更新したものを復活）
  function ensureEachGroup(categories) {
    for (const group of GROUPS) {
      const inGroup = categories.filter((c) => c.group === group);
      if (inGroup.length && !inGroup.some((c) => !c.deleted)) {
        const latest = inGroup.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));
        latest.deleted = false;
      }
    }
    return categories;
  }

  // カテゴリーが見つからない記録は取り除く
  function dropOrphans(transactions, categories) {
    const ids = new Set(categories.map((c) => c.id));
    const kept = transactions.filter((t) => ids.has(t.categoryId));
    return { kept, dropped: transactions.length - kept.length };
  }

  // 同じ id の記録は、更新日時が新しいほうを残す
  function mergeList(localList, incomingList, stats) {
    const byId = new Map(localList.map((x) => [x.id, { ...x }]));
    const incomingIds = new Set();
    for (const inc of incomingList) {
      incomingIds.add(inc.id);
      const loc = byId.get(inc.id);
      if (!loc) {
        byId.set(inc.id, { ...inc });
        stats.added += 1;
      } else if (inc.updatedAt > loc.updatedAt) {
        byId.set(inc.id, { ...inc });
        stats.updated += 1;
      } else if (loc.updatedAt > inc.updatedAt) {
        stats.localNewer += 1;
      }
    }
    // ファイルに入っていない、この端末だけの記録
    stats.localNewer += localList.filter((x) => !incomingIds.has(x.id)).length;
    return [...byId.values()];
  }

  // この端末のデータ（local）と、ファイルのデータ（incoming）を合体する
  // 戻り値：{ categories, transactions, stats: { added, updated, localNewer, dropped } }
  // localNewer：ファイルにない、またはファイルより新しい、この端末の記録の数
  function mergeData(local, incoming) {
    const stats = { added: 0, updated: 0, localNewer: 0, dropped: 0 };
    const categories = ensureEachGroup(mergeList(local.categories, incoming.categories, stats));
    const { kept, dropped } = dropOrphans(mergeList(local.transactions, incoming.transactions, stats), categories);
    stats.dropped = dropped;
    return { categories, transactions: kept, stats };
  }

  // 復元用：ファイルのデータだけを整える（合体しない）
  function prepareRestore(incoming) {
    const categories = ensureEachGroup(incoming.categories.map((c) => ({ ...c })));
    const { kept, dropped } = dropOrphans(incoming.transactions, categories);
    return { categories, transactions: kept, dropped };
  }

  K.sync = K.sync || {};
  Object.assign(K.sync, { buildFile, parseFile, mergeData, prepareRestore });
})();
