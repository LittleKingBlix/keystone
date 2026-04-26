// ============================================================
// Keystone, streak engine
// Reset rule: same habit missed two consecutive days = full reset.
// Different habits missed on consecutive days does NOT reset.
// Today is in progress and never counts as a miss for reset detection.
// ============================================================

const HABIT_KEYS = ['read', 'weighIn', 'water', 'workout', 'diet', 'visualization', 'social', 'coldShower'];

function isMissed(day, habitKey) {
  if (!day) return true;
  if (habitKey === 'weighIn') {
    return !(day.weighIn && day.weighIn.done);
  }
  return !day[habitKey];
}

// Returns Set of date keys (YYYY-MM-DD) where a reset condition triggered
// for at least one habit. Resets are detected only on completed past days,
// not on today (today is in progress).
function detectResets(state) {
  const resets = new Set();
  if (!state || !state.startDate) return resets;
  const startD = parseDateKey(state.startDate);
  const today = parseDateKey(todayKeyFor(state));
  if (!startD || !today) return resets;

  for (const h of HABIT_KEYS) {
    let prevMissed = false;
    let firstDay = true;
    for (let d = new Date(startD); d < today; d.setDate(d.getDate() + 1)) {
      const k = formatDateKey(d);
      const day = state.days[k];
      const missed = isMissed(day, h);

      if (!firstDay && missed && prevMissed) {
        resets.add(k);
      }
      prevMissed = missed;
      firstDay = false;
    }
  }
  return resets;
}

// Current streak in days. Starts at 1 on the first day of the program
// (or the day after the most recent reset). Resets count from the day after.
function computeCurrentStreak(state, todayKeyStr) {
  if (!state || !state.startDate) return 0;
  const resets = detectResets(state);
  const sortedResets = [...resets].sort();

  let streakStartDate;
  if (sortedResets.length) {
    const lastReset = parseDateKey(sortedResets[sortedResets.length - 1]);
    streakStartDate = new Date(lastReset);
    streakStartDate.setDate(streakStartDate.getDate() + 1);
  } else {
    streakStartDate = parseDateKey(state.startDate);
  }

  const today = parseDateKey(todayKeyStr);
  if (!streakStartDate || !today) return 0;
  if (today < streakStartDate) return 0;

  const days = Math.floor((today - streakStartDate) / 86400000) + 1;
  return Math.max(0, days);
}

// Helpers (kept inside streak.js so it can be tested standalone).
function parseDateKey(k) {
  if (!k) return null;
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function todayKeyFor(state) {
  const now = new Date();
  const boundary = state.dayBoundaryHour ?? 4;
  if (now.getHours() < boundary) {
    now.setDate(now.getDate() - 1);
  }
  return formatDateKey(now);
}

// Expose for app.js (browser) and tests (node).
if (typeof window !== 'undefined') {
  window.Keystone = window.Keystone || {};
  window.Keystone.HABIT_KEYS = HABIT_KEYS;
  window.Keystone.detectResets = detectResets;
  window.Keystone.computeCurrentStreak = computeCurrentStreak;
  window.Keystone.parseDateKey = parseDateKey;
  window.Keystone.formatDateKey = formatDateKey;
  window.Keystone.todayKeyFor = todayKeyFor;
  window.Keystone.isMissed = isMissed;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HABIT_KEYS, detectResets, computeCurrentStreak,
    parseDateKey, formatDateKey, todayKeyFor, isMissed,
  };
}
