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
    }
    if (!todaySession.completed) wasComplete = false;
  }

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
      html += `<div class="stack" id="ex-list"></div>`;
    }
    html += `</div>`;
    v.innerHTML = html;
    if (!isRest) buildCards();
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
      const ghost = getGhost() && todayGhost[exr.name] ? summaryStr(todayGhost[exr.name]) : null;

      el.className = 'card' + (exr.skipped ? ' skipped' : exr.done ? ' done' : '');
      el.dataset.idx = i;

      const showMic = !simple && !exr.skipped && voiceAvailable();
      let inner = `
        <div class="ex-head" style="justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <span style="color:${exr.skipped ? 'hsl(var(--muted-foreground))' : exr.done ? 'hsl(var(--success))' : 'hsl(var(--primary))'}">
              ${icon(simple ? 'waves' : 'dumbbell', 16)}
            </span>
            <div style="min-width:0"><div class="ex-name">${esc(exr.name)}</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            ${showMic ? `<button class="mic-btn" type="button" title="${t('voice.mic')}" aria-label="${t('voice.mic')}">${icon('mic', 16)}</button>` : ''}
            <button class="skip-btn ${exr.skipped ? 'on' : ''}" type="button">
              ${exr.skipped ? t('today.skipped') : t('today.skip')}
            </button>
          </div>
        </div>
        <div class="ex-target">${esc(exr.target)}</div>
      `;

      if (summ && !exr.skipped) {
        inner += `<div class="prev-hint">${icon('trendingUp', 14)}<span>${t('today.last', { when: relDay(prev.date) })} <span class="v">${esc(summ)}</span></span></div>`;
      }
      if (ghost && !exr.skipped) {
        inner += `<div class="ghost-hint">${icon('ghost', 14)}<span>${esc(getGhost().label)}: <span class="v">${esc(ghost)}</span> — ${t('today.beatIt')}</span></div>`;
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
        inner += `<div class="sets-wrap ${exr.skipped ? 'disabled-sets' : ''}" style="display:flex;flex-direction:column;gap:8px;margin-top:12px">`;
        exr.sets.forEach((st, si) => {
          const ps = prev && prev.sets[si];
          inner += `<div class="setrow" data-si="${si}">
            <span class="setnum">${si + 1}</span>
            <div style="flex:1;display:flex;align-items:center;gap:8px">
              <div class="setcell"><input type="number" inputmode="decimal" class="w" placeholder="${ps && ps.weight != null ? ps.weight : u}" value="${st.weight ?? ''}" ${exr.skipped ? 'disabled' : ''}/></div>
              <span class="xsign">×</span>
              <div class="setcell"><input type="number" inputmode="numeric" class="r" placeholder="${ps && ps.reps != null ? ps.reps : 'reps'}" value="${st.reps ?? ''}" ${exr.skipped ? 'disabled' : ''}/></div>
            </div>
            <button class="checkbtn ${st.done && !exr.skipped ? 'on' : ''}" ${exr.skipped ? 'disabled' : ''}>${icon('check', 20)}</button></div>`;
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
          row.querySelector('.checkbtn').onclick = () => {
            if (exr.skipped) return;
            st.done = !st.done;
            row.querySelector('.checkbtn').classList.toggle('on', st.done);
            exr.done = exr.sets.every(s => s.done);
            el.classList.toggle('done', exr.done);
            updateProgress();
            persistToday();
          };
        });
      }

      const micBtn = el.querySelector('.mic-btn');
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
      if (sets) sets.oninput = ev => { e.sets = Math.max(1, Math.min(10, parseInt(ev.target.value) || 1)); };
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

  /* ---- HISTORY (+ IL-19 records) ---- */
  let recordsExpanded = false;

  function fmtDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(getLang(), { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function renderHistory(v) {
    const s = computeStats();
    const records = computeRecords();
    const u = getUnit();

    let sessions = s.sessions.length === 0
      ? `<p class="muted" style="font-size:14px;padding:32px 0;text-align:center">${t('history.empty')}</p>`
      : '<div class="stack">' + s.sessions.map((x) => {
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
        }).join('') + '</div>';

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
      ${recordsHtml}
      <h2 class="display" style="font-size:24px;text-transform:uppercase;margin-top:32px;margin-bottom:12px">${t('history.recent')}</h2>
      ${sessions}
    </div>`;

    document.getElementById('btn-flex').onclick = shareFlexCard;
    const recToggle = document.getElementById('rec-toggle');
    if (recToggle) recToggle.onclick = () => { recordsExpanded = !recordsExpanded; render(); };
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
          ${settingsRow('ghost', t('settings.ghostLoad'), t('settings.importSub'), 'btn-ghost-load')}
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

    v.querySelectorAll('.seg-btn').forEach(b => {
      b.onclick = () => { setUnit(b.dataset.u); renderSettings(v); };
    });
    document.getElementById('lang-select').onchange = e => {
      setLang(e.target.value);
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
  renderNav();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  window.addEventListener('hashchange', () => { handleIncomingLink(); });

  handleIncomingLink().then(shown => { if (!shown) render(); });
