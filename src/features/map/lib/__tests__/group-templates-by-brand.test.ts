import type { MachineTemplateResponse, SeriesResponse } from '@/shared/generated/model';
import type { Brand, Category } from '@/shared/types/database';

import { groupTemplatesByBrand } from '../group-templates-by-brand';

const brands: Brand[] = [{ id: 'b1', name: 'BrandOne', nameKo: '브랜드원' }];
const categories: Category[] = [
  { id: 'c-back', name: '등' },
  { id: 'c-chest', name: '가슴' },
];
const series: SeriesResponse[] = [
  { id: 's1', brandId: 'b1', name: 'Alpha', nameKo: 'Alpha' },
  { id: 's2', brandId: 'b1', name: 'Beta', nameKo: 'Beta' },
];

function tpl(id: string, categoryId: string, seriesId: string | null): MachineTemplateResponse {
  return {
    id,
    brandId: 'b1',
    brandName: 'BrandOne',
    brandNameKo: '브랜드원',
    categoryId,
    nameEn: id.toUpperCase(),
    nameKo: id,
    loadingType: 'pin',
    seriesId,
  };
}

const templates = [
  tpl('t1', 'c-back', 's1'),
  tpl('t2', 'c-back', 's1'),
  tpl('t3', 'c-chest', 's2'),
  tpl('t4', 'c-back', null),
];
const counts = new Map<string, number>([
  ['t1', 5],
  ['t3', 3],
  ['t4', 1],
]); // t2 absent → 0

describe('groupTemplatesByBrand — series + counts', () => {
  it('nests templates under series → body-part, attaching gym counts', () => {
    const groups = groupTemplatesByBrand({ brands, categories, series, templates, counts });

    expect(groups).toHaveLength(1);
    const brand = groups[0];
    expect(brand?.totalCount).toBe(4);

    // Series ordered by total nearby count desc: Alpha(5) > Beta(3) > 기타(1).
    expect(brand?.seriesGroups.map((s) => s.seriesName)).toEqual(['Alpha', 'Beta', null]);

    const alpha = brand?.seriesGroups[0];
    const backSection = alpha?.sections.find((s) => s.category.id === 'c-back');
    expect(backSection).toBeDefined();
    // Rows sorted by gymCount desc within a section: t1(5) before t2(0).
    expect(backSection?.templates.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(backSection?.templates[0]?.gymCount).toBe(5);
    expect(backSection?.templates[1]?.gymCount).toBe(0);
  });

  it('defaults gym counts to 0 when no counts map is given', () => {
    const groups = groupTemplatesByBrand({ brands, categories, series, templates });
    const everyRow = (groups[0]?.seriesGroups ?? []).flatMap((s) =>
      s.sections.flatMap((sec) => sec.templates),
    );
    expect(everyRow.every((r) => r.gymCount === 0)).toBe(true);
  });
});
