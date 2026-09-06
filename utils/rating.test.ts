import { describe, it, expect } from 'vitest';
import {
  RatingState,
  RATING_MIN_ACTIVE_DAYS,
  dayKey,
  normalizeRatingState,
  shouldPromptForRating,
  withActiveDay,
} from './rating';

const state = (over: Partial<RatingState> = {}): RatingState =>
  ({ activeDays: 0, lastActiveDay: '', status: 'idle', ...over });

describe('dayKey', () => {
  it('formats the local calendar day', () => {
    expect(dayKey(new Date(2026, 8, 6))).toBe('2026-09-06');
  });

  it('pads single-digit months and days', () => {
    expect(dayKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  // Local, not UTC: a user in IST applying a rule at 09:00 is on today, not
  // yesterday, and the counter would otherwise stall for anyone east of UTC.
  it('uses local time, so a morning in a positive offset is today', () => {
    const morning = new Date(2026, 8, 6, 9, 0, 0);
    expect(dayKey(morning)).toBe('2026-09-06');
  });
});

describe('normalizeRatingState: storage is hand-editable', () => {
  it('returns an empty state for anything that is not an object', () => {
    for (const raw of [undefined, null, 'x', 7, []]) {
      expect(normalizeRatingState(raw)).toEqual(state());
    }
  });

  it('keeps a well-formed state', () => {
    const raw = { activeDays: 3, lastActiveDay: '2026-09-05', status: 'idle' };
    expect(normalizeRatingState(raw)).toEqual(state({ activeDays: 3, lastActiveDay: '2026-09-05' }));
  });

  it('rejects an unknown status rather than trusting it', () => {
    expect(normalizeRatingState({ status: 'nagging' }).status).toBe('idle');
  });

  it('floors and clamps a hand-edited day count', () => {
    expect(normalizeRatingState({ activeDays: -5 }).activeDays).toBe(0);
    expect(normalizeRatingState({ activeDays: 2.7 }).activeDays).toBe(2);
    expect(normalizeRatingState({ activeDays: Infinity }).activeDays).toBe(0);
    expect(normalizeRatingState({ activeDays: 'lots' }).activeDays).toBe(0);
  });

  it('preserves a dismissal, which is the whole point of persisting it', () => {
    expect(normalizeRatingState({ status: 'dismissed' }).status).toBe('dismissed');
  });
});

describe('withActiveDay: at most one write per day', () => {
  it('counts the first day', () => {
    expect(withActiveDay(state(), '2026-09-06'))
      .toEqual(state({ activeDays: 1, lastActiveDay: '2026-09-06' }));
  });

  it('returns null for a second page load on the same day', () => {
    const today = state({ activeDays: 1, lastActiveDay: '2026-09-06' });
    expect(withActiveDay(today, '2026-09-06')).toBeNull();
  });

  it('counts a new day', () => {
    const yesterday = state({ activeDays: 1, lastActiveDay: '2026-09-05' });
    expect(withActiveDay(yesterday, '2026-09-06'))
      .toEqual(state({ activeDays: 2, lastActiveDay: '2026-09-06' }));
  });

  // Once answered there is nothing left to decide, so the content script should
  // stop writing to storage on this user's behalf entirely.
  it('stops counting after the user has answered', () => {
    for (const status of ['dismissed', 'rated'] as const) {
      expect(withActiveDay(state({ status, lastActiveDay: '2026-09-05' }), '2026-09-06')).toBeNull();
    }
  });

  it('ignores an empty day key', () => {
    expect(withActiveDay(state(), '')).toBeNull();
  });
});

describe('shouldPromptForRating', () => {
  const ready = state({ activeDays: RATING_MIN_ACTIVE_DAYS, lastActiveDay: '2026-09-06' });

  it('asks once the threshold is reached and rules exist', () => {
    expect(shouldPromptForRating(ready, 1)).toBe(true);
  });

  it('does not ask before the threshold', () => {
    expect(shouldPromptForRating(state({ activeDays: RATING_MIN_ACTIVE_DAYS - 1 }), 3)).toBe(false);
  });

  // Rule 2: a dismissal is permanent. This is the assertion that stops someone
  // "improving" the prompt into a recurring nag later.
  it('never asks again after a dismissal, however long the user stays', () => {
    expect(shouldPromptForRating({ ...ready, activeDays: 400, status: 'dismissed' }, 9)).toBe(false);
  });

  it('never asks again after the user has rated', () => {
    expect(shouldPromptForRating({ ...ready, activeDays: 400, status: 'rated' }, 9)).toBe(false);
  });

  it('does not ask a user who has deleted every rule', () => {
    expect(shouldPromptForRating(ready, 0)).toBe(false);
  });
});
