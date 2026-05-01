import { formatDistanceKm, formatVerifiedDate } from '../format';

describe('formatDistanceKm', () => {
  it('rounds to one decimal place with km suffix', () => {
    expect(formatDistanceKm(0.34)).toBe('0.3km');
  });

  it('rounds half-up at the boundary', () => {
    expect(formatDistanceKm(1.25)).toBe('1.3km');
  });

  it('keeps the trailing zero for whole-number distances', () => {
    expect(formatDistanceKm(2)).toBe('2.0km');
  });

  it('renders very small distances as 0.0km rather than NaN', () => {
    expect(formatDistanceKm(0)).toBe('0.0km');
  });
});

describe('formatVerifiedDate', () => {
  it('formats an ISO timestamp as YYYY.MM.DD', () => {
    expect(formatVerifiedDate('2026-03-15T10:00:00Z')).toBe('2026.03.15');
  });

  it('formats a date-only ISO string', () => {
    expect(formatVerifiedDate('2026-04-01')).toBe('2026.04.01');
  });
});
