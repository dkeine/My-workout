/* ---------------- TRENDS (Round 3) ----------------
   Two charts, built to the dataviz method: one series color (the app
   primary), text in text tokens, recessive grid, one axis, direct labels
   only where they earn it, tap-for-tooltip, and a data table fallback. */

const CHART_INK = {
  series: 'hsl(var(--primary))',
  grid: 'hsl(var(--muted-foreground) / .18)',
  label: 'hsl(var(--muted-foreground))',
  value: 'hsl(var(--foreground))',
  ref: 'hsl(var(--muted-foreground) / .7)',
};

/* Single-series e1RM line: no legend (the title names the series). */
function lineChartSVG(points, unit) {
  const W = 640, H = 220, padL = 44, padR = 16, padT = 18, padB = 26;
  if (points.length < 2) return null;
  const ys = points.map(p => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi === lo) { hi += 5; lo = Math.max(0, lo - 5); }
  const span = hi - lo;
  lo = Math.max(0, lo - span * 0.15);
  hi = hi + span * 0.15;

  const x = i => padL + (i / (points.length - 1)) * (W - padL - padR);
  const y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  // 3 recessive gridlines with axis values
  let grid = '';
  for (let g = 0; g < 3; g++) {
    const v = lo + ((g + 0.5) / 3) * (hi - lo);
    grid += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="${CHART_INK.grid}" stroke-width="1"/>
      <text x="${padL - 6}" y="${y(v) + 3}" text-anchor="end" font-size="10" fill="${CHART_INK.label}">${Math.round(v)}</text>`;
  }

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');

  // Selective direct labels: first, max, last
  const maxIdx = ys.indexOf(Math.max(...ys));
  const labelled = new Set([0, maxIdx, points.length - 1]);
  let dots = '', labels = '';
  points.forEach((p, i) => {
    if (!labelled.has(i)) return;
    dots += `<circle cx="${x(i)}" cy="${y(p.y)}" r="3.5" fill="${CHART_INK.series}" stroke="hsl(var(--card))" stroke-width="2"/>`;
    const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
    labels += `<text x="${x(i)}" y="${y(p.y) - 9}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="${CHART_INK.value}">${p.y}</text>`;
  });

  // x labels: first + last date only
  const xl = `<text x="${padL}" y="${H - 8}" font-size="10" fill="${CHART_INK.label}">${points[0].label}</text>
    <text x="${W - padR}" y="${H - 8}" text-anchor="end" font-size="10" fill="${CHART_INK.label}">${points[points.length - 1].label}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" data-lo="${lo}" data-hi="${hi}" data-padl="${padL}" data-padr="${padR}" data-padt="${padT}" data-padb="${padB}">
    ${grid}
    <path d="${path}" fill="none" stroke="${CHART_INK.series}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${labels}${xl}
    <circle class="hover-dot" r="4.5" fill="${CHART_INK.series}" stroke="hsl(var(--card))" stroke-width="2" style="display:none"/>
  </svg>`;
}

/* Tap/drag tooltip for the line chart. */
function wireLineChart(container, points, unit) {
  const svg = container.querySelector('svg');
  const tip = container.querySelector('.chart-tip');
  if (!svg || !tip) return;
  const padL = +svg.dataset.padl, padR = +svg.dataset.padr;

  const show = clientX => {
    const rect = svg.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width * 640;
    const inner = Math.min(Math.max(frac, padL), 640 - padR);
    const i = Math.round((inner - padL) / (640 - padL - padR) * (points.length - 1));
    const p = points[i];
    if (!p) return;
    tip.style.display = 'block';
    tip.textContent = `${p.label} — ${p.y}${unit}${p.reps ? ` (${p.w}${unit} × ${p.reps})` : ''}`;
    const dot = svg.querySelector('.hover-dot');
    const x = padL + (i / (points.length - 1)) * (640 - padL - padR);
    const lo = +svg.dataset.lo, hi = +svg.dataset.hi, padT = +svg.dataset.padt, padB = +svg.dataset.padb;
    dot.style.display = 'block';
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', padT + (1 - (p.y - lo) / (hi - lo)) * (220 - padT - padB));
  };
  svg.addEventListener('pointerdown', e => show(e.clientX));
  svg.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') show(e.clientX); });
  svg.addEventListener('pointerleave', () => {
    tip.style.display = 'none';
    svg.querySelector('.hover-dot').style.display = 'none';
  });
}

/* Weekly volume: one bar per muscle, single series; the thin tick is a
   last-week annotation (reference, not a second series). */
function muscleBarsHTML(thisWeek, lastWeek) {
  const muscles = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'other']
    .filter(m => (thisWeek[m] || 0) > 0 || (lastWeek[m] || 0) > 0);
  if (!muscles.length) return null;
  const max = Math.max(...muscles.map(m => Math.max(thisWeek[m] || 0, lastWeek[m] || 0)), 10);

  return muscles.map(m => {
    const v = thisWeek[m] || 0;
    const ref = lastWeek[m] || 0;
    const pct = Math.round(v / max * 100);
    const refPct = Math.round(ref / max * 100);
    return `<div class="vol-row" title="${t('trends.sets', { n: v })}">
      <span class="vol-label">${t('muscle.' + m)}</span>
      <span class="vol-track">
        <span class="vol-fill" style="width:${pct}%"></span>
        ${ref ? `<span class="vol-ref" style="left:${refPct}%"></span>` : ''}
      </span>
      <span class="vol-val">${v}</span>
    </div>`;
  }).join('');
}
