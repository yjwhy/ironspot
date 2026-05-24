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
// rectangle's initial aspect is 16:9 (most gym plates are wider than tall),
// but the four corner handles let the user freely resize either axis after
// the initial state — follow-up to PR #176's pan-only MVP, requested
// during real device testing 2026-05-25.
const INITIAL_CROP_RATIO = 0.7;
const INITIAL_ASPECT_W = 16;
const INITIAL_ASPECT_H = 9;

// Minimum crop rectangle size in screen pixels. Below this the corner
// handles get too small to touch reliably and the OCR window shrinks so
// far that brand-anchored matching's keyword surface drops to noise.
const MIN_RECT_SIZE = 80;

// Touch target for corner handles. Visible 24 px white square; the
// 6 px negative inset extends the hit area outward so users can grab
// the corner without pixel-perfect aim.
const HANDLE_SIZE = 24;
const HANDLE_HIT_INSET = -6;

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
          모서리를 잡고 라벨 크기에 맞게 조절한 뒤 자르기를 눌러주세요
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

// Free-resize crop rectangle. Body pan moves the whole rectangle; four
// corner handles independently resize toward / away from the opposite
// edge. The initial state is 70 % width × 16:9 height (the geometry of
// a typical gym plate), but the user can freely deform either axis.
function CropOverlay({ imageLayout, onCommitRect }: CropOverlayProps) {
  const initialW = imageLayout.width * INITIAL_CROP_RATIO;
  const initialHRaw = (initialW * INITIAL_ASPECT_H) / INITIAL_ASPECT_W;
  const initialH = Math.min(initialHRaw, imageLayout.height * INITIAL_CROP_RATIO);
  const initialX = (imageLayout.width - initialW) / 2;
  const initialY = (imageLayout.height - initialH) / 2;

  // Rectangle state — x/y are the top-left in rendered-image coordinates;
  // w/h are screen-pixel dimensions. All four are animated shared values
  // so resize gestures update them on the UI thread.
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);
  const w = useSharedValue(initialW);
  const h = useSharedValue(initialH);

  // Gesture-session snapshots. Each Pan captures all four state values
  // onBegin so the worklet can compute the next state from the gesture's
  // total translation rather than incremental deltas (incremental deltas
  // drift on cancelled gestures).
  const startX = useSharedValue(initialX);
  const startY = useSharedValue(initialY);
  const startW = useSharedValue(initialW);
  const startH = useSharedValue(initialH);

  function snapshot() {
    'worklet';
    startX.value = x.value;
    startY.value = y.value;
    startW.value = w.value;
    startH.value = h.value;
  }

  // Body pan: translate the rectangle as a whole, size unchanged.
  const bodyPan = Gesture.Pan()
    .onBegin(snapshot)
    .onUpdate(function follow(event) {
      'worklet';
      const nx = startX.value + event.translationX;
      const ny = startY.value + event.translationY;
      x.value = clamp(nx, 0, imageLayout.width - w.value);
      y.value = clamp(ny, 0, imageLayout.height - h.value);
    });

  // Corner handles: each handle adjusts two edges. Constraints:
  //   * width / height >= MIN_RECT_SIZE so the handles stay grabbable.
  //   * Rectangle stays fully inside the rendered image bounds.
  // Each branch computes the new width / height first (clamped) and then
  // derives x / y from the start anchor's opposite edge so the edge the
  // user isn't dragging stays fixed exactly where it was.
  const tlPan = Gesture.Pan()
    .onBegin(snapshot)
    .onUpdate(function tl(event) {
      'worklet';
      const newW = clamp(
        startW.value - event.translationX,
        MIN_RECT_SIZE,
        startX.value + startW.value,
      );
      const newH = clamp(
        startH.value - event.translationY,
        MIN_RECT_SIZE,
        startY.value + startH.value,
      );
      x.value = startX.value + startW.value - newW;
      y.value = startY.value + startH.value - newH;
      w.value = newW;
      h.value = newH;
    });

  const trPan = Gesture.Pan()
    .onBegin(snapshot)
    .onUpdate(function tr(event) {
      'worklet';
      const newW = clamp(
        startW.value + event.translationX,
        MIN_RECT_SIZE,
        imageLayout.width - startX.value,
      );
      const newH = clamp(
        startH.value - event.translationY,
        MIN_RECT_SIZE,
        startY.value + startH.value,
      );
      y.value = startY.value + startH.value - newH;
      w.value = newW;
      h.value = newH;
    });

  const blPan = Gesture.Pan()
    .onBegin(snapshot)
    .onUpdate(function bl(event) {
      'worklet';
      const newW = clamp(
        startW.value - event.translationX,
        MIN_RECT_SIZE,
        startX.value + startW.value,
      );
      const newH = clamp(
        startH.value + event.translationY,
        MIN_RECT_SIZE,
        imageLayout.height - startY.value,
      );
      x.value = startX.value + startW.value - newW;
      w.value = newW;
      h.value = newH;
    });

  const brPan = Gesture.Pan()
    .onBegin(snapshot)
    .onUpdate(function br(event) {
      'worklet';
      const newW = clamp(
        startW.value + event.translationX,
        MIN_RECT_SIZE,
        imageLayout.width - startX.value,
      );
      const newH = clamp(
        startH.value + event.translationY,
        MIN_RECT_SIZE,
        imageLayout.height - startY.value,
      );
      w.value = newW;
      h.value = newH;
    });

  // Rectangle animated style — position via translate, size via
  // width/height. Reanimated handles all four channels on the UI thread
  // so gesture latency stays under a frame.
  const rectStyle = useAnimatedStyle(function rect() {
    return {
      transform: [{ translateX: x.value }, { translateY: y.value }],
      width: w.value,
      height: h.value,
    };
  });

  function handleCommit() {
    onCommitRect({
      x: x.value,
      y: y.value,
      width: w.value,
      height: h.value,
    });
  }

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
      <GestureDetector gesture={bodyPan}>
        <Animated.View
          testID="upload-crop-rect"
          style={[
            {
              position: 'absolute',
              borderColor: 'white',
              borderWidth: 2,
            },
            rectStyle,
          ]}
        >
          <CornerHandle gesture={tlPan} testID="upload-crop-handle-tl" position="tl" />
          <CornerHandle gesture={trPan} testID="upload-crop-handle-tr" position="tr" />
          <CornerHandle gesture={blPan} testID="upload-crop-handle-bl" position="bl" />
          <CornerHandle gesture={brPan} testID="upload-crop-handle-br" position="br" />
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

interface CornerHandleProps {
  gesture: ReturnType<typeof Gesture.Pan>;
  testID: string;
  position: 'tl' | 'tr' | 'bl' | 'br';
}

/**
 * Corner resize handle. The visible white square sits at the rectangle's
 * corner; the hit area extends {@link HANDLE_HIT_INSET} pixels outward via
 * negative absolute insets so the user can grab the corner without
 * pixel-perfect aim. Each corner mounts a dedicated {@link Gesture.Pan}
 * so the parent body-pan doesn't compete with the resize.
 */
function CornerHandle({ gesture, testID, position }: CornerHandleProps) {
  const cornerStyle = (() => {
    switch (position) {
      case 'tl':
        return { top: HANDLE_HIT_INSET, left: HANDLE_HIT_INSET };
      case 'tr':
        return { top: HANDLE_HIT_INSET, right: HANDLE_HIT_INSET };
      case 'bl':
        return { bottom: HANDLE_HIT_INSET, left: HANDLE_HIT_INSET };
      case 'br':
        return { bottom: HANDLE_HIT_INSET, right: HANDLE_HIT_INSET };
    }
  })();

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID={testID}
        style={[
          {
            position: 'absolute',
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            backgroundColor: 'white',
            borderWidth: 2,
            borderColor: 'rgba(0,0,0,0.4)',
          },
          cornerStyle,
        ]}
      />
    </GestureDetector>
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
