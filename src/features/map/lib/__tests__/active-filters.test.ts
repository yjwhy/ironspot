import type { MachineTemplateResponse } from '@/shared/generated/model';
import type { Brand, Category, SearchFilters } from '@/shared/types/database';

import { formatMachineTemplateLabel, toActiveFilters } from '../active-filters';

const brands: Brand[] = [
  { id: 'b1', name: 'Panatta' },
  { id: 'b2', name: 'Hammer Strength' },
];

const categories: Category[] = [
  { id: 'c1', name: '등' },
  { id: 'c2', name: '가슴' },
];

const machineTemplates: MachineTemplateResponse[] = [
  {
    id: 't1',
    brandId: 'b1',
    brandName: 'Panatta',
    categoryId: 'c1',
    nameEn: 'High Row',
    nameKo: 'High Row',
    loadingType: 'pin',
  },
  {
    id: 't2',
    brandId: 'b2',
    brandName: 'Hammer Strength',
    categoryId: 'c2',
    nameEn: 'Chest Press',
    nameKo: 'Chest Press',
    loadingType: 'plate',
  },
];

const emptyFilters: SearchFilters = {
  brandIds: [],
  categoryIds: [],
  templateIds: [],
  machineFilterMode: 'or',
};

describe('formatMachineTemplateLabel', () => {
  const [pinTemplate, plateTemplate] = machineTemplates;

  it('formats pin loading with brand prefix + 핀 suffix', () => {
    if (pinTemplate === undefined) throw new Error('test fixture missing');
    expect(formatMachineTemplateLabel(pinTemplate)).toBe('Panatta High Row · 핀');
  });

  it('formats plate loading with 플레이트 suffix', () => {
    if (plateTemplate === undefined) throw new Error('test fixture missing');
    expect(formatMachineTemplateLabel(plateTemplate)).toBe(
      'Hammer Strength Chest Press · 플레이트',
    );
  });
});

describe('toActiveFilters', () => {
  it('returns an empty array when no filter is active', () => {
    expect(
      toActiveFilters({ filters: emptyFilters, brands, categories, machineTemplates }),
    ).toEqual([]);
  });

  it('maps brand ids to brand names preserving selection order', () => {
    const result = toActiveFilters({
      filters: { ...emptyFilters, brandIds: ['b2', 'b1'] },
      brands,
      categories,
      machineTemplates,
    });
    expect(result).toEqual([
      { kind: 'brand', id: 'b2', label: 'Hammer Strength' },
      { kind: 'brand', id: 'b1', label: 'Panatta' },
    ]);
  });

  it('maps category ids to category names', () => {
    const result = toActiveFilters({
      filters: { ...emptyFilters, categoryIds: ['c1', 'c2'] },
      brands,
      categories,
      machineTemplates,
    });
    expect(result).toEqual([
      { kind: 'category', id: 'c1', label: '등' },
      { kind: 'category', id: 'c2', label: '가슴' },
    ]);
  });

  it('maps template ids to brand-prefixed chip labels', () => {
    const result = toActiveFilters({
      filters: { ...emptyFilters, templateIds: ['t1', 't2'] },
      brands,
      categories,
      machineTemplates,
    });
    expect(result).toEqual([
      { kind: 'machineTemplate', id: 't1', label: 'Panatta High Row · 핀' },
      { kind: 'machineTemplate', id: 't2', label: 'Hammer Strength Chest Press · 플레이트' },
    ]);
  });

  it('skips ids that do not resolve to a known item (defensive against stale selections)', () => {
    const result = toActiveFilters({
      filters: { ...emptyFilters, brandIds: ['b1', 'unknown'], templateIds: ['t1', 'tx'] },
      brands,
      categories,
      machineTemplates,
    });
    expect(result).toEqual([
      { kind: 'brand', id: 'b1', label: 'Panatta' },
      { kind: 'machineTemplate', id: 't1', label: 'Panatta High Row · 핀' },
    ]);
  });

  it('combines brand, category, and machineTemplate in order', () => {
    const result = toActiveFilters({
      filters: {
        brandIds: ['b1'],
        categoryIds: ['c2'],
        templateIds: ['t2'],
        machineFilterMode: 'or',
      },
      brands,
      categories,
      machineTemplates,
    });
    expect(result).toEqual([
      { kind: 'brand', id: 'b1', label: 'Panatta' },
      { kind: 'category', id: 'c2', label: '가슴' },
      { kind: 'machineTemplate', id: 't2', label: 'Hammer Strength Chest Press · 플레이트' },
    ]);
  });
});
