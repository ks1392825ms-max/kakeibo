// アプリの起動と、画面の切り替えを担当するファイル
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;

  const SCREEN_TITLES = { home: 'ホーム', input: '入力', list: '明細', summary: '集計', balance: '残り', settings: '設定' };

  const state = {
    screen: 'home',
    params: {},
    month: U.toMonthKey(new Date()), // 表示している月（ホーム・明細・集計で共通）
  };

  function render() {
    const container = document.getElementById('screen');
    container.replaceChildren();

    const title = state.screen === 'input' && state.params.editId ? '編集' : SCREEN_TITLES[state.screen];
    document.getElementById('screen-title').textContent = title;
    document.title = `${title} | 家計簿`;

    for (const btn of document.querySelectorAll('.bottom-nav__btn')) {
      const active = btn.dataset.screen === state.screen;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }

    // 右下の［＋］ボタンは、入力画面以外で表示する
    document.getElementById('fab').hidden = state.screen === 'input';

    K.screens[state.screen].render(container, state.params);
  }

  function navigate(screen, params = {}) {
    state.screen = screen;
    state.params = params;
    if (params.month) state.month = params.month;
    render();
    window.scrollTo(0, 0);
  }

  function setMonth(month) {
    state.month = month;
    render();
  }

  let toastTimer = null;
  function toast(message) {
    const box = document.getElementById('toast');
    box.textContent = message;
    box.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('is-visible'), 1800);
  }

  function start() {
    const result = K.storage.init();
    if (!result.ok) {
      document.getElementById('screen').replaceChildren(U.el('p', { class: 'fatal', role: 'alert' }, result.message));
      return;
    }

    for (const btn of document.querySelectorAll('.bottom-nav__btn')) {
      btn.addEventListener('click', () => navigate(btn.dataset.screen));
    }
    document.getElementById('fab').addEventListener('click', () => navigate('input'));
    navigate('home');
  }

  K.app = { state, navigate, setMonth, rerender: render, toast };

  document.addEventListener('DOMContentLoaded', start);
})();
