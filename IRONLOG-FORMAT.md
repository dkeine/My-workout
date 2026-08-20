# The Iron Log Format — v1

Apps are products; formats are empires. This document specifies the open, versioned
JSON format Iron Log uses for backups, plan sharing, and ghost mode — so that anyone
can write a compatible reader or writer without reading Iron Log's source.

**Stability promise:** fields documented here will not be renamed or change meaning
within version 1. New optional fields may appear; readers must ignore fields they
don't recognize. A breaking change increments `version`.

## 1. Backup file

Produced by *Settings → Export backup*. One JSON object:

```json
{
  "format": "ironlog-backup",
  "version": 1,
  "exportedAt": "2026-08-13T18:00:00.000Z",
  "unit": "kg",
  "activePlan": "darryl-split",
  "plans": { "<planId>": Plan, ... },
  "sessions": { "<YYYY-MM-DD>": Session, ... },
  "records": [ Record, ... ]
}
```

- `format` / `version` — discriminator; readers MUST check both.
- `unit` — `"kg"` or `"lb"`. Display label only: logged numbers are stored as
  entered and never converted.
- `records` — derived data (see §4); writers MAY omit it, readers MUST NOT rely
  on it being present or fresh. The source of truth is `sessions`.

Import semantics (what Iron Log does, recommended for compatibility): merge by
key; existing sessions and plans on the device win over incoming ones.

## 2. Plan

A plan is always **seven days**, Monday-first. A day with an empty `exercises`
array is a rest day — that is how splits of any shape (3-day, 6-day) are encoded.

```json
{
  "id": "plan-abc123",
  "name": "Darryl's Split",
  "builtin": false,
  "days": [
    {
      "title": "Chest + Triceps",
      "focus": "Push Power",
      "muscle": "chest",
      "exercises": [
        { "name": "Flat Barbell Bench", "sets": 3, "target": "10-15 reps", "kind": "exercise" }
      ]
    }
  ]
}
```

- `muscle` — cover-art hint: `"chest" | "back" | "legs" | "rest"`.
- `kind` — `"exercise"` (logged sets of weight × reps), `"cardio"` (single
  done/not-done toggle), `"break"` (rest-timer marker, not trackable).
- `sets` — integer 0–10. Ignored for `cardio` and `break`.
- Sanity limits honored by Iron Log's reader: names ≤ 80 chars, titles ≤ 60,
  ≤ 40 exercises per day.

## 3. Session

One logged workout, keyed by local date `YYYY-MM-DD`.

```json
{
  "date": "2026-08-13",
  "weekday": 3,
  "planId": "darryl-split",
  "title": "Chest + Triceps",
  "muscle": "chest",
  "imported": "Strong",
  "completed": true,
  "completed_count": 9,
  "total_count": 9,
  "exercises": [
    {
      "name": "Flat Barbell Bench",
      "kind": "exercise",
      "target": "10-15 reps",
      "done": true,
      "skipped": false,
      "sets": [ { "weight": 60, "reps": 12, "done": true } ]
    }
  ]
}
```

- `weekday` — 0 = Monday … 6 = Sunday.
- `weight` — number in the user's unit, or `null`. `reps` — integer or `null`.
- Each set MAY carry `"rir"` (integer 0–4, reps in reserve); absent when not
  tracked. Added within version 1 — readers ignore unknown fields per the
  stability promise.
- Each set MAY carry `"ts"` (epoch milliseconds, when the set was completed).
  Rest between sets is derived from consecutive stamps; absent for imported or
  hand-entered history.
- An exercise MAY carry `"parked": true`, meaning it was set aside by a
  shortened session rather than skipped by choice. Parked exercises are also
  `skipped`, so readers that ignore `parked` still tally correctly.

## 3a. Readiness (optional companion map)

Backups MAY include `"readiness"`: `{ "YYYY-MM-DD": -1 | 0 | 1 }` — the lifter's
self-report for that day (rough / normal / primed). It scales coaching
suggestions and is never required to read a session.
- `imported` — optional; name of the source app when the session came through a
  migration importer (`"Strong"`, `"Hevy"`, `"FitNotes"`).
- `completed_count` / `total_count` — cached tallies over trackable exercises
  (everything but `break`); recomputable from `exercises`.

## 4. Record (derived)

```json
{ "name": "Deadlift", "weight": 140, "reps": 5, "date": "2026-07-02" }
```

Best set per exercise name: highest weight, ties broken by reps. Always
recomputable from sessions; carried in backups so a record book survives even a
reader that doesn't want to scan history.

## 5. Share link ("the drop")

A plan travels entirely inside a URL fragment — no server ever sees it:

```
https://<app>/#p=<scheme>.<base64url-payload>
```

- `scheme 1` — payload is `deflate-raw`-compressed UTF-8 JSON (native
  `CompressionStream`).
- `scheme 0` — payload is plain UTF-8 JSON, base64url.
- The JSON wire form is `{ "n": <plan name>, "d": <plan days array> }` — §2's
  `days`, same rules.
- base64url = RFC 4648 §5, no padding.

Receivers MUST treat incoming plans as untrusted input: validate shape, clamp
lengths, and escape for display.

## 6. Ghost mode

A ghost is simply another person's (or your past self's) backup file: the
`sessions` map is read with the same rules as §3 and surfaced as targets. No
special format exists — that is the point.
