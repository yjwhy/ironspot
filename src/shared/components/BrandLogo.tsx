import { type ImageSourcePropType, Image, View } from 'react-native';

import { AppText } from './AppText';

/**
 * Brand logo with monogram fallback.
 *
 * The {@link BRAND_LOGOS} map maps brand UUIDs (V8 / V16 seed) to
 * curated PNG assets under `assets/brand-logos/` (project root, matching
 * the existing `assets/photo-guidance-example.png` location). Brands
 * without a mapped asset fall back to a neutral monogram (first
 * character of `nameKo` on a hashed palette colour) — useful for newly
 * promoted brands before their PNG lands.
 *
 * To register a new brand asset:
 *
 * 1. Drop `<slug>.png` into `assets/brand-logos/`.
 * 2. Add one entry below keyed by the brand UUID:
 *
 * ```ts
 * 'b1000027-0000-0000-0000-000000000027': require('../../../assets/brand-logos/<slug>.png') as ImageSourcePropType,
 * ```
 *
 * The next render automatically picks up the bitmap. No code change at
 * any consumer — every surface goes through {@link BrandLogo}.
 *
 * Sizes are chosen per surface context (Frontend Fundamentals
 * predictability: same component, different scale per call site rather
 * than ad-hoc sizing at the call site). See {@link SIZE_PX}.
 */
export type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  brandId: string;
  brandName: string;
  brandNameKo: string;
  size?: BrandLogoSize;
  testID?: string;
}

// Per-surface footprints. sm fits MachineList rows / GymCard chips,
// md fits FilterSheet brand rows / MachinePicker brand step, lg is a
// future-proof bucket (e.g. brand detail screen). Keeping the size set
// closed forces consumers to extend this enum rather than sprinkle
// magic numbers across call sites.
const SIZE_PX: Record<BrandLogoSize, number> = {
  sm: 20,
  md: 28,
  lg: 40,
};

const FONT_SIZE_PX: Record<BrandLogoSize, number> = {
  sm: 11,
  md: 14,
  lg: 20,
};

// Neutral monogram palette. Intentionally NOT matched to any brand's
// actual identity colour — these are generic slate / muted tones so the
// monogram reads as "placeholder until real logo curated", not as a
// stylised stand-in for the brand's visual identity. Real-logo
// curation belongs to the asset file, not this fallback.
const MONOGRAM_PALETTE: readonly string[] = [
  '#64748B', // slate-500
  '#475569', // slate-600
  '#0F766E', // teal-700
  '#1D4ED8', // blue-700
  '#7C3AED', // violet-600
  '#BE185D', // pink-700
  '#B45309', // amber-700
  '#15803D', // green-700
];

/**
 * Stable string hash → palette index. Same brand always gets the same
 * monogram colour (across sessions / users / surfaces) so the brand's
 * visual presence stays consistent.
 */
function paletteIndex(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % MONOGRAM_PALETTE.length;
}

function monogramChar(brandNameKo: string, brandName: string): string {
  const source = brandNameKo.length > 0 ? brandNameKo : brandName;
  // Array.from handles multi-codepoint glyphs (e.g. emoji) correctly,
  // although none of the launch brands hit this branch.
  return Array.from(source)[0] ?? '?';
}

/**
 * Registry of curated brand logo assets. Empty by default — every brand
 * renders a monogram until an entry is added here.
 *
 * Brand IDs are the UUIDs from the `brands` table seed (see
 * `iron-spot-api/.../V8__catalog_bulk_seed.sql`). Add new entries as
 * curated assets land in `src/assets/brand-logos/`.
 */
export const BRAND_LOGOS: Record<string, ImageSourcePropType> = {
  // V8 seed (24). The first 5 brands carry prod-actual UUIDs that differ
  // from the V8 INSERT VALUES: prod had been seeded earlier with the
  // `b001b001-*` family, and V8's `ON CONFLICT (name) DO NOTHING` preserved
  // those existing rows rather than overwriting. V14 already references
  // `b001b001-...-000000000002` for Hammer Strength, confirming the
  // discrepancy. Keying the map by prod-actual UUIDs (verified via GET
  // /api/brands on 2026-05-25) so the bitmap branch fires for these brands.
  'b001b001-0000-0000-0000-000000000001':
    require('../../../assets/brand-logos/panatta.png') as ImageSourcePropType,
  'b001b001-0000-0000-0000-000000000002':
    require('../../../assets/brand-logos/hammer-strength.png') as ImageSourcePropType,
  'b001b001-0000-0000-0000-000000000003':
    require('../../../assets/brand-logos/life-fitness.png') as ImageSourcePropType,
  'b001b001-0000-0000-0000-000000000004':
    require('../../../assets/brand-logos/technogym.png') as ImageSourcePropType,
  'b001b001-0000-0000-0000-000000000005':
    require('../../../assets/brand-logos/hoist.png') as ImageSourcePropType,
  'b1000006-0000-0000-0000-000000000006':
    require('../../../assets/brand-logos/cybex.png') as ImageSourcePropType,
  'b1000007-0000-0000-0000-000000000007':
    require('../../../assets/brand-logos/matrix.png') as ImageSourcePropType,
  'b1000008-0000-0000-0000-000000000008':
    require('../../../assets/brand-logos/nautilus.png') as ImageSourcePropType,
  'b1000009-0000-0000-0000-000000000009':
    require('../../../assets/brand-logos/prime.png') as ImageSourcePropType,
  'b1000010-0000-0000-0000-000000000010':
    require('../../../assets/brand-logos/citadel-strength.png') as ImageSourcePropType,
  'b1000011-0000-0000-0000-000000000011':
    require('../../../assets/brand-logos/gym80.png') as ImageSourcePropType,
  'b1000012-0000-0000-0000-000000000012':
    require('../../../assets/brand-logos/booty-builder.png') as ImageSourcePropType,
  'b1000013-0000-0000-0000-000000000013':
    require('../../../assets/brand-logos/atlantis.png') as ImageSourcePropType,
  'b1000014-0000-0000-0000-000000000014':
    require('../../../assets/brand-logos/gymleco.png') as ImageSourcePropType,
  'b1000015-0000-0000-0000-000000000015':
    require('../../../assets/brand-logos/telju.png') as ImageSourcePropType,
  'b1000016-0000-0000-0000-000000000016':
    require('../../../assets/brand-logos/precor.png') as ImageSourcePropType,
  'b1000017-0000-0000-0000-000000000017':
    require('../../../assets/brand-logos/icarian.png') as ImageSourcePropType,
  'b1000018-0000-0000-0000-000000000018':
    require('../../../assets/brand-logos/star-trac.png') as ImageSourcePropType,
  'b1000019-0000-0000-0000-000000000019':
    require('../../../assets/brand-logos/watson.png') as ImageSourcePropType,
  'b1000020-0000-0000-0000-000000000020':
    require('../../../assets/brand-logos/freemotion.png') as ImageSourcePropType,
  'b1000021-0000-0000-0000-000000000021':
    require('../../../assets/brand-logos/newtech.png') as ImageSourcePropType,
  'b1000022-0000-0000-0000-000000000022':
    require('../../../assets/brand-logos/drax.png') as ImageSourcePropType,
  'b1000023-0000-0000-0000-000000000023':
    require('../../../assets/brand-logos/ultra-strength.png') as ImageSourcePropType,
  'b1000024-0000-0000-0000-000000000024':
    require('../../../assets/brand-logos/lexco.png') as ImageSourcePropType,
  // V16 expansion (2)
  'b1000025-0000-0000-0000-000000000025':
    require('../../../assets/brand-logos/arsenal.png') as ImageSourcePropType,
  'b1000026-0000-0000-0000-000000000026':
    require('../../../assets/brand-logos/repcon.png') as ImageSourcePropType,
};

export function BrandLogo({
  brandId,
  brandName,
  brandNameKo,
  size = 'md',
  testID,
}: BrandLogoProps) {
  const px = SIZE_PX[size];
  const asset = BRAND_LOGOS[brandId];

  if (asset !== undefined) {
    return (
      <Image
        source={asset}
        resizeMode="contain"
        accessibilityLabel={`${brandName} 로고`}
        testID={testID}
        style={{ width: px, height: px, borderRadius: 4 }}
      />
    );
  }

  const colour = MONOGRAM_PALETTE[paletteIndex(brandId)] ?? MONOGRAM_PALETTE[0];
  const char = monogramChar(brandNameKo, brandName);

  return (
    <View
      accessibilityLabel={`${brandName} 로고 자리 (${char})`}
      testID={testID}
      style={{
        width: px,
        height: px,
        borderRadius: 4,
        backgroundColor: colour,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText
        style={{
          color: '#FFFFFF',
          fontSize: FONT_SIZE_PX[size],
          fontWeight: '700',
          lineHeight: FONT_SIZE_PX[size] + 2,
        }}
      >
        {char}
      </AppText>
    </View>
  );
}
