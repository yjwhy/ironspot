import type { MachineTemplateResponse, SeriesResponse } from '@/shared/generated/model';
import type { Brand, Category } from '@/shared/types/database';

/**
 * Phase 5 item 23 (ADR 0024): the accordion FilterSheet renders one row per
 * brand; expanding a brand reveals its templates grouped by Series → body part,
 * mirroring the manual-registration picker. This helper builds that grouped
 * view from the flat lists the FilterSheet receives via props.
 *
 * Brands without any template at the current narrowing (e.g. when an active
 * 운동 부위 chip filters every template out of that brand) are dropped so the
 * empty rows don't clutter the list — per ADR 0024 결정 6.
 *
 * Nearby-count overlay: when a `counts` map (templateId → distinct gyms in the
 * searched bbox) is supplied, each row carries its `gymCount`; rows sort by
 * count desc within a section, and series sort by total nearby count desc, so
 * machines a user can actually find nearby float to the top.
 */

export interface AccordionMachineRow {
  readonly id: string;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly loadingType: string;
  /** Distinct gyms within the searched bbox that hold this template; 0 when none/unknown. */
  readonly gymCount: number;
}

export interface AccordionCategorySection {
  readonly category: Category;
  readonly templates: readonly AccordionMachineRow[];
}

export interface AccordionSeriesGroup {
  /** `null` for templates with no series assigned (rendered under 기타). */
  readonly seriesId: string | null;
  readonly seriesName: string | null;
  readonly sections: readonly AccordionCategorySection[];
}

export interface BrandGroup {
  readonly brand: Brand;
  readonly seriesGroups: readonly AccordionSeriesGroup[];
  readonly totalCount: number;
}

interface GroupTemplatesArgs {
  readonly brands: readonly Brand[];
  readonly categories: readonly Category[];
  readonly series: readonly SeriesResponse[];
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
  /**
   * templateId → distinct gyms within the searched bbox. Absent templates (or
   * an absent map entirely) resolve to a 0 count.
   */
  readonly counts?: ReadonlyMap<string, number>;
}

/** Bucket key for templates with no series assigned; also the stable React key for the 기타 group. */
export const NO_SERIES_KEY = '__none__';

function normaliseQuery(raw: string | undefined): string {
  return raw === undefined ? '' : raw.trim().toLowerCase();
}

function buildSections(
  templates: readonly MachineTemplateResponse[],
  categoryById: ReadonlyMap<string, Category>,
  counts: ReadonlyMap<string, number> | undefined,
): AccordionCategorySection[] {
  const byCategory = new Map<string, MachineTemplateResponse[]>();
  for (const template of templates) {
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
    const rows: AccordionMachineRow[] = ts.map((t) => ({
      id: t.id,
      nameKo: t.nameKo,
      nameEn: t.nameEn,
      loadingType: t.loadingType,
      gymCount: counts?.get(t.id) ?? 0,
    }));
    // Rows the user can find nearby first; ties broken by Korean name.
    rows.sort((a, b) => b.gymCount - a.gymCount || a.nameKo.localeCompare(b.nameKo, 'ko'));
    sections.push({ category, templates: rows });
  }
  sections.sort((a, b) => a.category.name.localeCompare(b.category.name, 'ko'));
  return sections;
}

function sectionGymCount(section: AccordionCategorySection): number {
  return section.templates.reduce((sum, row) => sum + row.gymCount, 0);
}

export function groupTemplatesByBrand({
  brands,
  categories,
  series,
  templates,
  activeCategoryIds,
  searchQuery,
  counts,
}: GroupTemplatesArgs): readonly BrandGroup[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const seriesById = new Map(series.map((s) => [s.id, s]));
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

    const bySeries = new Map<string, MachineTemplateResponse[]>();
    for (const template of matchedTemplates) {
      const key = template.seriesId ?? NO_SERIES_KEY;
      const list = bySeries.get(key);
      if (list === undefined) {
        bySeries.set(key, [template]);
      } else {
        list.push(template);
      }
    }

    const seriesGroups: AccordionSeriesGroup[] = [];
    for (const [seriesKey, ts] of bySeries) {
      const seriesId = seriesKey === NO_SERIES_KEY ? null : seriesKey;
      const seriesName = seriesId === null ? null : (seriesById.get(seriesId)?.name ?? null);
      seriesGroups.push({
        seriesId,
        seriesName,
        sections: buildSections(ts, categoryById, counts),
      });
    }
    // Series with more nearby machines float up; unassigned (null) sinks last;
    // ties broken by series name.
    seriesGroups.sort((a, b) => {
      if (a.seriesName === null) return 1;
      if (b.seriesName === null) return -1;
      const byCount =
        b.sections.reduce((s, sec) => s + sectionGymCount(sec), 0) -
        a.sections.reduce((s, sec) => s + sectionGymCount(sec), 0);
      return byCount || a.seriesName.localeCompare(b.seriesName, 'ko');
    });

    groups.push({
      brand,
      seriesGroups,
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
