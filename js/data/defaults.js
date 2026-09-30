// 初めて起動したときに登録される、初期カテゴリー
// id は固定の文字列にしておく（MacとiPhoneで同じカテゴリーとして扱えるように）
// group: income = 収入 / fixed = 固定費 / variable = 変動費
(function () {
  'use strict';
  const K = (window.Kakeibo = window.Kakeibo || {});

  K.defaults = {
    categories: [
      // 収入
      { id: 'inc_salary', name: '給与', group: 'income', color: '#2e9e6b' },
      { id: 'inc_child_allowance', name: '児童扶養手当', group: 'income', color: '#3fb6a8' },
      { id: 'inc_side', name: '副収入', group: 'income', color: '#5b8def' },
      { id: 'inc_other', name: 'その他', group: 'income', color: '#8e9aaf' },

      // 固定費
      { id: 'fix_rent', name: '家賃', group: 'fixed', color: '#7a5af8' },
      { id: 'fix_insurance', name: '保険', group: 'fixed', color: '#9b6bd3' },
      { id: 'fix_phone', name: '通信費', group: 'fixed', color: '#4c6ef5' },
      { id: 'fix_subscription', name: 'サブスク', group: 'fixed', color: '#d16ba5' },
      { id: 'fix_education', name: '教育費', group: 'fixed', color: '#3d8bd9' },
      { id: 'fix_other', name: 'その他', group: 'fixed', color: '#8e8aa8' },

      // 変動費
      { id: 'var_food', name: '食費', group: 'variable', color: '#f08c3a' },
      { id: 'var_daily', name: '日用品', group: 'variable', color: '#e0ad3a' },
      { id: 'var_utilities', name: '水道光熱費', group: 'variable', color: '#4db6d0' },
      { id: 'var_medical', name: '医療費', group: 'variable', color: '#e5616e' },
      { id: 'var_beauty', name: '美容', group: 'variable', color: '#e678b4' },
      { id: 'var_transport', name: '交通費', group: 'variable', color: '#6c9bd2' },
      { id: 'var_leisure', name: 'レジャー', group: 'variable', color: '#52b788' },
      { id: 'var_kids', name: '子ども', group: 'variable', color: '#f4a261' },
      { id: 'var_pet', name: 'ペット', group: 'variable', color: '#b08968' },
      { id: 'var_other', name: 'その他', group: 'variable', color: '#9aa0a6' },
    ],
  };
})();
