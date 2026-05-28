import { View } from 'react-native';

import { AppText } from '@/shared/components/AppText';

// Always-visible one-line reminder rendered under the camera preview by
// {@link UploadPhotoScreen}. Short enough not to crowd the capture buttons,
// present on every camera visit so even a returning user gets the framing
// coaching at the moment of capture without a blocking overlay.
//
// The richer reference (example image + paragraph) used to live alongside
// this strip as `PhotoGuidanceBanner`, an MMKV-gated first-time overlay
// that the user could never re-open from inside the app once dismissed.
// It was removed 2026-05-28 in favour of {@link LabelInfoSheet}, an
// on-demand BottomSheet reachable from the '?' affordance on both the
// upload-method-choice card and the camera viewfinder corner.
export function PhotoGuidanceHintStrip() {
  return (
    <View testID="photo-guidance-hint" className="bg-black px-6 pb-2 pt-3">
      <AppText className="text-body-sm text-white/80">
        브랜드/모델명 적힌 라벨을 가까이 찍어주세요
      </AppText>
    </View>
  );
}
