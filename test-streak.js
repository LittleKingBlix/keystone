// test-streak.js — Node tests for the streak engine.
// Run: node test-streak.js

const K = require('./streak.js');
const { HABITS, fmt, addDays, daysBetween, parseISO, todayString,
        recordFor, isComplete, completeCount,
        computeStreak, computeBreaks, monthGrid } = K;

let passed = 0, failed = 0;

function assert(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`PASS  ${label}`); }
  else {
    failed++;
    console.log(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`);
  }
}

// Build a record with all habits done (and an optional weight value).
function allDone(date, weight) {
  const habits = {};
  for (const h of HABITS) habits[h.id] = true;
  return { date, habits, weight: weight ?? null };
}
function doneExcept(date, missing) {
  const r = allDone(date);
  for (const m of missing) r.habits[m] = false;
  return r;
}
function emptyDay(date) {
  const habits = {};
  for (const h of HABITS) habits[h.id] = false;
  return { date, habits, weight: null };
}

// --- Date helpers ---

assert(fmt(new Date(2026, 3, 26)), '2026-04-26', 'fmt: April 26 2026');
assert(addDays('2026-04-26', 1), '2026-04-27', 'addDays: +1');
assert(addDays('2026-04-26', -1), '2026-04-25', 'addDays: -1');
assert(daysBetween('2026-04-26', '2026-05-01'), 5, 'daysBetween: 5');
assert(daysBetween('2026-05-01', '2026-04-26'), -5, 'daysBetween: -5');
assert(parseISO('2026-04-26').getMonth(), 3, 'parseISO: month 0-indexed');

// Day boundary
const noon = new Date(2026, 3, 26, 12, 0);
const am2 = new Date(2026, 3, 26, 2, 0);
assert(todayString(noon, 0), '2026-04-26', 'todayString: midnight cutoff at noon');
assert(todayString(am2, 0), '2026-04-26', 'todayString: midnight cutoff at 2am');
assert(todayString(am2, 4), '2026-04-25', 'todayString: 4am cutoff at 2am goes to prev day');
assert(todayString(noon, 4), '2026-04-26', 'todayString: 4am cutoff at noon stays today');

// --- Records ---

const recs = [allDone('2026-04-26'), doneExcept('2026-04-27', ['cold'])];
assert(recordFor(recs, '2026-04-26').date, '2026-04-26', 'recordFor: hit');
assert(recordFor(recs, '2026-04-28'), null, 'recordFor: miss');
assert(isComplete(recs[0]), true, 'isComplete: all 8');
assert(isComplete(recs[1]), false, 'isComplete: 7 of 8');
assert(completeCount(recs[1]), 7, 'completeCount: 7');
assert(completeCount(null), 0, 'completeCount: null = 0');

// --- Streak engine: the critical rules ---

// 7 perfect days (today not yet recorded; today is in progress)
{
  const records = [];
  for (let i = 0; i < 7; i++) records.push(allDone(addDays('2026-04-20', i)));
  const r = computeStreak(records, '2026-04-20', '2026-04-27');
  assert(r.streak, 7, '7 perfect past days = streak 7');
  assert(r.completedDays, 7, '7 perfect past days = 7 completed');
}

// One miss alone, no consecutive same → no reset
{
  const records = [
    allDone('2026-04-20'),
    allDone('2026-04-21'),
    doneExcept('2026-04-22', ['cold']),
    allDone('2026-04-23'),
    allDone('2026-04-24'),
  ];
  const r = computeStreak(records, '2026-04-20', '2026-04-25');
  assert(r.streak, 4, 'single miss alone: streak holds at 4 perfect days');
  const breaks = computeBreaks(records, '2026-04-20', '2026-04-25');
  assert(breaks.length, 0, 'single miss alone: no breaks');
}

// Same habit missed two days in a row → reset
{
  const records = [
    allDone('2026-04-20'),
    allDone('2026-04-21'),
    doneExcept('2026-04-22', ['cold']),
    doneExcept('2026-04-23', ['cold']),
    allDone('2026-04-24'),
    allDone('2026-04-25'),
  ];
  const r = computeStreak(records, '2026-04-20', '2026-04-26');
  assert(r.streak, 2, 'same habit two days in a row: reset, streak resumes (2 days after reset)');
  const breaks = computeBreaks(records, '2026-04-20', '2026-04-26');
  assert(breaks.length, 1, 'same habit twice: 1 break');
  assert(breaks[0].missedHabit, 'cold', 'break: missed habit recorded');
  assert(breaks[0].date, '2026-04-23', 'break: triggered on second miss day');
}

// Different habits on consecutive days → no reset
{
  const records = [
    allDone('2026-04-20'),
    doneExcept('2026-04-21', ['cold']),
    doneExcept('2026-04-22', ['water']),
    allDone('2026-04-23'),
  ];
  const r = computeStreak(records, '2026-04-20', '2026-04-24');
  // Day 0: perfect (+1=1). Day 1: cold missed (hold at 1). Day 2: water missed,
  // cold NOT in current missed → no reset (hold at 1). Day 3: perfect (+1=2).
  assert(r.streak, 2, 'different habits consecutive: no reset, only perfect days count toward streak');
  const breaks = computeBreaks(records, '2026-04-20', '2026-04-24');
  assert(breaks.length, 0, 'different habits consecutive: no breaks');
}

// Three same-habit misses in a row → break on day 2 (the second-in-a-row), then again on day 3
{
  const records = [
    allDone('2026-04-20'),
    doneExcept('2026-04-21', ['read']),
    doneExcept('2026-04-22', ['read']),
    doneExcept('2026-04-23', ['read']),
    allDone('2026-04-24'),
  ];
  const breaks = computeBreaks(records, '2026-04-20', '2026-04-25');
  assert(breaks.length, 2, 'three consecutive same-habit misses: 2 break events (day 2 and day 3)');
}

// Empty records (no day recorded at all) count as miss for all habits
{
  const records = [allDone('2026-04-20')]; // skip 21 and 22 entirely
  const breaks = computeBreaks(records, '2026-04-20', '2026-04-23');
  // Day 21 missing = all 8 missed. Day 22 missing = all 8 missed. So same-habit miss on consecutive days → break.
  assert(breaks.length > 0, true, 'unrecorded consecutive days trigger break');
}

// First day cannot be a reset (no prior day)
{
  const records = [emptyDay('2026-04-20')];
  const breaks = computeBreaks(records, '2026-04-20', '2026-04-21');
  assert(breaks.length, 0, 'first day cannot be a reset');
}

// startDate after today → empty result
{
  const r = computeStreak([], '2026-12-01', '2026-04-26');
  assert(r.streak, 0, 'startDate in future: streak 0');
  const b = computeBreaks([], '2026-12-01', '2026-04-26');
  assert(b.length, 0, 'startDate in future: no breaks');
}

// Weight handling: weigh habit follows the same boolean rule
{
  const records = [
    allDone('2026-04-20', 195.4),
    { date: '2026-04-21', habits: { ...allDone('2026-04-21').habits, weigh: false }, weight: null },
    { date: '2026-04-22', habits: { ...allDone('2026-04-22').habits, weigh: false }, weight: null },
  ];
  const breaks = computeBreaks(records, '2026-04-20', '2026-04-23');
  assert(breaks.length, 1, 'weigh missed two days in a row: break');
  assert(breaks[0].missedHabit, 'weigh', 'weigh break recorded');
}

// monthGrid: 42 cells, marks today
{
  const records = [allDone('2026-04-26')];
  const cells = monthGrid(2026, 3, records, '2026-04-20', '2026-04-26', 1);
  assert(cells.length, 42, 'monthGrid: 42 cells');
  const todayCell = cells.find(c => c.isToday);
  assert(todayCell.date, '2026-04-26', 'monthGrid: today flagged');
  assert(todayCell.complete, true, 'monthGrid: today complete');
}

// monthGrid: future days flagged
{
  const cells = monthGrid(2026, 3, [], '2026-04-20', '2026-04-26', 1);
  const future = cells.find(c => c.date === '2026-04-30');
  assert(future.future, true, 'monthGrid: future flagged');
  const past = cells.find(c => c.date === '2026-04-15');
  assert(past.beforeStart, true, 'monthGrid: before-start flagged');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
