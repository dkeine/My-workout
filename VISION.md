# Iron Log — Product Vision

**One line:** Iron Log is Darryl's gym-floor logbook. It remembers what he lifted last
time so he can beat it, and logs today's sets in seconds. Nothing is allowed to matter
more than that.

## The one job

Standing at the rack, mid-workout, sweaty thumbs:

1. What am I doing today?
2. What did I do last time? (*"Last Friday: 60kg × 12"*)
3. Log this set in a few seconds, check it off, rest, repeat.

The previous-session hint plus instant set entry **is** the product. That's the
painkiller — nobody remembers what they benched four days ago, and fumbling with a
bloated app between sets is why people go back to paper. The streak, the progress
ring, the hero images are garnish. Good garnish, but garnish.

## What Iron Log is — and stays

- **A single-user tool.** The settings card says it plainly: *"Darryl's personal
  training companion."* One named user with a real, felt pain beats a thousand
  hypothetical ones. No feature earns a spot here by imagining other users.
- **Zero-infrastructure.** One HTML file, three scripts, a stylesheet. No build, no
  backend, no login, no dependencies. It opens instantly in a gym basement with no
  signal. That absence of friction is the moat — every "real app" feature (accounts,
  sync, notifications) spends it.
- **The plan is code.** The split lives in `js/data.js`, version-controlled in git.
  Editing that file *is* the plan builder. A settings UI for building programs would
  be weeks of work to replace a two-minute edit.

## State of the product — the honest read

The core is right, and it's admirably lean. It does not need more features to be
good. It has two real gaps, and both are about **trust**, not features:

1. **The history is one tap from gone.** Every logged set lives in a single
   localStorage key on one phone. There is no export and no backup — the only
   data-management feature in Settings is the delete button. Browsers evict
   localStorage (iOS Safari is notorious for purging site data after periods of
   disuse), and one "clear browsing data" or a lost phone erases months of training
   history. The log is the only irreplaceable thing this app produces, and it is
   currently the least protected part of it.
2. **"Works fully offline" isn't true yet.** The settings card promises it, but the
   hero images hot-link Unsplash/Pexels, the fonts load from Google, and there's no
   service worker — so a fresh load with no signal fails, and even a cached load
   shows broken images. Either make the claim true or remove it; a personal tool
   shouldn't lie to its one user.

## Roadmap — in order, and it's short

1. **Backup & restore.** Export the session log as a JSON file; import it back.
   ~Half a page of code, and it converts "months of history" from *at risk* to
   *safe*. This is the highest-value change available to this app.
2. **Make the offline claim true.** Bundle images and fonts locally, add a minimal
   service worker (or accept system fonts and CSS-gradient heroes). Alternatively,
   delete the claim — but making it true is cheap and matches how a gym app is used.
3. **Progression at a glance — only if still wanted.** Last vs. best for a handful
   of big lifts (bench, deadlift, squat). Explicitly optional: the last-time hint
   already answers the in-workout question. This is the one piece of garnish worth
   considering, and it's third for a reason.

## The anti-roadmap — what we don't build

| Temptation | Why it's out |
|---|---|
| Accounts / cloud sync / backend | Kills instant-open and offline; a JSON export in Darryl's own storage does 95% of the job for 1% of the cost |
| Plan-builder UI | Weeks of work to replace a two-minute edit of `data.js` |
| Exercise database / instruction content | Darryl knows what a hammer curl is; this app logs, it doesn't teach |
| Social, sharing, leaderboards | User count is one, and that's the design, not a growth problem |
| AI coach / auto-progression | A vitamin in a lab coat; the hint shows last time's numbers, and "add 2.5kg" is Darryl's call |
| Native app / watch app | Résumé-driven; a browser tab already does the job with zero install |
| Charts for everything | History exists to answer "did I train and what did I lift" — one progression view max |
| Notifications, XP, badges | The streak already exists; guilt machinery doesn't add plates to the bar |

Rule of thumb: if a feature would make Iron Log look more like Strong or Hevy, it's
out. Those apps exist, they're good, and being a worse version of them is the only
way this project fails.

## The riskiest assumption

**"localStorage is forever."** The whole product rests on it and it is simply false —
browsers may evict it, phones get lost, and the reset button sits one confirm dialog
away. The cheapest test is to make the assumption irrelevant: ship export/restore
first (roadmap #1) and the bet stops existing.

## The filter for every future idea

> Does it make logging a set on the gym floor faster, or the history harder to lose?

If neither — however fun it would be to build — it's not for this app.

## Confidence

- **Grounded in the code:** no export path; localStorage-only persistence; hot-linked
  images and fonts with no service worker; one hardcoded plan and user; the settings
  card's offline claim.
- **Judgment calls:** that the last-time hint is the killer feature (from how lifting
  works — there's no telemetry here, and for a single-user tool there shouldn't be);
  the roadmap ordering; every line of the anti-roadmap. If Darryl disagrees with one
  of these, his vote is the tiebreak — he's the entire market.
