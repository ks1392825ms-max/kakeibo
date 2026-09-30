// 残り画面（月ごとの「収入 − 支出」と、その累計）
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;
  const el = U.el;

  function formatSigned(n) {
    if (n > 0) return `+${U.formatYen(n)}`;
    if (n < 0) return `−${U.formatYen(-n)}`;
    return U.formatYen(0);
  }

  function signClass(n) {
    if (n > 0) return 'is-plus';
    if (n < 0) return 'is-minus';
    return '';
  }

  function render(container) {
    const rows = K.calc.monthlyHistory();

    if (rows.length === 0) {
      container.append(
        el(
          'div',
          { class: 'empty' },
          el('p', null, 'まだ記録がありません。'),
          el('button', { type: 'button', class: 'btn btn--primary', onclick: () => K.app.navigate('input') }, '入力する')
        )
      );
      return;
    }

    const first = rows[0];
    const last = rows[rows.length - 1];

    const totalCard = el(
      'section',
      { class: 'card total' },
      el('p', { class: 'summary__label' }, '残りの累計'),
      el('p', { class: `total__value ${signClass(last.cumulative)}` }, formatSigned(last.cumulative)),
      el('p', { class: 'total__note' }, `${U.formatMonthLabel(first.month)}〜${U.formatMonthLabel(last.month)}（収入 − 支出 の合計）`)
    );

    // 新しい月を上にする。タップするとその月のホームを開く
    const list = el(
      'ul',
      { class: 'history' },
      rows
        .slice()
        .reverse()
        .map((r) =>
          el(
            'li',
            null,
            el(
              'button',
              { type: 'button', class: 'history__item', onclick: () => K.app.navigate('home', { month: r.month }) },
              el(
                'span',
                { class: 'history__main' },
                el('span', { class: 'history__month' }, U.formatMonthLabel(r.month)),
                el('span', { class: 'history__detail' }, `収入 ${U.formatYen(r.income)} / 支出 ${U.formatYen(r.expense)}`)
              ),
              el(
                'span',
                { class: 'history__amounts' },
                el('span', { class: `history__balance ${signClass(r.balance)}` }, formatSigned(r.balance)),
                el('span', { class: 'history__cumulative' }, `累計 ${formatSigned(r.cumulative)}`)
              )
            )
          )
        )
    );

    container.append(totalCard, el('h2', { class: 'section-title' }, '月ごとの残り'), list);
  }

  K.screens = K.screens || {};
  K.screens.balance = { render };
})();
