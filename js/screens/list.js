// 明細一覧画面（月ごとの記録を日付順に表示する）
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;
  const el = U.el;

  const FILTERS = [
    ['all', 'すべて'],
    ['income', '収入'],
    ['fixed', '固定費'],
    ['variable', '変動費'],
  ];
  const BADGE_LABELS = { income: '収入', fixed: '固定', variable: '変動' };

  // 月を切り替えても、選んだ絞り込みは残す
  let filter = 'all';

  // 記録が「収入・固定費・変動費」のどれに当たるかは、カテゴリーから決める
  function groupOf(tx, category) {
    if (category) return category.group;
    return tx.type === 'income' ? 'income' : 'variable';
  }

  function renderItem(tx) {
    const category = K.storage.getCategory(tx.categoryId);
    const group = groupOf(tx, category);
    const sign = tx.type === 'income' ? '+' : '−';

    return el(
      'li',
      null,
      el(
        'button',
        { type: 'button', class: 'tx', onclick: () => K.app.navigate('input', { editId: tx.id }) },
        el('span', {
          class: 'tx__dot',
          'aria-hidden': 'true',
          style: { background: category ? category.color : '#999' },
        }),
        el(
          'span',
          { class: 'tx__main' },
          el(
            'span',
            { class: 'tx__name' },
            category ? category.name : '（不明なカテゴリー）',
            el('span', { class: `badge badge--${group}` }, BADGE_LABELS[group])
          ),
          tx.memo ? el('span', { class: 'tx__memo' }, tx.memo) : null
        ),
        el('span', { class: `tx__amount tx__amount--${tx.type}` }, sign + U.formatYen(tx.amount))
      )
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

    const filterBar = el(
      'div',
      { class: 'chips chips--filter', role: 'group', 'aria-label': '絞り込み' },
      FILTERS.map(([key, label]) =>
        el(
          'button',
          {
            type: 'button',
            class: `chip chip--filter${filter === key ? ' is-selected' : ''}`,
            'aria-pressed': String(filter === key),
            onclick: () => {
              filter = key;
              K.app.rerender();
            },
          },
          label
        )
      )
    );

    container.append(monthNav, filterBar);

    const transactions = K.storage
      .getTransactions({ month })
      .filter((tx) => filter === 'all' || groupOf(tx, K.storage.getCategory(tx.categoryId)) === filter);

    if (transactions.length === 0) {
      container.append(
        el(
          'div',
          { class: 'empty' },
          el('p', null, filter === 'all' ? 'この月の記録はまだありません。' : '該当する記録はありません。'),
          el('button', { type: 'button', class: 'btn btn--primary', onclick: () => K.app.navigate('input') }, '入力する')
        )
      );
      return;
    }

    // 日付ごとにまとめる
    const byDate = new Map();
    for (const tx of transactions) {
      if (!byDate.has(tx.date)) byDate.set(tx.date, []);
      byDate.get(tx.date).push(tx);
    }

    for (const [date, items] of byDate) {
      container.append(
        el(
          'section',
          { class: 'day' },
          el('h3', { class: 'day__title' }, U.formatDateLabel(date)),
          el('ul', { class: 'tx-list' }, items.map(renderItem))
        )
      );
    }
  }

  K.screens = K.screens || {};
  K.screens.list = { render };
})();
