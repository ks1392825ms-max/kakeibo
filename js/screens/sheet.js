// 「生活収支表」画面：「家計簿入力」で保存した内容を、月ごとの表にする
// 1行＝1日。横に、支出の各項目・支出合計・収入の各項目・収入合計・本日の収支・合計 持ち越し金が並ぶ
// 行をタップすると、その日の「家計簿入力」を開いて直せる
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;
  const el = U.el;

  const yen = (n) => (n ? n.toLocaleString('ja-JP') : '');
  const plain = (n) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('ja-JP')}`;
  const signed = (n) => (n === 0 ? '±0' : `${n > 0 ? '+' : '−'}${Math.abs(n).toLocaleString('ja-JP')}`);

  // "2026-11-24" → "24(火)"
  function dayLabel(date) {
    return U.formatDateLabel(date).replace(/^\d+月/, '').replace('日', '');
  }

  function render(container) {
    const month = K.app.state.month;
    const ledger = K.storage.getQuickLedger();
    const rows = ledger.filter((e) => e.date.slice(0, 7) === month);
    const expItems = K.quickItems.expenses;
    const incItems = K.quickItems.incomes;

    const monthNav = el(
      'div',
      { class: 'month-nav' },
      el(
        'button',
        { type: 'button', class: 'month-nav__btn', 'aria-label': '前の月', onclick: () => K.app.setMonth(U.shiftMonth(month, -1)) },
        '◀'
      ),
      el('h2', { class: 'month-nav__label' }, U.formatMonthLabel(month)),
      el(
        'button',
        { type: 'button', class: 'month-nav__btn', 'aria-label': '次の月', onclick: () => K.app.setMonth(U.shiftMonth(month, 1)) },
        '▶'
      )
    );

    // この月の合計
    const expTotal = rows.reduce((s, r) => s + r.expense, 0);
    const incTotal = rows.reduce((s, r) => s + r.income, 0);
    const net = incTotal - expTotal;
    // 月末の持ち越し金：この月の最後の記録。なければ、この月より前の最後の記録
    const upToMonth = ledger.filter((e) => e.date.slice(0, 7) <= month);
    const endCarry = upToMonth.length ? upToMonth[upToMonth.length - 1].totalCarry : null;

    const summary = el(
      'div',
      { class: 'sheet-summary' },
      el('div', { class: 'sheet-summary__item is-exp' }, el('span', {}, '支出合計'), el('b', {}, plain(expTotal))),
      el('div', { class: 'sheet-summary__item is-inc' }, el('span', {}, '収入合計'), el('b', {}, plain(incTotal))),
      el(
        'div',
        { class: `sheet-summary__item${net > 0 ? ' is-inc' : net < 0 ? ' is-exp' : ''}` },
        el('span', {}, 'この月の収支'),
        el('b', {}, signed(net))
      ),
      el(
        'div',
        { class: 'sheet-summary__item is-carry' },
        el('span', {}, '月末の 合計 持ち越し金'),
        el('b', {}, endCarry === null ? '—' : plain(endCarry))
      )
    );

    if (!rows.length) {
      container.append(
        monthNav,
        summary,
        el(
          'div',
          { class: 'empty' },
          el('p', {}, 'この月の入力はまだありません。'),
          el('button', { type: 'button', class: 'btn btn--primary', onclick: () => K.app.navigate('quick') }, '入力する')
        )
      );
      return;
    }

    const head = el(
      'tr',
      {},
      el('th', { class: 'sheet__date', scope: 'col' }, '日付'),
      expItems.map((i) => el('th', { class: 'is-exp', scope: 'col' }, i.name)),
      el('th', { class: 'is-exp is-sum', scope: 'col' }, '支出合計'),
      incItems.map((i) => el('th', { class: 'is-inc', scope: 'col' }, i.name)),
      el('th', { class: 'is-inc is-sum', scope: 'col' }, '収入合計'),
      el('th', { scope: 'col' }, '前回の持ち越し金'),
      el('th', { scope: 'col' }, '本日の収支'),
      el('th', { class: 'is-carry', scope: 'col' }, '合計 持ち越し金')
    );

    const body = rows.map((r) =>
      el(
        'tr',
        {
          class: 'sheet__row',
          tabindex: '0',
          title: `${U.formatDateLabel(r.date)}の入力を開く`,
          onclick: () => K.app.navigate('quick', { date: r.date }),
          onkeydown: (e) => {
            if (e.key === 'Enter') K.app.navigate('quick', { date: r.date });
          },
        },
        el('th', { class: 'sheet__date', scope: 'row' }, dayLabel(r.date)),
        expItems.map((i) => el('td', { class: 'is-exp' }, yen(r.amounts[i.id]))),
        el('td', { class: 'is-exp is-sum' }, plain(r.expense)),
        incItems.map((i) => el('td', { class: 'is-inc' }, yen(r.amounts[i.id]))),
        el('td', { class: 'is-inc is-sum' }, plain(r.income)),
        el('td', {}, plain(r.prevCarry)),
        el('td', { class: r.net > 0 ? 'is-plus' : r.net < 0 ? 'is-minus' : '' }, signed(r.net)),
        el('td', { class: 'is-carry' }, plain(r.totalCarry))
      )
    );

    // 月の合計の行
    const totalOf = (id) => rows.reduce((s, r) => s + (r.amounts[id] || 0), 0);
    const foot = el(
      'tr',
      {},
      el('th', { class: 'sheet__date', scope: 'row' }, '月計'),
      expItems.map((i) => el('td', { class: 'is-exp' }, yen(totalOf(i.id)))),
      el('td', { class: 'is-exp is-sum' }, plain(expTotal)),
      incItems.map((i) => el('td', { class: 'is-inc' }, yen(totalOf(i.id)))),
      el('td', { class: 'is-inc is-sum' }, plain(incTotal)),
      el('td', {}, ''),
      el('td', { class: net > 0 ? 'is-plus' : net < 0 ? 'is-minus' : '' }, signed(net)),
      el('td', { class: 'is-carry' }, endCarry === null ? '' : plain(endCarry))
    );

    container.append(
      monthNav,
      summary,
      el('p', { class: 'sheet-hint' }, '表は横にスクロールできます。行をタップすると、その日の入力を直せます。'),
      el(
        'div',
        { class: 'sheet-scroll' },
        el('table', { class: 'sheet' }, el('thead', {}, head), el('tbody', {}, body), el('tfoot', {}, foot))
      )
    );
  }

  K.screens = K.screens || {};
  K.screens.sheet = { render };
})();
