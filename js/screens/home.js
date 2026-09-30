// ホーム画面（その月の収入・支出・残りをひと目で見る）
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;
  const el = U.el;

  // 80000 → "+80,000円"、-5000 → "−5,000円"
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

  function row(label, amount, modifier) {
    return el(
      'div',
      { class: `summary__row${modifier ? ` summary__row--${modifier}` : ''}` },
      el('span', { class: 'summary__label' }, label),
      el('span', { class: 'summary__value' }, U.formatYen(amount))
    );
  }

  function render(container) {
    const month = K.app.state.month;
    const summary = K.calc.monthlySummary(month);
    const cumulative = K.calc.cumulativeUntil(month);
    const hasRecords = summary.income > 0 || summary.expense > 0;

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

    const summaryCard = el(
      'section',
      { class: 'card summary', 'aria-label': 'この月の収支' },
      row('収入', summary.income, 'income'),
      row('支出', summary.expense),
      row('固定費', summary.fixed, 'sub'),
      row('変動費', summary.variable, 'sub'),
      el(
        'div',
        { class: 'summary__total' },
        el('span', { class: 'summary__label' }, 'この月の残り'),
        el('span', { class: `summary__total-value ${signClass(summary.balance)}` }, formatSigned(summary.balance))
      ),
      hasRecords ? null : el('p', { class: 'hint' }, 'この月の記録はまだありません。')
    );

    const cumulativeCard = el(
      'button',
      { type: 'button', class: 'card stat-link', onclick: () => K.app.navigate('balance') },
      el(
        'span',
        { class: 'stat-link__main' },
        el('span', { class: 'summary__label' }, '累計の残り'),
        el('span', { class: 'stat-link__note' }, `記録開始から${U.formatMonthLabel(month)}まで`)
      ),
      el('span', { class: `stat-link__value ${signClass(cumulative)}` }, formatSigned(cumulative)),
      el('span', { class: 'stat-link__arrow', 'aria-hidden': 'true' }, '›')
    );

    const actions = el(
      'div',
      { class: 'actions' },
      el('button', { type: 'button', class: 'btn btn--primary', onclick: () => K.app.navigate('input') }, '＋ 入力する'),
      el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => K.app.navigate('list') }, 'この月の明細を見る')
    );

    container.append(monthNav, summaryCard, cumulativeCard, actions);
  }

  K.screens = K.screens || {};
  K.screens.home = { render };
})();
