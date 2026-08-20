/* ---------------- MAIN APP CONTROLLER ---------------- */

/* User & imported content is rendered via innerHTML — escape it. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let planMode = 'view';   // view | library | edit
let pendingPlan = null;  // decoded plan from an incoming share link

function render() {
    const v = document.getElementById('view');
    v.className = 'fade';
    if (pendingPlan) renderCover(v);
    else if (currentTab === 'today') renderToday(v);
    else if (currentTab === 'plan') renderPlanTab(v);
    else if (currentTab === 'history') renderHistory(v);
    else if (currentTab === 'settings') renderSettings(v);

    v.classList.remove('fade');
    void v.offsetWidth;
    v.classList.add('fade');
  }

  /* ---- TODAY ---- */
  let todaySession = null;
  let todayPrev = {};
  let todayGhost = {};
  let saveTimer = null;
  let wasComplete = false;

  function persistToday() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => putSession(todaySession.date, todaySession), 400);
  }

  function updateProgress() {
    recompute(todaySession);
    const p = todaySession.total_count ? todaySession.completed_count / todaySession.total_count : 0;

    const circleEl = document.getElementById('today-ring-circle');
    const textEl = document.getElementById('today-ring-text');

    if (circleEl && textEl) {
      const size = 56;
      const stroke = 5;
      const r = (size - stroke) / 2;
      const c = 2 * Math.PI * r;
      const off = c - Math.min(Math.max(p, 0), 1) * c;
      circleEl.style.strokeDashoffset = off;
      textEl.textContent = Math.round(p * 100);
    } else {
      const ring = document.getElementById('today-ring');
      if (ring) ring.innerHTML = ringWithLabel(p, 56, 5, 'hsl(var(--primary))');
    }

    const cnt = document.getElementById('today-count');
    if (cnt) cnt.textContent = t('today.count', { done: todaySession.completed_count, total: todaySession.total_count });

    const banner = document.getElementById('complete-banner');
    if (banner) banner.style.display = todaySession.completed ? 'flex' : 'none';

    if (todaySession.completed && !wasComplete) {
      wasComplete = true;
      toast(t('today.crushed'), t('today.crushedSub'));
      releaseWakeLock();
      const pill = document.getElementById('rest-pill');
      if (pill) pill.remove();
      const total = computeStats().total;
      if (total > 0 && total % 10 === 0) {
        setTimeout(() => toast(t('settings.backupNudge', { n: total }), t('settings.backupNudgeSub')), 3600);
      }
    }
    if (!todaySession.completed) wasComplete = false;
  }

  /* Keep the screen awake mid-session — phones sleep, sets don't (v2). */
  let wakeLock = null;
  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) {}
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  function syncWakeLock() {
    const wantLock = currentTab === 'today' && todaySession &&
      todaySession.exercises.length > 0 && !todaySession.completed &&
      document.visibilityState === 'visible';
    if (wantLock && !wakeLock) requestWakeLock();
    else if (!wantLock) releaseWakeLock();
  }

  document.addEventListener('visibilitychange', () => syncWakeLock());

  function summaryStr(prev) {
    if (!prev || !prev.sets.length) return null;
    const u = getUnit();
    return prev.sets.map(s => `${s.weight != null ? s.weight + u : '—'}×${s.reps != null ? s.reps : '—'}`).join('  ·  ');
  }

  function relDay(iso) {
    const then = new Date(iso + 'T00:00:00');
    const now = new Date();
    const days = Math.round((now.setHours(0, 0, 0, 0) - then.setHours(0, 0, 0, 0)) / 864e5);
    if (days <= 0) return t('today.today');
    if (days === 1) return t('today.yesterday');
    if (days < 7) return t('today.daysAgo', { n: days });
    return then.toLocaleDateString(getLang(), { month: 'short', day: 'numeric' });
  }

  function sessionHasProgress(s) {
    return (s.exercises || []).some(e => e.done || e.skipped ||
      (e.sets || []).some(st => st.done || st.weight != null || st.reps != null));
  }

  function renderToday(v) {
    const wd = weekdayIndex();
    const date = todayStr();
    const plan = getActivePlan();
    const day = plan.days[wd];
    const saved = getSession(date);

    // Reuse today's saved session unless it's empty, or it came from
    // another plan and has no logged progress yet (plan switched today).
    const reusable = saved && saved.exercises && saved.exercises.length &&
      (saved.planId === plan.id || sessionHasProgress(saved));
    todaySession = reusable ? saved : buildSession(wd, date);
    recompute(todaySession);
    wasComplete = todaySession.completed;
    todayPrev = getPrevious(date);
    todayGhost = getGhostPrevious(date);

    const isRest = todaySession.exercises.length === 0;
    const p = todaySession.total_count ? todaySession.completed_count / todaySession.total_count : 0;

    let html = `<div class="hero">
      <img src="${COVER(day.muscle)}" alt=""/><div class="ov"></div>
      <div class="top">
        <div><div class="eyebrow">${esc(dayName(wd))}</div><div class="muted" style="font-size:12px;margin-top:4px;font-weight:600">${esc(day.focus)}</div></div>
        ${isRest ? '' : `<div class="ring-wrap" id="today-ring">${ringWithLabel(p, 56, 5, 'hsl(var(--primary))')}</div>`}
      </div>
      <div class="bot"><h1 class="display">${esc(todaySession.title)}</h1>
        ${isRest ? '' : `<div id="today-count" style="color:rgba(255,255,255,.8);font-size:14px;font-weight:600;margin-top:8px">${t('today.count', { done: todaySession.completed_count, total: todaySession.total_count })}</div>`}
      </div>
    </div><div class="px" style="margin-top:24px">`;

    if (isRest) {
      html += `<div style="text-align:center;padding:64px 0" class="fade">
        <div style="color:hsl(var(--primary));display:flex;justify-content:center;margin-bottom:16px">${icon('flame', 48)}</div>
        <h2 class="display" style="font-size:36px;text-transform:uppercase">${t('today.restHeadline')}</h2>
        <p class="muted" style="font-size:14px;margin-top:8px;max-width:280px;margin-left:auto;margin-right:auto">${t('today.restCopy')}</p>
      </div>`;
    } else {
      html += `<div id="complete-banner" class="banner" style="display:${todaySession.completed ? 'flex' : 'none'}">
        <span style="color:hsl(var(--success))">${icon('trophy', 24)}</span>
        <div><div class="t">${t('today.sessionComplete')}</div><div class="s">${t('today.sessionCompleteSub')}</div></div></div>`;

      // P1: one tap before the first set — the body gets a vote
      if (getReadiness() == null && !todaySession.completed) {
        html += `<div class="ready-card" id="ready-card">
          <div class="ready-ask">${t('ready.ask')}</div>
          <div class="ready-row">
            <button class="ready-btn" data-r="-1">${t('ready.rough')}</button>
            <button class="ready-btn" data-r="0">${t('ready.normal')}</button>
            <button class="ready-btn" data-r="1">${t('ready.primed')}</button>
          </div>
        </div>`;
      }

      // P3: something beats nothing
      if (!todaySession.completed) {
        const parked = todaySession.exercises.some(e => e.parked);
        html += `<div class="btnrow" style="margin-bottom:14px">
          <button class="btn-sm ${parked ? 'primary' : ''}" id="btn-mvs">${icon('timer', 15)} ${parked ? t('mvs.undo') : t('mvs.cut')}</button>
        </div>`;
      }
      html += `<div class="stack" id="ex-list"></div>`;
    }
    html += `</div>`;
    v.innerHTML = html;
    if (!isRest) buildCards();
    syncWakeLock();

    v.querySelectorAll('.ready-btn').forEach(b => {
      b.onclick = () => {
        const r = +b.dataset.r;
        setReadiness(r);
        render();
        toast(t('ready.set'), r < 0 ? t('ready.rougSub') : r > 0 ? t('ready.primedSub') : '');
      };
    });

    const mvsBtn = document.getElementById('btn-mvs');
    if (mvsBtn) mvsBtn.onclick = () => {
      const parked = todaySession.exercises.some(e => e.parked);
      if (parked) {
        todaySession.exercises.forEach(e => {
          if (e.parked) { e.parked = false; e.skipped = false; e.done = (e.sets || []).length ? e.sets.every(s => s.done) : e.done; }
        });
        recompute(todaySession);
        putSession(todaySession.date, todaySession);
        render();
        toast(t('mvs.restored'));
        return;
      }
      const plan = minimumViableSession(todaySession, 20);
      plan.cut.forEach(i => {
        const e = todaySession.exercises[i];
        e.parked = true;
        e.skipped = true;
        e.done = true;
      });
      recompute(todaySession);
      putSession(todaySession.date, todaySession);
      render();
      toast(t('mvs.done', { n: plan.minutes }), t('mvs.doneSub', { c: plan.cut.length }));
    };
  }

  function fillFirstOpenSet(exr, weight, reps, card) {
    const target = (exr.sets || []).find(st => !st.done);
    if (!target) return false;
    target.weight = weight;
    target.reps = reps;
    target.done = true;
    exr.done = exr.sets.every(s => s.done);
    updateProgress();
    persistToday();
    buildCards();
    return true;
  }

  function buildCards() {
    const list = document.getElementById('ex-list');
    if (!list) return;
    list.innerHTML = '';
    const ghostStore = getGhost();

    todaySession.exercises.forEach((exr, i) => {
      const el = document.createElement('div');
      if (exr.kind === 'break') {
        el.innerHTML = `<button class="breakbtn">${icon('timer', 16)} ${t('today.startTimer')}</button>`;
        el.querySelector('button').onclick = openTimer;
        list.appendChild(el);
        return;
      }
      const simple = exr.kind === 'cardio';
      const prev = todayPrev[exr.name];
      const summ = summaryStr(prev);
      const ghost = ghostStore && todayGhost[exr.name] ? summaryStr(todayGhost[exr.name]) : null;
      const live = !simple && !exr.skipped && !exr.done;
      const comeback = live ? comebackFor(exr.name) : null;
      const coach = live && !comeback ? applyReadiness(coachSuggestion(exr), getReadiness()) : null;

      el.className = 'card' + (exr.skipped ? ' skipped' : exr.done ? ' done' : '');
      el.dataset.idx = i;

      const showMic = !simple && !exr.skipped && voiceAvailable();
      // Warming up is about load relative to capacity, not the implement —
      // offer it for anything you've ever put weight on.
      const showWarmup = !simple && !exr.skipped &&
        (isBarbellLift(exr.name) || (prev && prev.sets.some(s => s.weight != null)));
      let inner = `
        <div class="ex-head" style="justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <span style="color:${exr.skipped ? 'hsl(var(--muted-foreground))' : exr.done ? 'hsl(var(--success))' : 'hsl(var(--primary))'}">
              ${icon(simple ? 'waves' : 'dumbbell', 16)}
            </span>
            <div style="min-width:0"><div class="ex-name">${esc(exr.name)}</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            ${showWarmup ? `<button class="mic-btn warmup-btn" type="button" title="${t('warmup.title')}" aria-label="${t('warmup.title')}">${icon('layers', 16)}</button>` : ''}
            ${showMic ? `<button class="mic-btn" type="button" title="${t('voice.mic')}" aria-label="${t('voice.mic')}">${icon('mic', 16)}</button>` : ''}
            <button class="skip-btn ${exr.skipped ? 'on' : ''}" type="button">
              ${exr.skipped ? t('today.skipped') : t('today.skip')}
            </button>
          </div>
        </div>
        <div class="ex-target">${esc(exr.target)}</div>
      `;

      if (comeback) {
        const u = getUnit();
        inner += `<button class="coach-chip comeback" type="button" data-w="${comeback.weight}">${icon('heart', 13)}<span>${esc(t('comeback.title', { d: comeback.days, w: comeback.weight, u }))}</span></button>`;
      } else if (coach) {
        const u = getUnit();
        let msg = coach.type === 'increase' ? t('coach.increase', { w: coach.weight, u })
          : coach.type === 'deload' ? t('coach.deload', { w: coach.weight, u })
          : coach.reps ? t('coach.hold', { r: coach.reps })
          : t('coach.holdFlat', { w: coach.weight, u });
        if (coach.damped) msg += ` — ${t('ready.damped')}`;
        if (coach.boosted) msg += ` — ${t('ready.boosted')}`;
        inner += `<button class="coach-chip ${coach.type}" type="button" data-w="${coach.weight}">${icon(coach.type === 'deload' ? 'chevronDown' : 'flame', 13)}<span>${esc(msg)}</span></button>`;
      }
      if (summ && !exr.skipped) {
        inner += `<div class="prev-hint">${icon('trendingUp', 14)}<span>${t('today.last', { when: relDay(prev.date) })} <span class="v">${esc(summ)}</span></span></div>`;
      }
      if (ghost && !exr.skipped) {
        inner += `<div class="ghost-hint">${icon('ghost', 14)}<span>${esc(ghostStore.label)}: <span class="v">${esc(ghost)}</span> — ${t('today.beatIt')}</span></div>`;
      }

      if (simple) {
        inner += `<button class="simplebtn ${exr.done && !exr.skipped ? 'on' : ''}" ${exr.skipped ? 'disabled' : ''}>
          ${icon('check', 20)} ${exr.skipped ? t('today.skipped') : exr.done ? t('today.completed') : t('today.markDone')}
        </button>`;
        el.innerHTML = inner;

        el.querySelector('.simplebtn').onclick = () => {
          if (exr.skipped) return;
          exr.done = !exr.done;
          el.querySelector('.simplebtn').classList.toggle('on', exr.done);
          el.querySelector('.simplebtn').innerHTML = `${icon('check', 20)} ${exr.done ? t('today.completed') : t('today.markDone')}`;
          el.classList.toggle('done', exr.done);
          updateProgress();
          persistToday();
        };
      } else {
        const u = getUnit();
        const showRir = rirEnabled();
        inner += `<div class="sets-wrap ${exr.skipped ? 'disabled-sets' : ''}" style="display:flex;flex-direction:column;gap:8px;margin-top:12px">`;
        exr.sets.forEach((st, si) => {
          const ps = prev && prev.sets[si];
          // Repeat the set above, or for the opening set, what you did last time.
          const above = si > 0 ? exr.sets[si - 1] : (prev && prev.sets[0]) || null;
          const canDitto = !exr.skipped && !st.done && above && above.weight != null && above.reps != null;
          const restGap = st.done && above && above.ts && st.ts ? Math.round((st.ts - above.ts) / 1000) : null;
          inner += `<div class="setrow" data-si="${si}">
            <span class="setnum">${si + 1}</span>
            <div style="flex:1;display:flex;align-items:center;gap:8px">
              <div class="setcell"><input type="number" inputmode="decimal" class="w" placeholder="${ps && ps.weight != null ? ps.weight : u}" value="${st.weight ?? ''}" ${exr.skipped ? 'disabled' : ''}/></div>
              <span class="xsign">×</span>
              <div class="setcell"><input type="number" inputmode="numeric" class="r" placeholder="${ps && ps.reps != null ? ps.reps : 'reps'}" value="${st.reps ?? ''}" ${exr.skipped ? 'disabled' : ''}/></div>
            </div>
            ${canDitto ? `<button class="ditto-btn" title="${t('ditto.title')}" aria-label="${t('ditto.title')}">${icon('copy', 15)}</button>` : ''}
            ${showRir ? `<button class="rir-btn ${st.rir != null ? 'on' : ''}" ${exr.skipped ? 'disabled' : ''} title="RIR">${st.rir != null ? '@' + st.rir : 'RIR'}</button>` : ''}
            <button class="checkbtn ${st.done && !exr.skipped ? 'on' : ''}" ${exr.skipped ? 'disabled' : ''}>${icon('check', 20)}</button></div>
            ${restGap && restGap > 20 && restGap < 900 ? `<div class="rest-truth">${t('rest.actual', { t: pad(Math.floor(restGap / 60)) + ':' + pad(restGap % 60) })}</div>` : ''}`;
        });
        inner += `</div>`;
        el.innerHTML = inner;

        el.querySelectorAll('.setrow').forEach(row => {
          const si = +row.dataset.si;
          const st = exr.sets[si];
          row.querySelector('.w').oninput = e => {
            st.weight = e.target.value === '' ? null : parseFloat(e.target.value);
            persistToday();
          };
          row.querySelector('.r').oninput = e => {
            st.reps = e.target.value === '' ? null : parseInt(e.target.value);
            persistToday();
          };
          const rirBtn = row.querySelector('.rir-btn');
          if (rirBtn) rirBtn.onclick = () => {
            if (exr.skipped) return;
            st.rir = st.rir == null ? 3 : st.rir === 0 ? null : st.rir - 1;
            rirBtn.textContent = st.rir != null ? '@' + st.rir : 'RIR';
            rirBtn.classList.toggle('on', st.rir != null);
            persistToday();
          };
          const ditto = row.querySelector('.ditto-btn');
          if (ditto) ditto.onclick = () => {
            const above = si > 0 ? exr.sets[si - 1] : (prev && prev.sets[0]);
            if (!above) return;
            st.weight = above.weight;
            st.reps = above.reps;
            if (above.rir != null) st.rir = above.rir;
            st.done = true;
            st.ts = Date.now();
            exr.done = exr.sets.every(s => s.done);
            if (autoTimerEnabled()) startRestPill();
            updateProgress();
            persistToday();
            buildCards();
          };
          row.querySelector('.checkbtn').onclick = () => {
            if (exr.skipped) return;
            st.done = !st.done;
            st.ts = st.done ? Date.now() : null; // P5: rest truth needs real stamps
            row.querySelector('.checkbtn').classList.toggle('on', st.done);
            exr.done = exr.sets.every(s => s.done);
            el.classList.toggle('done', exr.done);
            if (st.done && autoTimerEnabled()) startRestPill();
            updateProgress();
            persistToday();
          };
        });
      }

      const coachChip = el.querySelector('.coach-chip');
      if (coachChip) {
        coachChip.onclick = () => {
          const w = parseFloat(coachChip.dataset.w);
          const open = (exr.sets || []).find(st => st.weight == null && !st.done);
          if (!open || !Number.isFinite(w)) return;
          open.weight = w;
          persistToday();
          buildCards();
          toast(t('coach.applied', { w, u: getUnit() }));
        };
      }

      const warmupBtn = el.querySelector('.warmup-btn');
      if (warmupBtn) warmupBtn.onclick = () => openWarmup(exr, coach);

      const micBtn = el.querySelector('.mic-btn:not(.warmup-btn)');
      if (micBtn) {
        micBtn.onclick = () => {
          micBtn.classList.add('listening');
          startVoiceEntry(
            (parsed) => {
              micBtn.classList.remove('listening');
              if (fillFirstOpenSet(exr, parsed.weight, parsed.reps)) {
                toast(t('voice.filled', { w: parsed.weight, u: getUnit(), r: parsed.reps }));
              }
            },
            (transcript) => {
              micBtn.classList.remove('listening');
              toast(transcript === null ? t('voice.error') : t('voice.noMatch'));
            }
          );
        };
      }

      el.querySelector('.skip-btn').onclick = () => {
        exr.skipped = !exr.skipped;
        if (exr.skipped) {
          exr.done = true;
        } else {
          exr.done = simple ? exr.done : exr.sets.every(s => s.done);
        }
        updateProgress();
        persistToday();
        buildCards();
      };

      list.appendChild(el);
    });
  }

  /* ---- Compact auto rest timer (Round 3) ---- */
  let restPillInt = null;

  function startRestPill(seconds = 90) {
    const old = document.getElementById('rest-pill');
    if (old) old.remove();
    clearInterval(restPillInt);
    let remaining = seconds;
    const pill = document.createElement('div');
    pill.id = 'rest-pill';

    const draw = () => {
      if (remaining <= 0) {
        pill.classList.add('done');
        pill.innerHTML = `${icon('flame', 16)}<b>${t('timer.go')}</b>`;
        clearInterval(restPillInt);
        try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
        setTimeout(() => pill.remove(), 2500);
        return;
      }
      pill.innerHTML = `${icon('timer', 16)}<b>${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}</b><span class="add">+15s</span><span class="x">${icon('x', 14)}</span>`;
      pill.querySelector('.add').onclick = e => { e.stopPropagation(); remaining += 15; draw(); };
      pill.querySelector('.x').onclick = e => { e.stopPropagation(); clearInterval(restPillInt); pill.remove(); };
    };

    draw();
    document.body.appendChild(pill);
    restPillInt = setInterval(() => { remaining--; draw(); }, 1000);
  }

  /* ---- Warm-up ramp + plate math overlay (Round 3) ---- */
  function openWarmup(exr, coach) {
    const u = getUnit();
    let work = null;
    const withW = (exr.sets || []).find(st => st.weight != null);
    if (withW) work = withW.weight;
    else if (coach && coach.weight) work = coach.weight;
    else {
      const hist = exerciseHistory(exr.name, 1);
      if (hist.length) work = Math.max(...hist[0].sets.map(s => s.weight));
    }
    if (!work) {
      toast(t('warmup.noWeight'));
      return;
    }

    // Plate math only means something on a loadable bar.
    const barbell = isBarbellLift(exr.name);
    const plateStr = w => {
      if (!barbell) return '';
      const ps = platesPerSide(w);
      return ps.plates.length ? ps.plates.join(' + ') + ' ' + t('warmup.perSide') : t('warmup.noPlates');
    };
    const rows = warmupRamp(work, barbell).map(r => `
      <div class="wu-row">
        <span class="wu-w">${r.weight}${u}</span>
        <span class="wu-r">× ${r.reps}</span>
        <span class="wu-p">${r.isBar ? t('warmup.bar') : plateStr(r.weight)}</span>
      </div>`).join('');

    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="wu-card">
      <div class="eyebrow" style="margin-bottom:4px">${t('warmup.title')}</div>
      <h2 class="display" style="font-size:26px;text-transform:uppercase;line-height:1.05;margin-bottom:16px">${esc(exr.name)}</h2>
      ${rows}
      <div class="wu-row work">
        <span class="wu-w">${work}${u}</span>
        <span class="wu-r">${t('warmup.work')}</span>
        <span class="wu-p">${plateStr(work)}</span>
      </div>
      <button class="btn-primary wu-close">${icon('check', 18)} ${t('timer.close')}</button>
    </div>`;
    ov.querySelector('.wu-close').onclick = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  /* ---- PLAN TAB (IL-05..11): view / library / remix editor ---- */
  let weekSel = weekdayIndex();
  let editingPlan = null;
  let editingSourceId = null;
  let editDay = 0;

  function renderPlanTab(v) {
    if (planMode === 'library') return renderLibrary(v);
    if (planMode === 'edit') return renderEditor(v);
    renderPlanView(v);
  }

  function dayPills(sel, onclickName) {
    const plan = planMode === 'edit' ? editingPlan : getActivePlan();
    return plan.days.map((d, i) => {
      const rest = d.exercises.length === 0;
      return `<button class="pill ${i === sel ? 'active' : ''}" onclick="${onclickName}(${i})"><span class="d">${esc(dayShort(i))}</span>${rest ? `<span class="moon-icon">${icon('moon', 14)}</span>` : '<span class="dot"></span>'}</button>`;
    }).join('');
  }

  function selWeekDay(i) { weekSel = i; render(); }
  function selEditDay(i) { editDay = i; render(); }

  function renderPlanView(v) {
    const plan = getActivePlan();
    const day = plan.days[weekSel];

    let ex = '';
    if (day.exercises.length === 0) {
      ex = `<p class="muted" style="font-size:14px;padding:32px 0;text-align:center">${t('plan.recovery')}</p>`;
    } else {
      ex = '<div class="stack">' + day.exercises.map(e => {
        if (e.kind === 'break') return `<div class="breaklabel">${icon('timer', 14)} ${esc(e.name)}</div>`;
        return `<div class="exrow"><div class="l"><span style="color:hsl(var(--primary))">${icon(e.kind === 'cardio' ? 'waves' : 'dumbbell', 16)}</span><span class="n">${esc(e.name)}</span></div><span class="r">${e.sets > 1 ? e.sets + ' × ' : ''}${esc(e.target)}</span></div>`;
      }).join('') + '</div>';
    }

    v.innerHTML = `<div class="px" style="padding-top:32px">
      <div class="eyebrow">${t('plan.eyebrow')}</div>
      <h1 class="display" style="font-size:44px;text-transform:uppercase;line-height:1;margin-top:4px">${esc(plan.name)}</h1>
      <div class="btnrow" style="margin-top:16px">
        <button class="btn-sm" id="btn-library">${icon('layers', 15)} ${t('plan.library')}</button>
        <button class="btn-sm" id="btn-edit">${icon('pencil', 15)} ${t('plan.edit')}</button>
        <button class="btn-sm primary" id="btn-share">${icon('share', 15)} ${t('plan.share')}</button>
      </div>
      <div class="no-sb" style="display:flex;gap:8px;margin-top:20px;overflow-x:auto">${dayPills(weekSel, 'selWeekDay')}</div>
      <div style="margin-top:24px" class="fade">
        <div class="wk-hero"><img src="${COVER(day.muscle)}"/><div class="ov"></div><div class="cap"><div class="eyebrow">${esc(dayName(weekSel))}</div><h2>${esc(day.title)}</h2></div></div>
        ${ex}
      </div></div>`;

    document.getElementById('btn-library').onclick = () => { planMode = 'library'; render(); };
    document.getElementById('btn-edit').onclick = () => { openEditor(plan.id); };
    document.getElementById('btn-share').onclick = () => sharePlan(plan);
  }

  function renderLibrary(v) {
    const plans = Object.values(loadPlans());
    const activeId = getActivePlanId();

    const rows = plans.map(p => {
      const td = trainingDays(p).length;
      const active = p.id === activeId;
      return `<div class="plan-row ${active ? 'active' : ''}">
        <div class="plan-row-main">
          <div style="min-width:0">
            <div class="plan-name">${esc(p.name)}</div>
            <div class="muted" style="font-size:12px;margin-top:2px">${t('plan.trainingDays', { n: td })}
              ${p.builtin ? ` · <span class="badge">${t('plan.builtin')}</span>` : ''}
              ${active ? ` · <span class="badge on">${t('plan.active')}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="plan-row-actions">
          ${active ? '' : `<button class="btn-sm primary" data-act="use" data-id="${esc(p.id)}">${icon('check', 14)} ${t('plan.use')}</button>`}
          <button class="btn-sm" data-act="edit" data-id="${esc(p.id)}">${icon('pencil', 14)} ${t('plan.edit')}</button>
          <button class="btn-sm" data-act="share" data-id="${esc(p.id)}">${icon('share', 14)} ${t('plan.share')}</button>
          <button class="btn-sm" data-act="dup" data-id="${esc(p.id)}">${icon('copy', 14)} ${t('plan.duplicate')}</button>
          ${p.builtin || active ? '' : `<button class="btn-sm danger" data-act="del" data-id="${esc(p.id)}">${icon('trash', 14)} ${t('common.delete')}</button>`}
        </div>
      </div>`;
    }).join('');

    v.innerHTML = `<div class="px" style="padding-top:32px">
      <div class="eyebrow">${t('plan.eyebrow')}</div>
      <h1 class="display" style="font-size:44px;text-transform:uppercase;line-height:1;margin-top:4px">${t('plan.library')}</h1>
      <div class="btnrow" style="margin-top:16px">
        <button class="btn-sm" id="btn-back">${icon('chevronDown', 15)} ${t('common.back')}</button>
        <button class="btn-sm primary" id="btn-new">${icon('plus', 15)} ${t('plan.newPlan')}</button>
      </div>
      <div class="stack" style="margin-top:20px">${rows}</div>
    </div>`;

    document.getElementById('btn-back').onclick = () => { planMode = 'view'; render(); };
    document.getElementById('btn-new').onclick = () => {
      const p = normalizePlan({ id: newPlanId(), name: t('plan.newPlan'), days: [] });
      putPlan(p);
      openEditor(p.id);
    };
    v.querySelectorAll('[data-act]').forEach(btn => {
      const id = btn.dataset.id;
      btn.onclick = () => {
        const p = getPlan(id);
        if (!p) return;
        if (btn.dataset.act === 'use') { setActivePlan(id); render(); }
        else if (btn.dataset.act === 'edit') openEditor(id);
        else if (btn.dataset.act === 'share') sharePlan(p);
        else if (btn.dataset.act === 'dup') {
          const copy = normalizePlan({ ...JSON.parse(JSON.stringify(p)), id: newPlanId(), name: p.name + ' ²' });
          putPlan(copy);
          render();
        }
        else if (btn.dataset.act === 'del') {
          if (confirm(t('plan.deleteConfirm', { name: p.name }))) { deletePlan(id); render(); }
        }
      };
    });
  }

  function openEditor(id) {
    const p = getPlan(id);
    if (!p) return;
    editingSourceId = id;
    editingPlan = JSON.parse(JSON.stringify(p));
    editDay = weekdayIndex();
    planMode = 'edit';
    render();
  }

  const MUSCLES = ['chest', 'back', 'legs', 'rest'];

  function renderEditor(v) {
    const day = editingPlan.days[editDay];
    const kinds = ['exercise', 'cardio', 'break'];

    const exRows = day.exercises.map((e, i) => {
      const isBreak = e.kind === 'break';
      return `<div class="ed-ex ${isBreak ? 'is-break' : ''}" data-i="${i}">
        <div class="ed-ex-top">
          <input class="ed-input ed-name" value="${esc(e.name)}" placeholder="${t('editor.addExercise')}" ${isBreak ? 'disabled' : ''}/>
          <button class="btn-icon" data-a="kind" title="${t('kind.' + e.kind)}">${icon(e.kind === 'break' ? 'timer' : e.kind === 'cardio' ? 'waves' : 'dumbbell', 16)}</button>
          <button class="btn-icon danger" data-a="del">${icon('trash', 16)}</button>
        </div>
        ${isBreak ? '' : `<div class="ed-ex-bottom">
          <input class="ed-input ed-sets" type="number" min="1" max="10" value="${e.sets || 1}" title="${t('editor.sets')}"/>
          <input class="ed-input ed-target" value="${esc(e.target)}" placeholder="${t('editor.target')}"/>
          <button class="btn-icon" data-a="up" ${i === 0 ? 'disabled' : ''}>${icon('chevronUp', 16)}</button>
          <button class="btn-icon" data-a="down" ${i === day.exercises.length - 1 ? 'disabled' : ''}>${icon('chevronDown', 16)}</button>
        </div>`}
      </div>`;
    }).join('');

    v.innerHTML = `<div class="px" style="padding-top:32px">
      <div class="eyebrow">${t('plan.edit')}</div>
      <input id="ed-plan-name" class="ed-input ed-title-input display" value="${esc(editingPlan.name)}" placeholder="${t('editor.name')}"/>
      <div class="btnrow" style="margin-top:16px">
        <button class="btn-sm" id="ed-cancel">${icon('x', 15)} ${t('common.cancel')}</button>
        <button class="btn-sm primary" id="ed-save">${icon('check', 15)} ${t('common.save')}</button>
      </div>
      <div class="no-sb" style="display:flex;gap:8px;margin-top:20px;overflow-x:auto">${dayPills(editDay, 'selEditDay')}</div>

      <div class="card" style="margin-top:20px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;gap:8px">
          <div style="flex:1"><label class="ed-label">${t('editor.dayTitle')}</label>
            <input id="ed-day-title" class="ed-input" value="${esc(day.title)}"/></div>
          <div style="flex:1"><label class="ed-label">${t('editor.focus')}</label>
            <input id="ed-day-focus" class="ed-input" value="${esc(day.focus)}"/></div>
        </div>
        <div><label class="ed-label">${t('editor.cover')}</label>
          <div class="muscle-chips">${MUSCLES.map(m => `<button class="chip ${day.muscle === m ? 'on' : ''}" data-m="${m}"><span class="swatch" style="background:${COVER_HUES[m][1]}"></span>${m}</button>`).join('')}</div>
        </div>
      </div>

      <div class="stack" style="margin-top:16px">${exRows}</div>
      <div class="btnrow" style="margin-top:16px;margin-bottom:24px">
        <button class="btn-sm" id="ed-add-ex">${icon('plus', 15)} ${t('editor.addExercise')}</button>
        <button class="btn-sm" id="ed-add-break">${icon('timer', 15)} ${t('editor.addBreak')}</button>
        ${day.exercises.length ? `<button class="btn-sm" id="ed-rest">${icon('moon', 15)} ${t('editor.restDay')}</button>` : ''}
      </div>
    </div>`;

    document.getElementById('ed-plan-name').oninput = e => { editingPlan.name = e.target.value; };
    document.getElementById('ed-day-title').oninput = e => { day.title = e.target.value; };
    document.getElementById('ed-day-focus').oninput = e => { day.focus = e.target.value; };
    v.querySelectorAll('.chip').forEach(c => {
      c.onclick = () => { day.muscle = c.dataset.m; render(); };
    });
    document.getElementById('ed-cancel').onclick = () => { planMode = 'library'; editingPlan = null; render(); };
    document.getElementById('ed-save').onclick = saveEditor;
    document.getElementById('ed-add-ex').onclick = () => {
      day.exercises.push({ name: '', sets: 3, target: '10-15 reps', kind: 'exercise' });
      render();
      const names = document.querySelectorAll('.ed-ex .ed-name');
      if (names.length) names[names.length - 1].focus();
    };
    document.getElementById('ed-add-break').onclick = () => {
      day.exercises.push({ name: 'Short Break', sets: 0, target: 'Rest & recover', kind: 'break' });
      render();
    };
    const restBtn = document.getElementById('ed-rest');
    if (restBtn) restBtn.onclick = () => { day.exercises = []; day.title = 'Rest Day'; day.muscle = 'rest'; render(); };

    v.querySelectorAll('.ed-ex').forEach(row => {
      const i = +row.dataset.i;
      const e = day.exercises[i];
      const name = row.querySelector('.ed-name');
      if (name) name.oninput = ev => { e.name = ev.target.value; };
      const sets = row.querySelector('.ed-sets');
      if (sets) sets.oninput = ev => { e.sets = clampSets(ev.target.value); };
      const target = row.querySelector('.ed-target');
      if (target) target.oninput = ev => { e.target = ev.target.value; };
      row.querySelectorAll('[data-a]').forEach(btn => {
        btn.onclick = () => {
          const a = btn.dataset.a;
          if (a === 'del') day.exercises.splice(i, 1);
          else if (a === 'up' && i > 0) [day.exercises[i - 1], day.exercises[i]] = [day.exercises[i], day.exercises[i - 1]];
          else if (a === 'down' && i < day.exercises.length - 1) [day.exercises[i + 1], day.exercises[i]] = [day.exercises[i], day.exercises[i + 1]];
          else if (a === 'kind') {
            e.kind = kinds[(kinds.indexOf(e.kind) + 1) % kinds.length];
            if (e.kind === 'break') { e.name = 'Short Break'; e.sets = 0; e.target = 'Rest & recover'; }
            else if (!e.sets) { e.sets = e.kind === 'cardio' ? 1 : 3; }
          }
          render();
        };
      });
    });
  }

  function saveEditor() {
    const src = getPlan(editingSourceId);
    const clean = normalizePlan(editingPlan);
    if (!clean) return;
    const wasActive = getActivePlanId() === editingSourceId;
    if (src && src.builtin) {
      // Built-ins fork on save — the remix, not the master tape
      clean.id = newPlanId();
      if (clean.name === src.name) clean.name = src.name + ' (Remix)';
      putPlan(clean);
      if (wasActive) setActivePlan(clean.id);
      toast(t('editor.savedFork'));
    } else {
      clean.id = editingSourceId;
      putPlan(clean);
      toast(t('editor.saved'));
    }
    planMode = 'library';
    editingPlan = null;
    render();
  }

  /* ---- COVER PAGE for incoming shared links (IL-11) ---- */
  function renderCover(v) {
    const p = pendingPlan;
    const td = trainingDays(p);
    const firstMuscle = td.length ? p.days[td[0]].muscle : 'chest';

    const dayList = p.days.map((d, i) => `
      <div class="exrow"><div class="l">
        <span style="color:hsl(var(--primary))">${d.exercises.length ? icon('dumbbell', 16) : icon('moon', 16)}</span>
        <span class="n">${esc(dayName(i, 'short'))} — ${esc(d.title)}</span></div>
        <span class="r">${d.exercises.length ? d.exercises.filter(e => e.kind !== 'break').length : ''}</span>
      </div>`).join('');

    v.innerHTML = `<div class="hero">
      <img src="${COVER(firstMuscle)}" alt=""/><div class="ov"></div>
      <div class="top"><div class="eyebrow">${t('cover.incoming')}</div></div>
      <div class="bot"><h1 class="display">${esc(p.name)}</h1>
        <div style="color:rgba(255,255,255,.8);font-size:14px;font-weight:600;margin-top:8px">
          ${t('cover.meta', { days: td.length, ex: planExerciseCount(p) })}
        </div>
      </div>
    </div>
    <div class="px" style="margin-top:20px">
      <div class="btnrow">
        <button class="btn-sm primary grow" id="cv-run">${icon('flame', 15)} ${t('cover.run')}</button>
      </div>
      <div class="btnrow" style="margin-top:8px">
        <button class="btn-sm grow" id="cv-save">${icon('layers', 15)} ${t('cover.saveOnly')}</button>
        <button class="btn-sm grow" id="cv-dismiss">${icon('x', 15)} ${t('cover.dismiss')}</button>
      </div>
      <div class="stack" style="margin-top:20px;margin-bottom:24px">${dayList}</div>
    </div>`;

    document.getElementById('cv-run').onclick = () => {
      putPlan(pendingPlan);
      setActivePlan(pendingPlan.id);
      const title = pendingPlan.days[weekdayIndex()].title;
      resolveCover();
      switchTab('today');
      toast(t('cover.loaded'), t('cover.loadedSub', { title }));
    };
    document.getElementById('cv-save').onclick = () => {
      putPlan(pendingPlan);
      resolveCover();
      planMode = 'library';
      switchTab('plan');
      planMode = 'library';
      render();
    };
    document.getElementById('cv-dismiss').onclick = () => {
      resolveCover();
      switchTab('today');
    };
  }

  function resolveCover() {
    pendingPlan = null;
    clearIncomingPlan();
  }

  async function handleIncomingLink() {
    const payload = incomingPlanPayload();
    if (!payload) return false;
    const plan = await decodePlanPayload(payload);
    if (!plan) {
      clearIncomingPlan();
      toast(t('cover.invalid'));
      return false;
    }
    pendingPlan = plan;
    render();
    return true;
  }

  /* ---- HISTORY (+ IL-19 records, Round 3 trends) ---- */
  let recordsExpanded = false;
  let historyLimit = 30; // imported histories can be years long — half-second rule
  let trendPick = null;

  function buildTrendPoints(name) {
    const hist = exerciseHistory(name, 15).slice().reverse();
    return hist.map(h => {
      let best = null;
      h.sets.forEach(st => {
        const e = epley(st.weight, st.reps);
        if (e != null && (!best || e > best.y)) best = { y: e, w: st.weight, reps: st.reps };
      });
      return {
        label: new Date(h.date + 'T00:00:00').toLocaleDateString(getLang(), { month: 'short', day: 'numeric' }),
        y: best.y, w: best.w, reps: best.reps,
      };
    });
  }

  function fmtDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(getLang(), { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function renderHistory(v) {
    const s = computeStats();
    const records = computeRecords();
    const u = getUnit();

    const visibleSessions = s.sessions.slice(0, historyLimit);
    let sessions = s.sessions.length === 0
      ? `<p class="muted" style="font-size:14px;padding:32px 0;text-align:center">${t('history.empty')}</p>`
      : '<div class="stack">' + visibleSessions.map((x) => {
          const trackableExercises = (x.exercises || []).filter(e => e.kind !== 'break');

          const detailsHtml = trackableExercises.map(e => {
            const simple = e.kind === 'cardio';
            const loggedSets = (e.sets || []).filter(st => st.weight != null || st.reps != null || st.done);
            let setChips = '';
            if (e.skipped) {
              setChips = `<span class="badge skipped-badge">${t('history.skippedBadge')}</span>`;
            } else if (simple) {
              setChips = `<span class="badge ${e.done ? 'on' : ''}">${e.done ? t('history.completedBadge') : t('history.skippedBadge')}</span>`;
            } else if (loggedSets.length > 0) {
              setChips = loggedSets.map((st, i) => `
                <span class="set-chip">
                  <span class="num">S${i + 1}</span>
                  <span class="val">${st.weight != null ? st.weight + u : '—'} × ${st.reps != null ? st.reps : '—'}</span>
                </span>
              `).join('');
            } else {
              setChips = `<span class="muted" style="font-size:11px;">${t('history.noSets')}</span>`;
            }

            return `
              <div class="history-ex-item">
                <div class="history-ex-header">
                  <span style="color:${e.skipped ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))'}">${icon(simple ? 'waves' : 'dumbbell', 14)}</span>
                  <span style="${e.skipped ? 'opacity:0.7;' : ''}">${esc(e.name)}</span>
                </div>
                <div class="history-sets-wrap">${setChips}</div>
              </div>
            `;
          }).join('');

          return `
            <details class="history-card">
              <summary>
                <div style="min-width:0">
                  <div style="font-weight:700;font-size:15px;line-height:1.2;">${esc(x.title)}</div>
                  <div class="muted" style="font-size:12px;margin-top:2px;">${fmtDate(x.date)}${x.imported ? ` · <span class="badge">${esc(x.imported)}</span>` : ''}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span class="muted" style="font-size:12px;font-weight:700;">${x.completed_count}/${x.total_count}</span>
                  <span class="badge ${x.completed ? 'on' : ''}">${x.completed ? t('history.done') : t('history.partial')}</span>
                  <span class="history-chevron">${icon('chevronDown', 18)}</span>
                </div>
              </summary>
              <div class="history-body">${detailsHtml}</div>
            </details>
          `;
        }).join('') +
        (s.sessions.length > historyLimit
          ? `<button class="btn-sm" id="hist-more">${icon('chevronDown', 15)} ${t('history.showMore')} (${s.sessions.length - historyLimit})</button>`
          : '') +
        '</div>';

    // ---- Trends: e1RM per lift + weekly volume by muscle
    const freq = {};
    s.sessions.forEach(sess => (sess.exercises || []).forEach(e => {
      if (e.kind !== 'exercise') return;
      if ((e.sets || []).some(st => st.weight != null && st.reps != null)) freq[e.name] = (freq[e.name] || 0) + 1;
    }));
    const trendable = Object.entries(freq).filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n);
    if (trendable.length && !trendable.includes(trendPick)) trendPick = trendable[0];

    let trendsHtml = '';
    let trendPoints = [];
    if (trendable.length) {
      trendPoints = buildTrendPoints(trendPick);
      const svg = trendPoints.length >= 2 ? lineChartSVG(trendPoints, u) : null;
      const fc = prForecast(trendPick);
      const forecastHtml = fc ? `<div class="forecast">${icon('trendingUp', 14)}<span><b>${t('forecast.on', {
          w: fc.target, u, date: fc.date.toLocaleDateString(getLang(), { month: 'short', day: 'numeric' })
        })}</b> · ${t('forecast.rate', { r: fc.perWeek, u })}</span></div>` : '';
      const chips = trendable.map(n => `<button class="chip ${n === trendPick ? 'on' : ''}" data-trend="${esc(n)}">${esc(n)}</button>`).join('');
      const table = svg ? `<details class="chart-data"><summary>${t('trends.data')}</summary>
        ${trendPoints.map(p => `<div class="chart-data-row"><span>${p.label}</span><span>${p.w}${u} × ${p.reps}</span><b>${p.y}${u}</b></div>`).join('')}
      </details>` : '';
      trendsHtml = `
        <h2 class="display" style="font-size:24px;text-transform:uppercase;margin-top:32px;margin-bottom:12px">${t('trends.title')}</h2>
        <div class="muscle-chips no-sb" style="flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px">${chips}</div>
        <div class="card chart-card" id="trend-chart" style="margin-top:10px">
          <div class="l seclabel" style="margin-bottom:10px">${t('trends.e1rm')}</div>
          ${svg || `<p class="muted" style="font-size:12px">${t('trends.noData')}</p>`}
          <div class="chart-tip" style="display:none"></div>
          ${forecastHtml}
          ${table}
        </div>`;
    }

    // ---- P7: load radar
    const radar = fatigueRadar();
    const radarHtml = radar ? (() => {
      const map = {
        hole: ['fatigue.hole', 'fatigue.holeSub'],
        building: ['fatigue.building', 'fatigue.buildingSub'],
        steady: ['fatigue.steady', 'fatigue.steadySub'],
        light: ['fatigue.light', 'fatigue.lightSub'],
      }[radar.status];
      const vars = {
        v: Math.round(Math.abs(radar.volumeDelta) * 100),
        p: Math.abs(radar.perfPerLift), u,
        r: radar.recentSets,
      };
      vars.p = radar.status === 'steady' || radar.status === 'light' ? radar.priorSets : vars.p;
      return `<div class="radar-card ${radar.status}">
        <div class="radar-head">${icon(radar.status === 'hole' ? 'chevronDown' : radar.status === 'building' ? 'trendingUp' : 'waves', 16)}
          <span>${t(map[0])}</span></div>
        <div class="radar-sub">${esc(t(map[1], vars))}</div>
      </div>` ;
    })() : '';

    // ---- P2: recovery clocks
    const clocks = recoveryClocks().filter(c => c.hours != null);
    const recoveryHtml = clocks.length ? `
      <div class="card" style="margin-top:12px;padding:16px">
        <div class="l seclabel" style="margin-bottom:2px">${t('recovery.title')}</div>
        <div class="muted" style="font-size:11px;margin-bottom:14px">${t('recovery.sub')}</div>
        ${clocks.map(c => `<div class="vol-row">
          <span class="vol-label">${t('muscle.' + c.muscle)}</span>
          <span class="vol-track"><span class="vol-fill rec" style="width:${Math.round(c.fresh * 100)}%"></span></span>
          <span class="vol-val small">${c.fresh >= 1 ? t('recovery.fresh') : t('recovery.hours', { h: Math.round(c.hours) })}</span>
        </div>`).join('')}
      </div>` : '';

    // ---- P6: junk volume
    const jv = junkVolume(14);
    const junkHtml = jv.total ? `
      <div class="card" style="margin-top:12px;padding:16px">
        <div class="l seclabel" style="margin-bottom:8px">${t('junk.title')}</div>
        <div style="font-size:12px;line-height:1.6">${jv.junk === 0
          ? `<span class="muted">${t('junk.none', { d: jv.days })}</span>`
          : `${esc(t('junk.some', { n: jv.junk, t: jv.total, m: jv.minutes }))}
             ${jv.worst.length ? `<div class="muted" style="margin-top:6px">${esc(t('junk.worst', { list: jv.worst.map(w => w[0]).join(', ') }))}</div>` : ''}`}
        </div>
      </div>` : '';

    // ---- P9: balance ledger
    const bal = balanceLedger(28);
    const balanceHtml = bal ? (() => {
      const rows = [['balance.push', bal.push], ['balance.pull', bal.pull], ['balance.legs', bal.lower], ['balance.core', bal.core]];
      const max = Math.max(...rows.map(r => r[1]), 1);
      const advice = bal.findings.length
        ? bal.findings.map(f => f.kind === 'pull' ? t('balance.needPull', { n: Math.max(1, f.gap) })
            : f.kind === 'push' ? t('balance.needPush', { n: Math.max(1, f.gap) })
            : t('balance.needLegs', { n: Math.max(1, f.gap) })).join(' ')
        : t('balance.even');
      return `<div class="card" style="margin-top:12px;padding:16px">
        <div class="l seclabel" style="margin-bottom:2px">${t('balance.title')}</div>
        <div class="muted" style="font-size:11px;margin-bottom:14px">${t('balance.sub', { d: bal.days })}</div>
        ${rows.map(([k, val]) => `<div class="vol-row">
          <span class="vol-label">${t(k)}</span>
          <span class="vol-track"><span class="vol-fill" style="width:${Math.round(val / max * 100)}%"></span></span>
          <span class="vol-val">${val}</span>
        </div>`).join('')}
        <div class="balance-advice ${bal.findings.length ? 'warn' : ''}">${esc(advice)}</div>
      </div>`;
    })() : '';

    const twVol = weeklyMuscleSets(0), lwVol = weeklyMuscleSets(1);
    const volBars = muscleBarsHTML(twVol, lwVol);
    const volumeHtml = volBars ? `
      <div class="card" style="margin-top:12px;padding:16px">
        <div class="l seclabel" style="margin-bottom:2px">${t('trends.volume')}</div>
        <div class="muted" style="font-size:11px;margin-bottom:14px">${t('trends.volumeSub')}</div>
        ${volBars}
      </div>` : '';

    const shown = recordsExpanded ? records : records.slice(0, 6);
    const recordsHtml = records.length ? `
      <h2 class="display" style="font-size:24px;text-transform:uppercase;margin-top:32px;margin-bottom:12px">${t('history.records')}</h2>
      <div class="card" style="padding:8px 16px">
        ${shown.map((r, i) => `<div class="record-row">
          <span class="record-rank">${i + 1}</span>
          <span class="record-name">${esc(r.name)}</span>
          <span class="record-val">${r.weight}${u} × ${r.reps ?? '—'}</span>
          <span class="record-date muted">${fmtDate(r.date)}</span>
        </div>`).join('')}
        ${records.length > 6 ? `<button class="btn-sm" id="rec-toggle" style="margin:8px 0">${recordsExpanded ? t('history.showLess') : t('history.showAll')} (${records.length})</button>` : ''}
      </div>` : '';

    v.innerHTML = `<div class="px" style="padding-top:32px">
      <div style="display:flex;align-items:flex-end;justify-content:space-between">
        <div><div class="eyebrow">${t('history.eyebrow')}</div><h1 class="display" style="font-size:48px;text-transform:uppercase;line-height:1;margin-top:4px">${t('history.title')}</h1></div>
        <button class="btn-sm" id="btn-flex" style="margin-bottom:6px">${icon('share', 15)} ${t('history.shareCard')}</button>
      </div>
      <div class="statgrid">
        <div class="stat"><span style="color:hsl(var(--primary))">${icon('flame', 20)}</span><span class="v">${s.streak}</span><span class="l">${t('history.streak')}</span></div>
        <div class="stat"><span style="color:hsl(var(--primary))">${icon('trophy', 20)}</span><span class="v">${s.weekDone}/${s.weekTotal}</span><span class="l">${t('history.thisWeek')}</span></div>
        <div class="stat"><span style="color:hsl(var(--primary))">${icon('dumbbell', 20)}</span><span class="v">${s.total}</span><span class="l">${t('history.total')}</span></div>
      </div>
      <div class="wkgrid">
        <div class="l" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:hsl(var(--muted-foreground));margin-bottom:12px">${t('history.thisWeek')}</div>
        <div class="row">${s.grid.map((g, i) => `<div class="col"><span class="dl">${esc(dayShort(i))}</span><div class="circle ${g.done && g.scheduled ? 'on' : ''} ${g.scheduled ? '' : 'off'} ${g.isToday ? 'today' : ''}">${g.done && g.scheduled ? icon('check', 18) : '<span class="pip"></span>'}</div></div>`).join('')}</div>
      </div>
      ${radarHtml}
      ${trendsHtml}
      ${volumeHtml}
      ${recoveryHtml}
      ${balanceHtml}
      ${junkHtml}
      ${recordsHtml}
      <h2 class="display" style="font-size:24px;text-transform:uppercase;margin-top:32px;margin-bottom:12px">${t('history.recent')}</h2>
      ${sessions}
    </div>`;

    document.getElementById('btn-flex').onclick = shareFlexCard;
    const recToggle = document.getElementById('rec-toggle');
    if (recToggle) recToggle.onclick = () => { recordsExpanded = !recordsExpanded; render(); };
    const histMore = document.getElementById('hist-more');
    if (histMore) histMore.onclick = () => { historyLimit += 50; render(); };
    v.querySelectorAll('[data-trend]').forEach(c => {
      c.onclick = () => { trendPick = c.dataset.trend; render(); };
    });
    const trendCard = document.getElementById('trend-chart');
    if (trendCard && trendCard.querySelector('svg')) wireLineChart(trendCard, trendPoints, u);
  }

/* ---- SETTINGS ---- */
function settingsRow(iconName, title, sub, id, cls = '') {
  return `<button class="setrow-btn ${cls}" id="${id}">
    <span class="setrow-ic">${icon(iconName, 18)}</span>
    <span style="min-width:0;text-align:left"><span class="setrow-t">${title}</span><span class="setrow-s">${sub}</span></span>
  </button>`;
}

function renderSettings(v) {
    const dark = (localStorage.getItem(LS_THEME) || 'dark') === 'dark';
    const unit = getUnit();
    const lang = getLang();
    const ghost = getGhost();

    v.innerHTML = `<div class="px" style="padding-top:32px">
      <div class="eyebrow">${t('settings.eyebrow')}</div><h1 class="display" style="font-size:48px;text-transform:uppercase;line-height:1;margin-top:4px">${t('settings.title')}</h1>

      <div class="card" style="margin-top:24px;padding:20px">
        <div class="l seclabel">${t('settings.appearance')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="color:hsl(var(--primary))">${icon(dark ? 'moon' : 'sun', 20)}</span>
            <div><div style="font-weight:700;font-size:14px">${dark ? t('settings.dark') : t('settings.light')}</div><div class="muted" style="font-size:12px">${t('settings.tapSwitch')}</div></div>
          </div>
          <button class="toggle ${dark ? 'on' : ''}" id="theme-toggle"><span class="knob">${icon(dark ? 'moon' : 'sun', 16)}</span></button>
        </div>
      </div>

      <div class="card" style="margin-top:12px;padding:20px">
        <div class="l seclabel">${t('settings.prefs')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div><div style="font-weight:700;font-size:14px">${t('settings.unit')}</div><div class="muted" style="font-size:12px">${t('settings.unitNote')}</div></div>
          <div class="seg">
            <button class="seg-btn ${unit === 'kg' ? 'on' : ''}" data-u="kg">kg</button>
            <button class="seg-btn ${unit === 'lb' ? 'on' : ''}" data-u="lb">lb</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid hsl(var(--border))">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="color:hsl(var(--primary))">${icon('globe', 20)}</span>
            <div style="font-weight:700;font-size:14px">${t('settings.language')}</div>
          </div>
          <select id="lang-select" class="lang-select">
            ${LANGS.map(l => `<option value="${l.id}" ${l.id === lang ? 'selected' : ''}>${l.label}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid hsl(var(--border))">
          <div><div style="font-weight:700;font-size:14px">${t('settings.rir')}</div><div class="muted" style="font-size:12px">${t('settings.rirSub')}</div></div>
          <button class="toggle ${rirEnabled() ? 'on' : ''}" id="rir-toggle"><span class="knob">${icon('flame', 16)}</span></button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid hsl(var(--border))">
          <div><div style="font-weight:700;font-size:14px">${t('settings.autoTimer')}</div><div class="muted" style="font-size:12px">${t('settings.autoTimerSub')}</div></div>
          <button class="toggle ${autoTimerEnabled() ? 'on' : ''}" id="autotimer-toggle"><span class="knob">${icon('timer', 16)}</span></button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid hsl(var(--border))">
          <div style="font-weight:700;font-size:14px">${t('settings.bar')}</div>
          <div class="seg">
            ${(unit === 'lb' ? [45, 35] : [20, 15]).map(b => `<button class="seg-btn ${getBarWeight() === b ? 'on' : ''}" data-bar="${b}">${b}${unit}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;padding:20px">
        <div class="l seclabel">${t('settings.data')}</div>
        <div class="stack" style="gap:8px">
          ${settingsRow('download', t('settings.export'), t('settings.exportSub'), 'btn-export')}
          ${settingsRow('upload', t('settings.import'), t('settings.importSub'), 'btn-import')}
          ${settingsRow('layers', t('settings.migrate'), t('settings.migrateSub'), 'btn-migrate')}
        </div>
      </div>

      <div class="card" style="margin-top:12px;padding:20px">
        <div class="l seclabel">${t('settings.ghost')}</div>
        <div class="muted" style="font-size:12px;margin-bottom:12px">${t('settings.ghostSub')}</div>
        ${ghost ? `<div class="ghost-active">${icon('ghost', 16)} <span>${t('settings.ghostActive', { label: esc(ghost.label) })}</span></div>` : ''}
        <div class="stack" style="gap:8px">
          ${settingsRow('ghost', t('settings.ghostLoad'), t('settings.ghostLoadSub'), 'btn-ghost-load')}
          ${settingsRow('trendingUp', t('settings.ghostSelf'), '', 'btn-ghost-self')}
          ${ghost ? settingsRow('x', t('settings.ghostClear'), '', 'btn-ghost-clear') : ''}
        </div>
      </div>

      <div class="card" style="margin-top:12px;padding:20px">
        ${settingsRow('printer', t('settings.annex'), t('settings.annexSub'), 'btn-annex')}
      </div>

      <div class="card" style="margin-top:12px;padding:20px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:12px;background:hsl(var(--primary));display:flex;align-items:center;justify-content:center;color:hsl(var(--primary-foreground))">${icon('dumbbell', 24)}</div>
          <div><div class="display" style="font-size:24px;text-transform:uppercase;line-height:1">Iron Log</div><div class="muted" style="font-size:12px;margin-top:4px">${t('settings.tagline')}</div></div>
        </div>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid hsl(var(--border));display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px" class="muted">
          <div><div style="font-weight:700;color:hsl(var(--foreground))">${t('settings.local')}</div><div>${t('settings.localSub')}</div></div>
          <div><div style="font-weight:700;color:hsl(var(--foreground))">${t('settings.offline')}</div><div>${t('settings.offlineSub')}</div></div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;padding:20px;border-color:hsl(var(--destructive) / .3);">
        <div class="l seclabel" style="color:hsl(var(--destructive))">${t('settings.danger')}</div>
        <div class="muted" style="font-size:12px;margin-bottom:16px;">${t('settings.dangerCopy')}</div>
        <button class="reset-btn" id="reset-app-btn">${icon('x', 18)} ${t('settings.reset')}</button>
      </div>
    </div>`;

    document.getElementById('theme-toggle').onclick = () => { toggleTheme(); renderSettings(v); };

    v.querySelectorAll('.seg-btn[data-u]').forEach(b => {
      b.onclick = () => { setUnit(b.dataset.u); renderSettings(v); };
    });
    v.querySelectorAll('.seg-btn[data-bar]').forEach(b => {
      b.onclick = () => { setBarWeight(+b.dataset.bar); renderSettings(v); };
    });
    document.getElementById('rir-toggle').onclick = () => { setRirEnabled(!rirEnabled()); renderSettings(v); };
    document.getElementById('autotimer-toggle').onclick = () => { setAutoTimerEnabled(!autoTimerEnabled()); renderSettings(v); };
    document.getElementById('lang-select').onchange = e => {
      setLang(e.target.value);
      document.documentElement.lang = getLang();
      renderNav();
      render();
    };

    document.getElementById('btn-export').onclick = () => {
      downloadJSON(`ironlog-backup-${todayStr()}.json`, buildBackup());
      toast(t('settings.exported'), t('settings.exportedSub'));
    };
    document.getElementById('btn-import').onclick = () => pickFile('.json,application/json', (text) => {
      try {
        const res = mergeBackup(JSON.parse(text));
        if (!res) throw new Error('bad');
        toast(t('settings.imported'), t('settings.importedSub', { s: res.addedSessions, p: res.addedPlans }));
        render();
      } catch (e) {
        toast(t('settings.importFail'));
      }
    });
    document.getElementById('btn-migrate').onclick = () => pickFile('.csv,text/csv', (text) => {
      const res = importCsvHistory(text);
      if (res) {
        toast(t('settings.migrated'), t('settings.migratedSub', { n: res.added, app: res.app }));
        render();
      } else {
        toast(t('settings.importFail'));
      }
    });

    document.getElementById('btn-ghost-load').onclick = () => pickFile('.json,application/json', (text, name) => {
      try {
        const obj = JSON.parse(text);
        if (!isBackup(obj)) throw new Error('bad');
        const label = name.replace(/\.json$/i, '').slice(0, 40) || 'Ghost';
        setGhost({ label, sessions: obj.sessions });
        toast(t('settings.ghostLoaded'), t('settings.ghostLoadedSub', { label }));
        render();
      } catch (e) {
        toast(t('settings.importFail'));
      }
    });
    document.getElementById('btn-ghost-self').onclick = () => {
      const date = new Date().toLocaleDateString(getLang(), { month: 'short', day: 'numeric' });
      const label = t('settings.pastSelf', { date });
      setGhost({ label, sessions: loadSessions() });
      toast(t('settings.ghostLoaded'), t('settings.ghostLoadedSub', { label }));
      render();
    };
    const ghostClear = document.getElementById('btn-ghost-clear');
    if (ghostClear) ghostClear.onclick = () => { setGhost(null); render(); };

    document.getElementById('btn-annex').onclick = () => { window.open('poster.html', '_blank'); };

    document.getElementById('reset-app-btn').onclick = () => {
      downloadJSON(`ironlog-backup-${todayStr()}.json`, buildBackup()); // the parachute
      setTimeout(() => {
        if (confirm(t('settings.resetConfirm'))) {
          resetAppData();
          location.reload();
        }
      }, 300);
    };
  }

  /* ---------------- INIT APP ---------------- */
  initTheme();
  document.documentElement.lang = getLang();
  renderNav();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // announce updates, but never on first install
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) toast(t('app.updated'), t('app.updatedSub'));
      hadController = true;
    });
  }

  window.addEventListener('hashchange', () => { handleIncomingLink(); });

  handleIncomingLink().then(shown => { if (!shown) render(); });
