import { z } from 'zod';

/**
 * Security task #36 — strict Zod validation for the Naver-place JSON that
 * MapScreen serialises onto the upload route param.
 *
 * The previous hand-rolled validator (`parseNaverPlaceParam` in
 * UploadConfirmScreen + UploadMachinePhotoScreen) checked `typeof`
 * only — no length cap, no character allow-list, no coordinate range.
 * That left three classes of regression possible:
 *
 *   1. A crafted deep link could push a 10MB string into `name` or
 *      `address`, which then survived the FE, hit POST /api/gym-machines,
 *      and either bounced on a server-side length check OR landed in a
 *      gyms row that the moderation queue couldn't render cleanly.
 *   2. Coordinates outside the Korean service area (e.g.
 *      lat=0, lng=0) silently dropped a gym onto the equator on the map.
 *   3. Control / bidi / format codepoints in `name` reached the gyms
 *      table and rendered as right-to-left in the gym detail header.
 *
 * The schema caps everything to the same bounds the BE enforces, with a
 * bit of slack for Naver's own escapes. Coordinates are restricted to
 * Korea's bounding box (33-39 N, 124-132 E) since IronSpot is
 * Korea-only in Phase 1.
 */

const NO_CONTROL_CHARS = /^[^\p{C}]+$/u;

export const naverPlaceSchema = z.object({
  naverPlaceId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'invalid naver place id'),
  name: z.string().min(1).max(60).regex(NO_CONTROL_CHARS, 'control char in name'),
  address: z.string().min(1).max(200).regex(NO_CONTROL_CHARS, 'control char in address'),
  latitude: z.number().min(33).max(39),
  longitude: z.number().min(124).max(132),
});

export type NaverPlaceParam = z.infer<typeof naverPlaceSchema>;

/**
 * Parse the JSON-serialised Naver place from a route param. Returns the
 * validated shape or null on any failure (missing input, malformed JSON,
 * schema rejection). Callers fall back to the legacy gymId path when null
 * is returned, so a corrupted param degrades to a working flow rather
 * than crashing the upload.
 */
export function parseNaverPlaceParam(raw: string | undefined): NaverPlaceParam | null {
  if (raw === undefined || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = naverPlaceSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
