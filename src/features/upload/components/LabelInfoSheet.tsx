import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef } from 'react';
import { Image, Pressable, View, type ImageSourcePropType } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

// Static require so Metro bundles the asset at build time. Path is the
// existing PhotoCaptureGuidance asset; this sheet replaces the on-mount
// banner with a tap-to-open reference surface used in two places (the
// method-choice card and the camera viewfinder corner).
const PLATE_EXAMPLE_IMAGE =
  require('../../../../assets/photo-guidance-example.png') as ImageSourcePropType;

interface LabelInfoSheetProps {
  /** Fires when the sheet is dismissed (swipe-down, backdrop tap, or close button). */
  onClose: () => void;
}

// Image + heading + two short paragraphs + close button fit on the smallest
// supported phone (iPhone 13 mini) inside a 70% snap point without scrolling.
const SNAP_POINTS = ['70%'];
const BACKGROUND_STYLE = { backgroundColor: colors.bg.base };
// `BottomSheetModal.present()` after the host has finished its initial layout
// pass — matches the ReportReasonSheet delay so the sheet animates smoothly
// rather than appearing mid-mount.
const PRESENT_DELAY_MS = 50;

/**
 * On-demand "라벨이란?" reference sheet. Opens from the "?" affordance on the
 * upload-method-choice screen and from the matching corner button on the
 * camera viewfinder. Replaces the previous PhotoGuidanceBanner which was
 * a first-time-only auto-overlay that users could not re-open after the
 * "알겠어요" dismissal landed in MMKV.
 *
 * Self-contained {@link BottomSheetModalProvider} so the sheet can be dropped
 * anywhere in the upload flow without requiring the route layout to wrap a
 * provider (matches the ReportReasonSheet pattern). Parent renders this
 * component conditionally on a local `visible` flag and clears the flag on
 * `onClose`.
 */
export function LabelInfoSheet({ onClose }: LabelInfoSheetProps) {
  return (
    <BottomSheetModalProvider>
      <LabelInfoSheetInner onClose={onClose} />
    </BottomSheetModalProvider>
  );
}

function LabelInfoSheetInner({ onClose }: LabelInfoSheetProps) {
  const sheetRef = useRef<React.ComponentRef<typeof BottomSheetModal>>(null);

  useEffect(function presentOnMount() {
    const timer = setTimeout(() => sheetRef.current?.present(), PRESENT_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  function handleClose() {
    sheetRef.current?.dismiss();
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      backgroundStyle={BACKGROUND_STYLE}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      onDismiss={onClose}
    >
      <BottomSheetView style={{ flex: 1 }}>
        <View testID="label-info-sheet" className="flex-1 gap-4 px-6 pb-8 pt-2">
          <AppText
            accessibilityRole="header"
            className="text-center text-h3 font-semibold text-text-primary"
          >
            라벨이란?
          </AppText>
          <Image
            testID="label-info-sheet-image"
            source={PLATE_EXAMPLE_IMAGE}
            className="h-64 w-full rounded-xl"
            resizeMode="contain"
            accessibilityLabel="머신 라벨 예시 사진"
          />
          <AppText className="text-center text-body text-text-primary">
            브랜드/모델명이 적힌 라벨(스티커)을 가까이 찍어주세요
          </AppText>
          <AppText className="text-center text-body-sm text-text-secondary">
            머신 전체가 아닌 라벨 부분을 찍으면 브랜드와 모델명이 자동으로 인식돼요
          </AppText>
          <Pressable
            testID="label-info-sheet-close"
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={handleClose}
            style={pressedOpacity}
            className="mt-2 items-center rounded-xl bg-accent py-3"
          >
            <AppText className="text-body font-semibold text-white">닫기</AppText>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
