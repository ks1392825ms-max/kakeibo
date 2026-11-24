// 「家計簿入力」画面（iPhone のホーム画面からすぐ開く、収入・支出をまとめて入れる画面）
// 1日1件。保存済みの日を開くと、その内容が入っていて直せる。保存は storage.js の saveQuickEntry
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;
  const el = U.el;

  function signed(n) {
    if (n === 0) return '±0';
    return `${n > 0 ? '+' : '−'}${Math.abs(n).toLocaleString('ja-JP')}`;
  }

  function plain(n) {
    return `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('ja-JP')}`;
  }

  // 入力欄の文字を金額にする（空や数字以外は 0）
  function amountOf(input) {
    const n = U.parseAmount(input.value);
    return n === null ? 0 : n;
  }

  // 「-1,000」「−1000」などのマイナスも読む（持ち越し金用）。空なら 0、読めなければ null
  function parseSigned(text) {
    const t = String(text).trim().replace(/^[−ー－]/, '-');
    if (t === '' || t === '-') return 0;
    const minus = t.startsWith('-');
    const n = U.parseAmount(minus ? t.slice(1) : t);
    if (n === null) return null;
    return minus ? -n : n;
  }

  function render(container, params) {
    const state = { date: params.date || U.todayStr(), prevCarry: null, saved: null, snapshot: '' };

    const dateInput = el('input', { type: 'date', class: 'q-date__input', 'aria-label': '日付', value: state.date });
    const dateLabel = el('span');
    const status = el('p', { class: 'q-status' });
    const errorBox = el('p', { class: 'q-error', role: 'alert', hidden: true });

    const out = {
      expSum: el('output', {}, '0'),
      incSum: el('output', {}, '0'),
      prev: el('output', {}, '0'),
      net: el('output', {}, '±0'),
      total: el('output', {}, '0'),
    };

    // 前の記録がないとき（いちばん最初の1回）だけ、前回の持ち越し金を手で入れる
    const openingInput = el('input', {
      class: 'q-carry__opening',
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'off',
      placeholder: '0',
      'aria-label': '前回の持ち越し金（最初の1回だけ入力）',
      oninput: update,
      onfocus: () => openingInput.select(),
      onblur: () => {
        const n = parseSigned(openingInput.value);
        if (n !== null) openingInput.value = n ? plain(n) : '';
        update();
      },
    });

    function buildRows(items, prefix) {
      const inputs = [];
      const rows = items.map((item) => {
        const id = `${prefix}-${item.id}`;
        const input = el('input', {
          id,
          class: 'q-row__input',
          type: 'text',
          inputmode: 'numeric',
          autocomplete: 'off',
          'data-item': item.id,
          oninput: update,
          onfocus: () => input.select(),
          onblur: () => {
            const n = U.parseAmount(input.value);
            if (n !== null) input.value = n ? n.toLocaleString('ja-JP') : '';
            update();
          },
        });
        inputs.push(input);
        return el(
          'div',
          { class: 'q-row' },
          el('label', { class: 'q-row__name', for: id, title: item.note ? `${item.name}（${item.note}）` : item.name }, item.name, item.note ? el('small', {}, item.note) : null),
          input
        );
      });
      return { rows, inputs };
    }

    const exp = buildRows(K.quickItems.expenses, 'q-exp');
    const inc = buildRows(K.quickItems.incomes, 'q-inc');
    const allInputs = [...exp.inputs, ...inc.inputs];

    function sum(inputs) {
      return inputs.reduce((total, input) => {
        const n = amountOf(input);
        input.classList.toggle('has-value', n > 0);
        return total + n;
      }, 0);
    }

    function openingCarry() {
      if (state.prevCarry !== null) return 0;
      const n = parseSigned(openingInput.value);
      return n === null ? 0 : n;
    }

    function update() {
      const expTotal = sum(exp.inputs);
      const incTotal = sum(inc.inputs);
      const net = incTotal - expTotal;
      const prev = state.prevCarry !== null ? state.prevCarry : openingCarry();
      out.expSum.textContent = expTotal.toLocaleString('ja-JP');
      out.incSum.textContent = incTotal.toLocaleString('ja-JP');
      out.prev.textContent = plain(prev);
      out.net.textContent = signed(net);
      out.net.className = net > 0 ? 'is-plus' : net < 0 ? 'is-minus' : '';
      out.total.textContent = plain(prev + net);
    }

    // 今の入力内容（変更があるかを調べるのに使う）
    function currentForm() {
      return JSON.stringify([allInputs.map(amountOf), openingCarry()]);
    }
    const isDirty = () => currentForm() !== state.snapshot;

    // その日の内容を画面に出す（保存済みなら、その金額を入れる）
    function load(date) {
      state.date = date;
      state.saved = K.storage.getQuickEntry(date);
      state.prevCarry = K.storage.getPrevCarry(date);
      dateInput.value = date;
      dateLabel.textContent = U.formatDateLabel(date);
      const amounts = state.saved ? state.saved.amounts : {};
      for (const input of allInputs) {
        const n = amounts[input.dataset.item];
        input.value = n ? n.toLocaleString('ja-JP') : '';
      }
      const opening = state.saved ? state.saved.openingCarry || 0 : 0;
      openingInput.value = opening ? plain(opening) : '';
      out.prev.hidden = state.prevCarry === null;
      openingInput.hidden = state.prevCarry !== null;
      status.textContent = state.saved ? 'この日は保存済みです。直して保存し直せます。' : '';
      errorBox.hidden = true;
      update();
      state.snapshot = currentForm();
    }

    function onDateChange() {
      const next = dateInput.value;
      if (!next || next === state.date) {
        dateInput.value = state.date;
        return;
      }
      if (isDirty() && !window.confirm('入力中の内容は、まだ保存されていません。日付を変えますか？')) {
        dateInput.value = state.date;
        return;
      }
      if (K.storage.getQuickEntry(next) && !window.confirm(`${U.formatDateLabel(next)}の入力は、もう保存されています。開いて直しますか？`)) {
        dateInput.value = state.date;
        return;
      }
      load(next);
    }
    dateInput.addEventListener('change', onDateChange);

    function onSave() {
      errorBox.hidden = true;
      const bad = allInputs.find((input) => input.value.trim() !== '' && U.parseAmount(input.value) === null);
      if (bad) {
        errorBox.textContent = '金額は数字で入力してください。';
        errorBox.hidden = false;
        bad.focus();
        return;
      }
      if (state.prevCarry === null && parseSigned(openingInput.value) === null) {
        errorBox.textContent = '前回の持ち越し金は数字で入力してください。';
        errorBox.hidden = false;
        return;
      }
      const amounts = {};
      for (const input of allInputs) amounts[input.dataset.item] = amountOf(input);
      const wasSaved = Boolean(state.saved);
      try {
        K.storage.saveQuickEntry({ date: state.date, amounts, openingCarry: openingCarry() });
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
        return;
      }
      K.app.toast(wasSaved ? '更新しました' : '保存しました');
      K.app.state.month = state.date.slice(0, 7); // 生活収支表を開いたとき、この月を出す
      load(state.date);
    }

    container.append(
      el(
        'div',
        { class: 'q' },
        el(
          'header',
          { class: 'q-top' },
          el('h1', { class: 'q-top__title', 'aria-label': '家計簿入力' }, 'Kakeibo'),
          el('label', { class: 'q-date' }, dateLabel, el('span', { 'aria-hidden': 'true' }, ' ▾'), dateInput)
        ),
        status,
        el(
          'div',
          { class: 'q-cols' },
          el(
            'section',
            { class: 'q-col q-col--exp', 'aria-label': '支出' },
            el('h2', { class: 'q-col__title' }, '支出'),
            exp.rows,
            el('div', { class: 'q-sum' }, el('span', {}, '支出合計'), out.expSum)
          ),
          el(
            'section',
            { class: 'q-col q-col--inc', 'aria-label': '収入' },
            el('h2', { class: 'q-col__title' }, '収入'),
            inc.rows,
            el('div', { class: 'q-sum' }, el('span', {}, '収入合計'), out.incSum)
          )
        ),
        el(
          'div',
          { class: 'q-carry' },
          el('div', { class: 'q-carry__row' }, el('span', {}, '前回の持ち越し金'), el('span', {}, out.prev, openingInput)),
          el('div', { class: 'q-carry__row' }, el('span', {}, '本日の収支'), out.net),
          el('div', { class: 'q-carry__total' }, el('span', {}, '合計 持ち越し金'), out.total)
        ),
        el(
          'div',
          { class: 'q-dock' },
          errorBox,
          el('button', { type: 'button', class: 'q-save', onclick: onSave }, '保存して生活収支表に反映')
        )
      )
    );

    load(state.date);
  }

  K.screens = K.screens || {};
  K.screens.quick = { render };
})();
