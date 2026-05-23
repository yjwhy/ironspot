import { toast } from 'burnt';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';

// Initial crop rectangle covers the centre 70 % of the image preview so the
// user normally only needs a small adjustment to bracket the plate. The
// rectangle's screen size is fixed (no resize handles in this MVP); pan
// alone moves it across the image. If the plate doesn't fit the rectangle,
// the user can skip the crop entirely and rely on brand-anchored matching
// to discard background tokens.
const INITIAL_CROP_RATIO = 0.7;

// 16:9 aspect for the crop overlay. Most gym plates are wider than tall
// (e.g. the Hammer Strength plate shown in the F-step guidance image).
// A 16:9 rectangle approximates that geometry and gives the user a sane
// default rather than forcing them to draw a free-shape every time.
const CROP_ASPECT_W = 16;
const CROP_ASPECT_H = 9;

interface ImageLayout {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

interface NaturalSize {
  width: number;
  height: number;
}

export function UploadCropScreen() {
  const { compressedUri, gymMachineId, gymId, naverPlace } = useLocalSearchParams<{
    compressedUri: string;
    gymMachineId?: string;
    gymId?: string;
    naverPlace?: string;
  }>();
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [naturalSize, setNaturalSize] = useState<NaturalSize | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  // One-shot guard: router / params produce fresh references each render,
  // so a naive deps array would re-run Image.getSize on every render and
  // loop forever via setState. Tracking completion in a ref keeps the
  // deps array honest (React Compiler stays happy) while still firing the
  // fetch exactly once.
  const fetchedRef = useRef(false);

  useEffect(
    function fetchNaturalSize() {
      if (fetchedRef.current) return;
      fetchedRef.current = true;
      Image.getSize(
        compressedUri,
        function onSize(width, height) {
          setNaturalSize({ width, height });
        },
        function onError() {
          toast({ title: '사진 정보를 읽지 못했어요', preset: 'error' });
          router.replace({
            pathname: '/(upload)/confirm',
            params: { compressedUri, gymMachineId, gymId, naverPlace },
          });
        },
      );
    },
    [compressedUri, router, gymMachineId, gymId, naverPlace],
  );

  if (naturalSize === null) {
    return <View testID="upload-crop-loading" className="flex-1 bg-black" />;
  }
  // Local const captures the post-null-check narrowing so closures below
  // (handleConfirm) see NaturalSize rather than NaturalSize | null without
  // a non-null assertion.
  const resolvedNaturalSize: NaturalSize = naturalSize;

  // Preview slot reserves the area between the screen edges and the
  // bottom button stack. Image inside is letterbox-fitted; crop overlay
  // sits relative to the image, not the preview slot, so pan clamping
  // matches the visible image bounds.
  const PREVIEW_BOTTOM_RESERVED = 200;
  const previewWidth = screenWidth;
  const previewHeight = screenHeight - PREVIEW_BOTTOM_RESERVED;
  const imageLayout = fitImage(resolvedNaturalSize, previewWidth, previewHeight);

  function handleConfirm(cropRect: { x: number; y: number; width: number; height: number }) {
    setIsCropping(true);
    const natural = naturalToImageRect(cropRect, imageLayout, resolvedNaturalSize);
    void runImageCrop(compressedUri, natural)
      .then(function navigate(croppedUri) {
        router.replace({
          pathname: '/(upload)/confirm',
          params: { compressedUri: croppedUri, gymMachineId, gymId, naverPlace },
        });
      })
      .catch(function fail() {
        toast({ title: '사진을 자르지 못했어요', preset: 'error' });
        setIsCropping(false);
      });
  }

  function handleSkip() {
    router.replace({
      pathname: '/(upload)/confirm',
      params: { compressedUri, gymMachineId, gymId, naverPlace },
    });
  }

  return (
    <View className="flex-1 bg-black">
      <View
        testID="upload-crop-preview"
        style={{ width: previewWidth, height: previewHeight }}
        className="items-center justify-center"
      >
        <Image
          source={{ uri: compressedUri }}
          style={{ width: imageLayout.width, height: imageLayout.height }}
          resizeMode="contain"
        />
        <CropOverlay imageLayout={imageLayout} onCommitRect={handleConfirm} />
      </View>

      <View className="absolute inset-x-0 bottom-0 gap-3 bg-black/70 px-6 pb-10 pt-4">
        <AppText className="text-center text-body-sm text-white/80">
          사각형을 라벨 위로 옮기고 자르기를 눌러주세요
        </AppText>
        <Pressable
          testID="upload-crop-skip"
          accessibilityRole="button"
          onPress={handleSkip}
          style={pressedOpacity}
          className="items-center rounded-xl border border-white/30 py-3"
          disabled={isCropping}
        >
          <AppText className="text-body font-medium text-white">자르기 건너뛰기</AppText>
        </Pressable>
      </View>
    </View>
  );
}

interface CropOverlayProps {
  imageLayout: ImageLayout;
  onCommitRect: (rect: { x: number; y: number; width: number; height: number }) => void;
}

// Pan-only crop rectangle. Size is computed once from the image layout and
// the 16:9 aspect ratio; the rectangle simply translates across the image
// under the user's finger. A "자르기" button at the rectangle's bottom-left
// commits the current position to the parent so the heavy ImageManipulator
// work runs on the JS thread.
function CropOverlay({ imageLayout, onCommitRect }: CropOverlayProps) {
  const cropWidth = imageLayout.width * INITIAL_CROP_RATIO;
  const cropHeight = (cropWidth * CROP_ASPECT_H) / CROP_ASPECT_W;
  // Clamp height to image bounds in case 16:9 of the image's width
  // exceeds its height (very wide image).
  const clampedHeight = Math.min(cropHeight, imageLayout.height * INITIAL_CROP_RATIO);
  const initialX = (imageLayout.width - cropWidth) / 2;
  const initialY = (imageLayout.height - clampedHeight) / 2;

  const offsetX = useSharedValue(initialX);
  const offsetY = useSharedValue(initialY);
  const startX = useSharedValue(initialX);
  const startY = useSharedValue(initialY);

  const panGesture = Gesture.Pan()
    .onBegin(function captureStart() {
      'worklet';
      startX.value = offsetX.value;
      startY.value = offsetY.value;
    })
    .onUpdate(function follow(event) {
      'worklet';
      const next = startX.value + event.translationX;
      const nextY = startY.value + event.translationY;
      offsetX.value = clamp(next, 0, imageLayout.width - cropWidth);
      offsetY.value = clamp(nextY, 0, imageLayout.height - clampedHeight);
    });

  const animatedStyle = useAnimatedStyle(function rect() {
    return {
      transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
    };
  });

  function handleCommit() {
    onCommitRect({
      x: offsetX.value,
      y: offsetY.value,
      width: cropWidth,
      height: clampedHeight,
    });
  }

  // Pressable.onPress fires on the JS thread already, so the commit
  // handler can be wired directly without a worklet bridge.

  return (
    <View
      style={{
        position: 'absolute',
        left: imageLayout.offsetX,
        top: imageLayout.offsetY,
        width: imageLayout.width,
        height: imageLayout.height,
      }}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={panGesture}>
        <Animated.View
          testID="upload-crop-rect"
          style={[
            {
              position: 'absolute',
              width: cropWidth,
              height: clampedHeight,
              borderColor: 'white',
              borderWidth: 2,
            },
            animatedStyle,
          ]}
        >
          <Pressable
            testID="upload-crop-confirm"
            accessibilityRole="button"
            onPress={handleCommit}
            style={pressedOpacity}
            className="absolute -bottom-12 left-0 rounded-xl bg-accent px-4 py-2"
          >
            <AppText className="text-body-sm font-semibold text-white">이 부분 자르기</AppText>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// Letterbox-fit the natural image into the preview slot. Returns the
// rendered image's screen rectangle plus the offset inside the slot, so
// the crop overlay can be positioned on the visible image rather than on
// the slot itself (which has letterbox bands).
function fitImage(natural: NaturalSize, slotWidth: number, slotHeight: number): ImageLayout {
  const slotAspect = slotWidth / slotHeight;
  const imageAspect = natural.width / natural.height;
  if (imageAspect > slotAspect) {
    const width = slotWidth;
    const height = slotWidth / imageAspect;
    return { width, height, offsetX: 0, offsetY: (slotHeight - height) / 2 };
  }
  const height = slotHeight;
  const width = slotHeight * imageAspect;
  return { width, height, offsetX: (slotWidth - width) / 2, offsetY: 0 };
}

// Convert a crop rect expressed in rendered-image coordinates back into
// natural-image pixels for ImageManipulator. The renderer-to-natural
// ratio is identical along both axes because we letterbox-fit, so a
// single scale factor suffices.
function naturalToImageRect(
  rect: { x: number; y: number; width: number; height: number },
  imageLayout: ImageLayout,
  natural: NaturalSize,
): { originX: number; originY: number; width: number; height: number } {
  const scale = natural.width / imageLayout.width;
  return {
    originX: Math.round(rect.x * scale),
    originY: Math.round(rect.y * scale),
    width: Math.round(rect.width * scale),
    height: Math.round(rect.height * scale),
  };
}

async function runImageCrop(
  uri: string,
  rect: { originX: number; originY: number; width: number; height: number },
): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.crop(rect);
  try {
    const imageRef = await context.renderAsync();
    try {
      const result = await imageRef.saveAsync({ compress: 0.9, format: SaveFormat.WEBP });
      return result.uri;
    } finally {
      imageRef.release();
    }
  } finally {
    context.release();
  }
}
