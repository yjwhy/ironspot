import { type ImageSourcePropType, Image, View } from 'react-native';

import { AppText } from './AppText';

/**
 * Brand logo with monogram fallback.
 *
 * The {@link BRAND_LOGOS} map starts empty so every brand renders a
 * neutral monogram (first character of `nameKo` on a hashed palette colour)
 * until a curated PNG/SVG is added. To switch a brand from monogram to
 * its real logo, drop the asset into `src/assets/brand-logos/{brandId}.png`
 * (or any image format expo-image-resolver supports) and register it:
 *
 * ```ts
 * export const BRAND_LOGOS: Record<string, ImageSourcePropType> = {
 *   'b0000001-0000-0000-0000-000000000001': require('@/assets/brand-logos/panatta.png'),
 * };
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
export const BRAND_LOGOS: Record<string, ImageSourcePropType> = {};

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
