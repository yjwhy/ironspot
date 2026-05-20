import type { MachineTemplateResponse, SearchScope } from '@/shared/generated/model';
import { templateDisplayName } from '@/shared/lib/template-display-name';
import type { Brand, Category, LoadingType, SearchFilters } from '@/shared/types/database';

type MachineFilterMode = SearchFilters['machineFilterMode'];

/**
 * ADR 0022: structured filter UI uses `machineFilterMode: 'or' | 'and'` for
 * UX clarity; backend API uses `scope: 'each' | 'combined'` (same semantics
 * as NL Search's `SearchScope`). These two helpers keep the mapping in a
 * single source of truth — adding an enum value to one side forces a fix here.
 */
export function machineFilterModeToScope(mode: MachineFilterMode): SearchScope {
  return mode === 'and' ? 'combined' : 'each';
}

export function scopeToMachineFilterMode(scope: SearchScope | undefined): MachineFilterMode {
  return scope === 'combined' ? 'and' : 'or';
}

// Phase 5 item 20: single source of truth for "is at least one filter active".
// Pure function over SearchFilters so consumers (useFilters, FilterSheet) can't
// drift apart when a new filter dimension is added — every caller hits the
// same predicate.
export function hasActiveSearchFilters(filters: SearchFilters): boolean {
  return filters.brandIds.length + filters.categoryIds.length + filters.templateIds.length > 0;
}

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

// Chip suffix mapping for machine template loading type. `Record<LoadingType, ...>`
// enforces compile-time exhaustiveness — adding a new LoadingType triggers a TS
// error here, preventing silent fallback through a ternary.
const LOADING_TYPE_SUFFIX: Record<LoadingType, string> = {
  pin: '핀',
  plate: '플레이트',
};

function loadingTypeSuffix(loadingType: string): string {
  // OpenAPI schema types loadingType as `string`, but the backend constrains it
  // to the LoadingType enum at the source. Defensive lookup: known value → label,
  // unknown value → raw passthrough (logged would be nice but out of scope).
  return loadingType in LOADING_TYPE_SUFFIX
    ? LOADING_TYPE_SUFFIX[loadingType as LoadingType]
    : loadingType;
}

/**
 * Renders a machine template chip label.
 * ADR 0022: chip 라벨은 "BrandName TemplateName · LoadingType" 형식. 사용자가
 * 정확히 어떤 (브랜드, 머신) 짝을 선택했는지 한눈에 파악 가능.
 */
export function formatMachineTemplateLabel(template: MachineTemplateResponse): string {
  return `${template.brandName} ${templateDisplayName(template)} · ${loadingTypeSuffix(template.loadingType)}`;
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
