import { describe, it, expect } from '@jest/globals';
import { calculateDistance } from '../distance';

describe('calculateDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(calculateDistance(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  it('calculates Paris to London (~343 km)', () => {
    const d = calculateDistance(48.8566, 2.3522, 51.5074, -0.1278);
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(350);
  });

  it('calculates short distance within a city (~1.9 km)', () => {
    const d = calculateDistance(48.8584, 2.2945, 48.8606, 2.3376);
    expect(d).toBeGreaterThan(1);
    expect(d).toBeLessThan(5);
  });

  it('calculates antipodal distance (~20000 km)', () => {
    const d = calculateDistance(0, 0, 0, 180);
    expect(d).toBeGreaterThan(20000);
    expect(d).toBeLessThan(20100);
  });

  it('returns NaN for NaN coordinates', () => {
    expect(calculateDistance(NaN, 2.3522, 51.5074, -0.1278)).toBeNaN();
    expect(calculateDistance(48.8566, NaN, 51.5074, -0.1278)).toBeNaN();
  });

  it('returns NaN for Infinity coordinates', () => {
    expect(calculateDistance(Infinity, 2.3522, 51.5074, -0.1278)).toBeNaN();
  });

  it('returns NaN for out-of-range latitude', () => {
    expect(calculateDistance(91, 0, 0, 0)).toBeNaN();
    expect(calculateDistance(-91, 0, 0, 0)).toBeNaN();
  });

  it('returns NaN for out-of-range longitude', () => {
    expect(calculateDistance(0, 181, 0, 0)).toBeNaN();
    expect(calculateDistance(0, -181, 0, 0)).toBeNaN();
  });

  it('handles boundary coordinates (poles)', () => {
    const d = calculateDistance(90, 0, -90, 0);
    expect(d).toBeGreaterThan(20000);
    expect(d).toBeLessThan(20100);
  });

  it('handles boundary longitude (-180 to 180)', () => {
    const d = calculateDistance(0, -180, 0, 180);
    expect(d).toBeLessThan(1);
  });

  it('is symmetric', () => {
    const d1 = calculateDistance(48.8566, 2.3522, 51.5074, -0.1278);
    const d2 = calculateDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(d1).toBeCloseTo(d2, 10);
  });
});
