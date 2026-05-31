/**
 * Phase 5 item 18: single source of truth for "which name do I render?"
 * across every machine-template surface (cards, picker, detail, admin,
 * owner, NL chip).
 *
 * Returns Korean primary when populated; falls back to English. Treats
 * empty string the same as null/undefined so backfill-pending rows
 * (item 22 will land Korean names later) still surface something.
 * Centralises the `||` vs `??` policy that previously diverged across
 * ~10 inline call sites.
 *
 * Two flavours because the codebase has both shapes:
 *   - camelCase from the Orval-generated wire DTOs
 *     (`MachineTemplateResponse`, `MachineTemplateSuggestion`,
 *     `GymMachineResponse`).
 *   - snake_case from the hand-written `MachineTemplate` mirror in
 *     `src/shared/types/database.ts` (Supabase-style fetch shape).
 */

type Nullable = string | null | undefined;

function preferKorean(nameKo: Nullable, nameEn: Nullable): string {
  // Empty string counts as "not set" so a backfill-pending row falls
  // through to the English column. `?? ''` defenses make the type
  // collapse to `string` without `||` chains at call sites.
  return (nameKo ?? '').trim() || (nameEn ?? '').trim();
}

export function templateDisplayName(template: { nameKo: string; nameEn: string }): string {
  return preferKorean(template.nameKo, template.nameEn);
}

export function snakeCaseTemplateDisplayName(template: {
  name_ko: string;
  name_en: string;
}): string {
  return preferKorean(template.name_ko, template.name_en);
}

/**
 * Series-tagged display name for the series-UNAWARE pickers (MachinePicker,
 * OwnerMachineForm) where a brand can show several identically-named models
 * across product lines (e.g. LEXCO has a "시티드 체스트 프레스" in Falcon,
 * Master, Master Pro, Taurus and Master Pro Plate Load). The `[Series]`
 * prefix is what keeps those rows distinguishable.
 *
 * NOT used on the series-FIRST flow (UploadManualInputScreen template step):
 * the user has already picked the series there, so the tag would be redundant
 * — that surface keeps {@link templateDisplayName}.
 *
 * `seriesNameById` maps machine_series.id -> its English name (from
 * useSeries()). Templates with no series (series_id NULL) render unchanged.
 */
export function seriesTaggedDisplayName(
  template: { nameKo: string; nameEn: string; seriesId?: string | null },
  seriesNameById: ReadonlyMap<string, string>,
): string {
  const base = templateDisplayName(template);
  const seriesName = template.seriesId ? seriesNameById.get(template.seriesId) : null;
  return seriesName ? `[${seriesName}] ${base}` : base;
}

/**
 * GymMachineResponse-shape picker (custom_name overrides since user-typed
 * direct input wins over the template's canonical name).
 */
export function gymMachineDisplayName(machine: {
  machineNameKo?: Nullable;
  machineNameEn?: Nullable;
  customName?: Nullable;
}): string {
  const custom = (machine.customName ?? '').trim();
  if (custom) return custom;
  return preferKorean(machine.machineNameKo, machine.machineNameEn);
}

/**
 * Korean label for the loading_type enum. Previously inlined as
 * `type === 'pin' ? '핀' : '플레이트'` in 3 admin screens + a picker toggle;
 * Phase 5 item 11-4 FF review unifies the mapping here. Falls back to the
 * raw literal for forward compatibility — if a future enum value lands
 * before the UI is updated, we render the literal rather than mis-labeling
 * it as '플레이트'.
 */
export function formatLoadingType(loadingType: string): string {
  if (loadingType === 'pin') return '핀';
  if (loadingType === 'plate') return '플레이트';
  return loadingType;
}
