// 入力画面（新しく登録する／明細から開いて編集・削除する）
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;
  const el = U.el;

  const GROUP_LABELS = { income: '収入', fixed: '固定費', variable: '変動費' };

  // 続けて入力するときのために、最後に選んだ「支出／収入」を覚えておく
  let lastType = 'expense';

  function render(container, params) {
    const editing = params.editId ? K.storage.getTransaction(params.editId) : null;
    if (params.editId && !editing) {
      container.append(el('p', { class: 'empty' }, 'この記録は見つかりませんでした。'));
      return;
    }

    const state = {
      type: editing ? editing.type : lastType,
      categoryId: editing ? editing.categoryId : null,
    };

    const typeButtons = ['expense', 'income'].map((type) =>
      el(
        'button',
        { type: 'button', class: 'segment__btn', 'data-type': type, onclick: () => setType(type) },
        type === 'expense' ? '支出' : '収入'
      )
    );

    const amountInput = el('input', {
      id: 'amount',
      class: 'amount-input',
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'off',
      placeholder: '0',
      value: editing ? editing.amount.toLocaleString('ja-JP') : '',
      onblur: () => {
        const n = U.parseAmount(amountInput.value);
        if (n !== null) amountInput.value = n.toLocaleString('ja-JP');
      },
    });

    const dateInput = el('input', {
      id: 'date',
      class: 'field__input',
      type: 'date',
      value: editing ? editing.date : U.todayStr(),
    });

    const memoInput = el('input', {
      id: 'memo',
      class: 'field__input',
      type: 'text',
      maxlength: '100',
      placeholder: '例：スーパー',
      value: editing ? editing.memo : '',
    });

    const categoryArea = el('div', { class: 'category-area' });
    const errorBox = el('p', { class: 'form-error', role: 'alert', hidden: true });

    function updateTypeButtons() {
      for (const btn of typeButtons) {
        const selected = btn.dataset.type === state.type;
        btn.classList.toggle('is-selected', selected);
        btn.setAttribute('aria-pressed', String(selected));
      }
    }

    // 削除したカテゴリーの過去の記録を編集するときは、そのカテゴリーも「（削除済み）」として出す
    function categoriesFor(group) {
      const list = K.storage.getCategories({ group });
      const current = state.categoryId ? K.storage.getCategory(state.categoryId) : null;
      if (current && current.deleted && current.group === group) {
        list.push({ ...current, name: `${current.name}（削除済み）` });
      }
      return list;
    }

    function renderCategories() {
      const groups = state.type === 'income' ? ['income'] : ['fixed', 'variable'];
      categoryArea.replaceChildren(
        ...groups.map((group) =>
          el(
            'div',
            { class: 'category-group' },
            el('p', { class: 'category-group__title' }, GROUP_LABELS[group]),
            el(
              'div',
              { class: 'chips' },
              categoriesFor(group).map((c) => {
                const selected = c.id === state.categoryId;
                return el(
                  'button',
                  {
                    type: 'button',
                    class: `chip${selected ? ' is-selected' : ''}`,
                    'aria-pressed': String(selected),
                    style: { '--chip-color': c.color },
                    onclick: () => {
                      state.categoryId = c.id;
                      renderCategories();
                    },
                  },
                  c.name
                );
              })
            )
          )
        )
      );
    }

    function setType(type) {
      if (state.type === type) return;
      state.type = type;
      state.categoryId = null;
      if (!editing) lastType = type;
      updateTypeButtons();
      renderCategories();
    }

    function showError(message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    }

    function onSubmit(event) {
      event.preventDefault();
      errorBox.hidden = true;

      const amount = U.parseAmount(amountInput.value);
      const errors = [];
      if (amount === null || amount <= 0) errors.push('金額を1円以上の数字で入力してください。');
      if (!dateInput.value) errors.push('日付を入力してください。');
      if (!state.categoryId) errors.push('カテゴリーを選んでください。');
      if (errors.length) {
        showError(errors.join('\n'));
        return;
      }

      const fields = {
        type: state.type,
        amount,
        date: dateInput.value,
        categoryId: state.categoryId,
        memo: memoInput.value,
      };

      try {
        if (editing) {
          K.storage.updateTransaction(editing.id, fields);
          K.app.toast('更新しました');
          K.app.navigate('list', { month: fields.date.slice(0, 7) });
        } else {
          K.storage.addTransaction(fields);
          K.app.toast('保存しました');
          // 日付と「支出／収入」はそのまま残し、続けて入力しやすくする
          amountInput.value = '';
          memoInput.value = '';
          state.categoryId = null;
          renderCategories();
          amountInput.focus();
        }
      } catch (err) {
        showError(err.message);
      }
    }

    function onDelete() {
      if (!window.confirm('この記録を削除しますか？')) return;
      try {
        K.storage.deleteTransaction(editing.id);
        K.app.toast('削除しました');
        K.app.navigate('list', { month: editing.date.slice(0, 7) });
      } catch (err) {
        showError(err.message);
      }
    }

    const actions = editing
      ? [
          el('button', { type: 'submit', class: 'btn btn--primary' }, '更新する'),
          el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => K.app.navigate('list') }, 'キャンセル'),
          el('button', { type: 'button', class: 'btn btn--danger', onclick: onDelete }, 'この記録を削除'),
        ]
      : [el('button', { type: 'submit', class: 'btn btn--primary' }, '保存する')];

    const form = el(
      'form',
      { class: 'card', novalidate: true, onsubmit: onSubmit },
      el('div', { class: 'segment', role: 'group', 'aria-label': '収入か支出か' }, typeButtons),

      el(
        'div',
        { class: 'field' },
        el('label', { class: 'field__label', for: 'amount' }, '金額'),
        el('div', { class: 'amount-wrap' }, amountInput, el('span', { class: 'amount-unit' }, '円'))
      ),

      el('div', { class: 'field' }, el('label', { class: 'field__label', for: 'date' }, '日付'), dateInput),

      el('div', { class: 'field' }, el('p', { class: 'field__label' }, 'カテゴリー'), categoryArea),

      el('div', { class: 'field' }, el('label', { class: 'field__label', for: 'memo' }, 'メモ（任意）'), memoInput),

      errorBox,
      el('div', { class: 'actions' }, actions)
    );

    updateTypeButtons();
    renderCategories();
    container.append(form);
  }

  K.screens = K.screens || {};
  K.screens.input = { render };
})();
