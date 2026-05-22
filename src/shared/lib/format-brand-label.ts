/**
 * Phase 5 item 24: single source of truth for "how do I render this brand
 * name?" across every brand-display surface (FilterSheet accordion row,
 * MachinePicker brand step, GymDetail MachineList section header,
 * brand-only filter chip, brand-in-compound chip).
 *
 * Two helpers because brand renders in two distinct contexts:
 *
 *   - `formatBrandLabel` — used where the brand stands alone in a label
 *     slot. Returns `"{nameKo} ({name})"` when both are populated and
 *     differ. Falls back to plain `{nameKo}` when the two match (gym80,
 *     뉴텍) or when nameKo is missing. Mirrors item 18's "primary +
 *     parenthesised secondary" pattern at the helper level so call sites
 *     can stay one-line.
 *
 *   - `brandShortName` — used where the brand is a prefix in a compound
 *     label (e.g. the template chip `"브랜드 머신명 · 핀"`). Returns the
 *     Korean form alone, falling back to English. Mirrors item 18's
 *     `templateDisplayName` shape so compound rendering stays compact.
 *
 * Empty / whitespace nameKo is treated as "not set" (same convention as
 * item 18's `preferKorean`) so V11's defensive backfill for admin-promoted
 * brands (`name_ko = name`) renders cleanly without parens.
 */

interface BrandLike {
  name: string;
  nameKo: string;
}

export function formatBrandLabel(brand: BrandLike): string {
  const ko = brand.nameKo.trim();
  const en = brand.name.trim();
  if (ko === en) return en;
  if (ko === '') return en;
  if (en === '') return ko;
  return `${ko} (${en})`;
}

export function brandShortName(brand: BrandLike): string {
  return brand.nameKo.trim() || brand.name;
}
