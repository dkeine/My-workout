/* ---------------- THE GREAT MIGRATION (IL-18) ----------------
   CSV importers for Strong, Hevy and FitNotes exports. Their moat is
   switching cost; this drains it, file by file. */

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === ';') {
      // Strong exports use ';' in some locales; a header decides per-file
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some(f => f !== '')) rows.push(row);
  }
  return rows;
}

function csvColumns(header) {
  const map = {};
  header.forEach((h, i) => { map[h.trim().toLowerCase()] = i; });
  return map;
}

function findCol(cols, names) {
  for (const n of names) if (cols[n] != null) return cols[n];
  return -1;
}

function detectCsvApp(header) {
  const cols = csvColumns(header);
  if (cols['exercise_title'] != null) return 'Hevy';
  if (cols['workout name'] != null && cols['exercise name'] != null) return 'Strong';
  if (cols['exercise'] != null && cols['category'] != null) return 'FitNotes';
  return null;
}

function csvNum(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function csvDate(v) {
  const m = String(v || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const dm = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); // dd/mm/yyyy
  if (dm) return `${dm[3]}-${dm[2]}-${dm[1]}`;
  return null;
}

/* Turn CSV rows into {date -> {title, entries: [{name, weight, reps}]}} */
function extractWorkouts(rows, app) {
  const cols = csvColumns(rows[0]);
  const spec = {
    Strong:   { date: findCol(cols, ['date']), title: findCol(cols, ['workout name']), ex: findCol(cols, ['exercise name']), weight: findCol(cols, ['weight', 'weight (kg)', 'weight (lb)']), reps: findCol(cols, ['reps']) },
    Hevy:     { date: findCol(cols, ['start_time']), title: findCol(cols, ['title']), ex: findCol(cols, ['exercise_title']), weight: findCol(cols, ['weight_kg', 'weight_lbs']), reps: findCol(cols, ['reps']) },
    FitNotes: { date: findCol(cols, ['date']), title: -1, ex: findCol(cols, ['exercise']), weight: findCol(cols, ['weight (kgs)', 'weight (lbs)', 'weight']), reps: findCol(cols, ['reps']) },
  }[app];
  if (!spec || spec.date < 0 || spec.ex < 0) return {};

  const byDate = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const date = csvDate(r[spec.date]);
    const name = (r[spec.ex] || '').trim();
    if (!date || !name) continue;
    const day = byDate[date] || (byDate[date] = { title: null, entries: [] });
    if (spec.title >= 0 && r[spec.title] && !day.title) day.title = r[spec.title].trim();
    day.entries.push({
      name: name.slice(0, 80),
      weight: spec.weight >= 0 ? csvNum(r[spec.weight]) : null,
      reps: spec.reps >= 0 ? Math.round(csvNum(r[spec.reps]) || 0) || null : null,
    });
  }
  return byDate;
}

function workoutsToSessions(byDate, app) {
  const sessions = {};
  Object.entries(byDate).forEach(([date, day]) => {
    const order = [];
    const grouped = {};
    day.entries.forEach(en => {
      if (!grouped[en.name]) { grouped[en.name] = []; order.push(en.name); }
      if (en.weight != null || en.reps != null) {
        grouped[en.name].push({ weight: en.weight, reps: en.reps, done: true });
      }
    });
    const exercises = order.map(name => ({
      name, kind: 'exercise', target: '',
      sets: grouped[name], done: true,
    }));
    if (!exercises.length) return;
    sessions[date] = {
      date,
      weekday: (new Date(date + 'T00:00:00').getDay() + 6) % 7,
      title: day.title || app + ' workout',
      muscle: 'chest',
      imported: app,
      exercises,
      completed: true,
      completed_count: exercises.length,
      total_count: exercises.length,
    };
  });
  return sessions;
}

/* Main entry: returns {app, added, skipped} or null if unrecognized. */
function importCsvHistory(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return null;
  const app = detectCsvApp(rows[0]);
  if (!app) return null;
  const incoming = workoutsToSessions(extractWorkouts(rows, app), app);
  const existing = loadSessions();
  let added = 0, skipped = 0;
  Object.entries(incoming).forEach(([date, sess]) => {
    if (existing[date]) skipped++;
    else { existing[date] = sess; added++; }
  });
  saveSessions(existing);
  return { app, added, skipped };
}
