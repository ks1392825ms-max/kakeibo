// データの保存・読み込みを担当するファイル
// 画面のファイルは、必ずこのファイルの関数を通してデータを読み書きする。
// 将来 Google Drive と同期するときも、変更するのは基本的にこのファイルだけで済むようにしている。
//
// 保存されるデータの形：
// {
//   version: 1,                 データ形式の番号（形を変えたときの自動変換に使う）
//   categories: [...],          カテゴリー
//   transactions: [...],        収入・支出の記録
//   settings: {...}             設定
// }
// すべての記録に id / createdAt / updatedAt / deleted を持たせる（同期のため）。
// 削除は本当に消さず deleted: true にする（もう一方の端末に「削除した」ことを伝えるため）。
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;

  const STORAGE_KEY = 'kakeibo-data';
  const RESTORE_BACKUP_KEY = 'kakeibo-data-before-restore'; // 復元の直前の状態
  const DEFAULTS_TIMESTAMP = '2000-01-01T00:00:00.000Z'; // 初期カテゴリーの日時
  const DATA_VERSION = 1;
  const MAX_AMOUNT = 999999999;
  const MAX_MEMO_LENGTH = 100;
  const MAX_CATEGORY_NAME_LENGTH = 20;
  const CATEGORY_GROUPS = ['income', 'fixed', 'variable'];

  let data = null;

  function createInitialData() {
    const now = U.nowIso();
    return {
      version: DATA_VERSION,
      // 初期カテゴリーの日時は固定にする。同期のとき、どちらかの端末で編集したものが必ず優先されるように
      categories: K.defaults.categories.map((c, i) => ({
        id: c.id,
        name: c.name,
        group: c.group,
        color: c.color,
        order: i,
        createdAt: DEFAULTS_TIMESTAMP,
        updatedAt: DEFAULTS_TIMESTAMP,
        deleted: false,
      })),
      transactions: [],
      settings: {
        openingBalance: 0,
        lastSyncedAt: null,
        updatedAt: now,
      },
    };
  }

  // 古い形式のデータを、今の形式に変換する（今はバージョン1だけなので確認のみ）
  function migrate(obj) {
    if (!obj || typeof obj.version !== 'number') {
      throw new Error('データの形式が正しくありません。');
    }
    if (obj.version > DATA_VERSION) {
      throw new Error('このアプリより新しい形式のデータです。アプリを最新にしてください。');
    }
    // 例：将来 version 2 を作ったら、ここに「1 → 2 の変換」を書く
    obj.categories = Array.isArray(obj.categories) ? obj.categories : [];
    obj.transactions = Array.isArray(obj.transactions) ? obj.transactions : [];
    obj.settings = obj.settings || {};
    return obj;
  }

  // 変更して保存する。保存に失敗したら、変更前の状態に戻す
  // 通常の変更では「書き出していない変更あり」の目印を付ける（markChanged: false で付けない）
  function commit(mutate, { markChanged = true } = {}) {
    const backup = JSON.stringify(data);
    mutate(data);
    if (markChanged) data.settings.hasUnexportedChanges = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      data = JSON.parse(backup);
      throw new Error('保存に失敗しました。ブラウザの設定や空き容量を確認してください。');
    }
  }

  // 起動時に1回だけ呼ぶ。結果を { ok, message } で返す
  function init() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return {
        ok: false,
        message: 'このブラウザではデータを保存できません。プライベートブラウズを使っている場合は、通常のウィンドウで開いてください。',
      };
    }

    if (raw === null) {
      data = createInitialData();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        return { ok: false, message: 'データを保存できませんでした。ブラウザの設定を確認してください。' };
      }
      return { ok: true };
    }

    try {
      data = migrate(JSON.parse(raw));
    } catch (err) {
      // 読めないデータを上書きしないよう、ここで止める
      console.error(err);
      return {
        ok: false,
        message: `保存されているデータを読み込めませんでした（${err.message}）。データは消さずにそのまま残しています。`,
      };
    }
    return { ok: true };
  }

  // ---- カテゴリー ----

  // group を指定すると、そのグループだけ返す。削除済みは含めない
  function getCategories({ group } = {}) {
    return data.categories
      .filter((c) => !c.deleted && (!group || c.group === group))
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ ...c }));
  }

  // 削除済みも含めて1件探す（過去の記録の表示用）
  function getCategory(id) {
    const c = data.categories.find((x) => x.id === id);
    return c ? { ...c } : null;
  }

  // 削除したカテゴリーの一覧（元に戻す用）
  function getDeletedCategories({ group } = {}) {
    return data.categories
      .filter((c) => c.deleted && (!group || c.group === group))
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ ...c }));
  }

  function findActiveCategory(id) {
    const c = data.categories.find((x) => x.id === id && !x.deleted);
    if (!c) throw new Error('カテゴリーが見つかりませんでした。');
    return c;
  }

  function normalizeCategoryName(name, group, exceptId) {
    const clean = String(name || '').trim();
    if (!clean) throw new Error('カテゴリー名を入力してください。');
    if (clean.length > MAX_CATEGORY_NAME_LENGTH) {
      throw new Error(`カテゴリー名は${MAX_CATEGORY_NAME_LENGTH}文字以内で入力してください。`);
    }
    const duplicate = data.categories.some((c) => !c.deleted && c.group === group && c.name === clean && c.id !== exceptId);
    if (duplicate) throw new Error(`「${clean}」はすでにあります。別の名前にしてください。`);
    return clean;
  }

  function normalizeColor(color) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(color))) throw new Error('色が正しくありません。');
    return color.toLowerCase();
  }

  function addCategory({ name, group, color }) {
    if (!CATEGORY_GROUPS.includes(group)) throw new Error('グループが正しくありません。');
    const now = U.nowIso();
    const category = {
      id: U.uuid(),
      name: normalizeCategoryName(name, group),
      group,
      color: normalizeColor(color),
      order: Math.max(-1, ...data.categories.map((c) => c.order)) + 1,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };
    commit((d) => d.categories.push(category));
    return { ...category };
  }

  // 名前と色だけ変えられる（グループを変えると過去の集計が変わるため）
  function updateCategory(id, { name, color }) {
    const current = findActiveCategory(id);
    const clean = {
      name: normalizeCategoryName(name, current.group, id),
      color: normalizeColor(color),
    };
    commit((d) => {
      Object.assign(d.categories.find((c) => c.id === id), clean, { updatedAt: U.nowIso() });
    });
  }

  // 同じグループの中で、1つ上（direction = -1）か1つ下（+1）と入れ替える
  function moveCategory(id, direction) {
    const current = findActiveCategory(id);
    const list = getCategories({ group: current.group });
    const index = list.findIndex((c) => c.id === id);
    const other = list[index + direction];
    if (!other) return;
    commit((d) => {
      const a = d.categories.find((c) => c.id === id);
      const b = d.categories.find((c) => c.id === other.id);
      [a.order, b.order] = [b.order, a.order];
      a.updatedAt = b.updatedAt = U.nowIso();
    });
  }

  function deleteCategory(id) {
    const current = findActiveCategory(id);
    if (getCategories({ group: current.group }).length <= 1) {
      throw new Error('各グループには、最低1つのカテゴリーが必要です。');
    }
    commit((d) => {
      const c = d.categories.find((x) => x.id === id);
      c.deleted = true;
      c.updatedAt = U.nowIso();
    });
  }

  function restoreCategory(id) {
    const current = data.categories.find((c) => c.id === id && c.deleted);
    if (!current) throw new Error('カテゴリーが見つかりませんでした。');
    normalizeCategoryName(current.name, current.group, id);
    commit((d) => {
      const c = d.categories.find((x) => x.id === id);
      c.deleted = false;
      c.updatedAt = U.nowIso();
    });
  }

  // ---- 収入・支出の記録 ----

  // month（"2026-09"）を指定すると、その月だけ返す。新しい日付順
  function getTransactions({ month } = {}) {
    return data.transactions
      .filter((t) => !t.deleted && (!month || t.date.startsWith(`${month}-`)))
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
      .map((t) => ({ ...t }));
  }

  function getTransaction(id) {
    const t = data.transactions.find((x) => x.id === id && !x.deleted);
    return t ? { ...t } : null;
  }

  // 入力内容をチェックして、保存してよい形に整える
  function normalizeTransaction(fields) {
    const type = fields.type;
    if (type !== 'income' && type !== 'expense') {
      throw new Error('収入か支出かを選んでください。');
    }

    const amount = Number(fields.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      throw new Error('金額は1円以上の整数で入力してください。');
    }

    const date = String(fields.date || '');
    const [y, m, d] = date.split('-').map(Number);
    const check = new Date(y, m - 1, d);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || U.toDateStr(check) !== date) {
      throw new Error('日付が正しくありません。');
    }

    const category = data.categories.find((c) => c.id === fields.categoryId);
    const expectedGroups = type === 'income' ? ['income'] : ['fixed', 'variable'];
    if (!category || !expectedGroups.includes(category.group)) {
      throw new Error('カテゴリーを選んでください。');
    }

    const memo = String(fields.memo || '').trim();
    if (memo.length > MAX_MEMO_LENGTH) {
      throw new Error(`メモは${MAX_MEMO_LENGTH}文字以内で入力してください。`);
    }

    return { type, amount, date, categoryId: category.id, memo };
  }

  function addTransaction(fields) {
    const clean = normalizeTransaction(fields);
    const now = U.nowIso();
    const tx = { id: U.uuid(), ...clean, createdAt: now, updatedAt: now, deleted: false };
    commit((d) => d.transactions.push(tx));
    return { ...tx };
  }

  function updateTransaction(id, fields) {
    const current = getTransaction(id);
    if (!current) throw new Error('記録が見つかりませんでした。');
    const clean = normalizeTransaction({ ...current, ...fields });
    commit((d) => {
      const tx = d.transactions.find((x) => x.id === id);
      Object.assign(tx, clean, { updatedAt: U.nowIso() });
    });
    return getTransaction(id);
  }

  function deleteTransaction(id) {
    if (!getTransaction(id)) throw new Error('記録が見つかりませんでした。');
    commit((d) => {
      const tx = d.transactions.find((x) => x.id === id);
      tx.deleted = true;
      tx.updatedAt = U.nowIso();
    });
  }

  // すべてのデータのコピーを返す（バックアップ・同期用）
  function exportData() {
    return JSON.parse(JSON.stringify(data));
  }

  // ---- 同期・バックアップ ----

  // 同期の状態：{ lastExportedAt, lastImportedAt, hasUnexportedChanges }
  function getSyncStatus() {
    return {
      lastExportedAt: data.settings.lastExportedAt || null,
      lastImportedAt: data.settings.lastImportedAt || null,
      // 一度も書き出していないのに記録がある場合（Step3 までのデータなど）も「変更あり」とする
      hasUnexportedChanges:
        Boolean(data.settings.hasUnexportedChanges) || (!data.settings.lastExportedAt && data.transactions.length > 0),
    };
  }

  // 同期ファイルを書き出したことを記録する
  function markExported() {
    commit(
      (d) => {
        d.settings.lastExportedAt = U.nowIso();
        d.settings.hasUnexportedChanges = false;
      },
      { markChanged: false }
    );
  }

  // 同期ファイルの内容と合体して保存する（incoming は K.sync.parseFile の data）
  function mergeFromFile(incoming) {
    const merged = K.sync.mergeData(exportData(), incoming);
    commit(
      (d) => {
        d.categories = merged.categories;
        d.transactions = merged.transactions;
        d.settings.lastImportedAt = U.nowIso();
        // この端末にしかない変更がなければ、ファイルと同じ内容になっている
        d.settings.hasUnexportedChanges = merged.stats.localNewer > 0;
      },
      { markChanged: false }
    );
    return merged.stats;
  }

  // 復元の直前の状態が残っていれば、その日時を返す
  function getRestoreBackupDate() {
    try {
      const raw = localStorage.getItem(RESTORE_BACKUP_KEY);
      return raw ? JSON.parse(raw).savedAt : null;
    } catch (err) {
      return null;
    }
  }

  // バックアップの内容で丸ごと置き換える。直前の状態は1つだけ残しておく
  function restoreFromFile(incoming) {
    const prepared = K.sync.prepareRestore(incoming);
    try {
      localStorage.setItem(RESTORE_BACKUP_KEY, JSON.stringify({ savedAt: U.nowIso(), data }));
    } catch (err) {
      throw new Error('復元の前に、今のデータを残せませんでした。復元を中止しました。');
    }
    commit((d) => {
      d.categories = prepared.categories;
      d.transactions = prepared.transactions;
    });
    return { dropped: prepared.dropped };
  }

  // 復元を取り消して、復元の直前の状態に戻す
  function undoRestore() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(RESTORE_BACKUP_KEY));
    } catch (err) {
      saved = null;
    }
    if (!saved || !saved.data) throw new Error('戻せる状態が見つかりませんでした。');
    const previous = migrate(saved.data);
    commit((d) => {
      d.categories = previous.categories;
      d.transactions = previous.transactions;
    });
    localStorage.removeItem(RESTORE_BACKUP_KEY);
  }

  K.storage = {
    init,
    getCategories,
    getCategory,
    getDeletedCategories,
    addCategory,
    updateCategory,
    moveCategory,
    deleteCategory,
    restoreCategory,
    getTransactions,
    getTransaction,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    exportData,
    getSyncStatus,
    markExported,
    mergeFromFile,
    getRestoreBackupDate,
    restoreFromFile,
    undoRestore,
  };
})();
