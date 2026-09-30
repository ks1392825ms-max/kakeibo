// 集計の計算を担当するファイル
// 画面のファイルは、合計や残りを自分で計算せず、ここの関数を使う。
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;

  function emptySummary(month) {
    return { month, income: 0, expense: 0, fixed: 0, variable: 0, balance: 0 };
  }

  // 記録が「収入・固定費・変動費」のどれに当たるかは、カテゴリーから決める
  function groupOf(tx) {
    const category = K.storage.getCategory(tx.categoryId);
    if (category) return category.group;
    return tx.type === 'income' ? 'income' : 'variable';
  }

  function addTo(summary, tx) {
    if (tx.type === 'income') {
      summary.income += tx.amount;
    } else {
      summary.expense += tx.amount;
      if (groupOf(tx) === 'fixed') summary.fixed += tx.amount;
      else summary.variable += tx.amount;
    }
    summary.balance = summary.income - summary.expense;
  }

  // 1か月分の集計
  // 戻り値：{ month, income（収入）, expense（支出）, fixed（固定費）, variable（変動費）, balance（残り） }
  function monthlySummary(month) {
    const summary = emptySummary(month);
    for (const tx of K.storage.getTransactions({ month })) addTo(summary, tx);
    return summary;
  }

  // 記録のある最初の月から untilMonth までの、月ごとの集計（古い順）
  // それぞれに cumulative（累計の残り）が付く。記録がない月も 0円 として含める。
  // untilMonth を省略すると「今月」と「最後に記録がある月」の遅いほうまで。
  function monthlyHistory(untilMonth) {
    const transactions = K.storage.getTransactions();
    if (transactions.length === 0) return [];

    const byMonth = new Map();
    let first = null;
    let last = null;
    for (const tx of transactions) {
      const month = tx.date.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, emptySummary(month));
      addTo(byMonth.get(month), tx);
      if (!first || month < first) first = month;
      if (!last || month > last) last = month;
    }

    const current = U.toMonthKey(new Date());
    const end = untilMonth || (last > current ? last : current);

    const rows = [];
    let cumulative = 0;
    for (let month = first; month <= end; month = U.shiftMonth(month, 1)) {
      const summary = byMonth.get(month) || emptySummary(month);
      cumulative += summary.balance;
      rows.push({ ...summary, cumulative });
    }
    return rows;
  }

  // 記録を始めた月から month までの、残りの累計
  function cumulativeUntil(month) {
    const rows = monthlyHistory(month);
    return rows.length ? rows[rows.length - 1].cumulative : 0;
  }

  // 1か月分のカテゴリー別の集計（金額の大きい順）
  // scope：'expense'（支出全体）/ 'fixed'（固定費）/ 'variable'（変動費）/ 'income'（収入）
  // 戻り値：{ total, rows: [{ categoryId, name, color, deleted, amount, ratio（割合 0〜1） }] }
  function categoryBreakdown(month, scope) {
    const amounts = new Map();
    for (const tx of K.storage.getTransactions({ month })) {
      const matches = scope === 'expense' ? tx.type === 'expense' : groupOf(tx) === scope;
      if (!matches) continue;
      amounts.set(tx.categoryId, (amounts.get(tx.categoryId) || 0) + tx.amount);
    }

    const total = [...amounts.values()].reduce((sum, n) => sum + n, 0);
    const rows = [...amounts].map(([categoryId, amount]) => {
      const category = K.storage.getCategory(categoryId);
      return {
        categoryId,
        name: category ? category.name : '（不明なカテゴリー）',
        color: category ? category.color : '#9aa0a6',
        deleted: category ? category.deleted : false,
        amount,
        ratio: total ? amount / total : 0,
      };
    });
    rows.sort((a, b) => b.amount - a.amount);
    return { total, rows };
  }

  // untilMonth までの直近 count か月の集計（古い順）。記録がない月も 0円 として含める
  function recentMonths(untilMonth, count) {
    const rows = [];
    for (let i = count - 1; i >= 0; i--) {
      rows.push(monthlySummary(U.shiftMonth(untilMonth, -i)));
    }
    return rows;
  }

  K.calc = {
    groupOf,
    monthlySummary,
    monthlyHistory,
    cumulativeUntil,
    categoryBreakdown,
    recentMonths,
  };
})();
