/* ---------------- THE COACH (Round 3) ----------------
   The difference between a logbook and a training app: this file tells
   you what to lift today. Double progression + RIR awareness + stall
   detection with a deload call, estimated 1RM, warm-up ramps and plate
   math. All computed from your own history, on-device. */

/* Epley estimated 1RM */
function epley(weight, reps) {
  if (weight == null || !reps) return null;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function bestE1RM(sets) {
  let best = null;
  (sets || []).forEach(st => {
    const e = epley(st.weight, st.reps);
    if (e != null && (best == null || e > best)) best = e;
  });
  return best;
}

/* "10-15 reps" -> {min:10,max:15}; "12 reps" -> {min:12,max:12} */
function parseRepRange(target) {
  const range = String(target || '').match(/(\d+)\s*-\s*(\d+)/);
  if (range) return { min: +range[1], max: +range[2] };
  const single = String(target || '').match(/(\d+)\s*rep/i);
  if (single) return { min: +single[1], max: +single[1] };
  return null;
}

/* Most recent sessions containing weighted sets of this exercise, newest first. */
function exerciseHistory(name, limit = 20) {
  const all = loadSessions();
  const out = [];
  Object.keys(all).sort().reverse().some(date => {
    const m = (all[date].exercises || []).find(x => x.name === name);
    if (m) {
      const sets = (m.sets || []).filter(st => st.weight != null && st.reps != null);
      if (sets.length) out.push({ date, sets });
    }
    return out.length >= limit;
  });
  return out;
}

function progressionIncrement() {
  return getUnit() === 'lb' ? 5 : 2.5;
}

function roundToIncrement(w) {
  const inc = getUnit() === 'lb' ? 2.5 : 1.25;
  return Math.round(w / inc) * inc;
}

/* The call: increase / hold / deload — or null when there's nothing to say. */
function coachSuggestion(exr) {
  if (exr.kind !== 'exercise') return null;
  const range = parseRepRange(exr.target);
  const hist = exerciseHistory(exr.name, 4);
  if (!hist.length) return null;

  const last = hist[0];
  const topWeight = Math.max(...last.sets.map(s => s.weight));

  // Stall check: three straight sessions stuck at the SAME top weight with no
  // e1RM improvement → deload. (A weight jump with fewer reps is normal
  // double progression, not a stall.)
  if (hist.length >= 3) {
    const e = hist.map(h => bestE1RM(h.sets));
    const tops = hist.map(h => Math.max(...h.sets.map(s => s.weight)));
    if (tops[0] === tops[1] && tops[1] === tops[2] &&
        e[0] != null && e[1] != null && e[2] != null && e[0] <= e[1] && e[1] <= e[2]) {
      return { type: 'deload', weight: roundToIncrement(topWeight * 0.9), e1rm: e[0] };
    }
  }

  if (!range) return { type: 'hold', weight: topWeight, reps: null, e1rm: bestE1RM(last.sets) };

  // Double progression: every set at the top of the range → add load
  const toppedOut = last.sets.every(s => s.reps >= range.max);
  const rirs = last.sets.map(s => s.rir).filter(r => r != null);
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;

  if (toppedOut) {
    const jumps = avgRir != null && avgRir >= 3 ? 2 : 1; // tons in the tank → bigger jump
    return { type: 'increase', weight: topWeight + jumps * progressionIncrement(), reps: range.min, e1rm: bestE1RM(last.sets) };
  }

  const bestReps = Math.max(...last.sets.map(s => s.reps));
  return { type: 'hold', weight: topWeight, reps: Math.min(range.max, bestReps + 1), e1rm: bestE1RM(last.sets) };
}

/* ---------------- Muscle classifier ----------------
   Heuristic keyword mapping for volume tracking. Order matters. */
const MUSCLE_RULES = [
  ['core', /crunch|plank|sit up|sit-up|ab wheel|hanging leg|laying leg|l-sit/i],
  ['legs', /squat|lunge|hamstring|quad|calf|calves|\bleg\b|rdl|hip thrust|glute|step up/i],
  ['back', /back ext/i],
  ['biceps', /\bcurl/i],
  ['triceps', /push ?down|pushdown|tricep|skull|close grip|overhead push|extension/i],
  ['shoulders', /shoulder|\bohp\b|overhead press|lateral raise|frontal raise|front raise|rear delt|face pull|arnold/i],
  ['back', /row|pull ?up|chin ?up|pull ?down|pulldown|pullover|deadlift|shrug|\blat\b/i],
  ['chest', /bench|chest|fly|dip|push ?up|pec/i],
];

function muscleOf(name) {
  for (const [muscle, rx] of MUSCLE_RULES) {
    if (rx.test(name)) return muscle;
  }
  return 'other';
}

/* Hard sets per muscle for the week containing `ref` (Mon-Sun). */
function weeklyMuscleSets(weekOffset = 0) {
  const all = loadSessions();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const from = isoOf(monday), to = isoOf(sunday);

  const counts = {};
  Object.values(all).forEach(sess => {
    if (sess.date < from || sess.date > to) return;
    (sess.exercises || []).forEach(e => {
      if (e.kind !== 'exercise' || e.skipped) return;
      const hard = (e.sets || []).filter(st => st.done || st.weight != null || st.reps != null).length;
      if (!hard) return;
      const m = muscleOf(e.name);
      counts[m] = (counts[m] || 0) + hard;
    });
  });
  return counts;
}

/* ---------------- Warm-up ramp + plate math ---------------- */
function isBarbellLift(name) {
  return /barbell|bench|squat|deadlift|ohp|overhead press|row/i.test(name) &&
    !/dumbbell|machine|cable|smith|band/i.test(name);
}

const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] };

function platesPerSide(total) {
  const bar = getBarWeight();
  let side = (total - bar) / 2;
  if (side <= 0) return { plates: [], exact: total === bar };
  const out = [];
  for (const p of PLATES[getUnit()]) {
    while (side >= p - 1e-9) {
      out.push(p);
      side -= p;
    }
  }
  return { plates: out, exact: side < 1e-9 };
}

function warmupRamp(workWeight, useBar = true) {
  const bar = getBarWeight();
  // A bar has an empty-bar step and a floor; a dumbbell or machine has neither.
  const steps = useBar
    ? [{ pct: 0, reps: 10 }, { pct: 0.55, reps: 5 }, { pct: 0.75, reps: 3 }, { pct: 0.9, reps: 1 }]
    : [{ pct: 0.4, reps: 10 }, { pct: 0.6, reps: 5 }, { pct: 0.8, reps: 3 }];
  const ramp = [];
  steps.forEach(s => {
    if (s.pct === 0) {
      ramp.push({ weight: bar, reps: s.reps, isBar: true });
      return;
    }
    const raw = roundToIncrement(workWeight * s.pct);
    const w = useBar ? Math.max(bar, raw) : raw;
    if (w >= workWeight || w <= 0) return;
    if (ramp.some(r => r.weight === w)) return;
    ramp.push({ weight: w, reps: s.reps, isBar: false });
  });
  return ramp;
}
