/* ---------------- CHALK-HANDS LOGGING (IL-14) ----------------
   Say "sixty by twelve" — the set fills in. Uses the browser's own
   speech engine; no audio ever touches an Iron Log server (there is
   no Iron Log server). */

function voiceAvailable() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

const VOICE_WORDS = {
  // minimal word-number fallback; most engines already emit digits
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

function parseSetPhrase(raw) {
  let s = ' ' + raw.toLowerCase().replace(/,/g, '.') + ' ';
  // merge "sixty five" -> 65, "one hundred twenty" -> 120
  const tokens = s.split(/\s+/).filter(Boolean);
  const nums = [];
  let acc = null;
  const flush = () => { if (acc != null) { nums.push(acc); acc = null; } };
  for (const tok of tokens) {
    const digit = tok.match(/^(\d+(?:\.\d+)?)$/);
    if (digit) {
      flush();
      nums.push(parseFloat(digit[1]));
      continue;
    }
    const w = VOICE_WORDS[tok];
    if (w != null) {
      if (acc == null) acc = w;
      else if (w === 100) acc *= 100;
      else if (w < 10 && acc % 10 === 0) acc += w;                      // "sixty five"
      else if (w >= 10 && w < 100 && acc >= 100 && acc % 100 === 0) acc += w; // "hundred twenty"
      else { flush(); acc = w; }
      continue;
    }
    flush();
  }
  flush();
  if (nums.length < 2) return null;
  return { weight: nums[0], reps: Math.round(nums[1]) };
}

function startVoiceEntry(onResult, onFail) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = VOICE_LOCALES[getLang()] || 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  let handled = false;
  rec.onresult = ev => {
    handled = true;
    for (const alt of ev.results[0]) {
      const parsed = parseSetPhrase(alt.transcript);
      if (parsed) { onResult(parsed, alt.transcript); return; }
    }
    onFail(ev.results[0][0] ? ev.results[0][0].transcript : '');
  };
  rec.onerror = () => { if (!handled) onFail(null); };
  rec.onend = () => { if (!handled) onFail(undefined); };
  rec.start();
  return rec;
}
