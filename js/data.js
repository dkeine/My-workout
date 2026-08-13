/* ---------------- ICONS ---------------- */
const PATHS = {
    dumbbell: '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trendingUp: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronUp: '<path d="m18 15-6-6-6 6"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    ghost: '<path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect width="12" height="8" x="6" y="14" rx="1"/>',
  };

  function icon(name, size = 20, cls = '') {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="${size}" height="${size}">${PATHS[name]}</svg>`;
  }

  /* ---------------- COVERS ----------------
     Local SVG gradient art — zero network requests (IL-02). */
  const COVER_HUES = {
    chest: ['#2b0a02', '#c2410c', '#ff4b0a'],
    back:  ['#020a24', '#1d4ed8', '#38bdf8'],
    legs:  ['#180226', '#7e22ce', '#c084fc'],
    rest:  ['#03180d', '#15803d', '#34d399'],
  };

  function COVER(muscle) {
    const [a, b, c] = COVER_HUES[muscle] || COVER_HUES.chest;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">
      <defs>
        <linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="${a}"/><stop offset=".65" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="520" fill="url(#g)"/>
      <g fill="none" stroke="#ffffff" stroke-opacity=".14">
        <circle cx="640" cy="150" r="210" stroke-width="46"/>
        <circle cx="640" cy="150" r="120" stroke-width="26"/>
        <circle cx="120" cy="470" r="150" stroke-width="34"/>
      </g>
      <g stroke="#000000" stroke-opacity=".18" stroke-width="3">
        <line x1="-40" y1="420" x2="840" y2="140"/>
        <line x1="-40" y1="470" x2="840" y2="190"/>
        <line x1="-40" y1="520" x2="840" y2="240"/>
      </g>
      <rect width="800" height="520" fill="#000000" fill-opacity=".18"/>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\s+/g, ' '));
  }

  /* ---------------- DEFAULT PLAN (data, not code — IL-05) ---------------- */
  const ex = (name, sets, target, kind = 'exercise') => ({ name, sets, target, kind });
  const brk = () => ({ name: 'Short Break', sets: 0, target: 'Rest & recover', kind: 'break' });

  const DEFAULT_PLAN = {
    id: 'darryl-split',
    name: "Darryl's Split",
    builtin: true,
    days: [
      {
        title: 'Chest + Triceps', focus: 'Push Power', muscle: 'chest',
        exercises: [
          ex('Pull Ups', 1, '30 reps'), ex('Flat Barbell Bench', 3, '10-15 reps'), ex('Incline Barbell Bench', 3, '10-15 reps'),
          ex('Chest Fly Machine', 3, '15 reps'), ex('Chest Dips (lean forward)', 3, 'To Failure'), brk(),
          ex('Double Arm Push Down (metal)', 3, '10-15 reps'), ex('Overhead Push Up', 3, '10-15 reps'), ex('Single Arm Push Down', 3, '10-15 reps'), brk(),
          ex('Incline Treadmill', 1, '15 min @ 3.5mph', 'cardio')
        ]
      },
      {
        title: 'Back + Biceps', focus: 'Pull Strength', muscle: 'back',
        exercises: [
          ex('Pull Ups', 1, '50 reps'), ex('Machine Rows', 3, '10-15 reps'), ex('Lat Pull Down (wide)', 3, '10-15 reps'),
          ex('Lat Pull Down (narrow)', 3, '10-15 reps'), ex('Chest Supported Rows', 3, '15 reps'), brk(),
          ex('Traps Shrugs', 3, '10-15 reps'), ex('Face Pulls', 3, '10-15 reps'), brk(),
          ex('Barbell / Dumbbell Curls', 3, '10-15 reps'), ex('Incline Seated Dumbbell Curl', 3, '10-15 reps'),
          ex('Hammer Curl', 3, '10-15 reps'), ex('Concentration Curls', 3, '10-15 reps'), brk(),
          ex('Incline Treadmill', 1, '15 min @ 3.5mph', 'cardio')
        ]
      },
      {
        title: 'Shoulders + Legs + Core', focus: 'Full Engine', muscle: 'legs',
        exercises: [
          ex('Pull Ups', 1, '30 reps'), ex('Shoulder Press', 3, '10-15 reps'), ex('Lateral Raises', 3, '10-15 reps'),
          ex('Frontal Raises', 3, '10-15 reps'), ex('Shrugs', 3, '15 reps'), ex('Face Pulls', 3, '15 reps'), brk(),
          ex('Squats', 3, '10-15 reps'), ex('Leg Press', 3, '10-15 reps'), ex('Leg Raises', 3, '10-15 reps'), ex('Hamstring Curl', 3, '10-15 reps'), brk(),
          ex('Declined Bench Sit Ups', 3, '10-15 reps'), ex('Hanging / Laying Leg Raises', 3, '10-15 reps'),
          ex('Cable Crunches', 3, '10-15 reps'), ex('Planks', 3, '1 min'), ex('Jumping Jacks', 1, '300 reps', 'cardio')
        ]
      },
      {
        title: 'Chest + Triceps', focus: 'Push Power', muscle: 'chest',
        exercises: [
          ex('Pull Ups', 1, '30 reps'), ex('Incline Dumbbell Bench', 3, '10-15 reps'), ex('Chest Fly Machine', 3, '15 reps'),
          ex('Cable Fly (high-to-low)', 3, '10-15 reps'), ex('Chest Dips (lean forward)', 3, 'To Failure'), brk(),
          ex('Double Arm Push Down (metal)', 3, '10-15 reps'), ex('Overhead Arm Push Up', 3, '10-15 reps'),
          ex('Single Arm Push Down', 3, '10-15 reps'), ex('Machine Arm Push Down', 3, '10-15 reps'), brk(),
          ex('Incline Treadmill', 1, '15 min @ 3.5mph', 'cardio')
        ]
      },
      {
        title: 'Back + Biceps', focus: 'Pull Strength', muscle: 'back',
        exercises: [
          ex('Pull Ups', 1, '50 reps'), ex('Deadlift', 3, '10 reps'), ex('Lat Pull Down (wide)', 3, '10-15 reps'),
          ex('Lat Pull Down (narrow)', 3, '10-15 reps'), ex('Seated Row', 3, '10-15 reps'), ex('Machine Pullovers', 3, '15 reps'), brk(),
          ex('Preacher Curls', 3, '10-15 reps'), ex('Cable Curls', 3, '10-15 reps'), ex('Hammer Curls', 3, '10-15 reps'),
          ex('Wrist Curls', 3, '10-15 reps'), ex('Reverse Wrist Curls', 3, '10-15 reps'), brk(),
          ex('Incline Treadmill', 1, '15 min @ 3.5mph', 'cardio')
        ]
      },
      { title: 'Rest Day', focus: 'Recover & Grow', muscle: 'rest', exercises: [] },
      { title: 'Rest Day', focus: 'Recover & Grow', muscle: 'rest', exercises: [] },
    ],
  };
