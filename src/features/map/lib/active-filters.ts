import type { MachineTemplateResponse } from '@/shared/generated/model';
import type { Brand, Category, SearchFilters } from '@/shared/types/database';

export type ActiveFilterKind = 'brand' | 'category' | 'machineTemplate';

export interface ActiveFilter {
  kind: ActiveFilterKind;
  id: string;
  label: string;
}

interface ToActiveFiltersInput {
  filters: SearchFilters;
  brands: readonly Brand[];
  categories: readonly Category[];
  machineTemplates: readonly MachineTemplateResponse[];
}

// Korean prefix used by ActiveFilterStrip accessibility labels
// (e.g. "브랜드 Panatta 필터 제거"). Kept here so the view-model layer owns
// every user-visible label that depends on `ActiveFilterKind`.
export const ACTIVE_FILTER_KIND_LABEL: Record<ActiveFilterKind, string> = {
  brand: '브랜드',
  category: '운동 부위',
  machineTemplate: '머신',
};

/**
 * Renders a machine template chip label.
 * ADR 0022: chip 라벨은 "BrandName TemplateName · LoadingType" 형식. 사용자가
 * 정확히 어떤 (브랜드, 머신) 짝을 선택했는지 한눈에 파악 가능.
 */
export function formatMachineTemplateLabel(template: MachineTemplateResponse): string {
  const loadingSuffix = template.loadingType === 'pin' ? '핀' : '플레이트';
  return `${template.brandName} ${template.name} · ${loadingSuffix}`;
}

export function toActiveFilters({
  filters,
  brands,
  categories,
  machineTemplates,
}: ToActiveFiltersInput): ActiveFilter[] {
  const result: ActiveFilter[] = [];

  for (const brandId of filters.brandIds) {
    const brand = brands.find((candidate) => candidate.id === brandId);
    if (brand !== undefined) {
      result.push({ kind: 'brand', id: brand.id, label: brand.name });
    }
  }

  for (const categoryId of filters.categoryIds) {
    const category = categories.find((candidate) => candidate.id === categoryId);
    if (category !== undefined) {
      result.push({ kind: 'category', id: category.id, label: category.name });
    }
  }

  for (const templateId of filters.templateIds) {
    const template = machineTemplates.find((candidate) => candidate.id === templateId);
    if (template !== undefined) {
      result.push({
        kind: 'machineTemplate',
        id: template.id,
        label: formatMachineTemplateLabel(template),
      });
    }
  }

  return result;
}
