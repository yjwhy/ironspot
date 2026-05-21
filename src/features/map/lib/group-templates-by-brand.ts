import type { MachineTemplateResponse } from '@/shared/generated/model';
import type { Brand, Category } from '@/shared/types/database';

/**
 * Phase 5 item 23 (ADR 0024): the accordion FilterSheet renders one row per
 * brand; expanding a brand reveals its templates grouped by body part. This
 * helper builds that grouped view from the flat lists the FilterSheet
 * receives via props.
 *
 * Brands without any template at the current narrowing (e.g. when an active
 * 운동 부위 chip filters every template out of that brand) are dropped so the
 * empty rows don't clutter the list — per ADR 0024 결정 6.
 */

export interface AccordionMachineRow {
  readonly id: string;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly loadingType: string;
}

export interface AccordionCategorySection {
  readonly category: Category;
  readonly templates: readonly AccordionMachineRow[];
}

export interface BrandGroup {
  readonly brand: Brand;
  readonly sections: readonly AccordionCategorySection[];
  readonly totalCount: number;
}

interface GroupTemplatesArgs {
  readonly brands: readonly Brand[];
  readonly categories: readonly Category[];
  readonly templates: readonly MachineTemplateResponse[];
  /**
   * When provided and non-empty, only templates whose `categoryId` is in this
   * set survive the grouping — backs the 운동 부위 chip cross-filter.
   */
  readonly activeCategoryIds?: readonly string[];
  /**
   * Global search query (slice b). Tokens match case-insensitively against
   * `brand.name`, `template.nameKo`, and `template.nameEn`. A brand-name
   * match keeps all of that brand's templates (after the category narrowing
   * still applies); a template-name match keeps only the matching templates.
   * Empty or whitespace-only string = no search (all templates retained).
   */
  readonly searchQuery?: string;
}

function normaliseQuery(raw: string | undefined): string {
  return raw === undefined ? '' : raw.trim().toLowerCase();
}

export function groupTemplatesByBrand({
  brands,
  categories,
  templates,
  activeCategoryIds,
  searchQuery,
}: GroupTemplatesArgs): readonly BrandGroup[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const query = normaliseQuery(searchQuery);

  const filteredTemplates =
    activeCategoryIds !== undefined && activeCategoryIds.length > 0
      ? templates.filter((t) => activeCategoryIds.includes(t.categoryId))
      : templates;

  const templatesByBrand = new Map<string, MachineTemplateResponse[]>();
  for (const template of filteredTemplates) {
    const list = templatesByBrand.get(template.brandId);
    if (list === undefined) {
      templatesByBrand.set(template.brandId, [template]);
    } else {
      list.push(template);
    }
  }

  const groups: BrandGroup[] = [];
  for (const [brandId, brandTemplates] of templatesByBrand) {
    const brand = brandById.get(brandId);
    if (brand === undefined || brandTemplates.length === 0) continue;

    // Slice b: search query narrows visible templates per ADR 0024 결정 5.
    // - Brand-name match → all of brand's templates survive (matches the
    //   "Hammer Strength" → see all Hammer Strength machines mental model).
    // - Template-name match → only matching templates survive.
    // - No query → all templates pass through.
    const isBrandNameMatch = query !== '' && brand.name.toLowerCase().includes(query);
    const matchedTemplates =
      query === '' || isBrandNameMatch
        ? brandTemplates
        : brandTemplates.filter(
            (t) => t.nameKo.toLowerCase().includes(query) || t.nameEn.toLowerCase().includes(query),
          );
    if (matchedTemplates.length === 0) continue;

    const byCategory = new Map<string, MachineTemplateResponse[]>();
    for (const template of matchedTemplates) {
      const list = byCategory.get(template.categoryId);
      if (list === undefined) {
        byCategory.set(template.categoryId, [template]);
      } else {
        list.push(template);
      }
    }

    const sections: AccordionCategorySection[] = [];
    for (const [categoryId, ts] of byCategory) {
      const category = categoryById.get(categoryId);
      if (category === undefined) continue;
      sections.push({
        category,
        templates: ts.map((t) => ({
          id: t.id,
          nameKo: t.nameKo,
          nameEn: t.nameEn,
          loadingType: t.loadingType,
        })),
      });
    }
    sections.sort((a, b) => a.category.name.localeCompare(b.category.name, 'ko'));

    groups.push({
      brand,
      sections,
      // After-filter count (Q3): reflects what the user sees inside the
      // accordion after `activeCategoryIds` + `searchQuery` narrowing. Total
      // brand-catalog size is intentionally NOT exposed so the row badge can
      // never lie about what's about to render on expand.
      totalCount: matchedTemplates.length,
    });
  }

  groups.sort((a, b) => a.brand.name.localeCompare(b.brand.name, 'ko'));
  return groups;
}
