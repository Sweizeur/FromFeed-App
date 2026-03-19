import { describe, it, expect, jest } from '@jest/globals';

jest.mock('expo-calendar', () => ({}));

import {
  toDateOnly,
  parseTimeToDate,
  getActivityLocation,
  areValidCoords,
  buildActivityNotes,
} from '../calendar-export';
import type { PlanActivity } from '@/features/ai/types';

describe('toDateOnly', () => {
  it('extracts date from ISO string', () => {
    expect(toDateOnly('2025-06-15T10:30:00.000Z')).toBe('2025-06-15');
  });

  it('keeps date-only string unchanged', () => {
    expect(toDateOnly('2025-06-15')).toBe('2025-06-15');
  });

  it('returns original string for non-matching format', () => {
    expect(toDateOnly('invalid')).toBe('invalid');
  });

  it('returns original when T-split produces no valid date', () => {
    expect(toDateOnly('Thello')).toBe('Thello');
  });
});

describe('parseTimeToDate', () => {
  it('parses time string into Date', () => {
    const d = parseTimeToDate('2025-06-15', '14:30');
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it('defaults to noon when no time provided', () => {
    const d = parseTimeToDate('2025-06-15', null);
    expect(d.getHours()).toBe(12);
    expect(d.getMinutes()).toBe(0);
  });

  it('handles time with only hours', () => {
    const d = parseTimeToDate('2025-06-15', '9');
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  it('clamps hours to 0-23', () => {
    const d = parseTimeToDate('2025-06-15', '25:00');
    expect(d.getHours()).toBeLessThanOrEqual(23);
  });

  it('clamps minutes to 0-59', () => {
    const d = parseTimeToDate('2025-06-15', '10:70');
    expect(d.getMinutes()).toBeLessThanOrEqual(59);
  });

  it('handles invalid time format gracefully', () => {
    const d = parseTimeToDate('2025-06-15', 'invalid');
    expect(d.getHours()).toBe(9);
  });
});

describe('areValidCoords', () => {
  it('returns true for valid coordinates', () => {
    expect(areValidCoords(48.8566, 2.3522)).toBe(true);
  });

  it('returns false for 0,0', () => {
    expect(areValidCoords(0, 0)).toBe(false);
  });

  it('returns false for non-numbers', () => {
    expect(areValidCoords('48', '2')).toBe(false);
    expect(areValidCoords(null, null)).toBe(false);
    expect(areValidCoords(undefined, undefined)).toBe(false);
  });

  it('returns false for NaN', () => {
    expect(areValidCoords(NaN, 2)).toBe(false);
  });

  it('returns false for Infinity', () => {
    expect(areValidCoords(Infinity, 2)).toBe(false);
  });

  it('returns false for out-of-range lat', () => {
    expect(areValidCoords(91, 0)).toBe(false);
    expect(areValidCoords(-91, 0)).toBe(false);
  });

  it('returns false for out-of-range lon', () => {
    expect(areValidCoords(0, 181)).toBe(false);
    expect(areValidCoords(0, -181)).toBe(false);
  });

  it('accepts boundary values', () => {
    expect(areValidCoords(90, 180)).toBe(true);
    expect(areValidCoords(-90, -180)).toBe(true);
  });
});

describe('getActivityLocation', () => {
  it('returns googleFormattedAddress when available', () => {
    const activity = {
      place: { googleFormattedAddress: '10 Rue X, Paris', placeName: 'Café' },
    } as PlanActivity;
    expect(getActivityLocation(activity)).toBe('10 Rue X, Paris');
  });

  it('returns address when no googleFormattedAddress', () => {
    const activity = {
      place: { address: '10 Rue X', placeName: 'Café' },
    } as PlanActivity;
    expect(getActivityLocation(activity)).toBe('10 Rue X');
  });

  it('returns name + city when no address', () => {
    const activity = {
      place: { placeName: 'Café', city: 'Paris' },
    } as PlanActivity;
    expect(getActivityLocation(activity)).toBe('Café, Paris');
  });

  it('returns city when only city available', () => {
    const activity = {
      place: { city: 'Paris' },
    } as PlanActivity;
    expect(getActivityLocation(activity)).toBe('Paris');
  });

  it('returns placeName when only name available', () => {
    const activity = {
      place: { placeName: 'Café' },
    } as PlanActivity;
    expect(getActivityLocation(activity)).toBe('Café');
  });

  it('returns undefined when no location data', () => {
    const activity = { place: {} } as PlanActivity;
    expect(getActivityLocation(activity)).toBeUndefined();
  });
});

describe('buildActivityNotes', () => {
  it('builds notes with address, phone, url, and notes', () => {
    const activity = {
      place: {
        googleFormattedAddress: '10 Rue X, Paris',
        googlePhone: '01 23 45',
        websiteUrl: 'https://example.com',
        lat: 48.8566,
        lon: 2.3522,
        placeName: 'Café',
      },
      notes: 'Great coffee',
    } as PlanActivity;
    const notes = buildActivityNotes(activity);
    expect(notes).toContain('10 Rue X, Paris');
    expect(notes).toContain('Tél: 01 23 45');
    expect(notes).toContain('https://example.com');
    expect(notes).toContain('Great coffee');
    expect(notes).toContain('Carte:');
  });

  it('returns empty string when no data', () => {
    const activity = { place: {} } as PlanActivity;
    expect(buildActivityNotes(activity)).toBe('');
  });
});
