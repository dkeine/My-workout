# Iron Log — The War Plan

The backlog for [VISION.md](VISION.md). Not phases — **campaigns**. Each one ends in
a visible victory, not a sprint review. Sizes: S = under half a day · M = 1–3 days ·
L = about a week · XL = multi-week. 🚩 marks the rare ticket that needs a server —
everything unflagged runs on four files and spite.

**The queue:** IL-01 → IL-02 → IL-03 → IL-05 → IL-06. Nothing jumps past IL-01:
an empire whose records evaporate with a cleared cache is a rounding error, and
right now that's us.

---

## Campaign 0 — Arm the Citadel *(week one, no excuses)*

*Before conquering the world, become unkillable.*

**IL-01 · The log becomes immortal — S**
Export the full history (`ironlog-sessions`) as versioned JSON; import merges it
back. *Done when: phone dies, new phone, History identical. The record outlives the
hardware.*

**IL-02 · Own every byte — S**
Kill the Unsplash/Pexels hotlinks and the Google Fonts request; local images or
gradient covers, self-hosted or system type. *Done when: airplane mode, zero broken
anything. No foreign server is load-bearing in this empire.*

**IL-03 · Install like we own the phone — M**
Manifest, icon, service worker. Home-screen app, cold-launches offline, and the
settings card's "works fully offline" stops being a lie and starts being a threat.
*Done when: airplane-mode cold start shows today's workout.*

**IL-04 · Reset with a parachute — S**
The Danger Zone's `localStorage.clear()` can vaporize months of training behind one
confirm. Reset hands you a backup first. *Done when: losing the log without holding
an export is impossible.*

**Victory condition:** the history cannot be killed, and the app installs and runs
with no network on Earth.

## Campaign 1 — The Mixtape Economy

*Training programs start spreading like music. No backend, no logins — the link is
the entire distribution system, which means distribution costs us nothing and can't
be shut off.*

**IL-05 · The plan becomes data — M**
Extract `PLAN` from `js/data.js` into schema'd JSON the app loads. Code stops being
config; a split becomes a thing you can hold. *Done when: `data.js` contains zero
exercises.*

**IL-06 · The drop — M**
A plan encodes into a URL fragment (compressed, serverless). Opening it offers
"Run this split" and lands on today. *Done when: one text puts your program on a
stranger's phone in under ten seconds, no signup, no store.*

**IL-07 · The crate — M**
Multiple plans, one active, delete the regrets. *Done when: importing a mixtape
can't destroy your own.*

**IL-08 · The remix — M/L**
Fork any plan: rename, swap lifts, change sets/targets, share your version back.
An editor with the soul of a sampler, not a wizard. *Done when: fork Darryl's
split, swap two lifts, drop your remix as a link.*

**IL-09 · Every unit people lift in — S**
kg/lb toggle ("kg" is hardcoded today). Everyone's Darryl includes Americans.
*Done when: one toggle, applied everywhere.*

**IL-10 · Splits of any shape — M/L**
The code hardcodes Mon–Fri (`wd < 5`, five circles). Real programs run 3-day,
6-day, rotating. Training days derive from the plan. *Done when: a 3-day and a
6-day split both get correct streaks and grids.*

**IL-11 · The cover art — M**
A shared link doesn't open as raw JSON energy — it renders as a release page inside
the app: plan name, cover, focus, "Run this split." The link *is* the landing page.
Coaches drop programs like albums. *Done when: a shared split looks like something
you'd screenshot.*

**Victory condition:** a split gets forked by someone we've never met. 1,000
Darryls. A coach announces a program by posting a link.

## Campaign 2 — The Crew Wars

*The streak becomes social currency. Everything here but the board is still
serverless — the crew runs on files and pride.*

**IL-12 · The flex card — M**
One tap renders your week/streak/session as a clean image for the group chat
(canvas + Web Share). The gym already has group chats; we colonize them. *Done
when: History → tap → image in chat.*

**IL-13 · Ghost mode — M**
Import anyone's export and their numbers haunt your Today view as targets:
"Darryl did 60kg × 12 — beat it." Works on any export, including your own from
January. Race your friends; race your former self. *Done when: two lifters on one
plan chase each other's numbers with zero server.*

**IL-14 · Chalk-hands logging — M/L**
Voice entry via on-device speech: say "sixty by twelve," the set fills in. Hands
never touch the phone mid-superset. No cloud, no audio leaves the device. *Done
when: a full set logs without a tap.*

**IL-15 · The gym board — XL 🚩**
Per-gym consistency leaderboard, joined by QR, anonymous handles, ranked by showing
up — the one axis where day-one lifters fight monsters as equals. **First server in
the empire.** It stores handles and streaks, never logins, never lift data it
doesn't need. Starts only after Campaign 1 mixtapes are demonstrably spreading.
*Done when: one scan puts you on the wall.*

**IL-16 · The annexation kit — S**
Printable QR poster pack + one-page pitch for gym owners, shipped in this repo.
We annex gyms with paper and a laminator. *Done when: a stranger can hang Iron Log
on a wall without talking to us.*

**Victory condition:** a gym we've never set foot in runs a board, and someone who
has never met Darryl says "beat Darryl."

## Campaign 3 — The World Record

*Own the record, own the sport.*

**IL-17 · The protocol — S to draft**
`IRONLOG-FORMAT.md`: versioned, documented JSON schema for plans and history, with
stability promises. Apps are products; formats are empires. *Done when: a stranger
could write a compatible reader without our source.*

**IL-18 · The Great Migration — M**
Defection kits: importers for Strong, Hevy, FitNotes exports. Their moat is
switching cost; we drain it politely, file by file. *Done when: a real Strong
export renders perfectly in History.*

**IL-19 · The passport — M**
Lifetime PRs per lift, computed from history, carried in every export. Your record
book crosses gyms, cities, decades. *Done when: bests survive an export/import
round trip.*

**IL-20 · Every language people lift in — M/L**
i18n scaffold plus the first five languages. Iron is already universal; the labels
should catch up. *Done when: a split shared from São Paulo opens readable in
Warsaw.*

**IL-21 · The Monument — XL 🚩**
A public, live counter of sets logged on Earth — opt-in, anonymous, counts only,
nothing else leaves the device. The metric from VISION.md made into a public
scoreboard for the species. *Done when: anyone can watch the planet lift in real
time.*

**Victory condition:** "log it" is understood in a gym we've never heard of, and
the Monument reads one million sets a day.

---

## Moonshots — unscheduled, unapologetic

Claimed by a campaign when their time comes:

- **Gym OS** — a TV on the gym wall running the board full-screen. Whiteboards had
  a good century; it's over.
- **The Iron Log Open** — a global consistency championship. Thirty days, show up
  every training day, everyone competes on the same axis. The first world
  championship you can win without being strong yet.
- **The Billboard of splits** — most-forked programs, charted. Program of the
  summer. 🚩
- **Signed drops** — a legendary coach releases their actual program as a link, and
  the fork counter does the talking.

## The laws (every ticket, every campaign)

- **The half-second rule:** no screen may open slower than stripping a plate. Perf
  regression = not done.
- **The refusals are weapons, not restraints:** logins, subscriptions, feeds, data
  sales — any ticket drifting there gets closed *won't-fix, see VISION.md*. We win
  **because** we refuse; the moment we stop, someone beats us with four small files.
- **Four files is a spirit, not a number:** every dependency needs a better reason
  than convenience.
