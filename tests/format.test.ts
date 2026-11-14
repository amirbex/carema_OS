import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clamp,
  csvCell,
  daysUntil,
  initials,
  isOverdue,
  percent,
  relativeTime,
  safeFileName,
  toCsv,
  toDate,
  truncate,
} from '../src/lib/format';

const now = new Date('2026-03-10T12:00:00Z');

test('daysUntil handles today, future and past dates', () => {
  assert.equal(daysUntil('2026-03-10T23:00:00Z', now), 0);
  assert.equal(daysUntil('2026-03-13T08:00:00Z', now), 3);
  assert.equal(daysUntil('2026-03-07T08:00:00Z', now), -3);
});

test('daysUntil is null for empty or invalid input', () => {
  assert.equal(daysUntil(null, now), null);
  assert.equal(daysUntil(undefined, now), null);
  assert.equal(daysUntil('not-a-date', now), null);
});

test('isOverdue ignores completed tasks', () => {
  assert.equal(isOverdue('2026-03-01T00:00:00Z', 'TODO', now), true);
  assert.equal(isOverdue('2026-03-01T00:00:00Z', 'DONE', now), false);
  assert.equal(isOverdue('2026-04-01T00:00:00Z', 'TODO', now), false);
  assert.equal(isOverdue(null, 'TODO', now), false);
});

test('percent never divides by zero or exceeds bounds', () => {
  assert.equal(percent(0, 0), 0);
  assert.equal(percent(5, 10), 50);
  assert.equal(percent(20, 10), 100);
  assert.equal(percent(-3, 10), 0);
});

test('clamp keeps values inside the range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
  assert.equal(clamp(Number.NaN, 2, 10), 2);
});

test('csv escaping quotes, commas and newlines', () => {
  assert.equal(csvCell('plain'), '"plain"');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(null), '""');
  assert.equal(toCsv(['a', 'b'], [[1, 2], [3, 4]]), '"a","b"\r\n"1","2"\r\n"3","4"');
});

test('safeFileName strips path-hostile characters', () => {
  assert.equal(safeFileName('My / Project: v2'), 'My_-_Project-_v2');
  assert.equal(safeFileName('   '), 'export');
});

test('initials prefers the email local part and handles empties', () => {
  assert.equal(initials('ada.lovelace@example.com'), 'AL');
  assert.equal(initials('Grace Hopper'), 'GH');
  assert.equal(initials(''), '?');
  assert.equal(initials(null), '?');
});

test('truncate never exceeds the limit', () => {
  assert.equal(truncate('abcdef', 6), 'abcdef');
  assert.equal(truncate('abcdef', 4), 'abc…');
  assert.equal(truncate('', 4), '');
});

test('relativeTime produces localized strings', () => {
  assert.equal(relativeTime(new Date(now.getTime() - 5 * 60_000), now, 'en'), '5 minutes ago');
  assert.match(relativeTime(new Date(now.getTime() + 2 * 86_400_000), now, 'en'), /in 2 days/);
});

test('toDate accepts strings, dates and Firestore-like timestamps', () => {
  assert.ok(toDate('2026-01-01T00:00:00Z') instanceof Date);
  assert.equal(toDate(null), null);
  assert.equal(toDate('nope'), null);
  const fakeTimestamp = { toDate: () => new Date('2026-02-02T00:00:00Z') };
  assert.equal(toDate(fakeTimestamp)?.toISOString(), '2026-02-02T00:00:00.000Z');
});
