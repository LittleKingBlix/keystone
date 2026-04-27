# Keystone — Build Prompt

A self-contained prompt for re-creating the Keystone habit tracker. Paste everything below the `---` line into Claude (web artifacts, Claude Code, or any Claude context) and it will produce the full project.

If Claude is in single-artifact mode (claude.ai web), it will produce one HTML file with everything inline. If Claude has filesystem access, it will produce the multi-file project structure described below.

---

# Build a personal habit-tracking PWA called Keystone

## What it is

An iPhone-installable Progressive Web App for tracking 8 daily keystone habits with a "don't break the chain" mechanic and a paper-wall-calendar aesthetic. Personal use only, no accounts, no sync, all data lives in localStorage on the user's device.

## The 8 habits (in order)

1. **Read 10 pages**
2. **Weigh in** (with number entry for the weight)
3. **64oz water**
4. **45 min workout**
5. **Compliant meal**
6. **Visualization**
7. **Social food only**
8. **Cold shower**

## The streak rule

Soft reset. If the user misses the **same habit on two consecutive days**, the streak resets to zero. Different habits missed on consecutive days do **not** reset (forgiving, lets you have a bad day if it's not the same failure twice).

Today is in progress and never counts as a miss for reset detection. The day boundary is configurable: midnight strict, or 4 AM forgiving (so a 1 AM check-off after a long day still counts toward the previous day).

## Three views

**1. Today (default landing).** Big "Day N" streak counter at top in cursive (Caveat font), today's date on the right in typewriter caps. Eight large checkbox rows below, one per habit. Tap a row to toggle. The weigh-in row has a number input that opens the iOS numeric keypad. A "View rules" link at the bottom jumps to Settings.

**2. Month.** Wall-calendar month grid. 7 columns (Sun-Sat), 6 rows. Each cell shows the date. Compliant days (all 8 habits done) get a **fat red marker X** (Permanent Marker font, color `#c8332c`, slightly tilted, with a soft text-shadow for paper-bleed). Partial days get a faint slash. Today is highlighted with a small red dot in the top-right corner. Month nav arrows on either side of the title. Tap any past day cell to see its checklist in a modal.

**3. Settings.** Start date picker, day boundary toggle (midnight or 4 AM), Export/Import JSON buttons, the contents of `rules.md` rendered as plain text in a scrollable box, and a Reset Program button (two-tap confirm).

A bottom tab bar with three buttons: Today, Month, Settings. Tabs styled as typewriter labels with an active-state underline.

## Visual rules — this is what makes it feel right

- **Background**: cream paper `#f4ead5`, with a subtle radial-gradient grain layered over it (random small darker dots, very light).
- **Body text**: `Crimson Pro` serif (Google Fonts, weights 400/500/600).
- **Cursive accents** for the day number, dates, and section titles: `Caveat` cursive (Google Fonts, weights 400/700).
- **Labels and small caps**: `Special Elite` typewriter monospace (Google Fonts).
- **The X marks**: `Permanent Marker` font (Google Fonts), color `#c8332c` (Sharpie red), with a subtle 0.5px text-shadow in the same red on multiple sides to give a marker-bleed feel. Slightly rotated (-8 to -12 degrees). They should look like someone struck out the day with a fat red Sharpie on paper.
- **Ink color** for borders, lines, body text: `#2a2620` (very dark warm gray, not pure black).
- **No** SF Pro. **No** modern iOS chrome. **No** gradients (other than the paper grain). **No** drop shadows.
- Calendar grid lines should be thin and slightly uneven (use `rgba(42,38,32,0.18)` for inner cell lines, solid `#2a2620` for outer borders).

## Data model

Persist to `localStorage` under key `keystone.state.v1`:

```json
{
  "appName": "Keystone",
  "startDate": "2026-04-26",
  "dayBoundaryHour": 4,
  "days": {
    "2026-04-26": {
      "read": true,
      "weighIn": { "done": true, "value": 195.4 },
      "water": true,
      "workout": true,
      "diet": true,
      "visualization": true,
      "social": true,
      "coldShower": true
    }
  }
}
```

- `weighIn` is special: an object with `done` and `value`. Other habits are plain booleans.
- A missing day in `days` counts as "all habits missed" for reset detection.
- Day boundary: if the current hour is less than `dayBoundaryHour`, treat the date as the previous calendar day.

## Streak engine logic

For each habit H, walk through completed past days from `startDate` up to (but not including) today. If H is missed on two consecutive past days, that's a reset event on the second day. Track all reset events across all habits. The most recent reset date defines the streak start.

```
streakStart = (most recent reset date + 1 day)  OR  startDate if no resets
currentStreak = (today - streakStart) + 1   in whole days, minimum 0
```

Today is never evaluated as a miss because the user might still complete the habits before the day boundary.

Implement this in a separate `streak.js` file so it can be unit-tested in Node. Export both as a browser global (`window.Keystone.computeCurrentStreak`) and as a Node module.

## Files to produce

```
keystone/
├── index.html                  app shell, three view containers, tab bar
├── styles.css                  paper aesthetic, all the visual rules above
├── app.js                      state, localStorage, view rendering, tap toggles
├── streak.js                   reset detection + current streak math (testable)
├── manifest.json               PWA metadata, references icons
├── service-worker.js           network-first HTML, cache-first assets
├── rules.md                    user's pass/fail definitions (placeholder)
├── icon-180.png                Apple touch icon (cream paper, fat red X)
├── icon-192.png                Android-friendly
├── icon-512.png                PWA standard
├── icon-1024.png               iOS App Store size (also high-res home)
└── README.md                   run + deploy notes
```

## Service worker

- Cache name versioned (`keystone-v0.1.0`).
- On install, cache the full asset list.
- On fetch: network-first for `.html` and root paths (so updates reach users on reload), cache-first for everything else.
- On activate, delete old cache versions.

## iOS PWA meta tags

Inside `<head>`:

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Keystone">
<meta name="theme-color" content="#f4ead5">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icon-180.png">
```

## Deploy to GitHub Pages (free)

After Claude generates the files in `~/Projects/keystone/`, run:

```bash
cd ~/Projects/keystone

# 1. Init git, commit, push to a new public GitHub repo
git init
git add -A
git commit -m "Initial commit"
git branch -M main
gh repo create keystone --public --source=. --push

# 2. Enable GitHub Pages (build_type=legacy means "deploy from branch")
gh api --method POST /repos/$(gh api user -q .login)/keystone/pages \
  -f build_type=legacy \
  -f "source[branch]=main" \
  -f "source[path]=/"

# 3. Wait ~60 seconds for the first build, then check
gh api /repos/$(gh api user -q .login)/keystone/pages -q .status

# Site URL:
echo "https://$(gh api user -q .login | tr '[:upper:]' '[:lower:]').github.io/keystone/"
```

GitHub Pages does not work for private repos on the free plan — the repo must be public.

## Install on iPhone

1. Open the Pages URL in **Safari** on iPhone (not Chrome — only Safari supports proper Add to Home Screen).
2. Tap Share → Add to Home Screen.
3. Confirm name "Keystone", tap Add.
4. Tap the icon on the home screen. It should launch fullscreen with no Safari chrome.

## Updating

```bash
cd ~/Projects/keystone
# edit any file
git add -A && git commit -m "your change" && git push
# Pages re-deploys in ~30 seconds
```

The service worker is configured for network-first HTML, so updates appear on next app launch without the user needing to clear cache.

## Tests for the streak engine

In a `test-streak.js` file, write Node-runnable assertions covering:

1. Seven perfect days yields streak of 8 (7 past + today).
2. One miss alone (any habit, one day) does NOT reset.
3. Same habit missed on two consecutive past days DOES reset on the second miss day.
4. Different habits missed on consecutive days does NOT reset.
5. Three consecutive same-habit misses yields multiple reset events; streak counts from day after most recent reset.
6. Missing day records (no entry at all) count as misses for all habits.
7. First day cannot be a reset.
8. Day 1 of program shows streak of 1 (not 0).
9. Single weigh-in miss does not reset.
10. Two weigh-in misses in a row do reset.

Run with: `node test-streak.js`. All should pass.
