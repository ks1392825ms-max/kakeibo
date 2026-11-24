// 「家計簿入力」画面の項目（名前と順番は決まったものなので変えない）
// id は保存に使う目印。あとから名前の表示を変えても、過去の記録とつながるように固定にしておく
(function () {
  'use strict';
  const K = (window.Kakeibo = window.Kakeibo || {});

  K.quickItems = {
    // 支出（赤）
    expenses: [
      { id: 'q_exp_total', name: '総合計', note: '楽天・北洋引き落とし' },
      { id: 'q_exp_sapporo_rent', name: '札幌家賃' },
      { id: 'q_exp_school_fee', name: '学校徴収金' },
      { id: 'q_exp_food', name: '食費' },
      { id: 'q_exp_kendo_taiko', name: '剣道＆太鼓' },
      { id: 'q_exp_inline', name: 'インライン' },
      { id: 'q_exp_highschool_savings', name: '高校貯金（郵貯）' },
      { id: 'q_exp_mediation_fee', name: '調停訴訟報酬金支払い' },
    ],
    // 収入（青）
    incomes: [
      { id: 'q_inc_isharyo', name: '慰謝料' },
      { id: 'q_inc_nagazaifu', name: '長財布' },
      { id: 'q_inc_tomakomai_shinkin', name: '苫小牧信用金庫' },
      { id: 'q_inc_hokuyo', name: '北洋' },
      { id: 'q_inc_chunan_shonan_taira_yucho', name: '中南・湘南・平・郵貯' },
      { id: 'q_inc_teiki', name: '定期' },
      { id: 'q_inc_saifu', name: '財布' },
      { id: 'q_inc_sara_yucho', name: '教育（郵貯）' },
      { id: 'q_inc_paypay', name: 'PayPay' },
      { id: 'q_inc_child_support', name: '児童扶養手当' },
      { id: 'q_inc_child_allowance', name: '児童手当' },
    ],
  };
})();
