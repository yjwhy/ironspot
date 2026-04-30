import { haversineKm } from '../geo';

const GANGNAM = { latitude: 37.4979, longitude: 127.0276 };
const SEOUL_STATION = { latitude: 37.5547, longitude: 126.9707 };

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(GANGNAM, GANGNAM)).toBe(0);
  });

  it('returns the great-circle distance between Gangnam and Seoul Station (~8.4km)', () => {
    const km = haversineKm(GANGNAM, SEOUL_STATION);
    expect(km).toBeGreaterThan(8);
    expect(km).toBeLessThan(9);
  });

  it('is symmetric: a→b equals b→a', () => {
    expect(haversineKm(GANGNAM, SEOUL_STATION)).toBeCloseTo(haversineKm(SEOUL_STATION, GANGNAM), 6);
  });

  it('always returns a non-negative value', () => {
    expect(
      haversineKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 1 }),
    ).toBeGreaterThan(0);
  });

  it('handles antipodal points (≈ half the earth circumference)', () => {
    const km = haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 });
    expect(km).toBeCloseTo(20015, -1);
  });
});
