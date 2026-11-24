// 「履歴」画面：「家計簿入力」で保存した日を、新しい順に並べる
// タップするとその日の入力を開いて直せる。「削除」で消せる
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;
  const el = U.el;

  const plain = (n) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('ja-JP')}`;
  const signed = (n) => (n === 0 ? '±0' : `${n > 0 ? '+' : '−'}${Math.abs(n).toLocaleString('ja-JP')}`);

  function render(container) {
    const list = K.storage.getQuickLedger().reverse();

    if (!list.length) {
      container.append(
        el(
          'div',
          { class: 'empty' },
          el('p', {}, 'まだ保存した入力はありません。'),
          el('button', { type: 'button', class: 'btn btn--primary', onclick: () => K.app.navigate('quick') }, '入力する')
        )
      );
      return;
    }

    function onDelete(entry) {
      const message =
        `${entry.date.slice(0, 4)}年${U.formatDateLabel(entry.date)}の入力を削除しますか？\n` +
        'それより後の日の「前回の持ち越し金」も、自動で計算し直されます。';
      if (!window.confirm(message)) return;
      try {
        K.storage.deleteQuickEntry(entry.date);
        K.app.toast('削除しました');
        K.app.rerender();
      } catch (err) {
        window.alert(err.message);
      }
    }

    let currentMonth = '';
    const items = [];
    for (const e of list) {
      const month = e.date.slice(0, 7);
      if (month !== currentMonth) {
        currentMonth = month;
        items.push(el('h2', { class: 'history-month' }, U.formatMonthLabel(month)));
      }
      items.push(
        el(
          'div',
          { class: 'history-item' },
          el(
            'button',
            {
              type: 'button',
              class: 'history-item__main',
              'aria-label': `${U.formatDateLabel(e.date)}の入力を開いて直す`,
              onclick: () => K.app.navigate('quick', { date: e.date }),
            },
            el('span', { class: 'history-item__date' }, U.formatDateLabel(e.date)),
            el(
              'span',
              { class: 'history-item__nums' },
              el('span', { class: 'is-exp' }, `支出 ${plain(e.expense)}`),
              el('span', { class: 'is-inc' }, `収入 ${plain(e.income)}`),
              el('span', { class: e.net > 0 ? 'is-inc' : e.net < 0 ? 'is-exp' : '' }, `収支 ${signed(e.net)}`)
            ),
            el('span', { class: 'history-item__carry' }, el('small', {}, '合計 持ち越し金'), plain(e.totalCarry))
          ),
          el('button', { type: 'button', class: 'history-item__delete', onclick: () => onDelete(e) }, '削除')
        )
      );
    }

    container.append(el('p', { class: 'sheet-hint' }, 'タップすると、その日の入力を開いて直せます。'), ...items);
  }

  K.screens = K.screens || {};
  K.screens.history = { render };
})();
