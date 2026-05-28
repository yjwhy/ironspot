import { useState } from 'react';
import { Image, Pressable, View, type ImageSourcePropType } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';

import { dismissPhotoBanner, isPhotoBannerDismissed } from '../lib/guidance-storage';

// Static require so Metro bundles the asset. Path stays relative to the
// component file because `assets/` sits at repo root with no `@/` alias.
// Cast narrows away `require`'s `any` to RN's image source type.
const PLATE_EXAMPLE_IMAGE =
  require('../../../../assets/photo-guidance-example.png') as ImageSourcePropType;

// Always-visible reminder under the camera preview. Short enough not to
// crowd the capture buttons, present on every camera visit so even a
// returning user gets the framing reminder without re-displaying the
// dismissed banner.
export function PhotoGuidanceHintStrip() {
  return (
    <View testID="photo-guidance-hint" className="bg-black px-6 pb-2 pt-3">
      <AppText className="text-body-sm text-white/80">
        브랜드/모델명 적힌 라벨을 가까이 찍어주세요
      </AppText>
    </View>
  );
}

// First-time-only banner overlaid on the camera preview. Heavier copy +
// example image because the user has zero prior context for what "라벨"
// means in this app's setting. Dismissable via "알겠어요"; MMKV remembers
// the dismissal so subsequent visits show only the hint strip below.
//
// Component owns its own mount/unmount via local state so the parent
// stays a pure layout consumer.
export function PhotoGuidanceBanner() {
  const [isVisible, setIsVisible] = useState(!isPhotoBannerDismissed());

  function handleDismiss() {
    dismissPhotoBanner();
    setIsVisible(false);
  }

  if (!isVisible) return null;

  return (
    <View
      testID="photo-guidance-banner"
      pointerEvents="box-none"
      className="absolute inset-x-0 top-0 bottom-0 items-center justify-center bg-black/80 px-6"
    >
      <View className="w-full max-w-sm gap-4 rounded-2xl bg-bg-base p-5">
        <AppText className="text-center text-h3 font-semibold text-text-primary">
          어떻게 찍어야 하나요?
        </AppText>
        <Image
          testID="photo-guidance-example-image"
          source={PLATE_EXAMPLE_IMAGE}
          className="h-64 w-full rounded-xl"
          resizeMode="contain"
        />
        <AppText className="text-center text-body text-text-primary">
          브랜드/모델명 적힌 라벨을 가까이 찍어주세요
        </AppText>
        <AppText className="text-center text-body-sm text-text-secondary">
          머신 전체가 아닌 라벨(스티커) 부분을 찍으면 브랜드와 모델명이 자동으로 인식돼요
        </AppText>
        <Pressable
          testID="photo-guidance-banner-dismiss"
          accessibilityRole="button"
          onPress={handleDismiss}
          style={pressedOpacity}
          className="items-center rounded-xl bg-accent py-3"
        >
          <AppText className="text-body font-semibold text-white">알겠어요</AppText>
        </Pressable>
      </View>
    </View>
  );
}
