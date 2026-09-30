// グラフを描く部品（外部のライブラリを使わず、SVGで描く）
(function () {
  'use strict';
  const K = window.Kakeibo;
  const U = K.utils;

  const NS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs, ...children) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value !== null && value !== undefined) node.setAttribute(key, value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  // マウスを乗せたときに出る説明（文字は textContent で入れるので安全）
  function title(text) {
    return svg('title', null, text);
  }

  // 250000 → "25万"、8000 → "8,000"（目盛り用の短い表記）
  function compactYen(n) {
    if (n >= 10000) return `${Number((n / 10000).toFixed(1))}万`;
    return n.toLocaleString('ja-JP');
  }

  // 目盛りの間隔を、きりのよい数（1・2・2.5・5 × 10のn乗）にそろえる
  function niceStep(rough) {
    if (rough <= 0) return 10000;
    const pow = 10 ** Math.floor(Math.log10(rough));
    for (const m of [1, 2, 2.5, 5, 10]) {
      if (m * pow >= rough) return m * pow;
    }
    return 10 * pow;
  }

  // ドーナツグラフ
  // segments: [{ label, value, color }]（6つまで。多い場合は呼ぶ側でまとめる）
  function donut({ segments, centerLabel, centerValue, ariaLabel }) {
    const cx = 100;
    const cy = 100;
    const r = 78;
    const width = 26;
    const gap = 2; // 区切りのすき間
    const circumference = 2 * Math.PI * r;
    const total = segments.reduce((sum, s) => sum + s.value, 0);

    const root = svg('svg', { class: 'donut', viewBox: '0 0 200 200', role: 'img', 'aria-label': ariaLabel });
    root.append(svg('circle', { class: 'donut__track', cx, cy, r, fill: 'none', 'stroke-width': width }));

    const visible = segments.filter((s) => s.value > 0);
    let offset = 0;
    for (const s of visible) {
      const length = (s.value / total) * circumference;
      const dash = visible.length === 1 ? circumference : Math.max(length - gap, 0.5);
      const pct = Math.round((s.value / total) * 100);
      root.append(
        svg(
          'circle',
          {
            class: 'donut__seg',
            cx,
            cy,
            r,
            fill: 'none',
            stroke: s.color,
            'stroke-width': width,
            'stroke-dasharray': `${dash} ${circumference - dash}`,
            'stroke-dashoffset': -offset,
            transform: `rotate(-90 ${cx} ${cy})`,
          },
          title(`${s.label} ${U.formatYen(s.value)}（${pct}%）`)
        )
      );
      offset += length;
    }

    root.append(
      svg('text', { class: 'donut__label', x: cx, y: cy - 8, 'text-anchor': 'middle' }, centerLabel),
      svg('text', { class: 'donut__value', x: cx, y: cy + 16, 'text-anchor': 'middle' }, centerValue)
    );
    return root;
  }

  // 上が丸い（4px）、下が四角い縦棒の形
  function barPath(x, y, w, h) {
    const r = Math.min(4, h, w / 2);
    const bottom = y + h;
    return `M${x},${bottom}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${bottom}Z`;
  }

  // 月ごとの縦棒グラフ（2系列を並べる）
  // groups: [{ label, values: { income: 1000, expense: 800 } }]
  // series: [{ key, label, className }]
  function columns({ groups, series, ariaLabel }) {
    const W = 320;
    const H = 190;
    const left = 36;
    const right = 4;
    const top = 10;
    const bottom = 24;
    const baseline = H - bottom;
    const plotH = baseline - top;

    const max = Math.max(0, ...groups.flatMap((g) => series.map((s) => g.values[s.key])));
    const step = niceStep(max / 4);
    const ticks = Math.max(1, Math.ceil(max / step));
    const scaleMax = step * ticks;
    const y = (v) => baseline - (v / scaleMax) * plotH;

    const root = svg('svg', { class: 'columns', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': ariaLabel });

    // 横の目盛り線と数字
    for (let i = 0; i <= ticks; i++) {
      const v = step * i;
      root.append(
        svg('line', { class: 'columns__grid', x1: left, x2: W - right, y1: y(v), y2: y(v) }),
        svg('text', { class: 'columns__tick', x: left - 6, y: y(v) + 3.5, 'text-anchor': 'end' }, compactYen(v))
      );
    }

    const band = (W - left - right) / groups.length;
    const barGap = 2;
    const barW = Math.min(20, (band - 14 - barGap) / series.length);
    const pairW = barW * series.length + barGap * (series.length - 1);

    groups.forEach((g, gi) => {
      const x0 = left + band * gi + (band - pairW) / 2;
      series.forEach((s, si) => {
        const v = g.values[s.key];
        const x = x0 + si * (barW + barGap);
        const h = baseline - y(v);
        const tip = `${g.label} ${s.label} ${U.formatYen(v)}`;
        // 棒が短くてもマウスを当てやすいように、透明な当たり判定を重ねる
        root.append(
          svg('g', { class: 'columns__bar' },
            h > 0 ? svg('path', { class: s.className, d: barPath(x, y(v), barW, h) }) : null,
            svg('rect', { class: 'columns__hit', x: x - 1, y: top, width: barW + 2, height: plotH }),
            title(tip)
          )
        );
      });
      root.append(svg('text', { class: 'columns__tick', x: left + band * gi + band / 2, y: H - 6, 'text-anchor': 'middle' }, g.label));
    });

    return root;
  }

  K.charts = { donut, columns };
})();
