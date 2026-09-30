// どの画面からも使う、小さな便利関数をまとめたファイル
(function () {
  'use strict';
  const K = (window.Kakeibo = window.Kakeibo || {});

  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  // 重ならないID（UUID）を作る。MacとiPhoneで別々に登録してもぶつからない
  function uuid() {
    if (window.crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  // Date → "2026-09-30"
  function toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function todayStr() {
    return toDateStr(new Date());
  }

  // Date → "2026-09"
  function toMonthKey(d) {
    return toDateStr(d).slice(0, 7);
  }

  // "2026-09" を delta か月ずらす
  function shiftMonth(monthKey, delta) {
    const [y, m] = monthKey.split('-').map(Number);
    return toMonthKey(new Date(y, m - 1 + delta, 1));
  }

  // "2026-09" → "2026年9月"
  function formatMonthLabel(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return `${y}年${m}月`;
  }

  // "2026-09-30" → "9月30日(水)"
  function formatDateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const w = WEEKDAYS[new Date(y, m - 1, d).getDay()];
    return `${m}月${d}日(${w})`;
  }

  // 1200 → "1,200円"
  function formatYen(n) {
    return `${n.toLocaleString('ja-JP')}円`;
  }

  // "１,２００円" などを 1200 に変換する。数字でなければ null
  function parseAmount(text) {
    const normalized = String(text)
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/[,，円\s]/g, '');
    if (!/^\d+$/.test(normalized)) return null;
    return Number(normalized);
  }

  // HTML要素を作る関数。文字は textContent として入れるので、メモに記号が入っても安全
  const PROPS = ['value', 'checked', 'disabled', 'hidden'];
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') node.className = value;
        else if (key === 'style' && typeof value === 'object') {
          for (const [name, v] of Object.entries(value)) node.style.setProperty(name, v);
        } else if (key.startsWith('on') && typeof value === 'function') {
          node.addEventListener(key.slice(2), value);
        } else if (PROPS.includes(key)) node[key] = value;
        else node.setAttribute(key, value === true ? '' : value);
      }
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : String(child));
    }
    return node;
  }

  K.utils = {
    uuid,
    nowIso,
    toDateStr,
    todayStr,
    toMonthKey,
    shiftMonth,
    formatMonthLabel,
    formatDateLabel,
    formatYen,
    parseAmount,
    el,
  };
})();
