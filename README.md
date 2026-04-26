# Keystone

Personal iPhone habit tracker. Eight daily keystone habits, soft reset rule, classic paper-calendar look. Built as a PWA so it installs to the home screen via Add to Home Screen on iPhone.

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell with the three views |
| `styles.css` | Paper-calendar aesthetic |
| `app.js` | State, persistence, view rendering |
| `streak.js` | Reset detection and streak math |
| `rules.md` | Pass/fail definitions for each habit (edit this) |
| `manifest.json` | PWA metadata |

## Running locally

Because the Settings view fetches `rules.md`, you need a local server (not `file://`).

```bash
cd ~/Projects/keystone
python3 -m http.server 8080
```

Then open `http://localhost:8080` in Safari (or Chrome for dev tools).

## Deploying

Pick one:

**GitHub Pages**
1. Create a private repo, push this directory.
2. Settings, Pages, Source = main branch, root.
3. URL will be `https://<user>.github.io/<repo>/`. Open on iPhone.

**Cloudflare Pages**
1. `npx wrangler pages deploy .` (or connect via dashboard).
2. URL provided after deploy.

**Netlify**
1. Drag the project folder onto netlify.com/drop.

## Installing on iPhone

1. Open the deployed URL in Safari on iPhone.
2. Tap the share icon, then "Add to Home Screen".
3. Confirm. The app icon appears on the home screen and launches fullscreen.

## Backup

Use Settings > Export to save a JSON file. Use Import to restore. localStorage on iOS PWAs is durable but not bulletproof. Export periodically or set a reminder.

## Streak rule

The same habit missed on two consecutive completed days resets the streak. Different habits missed on consecutive days do not reset. Today is in progress and never counts as a miss for reset detection. The day boundary is configurable (midnight strict or 4 AM forgiving).

## Deploy options

Pick one. All are free for a personal app.

### Cloudflare Pages (recommended, fastest)

```bash
cd ~/Projects/keystone
npx wrangler pages deploy . --project-name=keystone
```

First run prompts for Cloudflare login. After that, deploys take ~10 seconds. URL printed at the end.

### Netlify Drop (no CLI)

1. Open https://app.netlify.com/drop in a browser.
2. Drag the `~/Projects/keystone/` folder onto the page.
3. Done. URL printed immediately. Drag again to update.

### GitHub Pages (most setup, best long-term)

```bash
cd ~/Projects/keystone
gh repo create keystone --private --source=. --push
gh api -X POST /repos/:owner/keystone/pages -f source.branch=main -f source.path=/
```

URL: `https://<your-github-user>.github.io/keystone/`. Takes ~2 minutes for first deploy.

## Phase status

- [x] Phase 1: Skeleton, today view, localStorage
- [x] Phase 2: Streak engine (14 tests passing)
- [x] Phase 3: Calendar view
- [x] Phase 4: Paper aesthetic
- [x] Phase 5: Service worker + custom icon PNGs
- [ ] Phase 6: Live testing and friction fixes (you, on iPhone, after deploy)

## Open items

- [ ] Write your final `rules.md` (the "EDIT THIS" sections in compliant meal and social food)
- [ ] Decide program length (open-ended vs fixed)
- [ ] Pick a deploy target and run the command
- [ ] Add to Home Screen on iPhone, run for a week, report friction
