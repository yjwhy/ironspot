import {
  gymMachineDisplayName,
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
