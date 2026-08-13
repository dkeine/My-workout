# Iron Log

The gym-floor logbook. Opens instantly, works fully offline, remembers what you
lifted last time so you can beat it. No login, no subscription, no feed — four
files and a grudge against friction.

**[VISION.md](VISION.md)** is where this is going (the fitness world).
**[BACKLOG.md](BACKLOG.md)** is the war plan. **[IRONLOG-FORMAT.md](IRONLOG-FORMAT.md)**
is the open data format everything rides on.

## What it does

- **Today** — your session, with last-time numbers beside every lift, one-tap set
  logging, voice entry ("sixty by twelve"), skip handling, and a rest timer.
- **Plan** — the active split, a library of plans, and a remix editor. Any plan
  shares as a link: no server, the URL *is* the split. Splits of any shape
  (3-day, 6-day, whatever) get correct streaks.
- **History** — streak, week grid, lifetime PRs (the passport), every session,
  and a shareable streak card for the group chat.
- **Ghost mode** — load anyone's backup (or your own past) and their numbers
  appear as targets to beat.
- **Data** — export/restore everything as JSON; import your history from
  Strong, Hevy, or FitNotes CSV exports. Your log is yours, forever.
- **Annex your gym** — a printable QR poster (`poster.html`).

In five languages: English, Español, Português, Français, Deutsch.

## Run it

It's static files — any web server works:

```
python3 -m http.server 8000
# open http://localhost:8000
```

Served over HTTPS (or localhost) it installs as a PWA and runs with no
connection at all. GitHub Pages is a perfectly good empire headquarters.

## Architecture

Vanilla JS, no build step, no dependencies, no backend. `js/data.js` holds the
built-in split, `js/state.js` owns localStorage, `js/app.js` renders the four
tabs, and everything else is one focused file each (share links, QR, CSV
importers, flex card, voice, i18n). The service worker (`sw.js`) precaches the
shell so the whole thing cold-starts offline.
