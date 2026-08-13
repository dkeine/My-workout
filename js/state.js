/* ---------------- STATE / STORAGE ---------------- */
const LS_SESSIONS = 'ironlog-sessions';
const LS_THEME = 'ironlog-theme';
const LS_PLANS = 'ironlog-plans';
const LS_ACTIVE = 'ironlog-active-plan';
const LS_UNIT = 'ironlog-unit';
const LS_GHOST = 'ironlog-ghost';
const LS_PREFIX = 'ironlog-';

const BACKUP_FORMAT = 'ironlog-backup';
const BACKUP_VERSION = 1;

const pad = n => String(n).padStart(2, '0');

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const weekdayIndex = () => ((new Date().getDay()) + 6) % 7;

function lsGet(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

/* ---- Sessions ---- */
function loadSessions() {
  return lsGet(LS_SESSIONS, {});
}

function saveSessions(s) {
  localStorage.setItem(LS_SESSIONS, JSON.stringify(s));
}

function getSession(date) {
  return loadSessions()[date] || null;
}

function putSession(date, sess) {
  const all = loadSessions();
  all[date] = sess;
  saveSessions(all);
}

/* ---- Plans (IL-05/07): stored as data, several at once, one active ---- */
function loadPlans() {
  let plans = lsGet(LS_PLANS, null);
  if (!plans || !Object.keys(plans).length) {
    plans = { [DEFAULT_PLAN.id]: DEFAULT_PLAN };
    localStorage.setItem(LS_PLANS, JSON.stringify(plans));
  }
  return plans;
}

function savePlans(p) {
  localStorage.setItem(LS_PLANS, JSON.stringify(p));
}

function getPlan(id) {
  return loadPlans()[id] || null;
}

function putPlan(plan) {
  const all = loadPlans();
  all[plan.id] = plan;
  savePlans(all);
}

function deletePlan(id) {
  const all = loadPlans();
  delete all[id];
  savePlans(all);
  if (getActivePlanId() === id) setActivePlan(Object.keys(all)[0] || DEFAULT_PLAN.id);
}

function getActivePlanId() {
  return localStorage.getItem(LS_ACTIVE) || DEFAULT_PLAN.id;
}

function setActivePlan(id) {
  localStorage.setItem(LS_ACTIVE, id);
}

function getActivePlan() {
  return getPlan(getActivePlanId()) || loadPlans()[Object.keys(loadPlans())[0]] || DEFAULT_PLAN;
}

function newPlanId() {
  return 'plan-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function normalizePlan(p) {
  /* Validate/repair an incoming plan object; returns null if hopeless. */
  if (!p || typeof p !== 'object' || !Array.isArray(p.days)) return null;
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = p.days[i] || {};
    days.push({
      title: String(d.title || 'Rest Day').slice(0, 60),
      focus: String(d.focus || '').slice(0, 60),
      muscle: COVER_HUES[d.muscle] ? d.muscle : 'rest',
      exercises: (Array.isArray(d.exercises) ? d.exercises : []).slice(0, 40).map(e => ({
        name: String(e.name || 'Exercise').slice(0, 80),
        sets: Math.max(0, Math.min(10, parseInt(e.sets) || 0)),
        target: String(e.target || '').slice(0, 60),
        kind: ['exercise', 'cardio', 'break'].includes(e.kind) ? e.kind : 'exercise',
      })),
    });
  }
  return { id: String(p.id || newPlanId()), name: String(p.name || 'Split').slice(0, 60), builtin: false, days };
}

function trainingDays(plan) {
  return plan.days.map((d, i) => (d.exercises.length ? i : -1)).filter(i => i >= 0);
}

function planExerciseCount(plan) {
  return plan.days.reduce((n, d) => n + d.exercises.filter(e => e.kind !== 'break').length, 0);
}

/* ---- Unit (IL-09): label only, no conversion of logged numbers ---- */
function getUnit() {
  return localStorage.getItem(LS_UNIT) === 'lb' ? 'lb' : 'kg';
}

function setUnit(u) {
  localStorage.setItem(LS_UNIT, u === 'lb' ? 'lb' : 'kg');
}

/* ---- Session building ---- */
function buildSession(dayIdx, date) {
  const plan = getActivePlan();
  const day = plan.days[dayIdx];
  const exercises = day.exercises.map(e => ({
    name: e.name,
    kind: e.kind,
    target: e.target,
    sets: (e.kind === 'break' || e.kind === 'cardio') ? [] : Array.from({ length: e.sets }, () => ({ weight: null, reps: null, done: false })),
    done: false
  }));
  return {
    date,
    weekday: dayIdx,
    planId: plan.id,
    title: day.title,
    muscle: day.muscle,
    exercises,
    completed: false,
    completed_count: 0,
    total_count: exercises.filter(e => e.kind !== 'break').length
  };
}

function recompute(s) {
    const trackable = s.exercises.filter(e => e.kind !== 'break');
    const done = trackable.filter(e => e.done || e.skipped).length;
    s.completed_count = done;
    s.total_count = trackable.length;
    s.completed = trackable.length > 0 && done === trackable.length;
    return s;
}

/* Most recent logged sets per exercise name, from an arbitrary session store. */
function previousFrom(store, names, beforeDate) {
  const dates = Object.keys(store).filter(d => !beforeDate || d < beforeDate).sort().reverse();
  const res = {};
  names.forEach(name => {
    for (const d of dates) {
      const sess = store[d];
      const m = (sess.exercises || []).find(x => x.name === name);
      if (!m) continue;
      const logged = (m.sets || []).filter(s => s.weight != null || s.reps != null);
      if (logged.length || m.done) {
        res[name] = { date: d, sets: logged };
        break;
      }
    }
  });
  return res;
}

function getPrevious(date) {
  const wd = (new Date(date + 'T00:00:00').getDay() + 6) % 7;
  const names = getActivePlan().days[wd].exercises.filter(e => e.kind !== 'break').map(e => e.name);
  return previousFrom(loadSessions(), names, date);
}

/* ---- Ghost mode (IL-13) ---- */
function getGhost() {
  return lsGet(LS_GHOST, null);
}

function setGhost(g) {
  if (g) localStorage.setItem(LS_GHOST, JSON.stringify(g));
  else localStorage.removeItem(LS_GHOST);
}

function getGhostPrevious(date) {
  const g = getGhost();
  if (!g || !g.sessions) return {};
  const wd = (new Date(date + 'T00:00:00').getDay() + 6) % 7;
  const names = getActivePlan().days[wd].exercises.filter(e => e.kind !== 'break').map(e => e.name);
  return previousFrom(g.sessions, names, null);
}

/* ---- Stats (IL-10: derived from the active plan, any split shape) ---- */
function computeStats() {
  const all = loadSessions();
  const plan = getActivePlan();
  const scheduled = new Set(trainingDays(plan));
  const doneDates = new Set(Object.values(all).filter(s => s.completed).map(s => s.date));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Streak: consecutive scheduled days completed (today may still be pending)
  let streak = 0;
  let cur = new Date(today);
  for (let k = 0; k < 366; k++) {
    const wd = (cur.getDay() + 6) % 7;
    if (scheduled.has(wd)) {
      if (doneDates.has(iso(cur))) streak++;
      else if (iso(cur) === iso(today)) {}
      else break;
    }
    cur.setDate(cur.getDate() - 1);
  }

  // Week grid: all 7 days, marking scheduled + done
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const grid = [];
  let weekDone = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const done = doneDates.has(iso(d));
    const sch = scheduled.has(i);
    if (done && sch) weekDone++;
    grid.push({ wd: i, scheduled: sch, done, isToday: iso(d) === iso(today) });
  }

  return {
    streak,
    weekDone,
    weekTotal: scheduled.size,
    grid,
    total: doneDates.size,
    sessions: Object.values(all).sort((a, b) => b.date < a.date ? -1 : 1)
  };
}

/* ---- Records / PR passport (IL-19) ---- */
function computeRecords() {
  const all = loadSessions();
  const best = {};
  Object.values(all).forEach(sess => {
    (sess.exercises || []).forEach(e => {
      if (e.kind === 'break' || e.kind === 'cardio') return;
      (e.sets || []).forEach(st => {
        if (st.weight == null) return;
        const b = best[e.name];
        if (!b || st.weight > b.weight || (st.weight === b.weight && (st.reps || 0) > (b.reps || 0))) {
          best[e.name] = { name: e.name, weight: st.weight, reps: st.reps, date: sess.date };
        }
      });
    });
  });
  return Object.values(best).sort((a, b) => b.weight - a.weight);
}

/* ---- Backup: build / merge (IL-01) ---- */
function buildBackup() {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    unit: getUnit(),
    activePlan: getActivePlanId(),
    plans: loadPlans(),
    sessions: loadSessions(),
    records: computeRecords(),
  };
}

function isBackup(obj) {
  return obj && obj.format === BACKUP_FORMAT && obj.sessions && typeof obj.sessions === 'object';
}

function mergeBackup(obj) {
  if (!isBackup(obj)) return null;
  const sessions = loadSessions();
  let addedSessions = 0;
  Object.entries(obj.sessions).forEach(([date, sess]) => {
    if (!sessions[date] && sess && Array.isArray(sess.exercises)) {
      sessions[date] = sess;
      addedSessions++;
    }
  });
  saveSessions(sessions);

  const plans = loadPlans();
  let addedPlans = 0;
  Object.values(obj.plans || {}).forEach(p => {
    const clean = normalizePlan(p);
    if (clean && !plans[clean.id]) {
      plans[clean.id] = clean;
      addedPlans++;
    }
  });
  savePlans(plans);
  return { addedSessions, addedPlans };
}

/* ---- Reset (IL-04): only our keys, and the caller hands out a backup first ---- */
function resetAppData() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(LS_PREFIX))
    .forEach(k => localStorage.removeItem(k));
}

/* ---------------- THEME ---------------- */
function initTheme() {
  const t = localStorage.getItem(LS_THEME) || 'dark';
  applyTheme(t);
}

function applyTheme(t) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  localStorage.setItem(LS_THEME, t);
}

function toggleTheme() {
  const cur = localStorage.getItem(LS_THEME) || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}
