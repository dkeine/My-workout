/* ---------------- FIRST PRINCIPLES (Round 4) ----------------
   Ten features derived from what training actually is, not from what
   other apps ship. Each one traces to a principle:

   P1 capacity varies day to day        -> readiness dial
   P2 recovery is half of adaptation    -> recovery clocks
   P3 consistency beats optimization    -> minimum viable session
   P4 cognition is scarce mid-set       -> ditto set
   P5 measure reality, not intention    -> rest truth
   P6 volume is an inverted U           -> junk volume report
   P7 fatigue is systemic               -> fatigue radar
   P8 interruption is normal            -> comeback protocol
   P9 asymmetry accumulates             -> balance ledger
   P10 progress lives on months         -> PR forecast
*/

/* ---- P1: Readiness dial — one tap, scales today's calls ---- */
function loadReadiness() {
  return lsGet(LS_READINESS, {});
}

function getReadiness(date = todayStr()) {
  const v = loadReadiness()[date];
  return v == null ? null : v; // -1 rough | 0 normal | 1 primed
}

function setReadiness(v, date = todayStr()) {
  const all = loadReadiness();
  all[date] = v;
  localStorage.setItem(LS_READINESS, JSON.stringify(all));
}

/* A rough day turns an increase into a hold; a primed day lets a hold
   become a small increase. The body, not the spreadsheet, decides. */
function applyReadiness(suggestion, readiness) {
  if (!suggestion || readiness == null || readiness === 0) return suggestion;
  const inc = progressionIncrement();
  if (readiness < 0 && suggestion.type === 'increase') {
    return { ...suggestion, type: 'hold', weight: suggestion.weight - inc, damped: true };
  }
  if (readiness > 0 && suggestion.type === 'hold' && suggestion.reps) {
    return { ...suggestion, type: 'increase', weight: suggestion.weight + inc, boosted: true };
  }
  return suggestion;
}

/* ---- P2: Recovery clocks — hours since each muscle was worked ---- */
const MUSCLE_ORDER = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core'];
const FULL_RECOVERY_HOURS = 48;

function lastTrainedAt(sessions) {
  const out = {};
  Object.values(sessions || loadSessions()).forEach(sess => {
    (sess.exercises || []).forEach(e => {
      if (e.kind !== 'exercise' || e.skipped) return;
      const hard = (e.sets || []).filter(st => st.done || st.weight != null);
      if (!hard.length) return;
      // Prefer a real timestamp; fall back to 18:00 on the session date.
      const stamped = hard.map(st => st.ts).filter(Boolean);
      const when = stamped.length ? Math.max(...stamped)
        : new Date(sess.date + 'T18:00:00').getTime();
      const m = muscleOf(e.name);
      if (!out[m] || when > out[m]) out[m] = when;
    });
  });
  return out;
}

function recoveryClocks(nowMs = Date.now()) {
  const last = lastTrainedAt();
  return MUSCLE_ORDER.map(m => {
    const when = last[m];
    if (!when) return { muscle: m, hours: null, fresh: 1 };
    const hours = Math.max(0, (nowMs - when) / 36e5);
    return { muscle: m, hours, fresh: Math.min(1, hours / FULL_RECOVERY_HOURS) };
  });
}

/* ---- P3: Minimum viable session — 20 minutes beats zero minutes ---- */
const MINUTES_PER_SET = 2.25; // work + rest, measured-ish

function exerciseValue(exr, index) {
  // Compounds first: they buy the most adaptation per minute.
  let v = 0;
  if (isBarbellLift(exr.name)) v += 3;
  if (/squat|deadlift|bench|press|row|pull ?up|chin ?up|dip/i.test(exr.name)) v += 3;
  if (/machine|cable|fly|raise|curl|push ?down|extension|shrug/i.test(exr.name)) v -= 1;
  if (exr.kind === 'cardio') v -= 2;
  v -= index * 0.15; // programme order carries intent
  return v;
}

function minimumViableSession(session, budgetMinutes = 20) {
  const trackable = session.exercises
    .map((e, i) => ({ e, i }))
    .filter(x => x.e.kind !== 'break' && !x.e.done && !x.e.skipped);
  const ranked = trackable
    .map(x => ({ ...x, value: exerciseValue(x.e, x.i) }))
    .sort((a, b) => b.value - a.value);

  const keep = new Set();
  let minutes = 0;
  for (const x of ranked) {
    const cost = Math.max(1, (x.e.sets || []).length || 1) * MINUTES_PER_SET;
    if (minutes + cost > budgetMinutes && keep.size) continue;
    keep.add(x.i);
    minutes += cost;
  }
  return { keep, cut: trackable.filter(x => !keep.has(x.i)).map(x => x.i), minutes: Math.round(minutes) };
}

/* ---- P5: Rest truth — what you actually rested, not what you meant to ---- */
function restGaps(session) {
  const stamps = [];
  (session.exercises || []).forEach(e => {
    (e.sets || []).forEach(st => { if (st.ts) stamps.push(st.ts); });
  });
  stamps.sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < stamps.length; i++) {
    const g = (stamps[i] - stamps[i - 1]) / 1000;
    if (g > 10 && g < 15 * 60) gaps.push(g); // ignore instant re-taps and long breaks
  }
  return gaps;
}

function medianRest(session) {
  const gaps = restGaps(session).sort((a, b) => a - b);
  if (!gaps.length) return null;
  const mid = Math.floor(gaps.length / 2);
  return Math.round(gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2);
}

/* ---- P6: Junk volume — sets too easy to have asked anything of you ---- */
function junkVolume(days = 14) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const from = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
  const all = loadSessions();
  let junk = 0, total = 0;
  const byExercise = {};
  Object.values(all).forEach(sess => {
    if (sess.date < from) return;
    (sess.exercises || []).forEach(e => {
      if (e.kind !== 'exercise' || e.skipped) return;
      (e.sets || []).forEach(st => {
        if (st.weight == null && st.reps == null) return;
        total++;
        if (st.rir != null && st.rir >= 4) {
          junk++;
          byExercise[e.name] = (byExercise[e.name] || 0) + 1;
        }
      });
    });
  });
  const worst = Object.entries(byExercise).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { junk, total, minutes: Math.round(junk * MINUTES_PER_SET), worst, days };
}

/* ---- P7: Fatigue radar — is the hole getting deeper? ---- */
function windowStats(fromDate, toDate) {
  const all = loadSessions();
  let sets = 0, rirSum = 0, rirCount = 0;
  const e1rm = {};
  Object.values(all).forEach(sess => {
    if (sess.date < fromDate || sess.date > toDate) return;
    (sess.exercises || []).forEach(e => {
      if (e.kind !== 'exercise' || e.skipped) return;
      (e.sets || []).forEach(st => {
        if (st.weight == null && st.reps == null) return;
        sets++;
        if (st.rir != null) { rirSum += st.rir; rirCount++; }
      });
      const best = bestE1RM(e.sets);
      if (best != null && (!e1rm[e.name] || best > e1rm[e.name])) e1rm[e.name] = best;
    });
  });
  return { sets, avgRir: rirCount ? rirSum / rirCount : null, e1rm };
}

function fatigueRadar() {
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const d7 = new Date(today); d7.setDate(today.getDate() - 6);
  const d8 = new Date(today); d8.setDate(today.getDate() - 13);
  const d14 = new Date(today); d14.setDate(today.getDate() - 7);

  const recent = windowStats(iso(d7), iso(today));
  const prior = windowStats(iso(d8), iso(d14));
  if (!recent.sets && !prior.sets) return null;

  const shared = Object.keys(recent.e1rm).filter(n => prior.e1rm[n]);
  let perf = 0;
  shared.forEach(n => { perf += recent.e1rm[n] - prior.e1rm[n]; });
  const perfPerLift = shared.length ? perf / shared.length : 0;
  const volumeDelta = prior.sets ? (recent.sets - prior.sets) / prior.sets : 0;

  // Less corroboration demands a stronger signal: two lifts agreeing on any
  // decline counts, a single lift has to drop meaningfully.
  const declining = shared.length >= 2 ? perfPerLift < 0 : shared.length === 1 && perfPerLift < -2;

  let status = 'steady';
  if (volumeDelta > 0.2 && declining) status = 'hole';
  else if (volumeDelta > 0.1 && perfPerLift >= 0) status = 'building';
  else if (recent.sets < prior.sets * 0.6) status = 'light';

  return {
    status,
    recentSets: recent.sets,
    priorSets: prior.sets,
    volumeDelta,
    perfPerLift: Math.round(perfPerLift * 10) / 10,
    lifts: shared.length,
  };
}

/* ---- P8: Comeback protocol — time off is data, not shame ---- */
function comebackFor(name, nowMs = Date.now()) {
  const hist = exerciseHistory(name, 1);
  if (!hist.length) return null;
  const days = Math.floor((nowMs - new Date(hist[0].date + 'T12:00:00').getTime()) / 864e5);
  if (days < 14) return null;
  const top = Math.max(...hist[0].sets.map(s => s.weight));
  const factor = days >= 56 ? 0.75 : days >= 28 ? 0.85 : 0.9;
  return { days, weight: roundToIncrement(top * factor), previous: top };
}

/* ---- P9: Balance ledger — what the body is quietly accumulating ---- */
const PUSH = ['chest', 'shoulders', 'triceps'];
const PULL = ['back', 'biceps'];

function balanceLedger(days = 28) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const from = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
  const all = loadSessions();
  const counts = {};
  Object.values(all).forEach(sess => {
    if (sess.date < from) return;
    (sess.exercises || []).forEach(e => {
      if (e.kind !== 'exercise' || e.skipped) return;
      const hard = (e.sets || []).filter(st => st.done || st.weight != null).length;
      if (!hard) return;
      const m = muscleOf(e.name);
      counts[m] = (counts[m] || 0) + hard;
    });
  });

  const push = PUSH.reduce((n, m) => n + (counts[m] || 0), 0);
  const pull = PULL.reduce((n, m) => n + (counts[m] || 0), 0);
  const lower = counts.legs || 0;
  const upper = push + pull;
  const total = upper + lower + (counts.core || 0);
  if (!total) return null;

  const findings = [];
  if (push && pull) {
    const ratio = push / pull;
    if (ratio > 1.3) findings.push({ kind: 'pull', gap: Math.ceil((push / 1.1 - pull) / (days / 7)) });
    else if (ratio < 0.77) findings.push({ kind: 'push', gap: Math.ceil((pull / 1.1 - push) / (days / 7)) });
  } else if (push && !pull) findings.push({ kind: 'pull', gap: Math.ceil(push / (days / 7)) });
  else if (pull && !push) findings.push({ kind: 'push', gap: Math.ceil(pull / (days / 7)) });

  if (upper && lower / Math.max(1, upper) < 0.3) {
    findings.push({ kind: 'legs', gap: Math.ceil((upper * 0.35 - lower) / (days / 7)) });
  }

  return { push, pull, lower, core: counts.core || 0, total, findings, days };
}

/* ---- P10: PR forecast — the months-scale view of a day-scale grind ---- */
function prForecast(name) {
  const hist = exerciseHistory(name, 12).slice().reverse();
  const points = hist.map(h => ({
    x: new Date(h.date + 'T12:00:00').getTime() / 864e5,
    y: bestE1RM(h.sets),
  })).filter(p => p.y != null);
  if (points.length < 4) return null;

  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0, den = 0;
  points.forEach(p => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; });
  if (den === 0) return null;
  const slope = num / den; // units per day
  const intercept = my - slope * mx;

  let ssRes = 0, ssTot = 0;
  points.forEach(p => {
    ssRes += (p.y - (slope * p.x + intercept)) ** 2;
    ssTot += (p.y - my) ** 2;
  });
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  if (slope <= 0 || r2 < 0.3) return null;

  const step = getUnit() === 'lb' ? 10 : 5;
  const current = Math.max(...points.map(p => p.y));
  const target = Math.ceil((current + 0.1) / step) * step;
  const days = Math.ceil((target - current) / slope);
  if (!Number.isFinite(days) || days <= 0 || days > 400) return null;

  const when = new Date();
  when.setDate(when.getDate() + days);
  return { target, days, date: when, r2: Math.round(r2 * 100) / 100, perWeek: Math.round(slope * 7 * 10) / 10 };
}
