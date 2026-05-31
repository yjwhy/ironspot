import {
  gymMachineDisplayName,
  seriesTaggedDisplayName,
  snakeCaseTemplateDisplayName,
  templateDisplayName,
} from '../template-display-name';

describe('templateDisplayName (camelCase)', () => {
  it('returns Korean when both are populated', () => {
    expect(templateDisplayName({ nameKo: '하이로우', nameEn: 'High Row' })).toBe('하이로우');
  });

  it('falls back to English when Korean is empty', () => {
    expect(templateDisplayName({ nameKo: '', nameEn: 'High Row' })).toBe('High Row');
  });

  it('falls back to English when Korean is whitespace only', () => {
    expect(templateDisplayName({ nameKo: '   ', nameEn: 'High Row' })).toBe('High Row');
  });

  it('returns empty string when both are empty (legacy/backfill-pending row)', () => {
    expect(templateDisplayName({ nameKo: '', nameEn: '' })).toBe('');
  });
});

describe('snakeCaseTemplateDisplayName', () => {
  it('returns Korean when both are populated', () => {
    expect(snakeCaseTemplateDisplayName({ name_ko: '체스트 프레스', name_en: 'Chest Press' })).toBe(
      '체스트 프레스',
    );
  });

  it('falls back to English when Korean is empty', () => {
    expect(snakeCaseTemplateDisplayName({ name_ko: '', name_en: 'Chest Press' })).toBe(
      'Chest Press',
    );
  });
});

describe('seriesTaggedDisplayName', () => {
  const seriesNameById = new Map([
    ['s-falcon', 'Falcon'],
    ['s-master-pro', 'Master Pro'],
  ]);

  it('prefixes the series name when the template belongs to a series', () => {
    expect(
      seriesTaggedDisplayName(
        { nameKo: '시티드 체스트 프레스', nameEn: 'Seated Chest Press', seriesId: 's-falcon' },
        seriesNameById,
      ),
    ).toBe('[Falcon] 시티드 체스트 프레스');
  });

  it('distinguishes same-named models across series', () => {
    const a = seriesTaggedDisplayName(
      { nameKo: '시티드 체스트 프레스', nameEn: 'Seated Chest Press', seriesId: 's-falcon' },
      seriesNameById,
    );
    const b = seriesTaggedDisplayName(
      { nameKo: '시티드 체스트 프레스', nameEn: 'Seated Chest Press', seriesId: 's-master-pro' },
      seriesNameById,
    );
    expect(a).not.toBe(b);
  });

  it('renders the plain name when the template has no series', () => {
    expect(
      seriesTaggedDisplayName(
        { nameKo: '하이로우', nameEn: 'High Row', seriesId: null },
        seriesNameById,
      ),
    ).toBe('하이로우');
  });

  it('renders the plain name when the seriesId is unknown to the map', () => {
    expect(
      seriesTaggedDisplayName(
        { nameKo: '하이로우', nameEn: 'High Row', seriesId: 's-missing' },
        seriesNameById,
      ),
    ).toBe('하이로우');
  });

  it('falls back to English inside the tag when Korean is empty', () => {
    expect(
      seriesTaggedDisplayName(
        { nameKo: '', nameEn: 'Glute', seriesId: 's-falcon' },
        seriesNameById,
      ),
    ).toBe('[Falcon] Glute');
  });
});

describe('gymMachineDisplayName', () => {
  it('prefers customName over template names (direct-input contribution)', () => {
    expect(
      gymMachineDisplayName({
        customName: '특수 머신',
        machineNameKo: '하이로우',
        machineNameEn: 'High Row',
      }),
    ).toBe('특수 머신');
  });

  it('treats whitespace-only customName as not set', () => {
    expect(
      gymMachineDisplayName({
        customName: '   ',
        machineNameKo: '하이로우',
        machineNameEn: 'High Row',
      }),
    ).toBe('하이로우');
  });

  it('returns Korean when customName is null and Korean is populated', () => {
    expect(
      gymMachineDisplayName({
        customName: null,
        machineNameKo: '하이로우',
        machineNameEn: 'High Row',
      }),
    ).toBe('하이로우');
  });

  it('falls back to English when Korean is empty and customName is missing', () => {
    expect(gymMachineDisplayName({ machineNameKo: '', machineNameEn: 'High Row' })).toBe(
      'High Row',
    );
  });

  it('returns empty string when nothing is set (pathological case — caller decides placeholder)', () => {
    expect(gymMachineDisplayName({})).toBe('');
  });
});
