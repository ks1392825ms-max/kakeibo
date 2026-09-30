// 集計画面（カテゴリー別の内訳と、月ごとの推移）
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;
  const el = U.el;

  const SCOPES = [
    ['expense', '全体'],
    ['fixed', '固定費'],
    ['variable', '変動費'],
  ];
  const DONUT_MAX = 5; // ドーナツに個別に出すカテゴリーの数。残りは「ほか」にまとめる
  const FOLD_COLOR = '#b9bdc3';
  const TREND_MONTHS = 6;

  // 月を切り替えても、選んだ「全体・固定費・変動費」は残す
  let scope = 'expense';

  function percent(ratio) {
    return `${Math.round(ratio * 100)}%`;
  }

  // カテゴリーごとの一覧（表）。棒は金額の大きさを表す
  function breakdownList(rows) {
    const max = rows.length ? rows[0].amount : 0;
    return el(
      'ul',
      { class: 'breakdown' },
      rows.map((r) =>
        el(
          'li',
          { class: 'breakdown__item' },
          el(
            'div',
            { class: 'breakdown__head' },
            el('span', { class: 'breakdown__dot', 'aria-hidden': 'true', style: { background: r.color } }),
            el('span', { class: 'breakdown__name' }, r.deleted ? `${r.name}（削除済み）` : r.name),
            el('span', { class: 'breakdown__amount' }, U.formatYen(r.amount)),
            el('span', { class: 'breakdown__pct' }, percent(r.ratio))
          ),
          el(
            'div',
            { class: 'breakdown__track', 'aria-hidden': 'true' },
            el('span', { class: 'breakdown__bar', style: { width: `${max ? (r.amount / max) * 100 : 0}%` } })
          )
        )
      )
    );
  }

  function expenseCard(month) {
    const { total, rows } = K.calc.categoryBreakdown(month, scope);
    const scopeLabel = SCOPES.find(([key]) => key === scope)[1];

    const scopeBar = el(
      'div',
      { class: 'segment segment--3', role: 'group', 'aria-label': '支出の種類' },
      SCOPES.map(([key, label]) =>
        el(
          'button',
          {
            type: 'button',
            class: `segment__btn${scope === key ? ' is-selected' : ''}`,
            'aria-pressed': String(scope === key),
            onclick: () => {
              scope = key;
              K.app.rerender();
            },
          },
          label
        )
      )
    );

    const card = el('section', { class: 'card' }, el('h2', { class: 'card__title' }, '支出の内訳'), scopeBar);

    if (total === 0) {
      card.append(el('p', { class: 'hint' }, 'この月の支出はまだありません。'));
      return card;
    }

    const segments = rows.slice(0, DONUT_MAX).map((r) => ({ label: r.name, value: r.amount, color: r.color }));
    const rest = rows.slice(DONUT_MAX);
    if (rest.length) {
      segments.push({ label: `ほか${rest.length}件`, value: rest.reduce((sum, r) => sum + r.amount, 0), color: FOLD_COLOR });
    }

    card.append(
      el(
        'div',
        { class: 'donut-wrap' },
        K.charts.donut({
          segments,
          centerLabel: `${scopeLabel}の支出`,
          centerValue: U.formatYen(total),
          ariaLabel: `${scopeLabel}の支出 ${U.formatYen(total)} のカテゴリー別の割合`,
        })
      )
    );
    if (rest.length) {
      card.append(el('p', { class: 'chart-note' }, `グラフでは上位${DONUT_MAX}つ以外を灰色でまとめています。`));
    }
    card.append(breakdownList(rows));
    return card;
  }

  function incomeCard(month) {
    const { total, rows } = K.calc.categoryBreakdown(month, 'income');
    const card = el(
      'section',
      { class: 'card' },
      el('h2', { class: 'card__title' }, '収入の内訳', el('span', { class: 'card__title-value' }, U.formatYen(total)))
    );
    card.append(total === 0 ? el('p', { class: 'hint' }, 'この月の収入はまだありません。') : breakdownList(rows));
    return card;
  }

  function trendCard(month) {
    const months = K.calc.recentMonths(month, TREND_MONTHS);
    const series = [
      { key: 'income', label: '収入', className: 'columns__income' },
      { key: 'expense', label: '支出', className: 'columns__expense' },
    ];

    const legend = el(
      'div',
      { class: 'legend' },
      series.map((s) => el('span', { class: 'legend__item' }, el('span', { class: `legend__swatch ${s.className}` }), s.label))
    );

    const chart = K.charts.columns({
      groups: months.map((m) => ({
        label: `${Number(m.month.slice(5))}月`,
        values: { income: m.income, expense: m.expense },
      })),
      series,
      ariaLabel: `直近${TREND_MONTHS}か月の収入と支出`,
    });

    // グラフと同じ数字を表でも見られるようにする
    const table = el(
      'div',
      { class: 'table-wrap' },
      el(
        'table',
        { class: 'trend-table' },
        el('thead', null, el('tr', null, el('th', null, '月'), el('th', null, '収入'), el('th', null, '支出'), el('th', null, '残り'))),
        el(
          'tbody',
          null,
          months
            .slice()
            .reverse()
            .map((m) =>
              el(
                'tr',
                null,
                el('td', null, U.formatMonthLabel(m.month)),
                el('td', null, U.formatYen(m.income)),
                el('td', null, U.formatYen(m.expense)),
                el('td', { class: m.balance < 0 ? 'is-minus' : '' }, `${m.balance < 0 ? '−' : ''}${U.formatYen(Math.abs(m.balance))}`)
              )
            )
        )
      )
    );

    return el(
      'section',
      { class: 'card' },
      el('h2', { class: 'card__title' }, `月ごとの推移（直近${TREND_MONTHS}か月）`),
      legend,
      chart,
      table
    );
  }

  function render(container) {
    const month = K.app.state.month;

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

    container.append(monthNav, el('div', { class: 'stack' }, expenseCard(month), incomeCard(month), trendCard(month)));
  }

  K.screens = K.screens || {};
  K.screens.summary = { render };
})();
