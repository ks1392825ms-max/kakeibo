// 設定画面（カテゴリーの追加・編集・並び替え・削除・復活）
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;
  const el = U.el;

  const GROUPS = [
    ['income', '収入'],
    ['fixed', '固定費'],
    ['variable', '変動費'],
  ];

  // 選べる色
  const COLORS = [
    '#2e9e6b', '#3fb6a8', '#4db6d0', '#4c6ef5', '#7a5af8', '#d16ba5',
    '#e5616e', '#f08c3a', '#e0ad3a', '#52b788', '#b08968', '#9aa0a6',
  ];

  // 表示中のグループと、開いているフォーム（null：閉じている / 'new'：追加 / カテゴリーID：編集）
  let group = 'variable';
  let formTarget = null;

  function groupLabel(key) {
    return GROUPS.find(([k]) => k === key)[1];
  }

  function categoryForm(category) {
    const isNew = !category;
    let color = category ? category.color : COLORS[0];
    const colors = COLORS.includes(color) ? COLORS : [color, ...COLORS];

    const nameInput = el('input', {
      id: 'category-name',
      class: 'field__input',
      type: 'text',
      maxlength: '20',
      placeholder: '例：外食',
      value: category ? category.name : '',
    });
    const errorBox = el('p', { class: 'form-error', role: 'alert', hidden: true });

    const swatches = el(
      'div',
      { class: 'swatches', role: 'group', 'aria-label': '色' },
      colors.map((c, i) =>
        el('button', {
          type: 'button',
          class: `swatch${c === color ? ' is-selected' : ''}`,
          style: { '--swatch-color': c },
          'aria-label': `色${i + 1}`,
          'aria-pressed': String(c === color),
          onclick: (event) => {
            color = c;
            for (const b of swatches.children) {
              const selected = b === event.currentTarget;
              b.classList.toggle('is-selected', selected);
              b.setAttribute('aria-pressed', String(selected));
            }
          },
        })
      )
    );

    function close() {
      formTarget = null;
      K.app.rerender();
    }

    function onSubmit(event) {
      event.preventDefault();
      try {
        if (isNew) {
          K.storage.addCategory({ name: nameInput.value, group, color });
          K.app.toast('追加しました');
        } else {
          K.storage.updateCategory(category.id, { name: nameInput.value, color });
          K.app.toast('更新しました');
        }
        close();
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
      }
    }

    function onDelete() {
      if (!window.confirm(`「${category.name}」を削除しますか？\n過去の記録はそのまま残ります。`)) return;
      try {
        K.storage.deleteCategory(category.id);
        K.app.toast('削除しました');
        close();
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
      }
    }

    const form = el(
      'form',
      { class: 'card category-form', novalidate: true, onsubmit: onSubmit },
      el('h3', { class: 'card__title' }, isNew ? `${groupLabel(group)}のカテゴリーを追加` : 'カテゴリーを編集'),
      el('div', { class: 'field' }, el('label', { class: 'field__label', for: 'category-name' }, '名前'), nameInput),
      el('div', { class: 'field' }, el('p', { class: 'field__label' }, '色'), swatches),
      errorBox,
      el(
        'div',
        { class: 'actions' },
        el('button', { type: 'submit', class: 'btn btn--primary' }, isNew ? '追加する' : '更新する'),
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: close }, 'キャンセル'),
        isNew ? null : el('button', { type: 'button', class: 'btn btn--danger', onclick: onDelete }, 'このカテゴリーを削除')
      )
    );
    setTimeout(() => nameInput.focus(), 0);
    return form;
  }

  function move(id, direction) {
    try {
      K.storage.moveCategory(id, direction);
      K.app.rerender();
    } catch (err) {
      K.app.toast(err.message);
    }
  }

  function categoryRow(c, index, count) {
    return el(
      'li',
      { class: 'cat-row' },
      el('span', { class: 'breakdown__dot', 'aria-hidden': 'true', style: { background: c.color } }),
      el('span', { class: 'cat-row__name' }, c.name),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': `${c.name}を上へ`, disabled: index === 0, onclick: () => move(c.id, -1) }, '▲'),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': `${c.name}を下へ`, disabled: index === count - 1, onclick: () => move(c.id, 1) }, '▼'),
      el(
        'button',
        {
          type: 'button',
          class: 'text-btn',
          onclick: () => {
            formTarget = c.id;
            K.app.rerender();
          },
        },
        '編集'
      )
    );
  }

  function deletedSection() {
    const deleted = K.storage.getDeletedCategories({ group });
    if (deleted.length === 0) return null;
    return el(
      'div',
      null,
      el('h3', { class: 'section-title' }, '削除したカテゴリー'),
      el(
        'ul',
        { class: 'cat-list' },
        deleted.map((c) =>
          el(
            'li',
            { class: 'cat-row is-deleted' },
            el('span', { class: 'breakdown__dot', 'aria-hidden': 'true', style: { background: c.color } }),
            el('span', { class: 'cat-row__name' }, c.name),
            el(
              'button',
              {
                type: 'button',
                class: 'text-btn',
                onclick: () => {
                  try {
                    K.storage.restoreCategory(c.id);
                    K.app.toast('元に戻しました');
                    K.app.rerender();
                  } catch (err) {
                    K.app.toast(err.message);
                  }
                },
              },
              '元に戻す'
            )
          )
        )
      )
    );
  }

  function render(container) {
    const groupBar = el(
      'div',
      { class: 'segment segment--3', role: 'group', 'aria-label': 'カテゴリーのグループ' },
      GROUPS.map(([key, label]) =>
        el(
          'button',
          {
            type: 'button',
            class: `segment__btn${group === key ? ' is-selected' : ''}`,
            'aria-pressed': String(group === key),
            onclick: () => {
              group = key;
              formTarget = null;
              K.app.rerender();
            },
          },
          label
        )
      )
    );

    const categories = K.storage.getCategories({ group });
    const editing = formTarget && formTarget !== 'new' ? K.storage.getCategory(formTarget) : null;

    const addButton =
      formTarget === 'new'
        ? categoryForm(null)
        : el(
            'button',
            {
              type: 'button',
              class: 'btn btn--ghost btn--block',
              onclick: () => {
                formTarget = 'new';
                K.app.rerender();
              },
            },
            '＋ カテゴリーを追加'
          );

    // 表示しない部分（null）を除いてから並べる
    const parts = [
      syncSection(),
      el('h2', { class: 'section-title' }, 'カテゴリー'),
      groupBar,
      el('p', { class: 'hint hint--left' }, '並び順は入力画面に反映されます。削除しても過去の記録は残ります。'),
      editing ? categoryForm(editing) : null,
      el('ul', { class: 'cat-list' }, categories.map((c, i) => categoryRow(c, i, categories.length))),
      addButton,
      deletedSection(),
    ];
    container.append(...parts.filter(Boolean));
  }

  // ---- 同期・バックアップ ----

  // 直前の操作の結果（画面に表示する）：{ ok, text }
  let lastResult = null;

  function formatDateTime(iso) {
    if (!iso) return 'まだありません';
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
  }

  function showResult(ok, text) {
    lastResult = { ok, text };
    K.app.rerender();
  }

  // 「ファイルを選ぶ」画面を開き、選ばれたファイルを onFile に渡す
  function pickFile(onFile) {
    const input = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
    input.addEventListener('change', () => {
      const file = input.files[0];
      input.remove();
      if (file) onFile(file);
    });
    input.addEventListener('cancel', () => input.remove());
    document.body.append(input);
    input.click();
  }

  function skippedNote(count) {
    return count > 0 ? `\n形式が正しくないため取り込めなかった記録：${count}件` : '';
  }

  function importSync() {
    pickFile(async (file) => {
      try {
        const parsed = K.sync.parseFile(await K.sync.readText(file));
        const stats = K.storage.mergeFromFile(parsed.data);
        const exported = parsed.exportedAt ? `\nファイルを書き出した日時：${formatDateTime(parsed.exportedAt)}` : '';
        K.app.toast('読み込みました');
        showResult(true, `読み込みました（追加 ${stats.added}件・更新 ${stats.updated}件）${exported}${skippedNote(parsed.skipped + stats.dropped)}`);
      } catch (err) {
        showResult(false, err.message);
      }
    });
  }

  async function exportSync() {
    try {
      const file = K.sync.buildFile(K.storage.exportData(), 'sync');
      const result = await K.sync.saveJson('kakeibo-sync.json', file);
      if (result === 'cancelled') return;
      K.storage.markExported();
      K.app.toast('書き出しました');
      showResult(
        true,
        result === 'downloaded'
          ? '書き出しました。保存先が Google Drive の同期フォルダでない場合は、ファイルを移して古いものと置き換えてください。'
          : '書き出しました。'
      );
    } catch (err) {
      showResult(false, `書き出せませんでした（${err.message}）`);
    }
  }

  async function saveBackup() {
    try {
      const file = K.sync.buildFile(K.storage.exportData(), 'backup');
      const result = await K.sync.saveJson(`kakeibo-backup-${U.todayStr()}.json`, file);
      if (result === 'cancelled') return;
      K.app.toast('バックアップを保存しました');
    } catch (err) {
      showResult(false, `保存できませんでした（${err.message}）`);
    }
  }

  function restoreBackup() {
    pickFile(async (file) => {
      try {
        const parsed = K.sync.parseFile(await K.sync.readText(file));
        const count = parsed.data.transactions.filter((t) => !t.deleted).length;
        const message =
          `今のデータを、このファイルの内容（記録 ${count}件）で置き換えます。よろしいですか？\n` +
          '置き換える前の状態は「復元を取り消す」で戻せます。';
        if (!window.confirm(message)) return;
        const result = K.storage.restoreFromFile(parsed.data);
        K.app.toast('復元しました');
        showResult(true, `復元しました${skippedNote(parsed.skipped + result.dropped)}`);
      } catch (err) {
        showResult(false, err.message);
      }
    });
  }

  function undoRestore() {
    if (!window.confirm('復元する前の状態に戻しますか？')) return;
    try {
      K.storage.undoRestore();
      K.app.toast('元に戻しました');
      showResult(true, '復元する前の状態に戻しました。');
    } catch (err) {
      showResult(false, err.message);
    }
  }

  function syncSection() {
    const status = K.storage.getSyncStatus();
    const restoreDate = K.storage.getRestoreBackupDate();

    let state;
    if (status.hasUnexportedChanges) state = el('p', { class: 'sync__state is-warning' }, '⚠ 書き出していない変更があります');
    else if (status.lastExportedAt) state = el('p', { class: 'sync__state is-ok' }, '✓ 最新の状態を書き出し済みです');
    else state = el('p', { class: 'sync__state' }, 'まだ書き出していません');

    return el(
      'div',
      null,
      el('h2', { class: 'section-title section-title--first' }, '同期（Google Drive）'),
      el(
        'section',
        { class: 'card' },
        state,
        el(
          'dl',
          { class: 'sync__status' },
          el('dt', null, '最後の書き出し'),
          el('dd', null, formatDateTime(status.lastExportedAt)),
          el('dt', null, '最後の読み込み'),
          el('dd', null, formatDateTime(status.lastImportedAt))
        ),
        el(
          'div',
          { class: 'actions actions--tight' },
          el('button', { type: 'button', class: 'btn btn--ghost', onclick: importSync }, '① 同期ファイルを読み込む'),
          el('button', { type: 'button', class: 'btn btn--primary', onclick: exportSync }, '② 同期ファイルを書き出す')
        ),
        el('p', { class: 'hint hint--left' }, '使い始める前に①、使い終わったら②。ファイル名は kakeibo-sync.json です。'),
        lastResult ? el('p', { class: lastResult.ok ? 'sync__result' : 'form-error', role: 'status' }, lastResult.text) : null
      ),
      el('h2', { class: 'section-title' }, 'バックアップ'),
      el(
        'section',
        { class: 'card' },
        el(
          'div',
          { class: 'actions actions--tight' },
          el('button', { type: 'button', class: 'btn btn--ghost', onclick: saveBackup }, 'バックアップを保存'),
          el('button', { type: 'button', class: 'btn btn--ghost', onclick: restoreBackup }, 'バックアップから復元'),
          restoreDate
            ? el('button', { type: 'button', class: 'btn btn--danger', onclick: undoRestore }, `復元を取り消す（${formatDateTime(restoreDate)}の状態に戻す）`)
            : null
        ),
        el('p', { class: 'hint hint--left' }, '復元すると、今のデータはファイルの内容で置き換わります。')
      )
    );
  }

  K.screens = K.screens || {};
  K.screens.settings = { render };
})();
