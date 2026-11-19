import { EXERCISES, isPR, logSet, nextUnfinished, SEED, stats, undoLastSet, workout } from '../data/workout';
import { nutritionTotals } from '../data/athlete';

beforeEach(() => workout.set(SEED));

test('seed matches the design: 12 of 15 sets, one bench PR', () => {
  const s = stats(workout.get());
  expect([s.done, s.total, s.cur]).toEqual([12, 15, 3]);
  expect(s.prs).toEqual([{ ex: 'پرس سینه', w: 67.5, r: 8, prev: 65 }]);
});

test('a PR needs 8+ reps above the current best', () => {
  expect(isPR(EXERCISES[0], [67.5, 8])).toBe(true);
  expect(isPR(EXERCISES[0], [70, 7])).toBe(false);
  expect(isPR(EXERCISES[1], [100, 10])).toBe(false);
});

test('logging and undoing sets', () => {
  logSet(3, [25, 12]);
  expect(workout.get().logs[3]).toHaveLength(2);
  undoLastSet(3);
  expect(workout.get().logs[3]).toHaveLength(1);
});

test('next unfinished exercise wraps around', () => {
  expect(nextUnfinished(workout.get(), 0)).toBe(3);
  expect(nextUnfinished({ ...SEED, logs: SEED.logs.map((l, i) => (i === 3 ? [...l, [25, 12], [25, 12], [25, 12]] : l)) }, 0)).toBe(-1);
});

test('nutrition totals count followed meals fully and partial meals at half', () => {
  expect(nutritionTotals(['followed', 'partial', 'unlogged', 'skipped'])).toEqual([620 + 390, 38 + 31, 52 + 44, 26 + 9]);
});
