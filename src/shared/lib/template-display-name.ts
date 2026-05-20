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
