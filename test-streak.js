// ============================================================
// Streak engine tests. Run: node test-streak.js
// ============================================================

const {
  HABIT_KEYS, detectResets, computeCurrentStreak, formatDateKey,
} = require('./streak.js');

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`PASS  ${label}`); }
  else { failed++; console.log(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`); }
}

function assertSet(actualSet, expectedArr, label) {
  const a = [...actualSet].sort();
  const b = [...expectedArr].sort();
  assertEqual(a, b, label);
}

// Build a state where startDate is N days ago, "today" is N+1 (so we have N completed past days).
function makeState(daysCompleted, dayBuilder) {
  const today = new Date();
  today.setHours(12, 0, 0, 0); // midday so day boundary doesn't shift
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - daysCompleted);
  const days = {};
  for (let i = 0; i < daysCompleted; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const k = formatDateKey(d);
    days[k] = dayBuilder(i);
  }
  return {
    startDate: formatDateKey(startDate),
    dayBoundaryHour: 0,
    days,
  };
}

function allDone() {
  const day = {};
  for (const h of HABIT_KEYS) {
    if (h === 'weighIn') day[h] = { done: true, value: 195 };
    else day[h] = true;
  }
  return day;
}

function allDoneExcept(missingKeys) {
  const d = allDone();
  for (const k of missingKeys) {
    if (k === 'weighIn') d[k] = { done: false };
    else d[k] = false;
  }
  return d;
}

// ---------- Tests ----------

// Test 1: 7 perfect past days, no resets
{
  const s = makeState(7, () => allDone());
  const resets = detectResets(s);
  assertSet(resets, [], 'T1: 7 perfect days yields no resets');
  // streak = 7 past days + today = 8
  const tk = formatDateKey(new Date());
  const streak = computeCurrentStreak(s, tk);
  assertEqual(streak, 8, 'T1: 7 perfect past days + today = streak 8');
}

// Test 2: One miss on day 4 (cold shower), no two-in-a-row
{
  const s = makeState(7, i => i === 3 ? allDoneExcept(['coldShower']) : allDone());
  const resets = detectResets(s);
  assertSet(resets, [], 'T2: single miss alone yields no reset');
  const tk = formatDateKey(new Date());
  const streak = computeCurrentStreak(s, tk);
  assertEqual(streak, 8, 'T2: single miss does not break streak');
}

// Test 3: Cold shower missed days 4 and 5, reset triggered
{
  const s = makeState(7, i => (i === 3 || i === 4) ? allDoneExcept(['coldShower']) : allDone());
  const resets = detectResets(s);
  // The reset happens on the second consecutive miss day (i=4), which is day index 4
  const [y, m, d] = s.startDate.split('-').map(Number);
  const startD = new Date(y, m - 1, d);
  const expectedResetDate = new Date(startD);
  expectedResetDate.setDate(startD.getDate() + 4);
  assertSet(resets, [formatDateKey(expectedResetDate)], 'T3: same habit twice yields one reset');
  // Streak after reset: today is 3 days after reset
  // Past days: 7 (indices 0..6), reset on index 4. Streak start = index 5. Today = index 7 (after end).
  // Days from index 5 to today inclusive: index 5, 6, today = 3
  const tk = formatDateKey(new Date());
  const streak = computeCurrentStreak(s, tk);
  assertEqual(streak, 3, 'T3: streak resumes after reset (3 days: 5, 6, today)');
}

// Test 4: Different habits missed on consecutive days yields no reset
{
  const s = makeState(7, i => {
    if (i === 3) return allDoneExcept(['coldShower']);
    if (i === 4) return allDoneExcept(['water']);
    return allDone();
  });
  const resets = detectResets(s);
  assertSet(resets, [], 'T4: different habits consecutive does not reset');
}

// Test 5: Three consecutive miss days of same habit triggers two resets, streak = 1
{
  const s = makeState(7, i => (i >= 3 && i <= 5) ? allDoneExcept(['read']) : allDone());
  const resets = detectResets(s);
  // Resets on i=4 and i=5
  assertEqual(resets.size, 2, 'T5: three consecutive misses yields two reset days');
  // Most recent reset is i=5, streak start = i=6, today is i=7. Days 6, today = 2
  const tk = formatDateKey(new Date());
  const streak = computeCurrentStreak(s, tk);
  assertEqual(streak, 2, 'T5: streak counts from day after most recent reset');
}

// Test 6: A missing day record counts as miss for all habits
{
  // Only record indices 0,1,2,3,4 (skip 5, 6 not recorded). Then i=5 and i=6 both blank = miss for all habits.
  const s = makeState(7, i => i < 5 ? allDone() : null);
  // Filter out null entries (simulate days never recorded)
  for (const k of Object.keys(s.days)) {
    if (s.days[k] === null) delete s.days[k];
  }
  const resets = detectResets(s);
  // Day 5 = miss (no record), day 6 = miss (no record). Reset on day 6.
  assertEqual(resets.size > 0, true, 'T6: blank days count as miss and trigger reset');
}

// Test 7: First day cannot be a reset (no prior day)
{
  const s = makeState(2, i => allDoneExcept(['water']));
  const resets = detectResets(s);
  // Day 0: prevMissed undefined, missed=true. firstDay=true so no add.
  // Day 1: prevMissed=true (from day 0), missed=true. firstDay=false so adds.
  assertEqual(resets.size, 1, 'T7: reset on day 1 when day 0 also missed');
}

// Test 8: Empty program (only today, no past days), streak = 1
{
  const s = makeState(0, () => allDone());
  const tk = formatDateKey(new Date());
  const streak = computeCurrentStreak(s, tk);
  assertEqual(streak, 1, 'T8: day 1 of program shows streak 1');
}

// Test 9: weighIn handles { done, value } shape
{
  const s = makeState(3, i => i === 1 ? allDoneExcept(['weighIn']) : allDone());
  const resets = detectResets(s);
  assertSet(resets, [], 'T9: single weigh-in miss alone does not reset');
}

// Test 10: weighIn missed two days in a row
{
  const s = makeState(3, i => (i === 0 || i === 1) ? allDoneExcept(['weighIn']) : allDone());
  const resets = detectResets(s);
  assertEqual(resets.size, 1, 'T10: weigh-in missed twice in a row resets');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
