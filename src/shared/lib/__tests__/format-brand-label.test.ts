import { brandShortName, formatBrandLabel } from '../format-brand-label';

describe('formatBrandLabel', () => {
  it('returns "한글 (영문)" when both populated and differ', () => {
    expect(formatBrandLabel({ name: 'Hammer Strength', nameKo: '해머 스트렝스' })).toBe(
      '해머 스트렝스 (Hammer Strength)',
    );
  });

  it('returns plain string when nameKo equals name (gym80, 뉴텍 verbatim cases)', () => {
    expect(formatBrandLabel({ name: 'gym80', nameKo: 'gym80' })).toBe('gym80');
    expect(formatBrandLabel({ name: '뉴텍', nameKo: '뉴텍' })).toBe('뉴텍');
  });

  it('falls back to English alone when nameKo is empty (backfill-pending row)', () => {
    expect(formatBrandLabel({ name: 'Panatta', nameKo: '' })).toBe('Panatta');
  });

  it('treats whitespace-only nameKo as not set', () => {
    expect(formatBrandLabel({ name: 'Panatta', nameKo: '   ' })).toBe('Panatta');
  });

  it('trims internal whitespace around the values before rendering', () => {
    expect(formatBrandLabel({ name: ' DRAX ', nameKo: ' 디랙스 ' })).toBe('디랙스 (DRAX)');
  });

  it('returns nameKo alone when name is empty (symmetric empty-side fallback)', () => {
    expect(formatBrandLabel({ name: '', nameKo: '디랙스' })).toBe('디랙스');
  });
});

describe('brandShortName', () => {
  it('prefers Korean when populated (B-group compound chip context)', () => {
    expect(brandShortName({ name: 'Life Fitness', nameKo: '라이프 피트니스' })).toBe(
      '라이프 피트니스',
    );
  });

  it('falls back to English when nameKo is empty', () => {
    expect(brandShortName({ name: 'Panatta', nameKo: '' })).toBe('Panatta');
  });

  it('falls back to English when nameKo is whitespace only', () => {
    expect(brandShortName({ name: 'Panatta', nameKo: '   ' })).toBe('Panatta');
  });

  it('returns nameKo when it equals name (gym80 / 뉴텍 verbatim cases)', () => {
    expect(brandShortName({ name: 'gym80', nameKo: 'gym80' })).toBe('gym80');
    expect(brandShortName({ name: '뉴텍', nameKo: '뉴텍' })).toBe('뉴텍');
  });
});
