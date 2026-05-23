import { MMKV } from 'react-native-mmkv';

// MMKV-backed flag that records whether the first-time photo-guidance banner
// has been dismissed by the user. The banner explains WHAT to photograph
// (the brand/model label, not the whole machine) so OCR has a real chance of
// recognising the equipment. Once the user has seen it and tapped
// "알겠어요", the always-visible hint strip is enough on subsequent visits.
//
// Isolated MMKV instance so the upload feature owns its own persistence
// boundary and a future wipe doesn't take search-recent or other unrelated
// state with it.
const storage = new MMKV({ id: 'upload-guidance' });
const PHOTO_BANNER_DISMISSED_KEY = 'photo-banner-dismissed.v1';

export function isPhotoBannerDismissed(): boolean {
  return storage.getBoolean(PHOTO_BANNER_DISMISSED_KEY) ?? false;
}

export function dismissPhotoBanner(): void {
  storage.set(PHOTO_BANNER_DISMISSED_KEY, true);
}

// Test-only escape hatch — keeps the production surface free of reset
// helpers while letting RTL tests assert both branches of the banner gate.
export function resetPhotoGuidanceForTests(): void {
  storage.delete(PHOTO_BANNER_DISMISSED_KEY);
}
