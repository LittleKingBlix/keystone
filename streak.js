// streak.js, Keystone streak/calendar logic.
// Pure functions, no DOM. Importable as module or via <script src>.
// Ported from the Direction F design bundle.
//
// DATA SHAPE:
//   record  = { date: 'YYYY-MM-DD', habits: { [habitId]: bool }, weight?: number }
//   records = array of records, sorted ascending by date
//   today   = 'YYYY-MM-DD' string in user's local time, accounting for dayBoundaryHour

// THE 8 KEYSTONE HABITS, order matters (same order across all UI).
const HABITS = [
  { id: 'weigh',     label: 'Weigh in',         short: 'Weight' },
  { id: 'read',      label: 'Read 10 pages',    short: 'Read' },
  { id: 'visualize', label: 'Visualization',    short: 'Visualize' },
  { id: 'cold',      label: 'Cold shower',      short: 'Cold' },
  { id: 'meal',      label: 'Compliant meal',   short: 'Meal' },
  { id: 'workout',   label: '45 min workout',   short: 'Workout' },
  { id: 'water',     label: '64oz water',       short: 'Water' },
  { id: 'social',    label: 'Social food only', short: 'Social' },
];

// Date helpers
function pad2(n) { return String(n).padStart(2, '0'); }
function fmt(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
}
function daysBetween(a, b) {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86400000);
}

// "Today" respecting day boundary. dayBoundaryHour=0 means midnight strict.
// dayBoundaryHour=4 means 11:59pm-3:59am still belongs to the previous day.
function todayString(now = new Date(), dayBoundaryHour = 0) {
  const d = new Date(now);
  if (d.getHours() < dayBoundaryHour) d.setDate(d.getDate() - 1);
  return fmt(d);
}

// Record helpers
function recordFor(records, date) {
  return records.find(r => r.date === date) || null;
}
function isComplete(record) {
  if (!record) return false;
  return HABITS.every(h => !!record.habits[h.id]);
}
function completeCount(record) {
  if (!record) return 0;
  return HABITS.reduce((n, h) => n + (record.habits[h.id] ? 1 : 0), 0);
}

// THE STREAK RULE
// "If the same habit is missed on two consecutive days, the chain resets.
//  Different habits missed on consecutive days are forgiven. Today is in
//  progress and never counts against you."
//
// The streak is the count of days since the chain last broke (or since
// startDate if it never broke), counting today as Day N. This is NOT a
// 'perfect days' counter — the philosophy is baseline consistency, not
// perfection. A day with 5 of 8 done still keeps the chain alive (as long
// as the same habit isn't missed two days running).
function computeStreak(records, startDate, today) {
  if (daysBetween(startDate, today) < 0) {
    return { streak: 0, lastResetDate: startDate };
  }

  let lastResetDate = null;
  let prevMissed = new Set();
  let cursor = startDate;

  while (cursor !== today) {
    const rec = recordFor(records, cursor);
    const missed = new Set();
    for (const h of HABITS) {
      if (!rec || !rec.habits[h.id]) missed.add(h.id);
    }

    let consecutiveSame = false;
    for (const id of missed) {
      if (prevMissed.has(id)) { consecutiveSame = true; break; }
    }
    if (consecutiveSame) lastResetDate = cursor;

    prevMissed = missed;
    cursor = addDays(cursor, 1);
    if (daysBetween(startDate, cursor) > 3650) break;
  }

  // streakStart = day after last reset, or startDate if no reset
  const streakStart = lastResetDate ? addDays(lastResetDate, 1) : startDate;
  if (daysBetween(streakStart, today) < 0) {
    return { streak: 0, lastResetDate: lastResetDate || startDate };
  }
  const streak = daysBetween(streakStart, today) + 1;
  return { streak, lastResetDate: lastResetDate || startDate };
}

// List every chain reset between startDate and today.
function computeBreaks(records, startDate, today) {
  const breaks = [];
  if (daysBetween(startDate, today) < 0) return breaks;

  let streak = 0;
  let prevMissed = new Set();
  let cursor = startDate;

  while (cursor !== today) {
    const rec = recordFor(records, cursor);
    const missed = new Set();
    for (const h of HABITS) {
      if (!rec || !rec.habits[h.id]) missed.add(h.id);
    }

    let consecutiveSame = null;
    for (const id of missed) {
      if (prevMissed.has(id)) { consecutiveSame = id; break; }
    }

    if (consecutiveSame) {
      breaks.push({ date: cursor, missedHabit: consecutiveSame, runLength: streak });
      streak = 0;
    } else if (missed.size === 0) {
      streak += 1;
    }

    prevMissed = missed;
    cursor = addDays(cursor, 1);
    if (daysBetween(startDate, cursor) > 3650) break;
  }
  return breaks;
}

// 6x7 month grid for calendar view.
function monthGrid(year, month, records, startDate, today, weekStartsOn = 0) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const gridStart = new Date(year, month, 1 - offset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const date = fmt(d);
    const rec = recordFor(records, date);
    const beforeStart = daysBetween(startDate, date) < 0;
    const future = daysBetween(today, date) > 0;
    const isToday = date === today;
    cells.push({
      date,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      record: rec,
      count: completeCount(rec),
      complete: isComplete(rec),
      isToday, beforeStart, future,
    });
  }
  return cells;
}

// Exports
const Keystone = {
  HABITS,
  pad2, fmt, parseISO, addDays, daysBetween, todayString,
  recordFor, isComplete, completeCount,
  computeStreak, computeBreaks, monthGrid,
};

if (typeof window !== 'undefined') window.Keystone = Keystone;
if (typeof module !== 'undefined' && module.exports) module.exports = Keystone;
