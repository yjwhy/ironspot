import { MaterialIcons } from '@expo/vector-icons';
import { toast } from 'burnt';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getInfoAsync } from 'expo-file-system/legacy';
import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

import { UPLOAD_IMAGE_FORMAT } from '../constants';
import { LabelInfoSheet } from './LabelInfoSheet';
import { PhotoGuidanceHintStrip } from './PhotoCaptureGuidance';

const COMPRESS_MAX_WIDTH = 1200;
const COMPRESS_QUALITY = 0.8;

async function compressImage(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: COMPRESS_MAX_WIDTH, height: COMPRESS_MAX_WIDTH });
  try {
    const imageRef = await context.renderAsync();
    try {
      const result = await imageRef.saveAsync({
        compress: COMPRESS_QUALITY,
        format: UPLOAD_IMAGE_FORMAT,
      });
      return result.uri;
    } finally {
      imageRef.release();
    }
  } finally {
    context.release();
  }
}

export function UploadPhotoScreen() {
  // Both params are optional at the type level: the existing entry point
  // (UploadGymSelect → tap machine) supplies both, but a future "register new
  // machine" entry point (Phase 5 item 15 FAB) may push without gymMachineId.
  // gymId is threaded through so UploadConfirmScreen can call
  // POST /api/gym-machines on contribution flows; gymMachineId stays the
  // existing photo-to-machine binding hint.
  // Phase 5 item 23 slice d: `naverPlace` is a JSON-serialised UnregisteredPlace
  // threaded from MapScreen for the first-photo-on-unregistered path. When
  // present (no gymId / no gymMachineId), the confirm screen submits the
  // contribution via the new `naverPlace` field on POST /api/gym-machines so
  // gym creation + photo binding commit atomically (slice a).
  const { gymMachineId, gymId, naverPlace } = useLocalSearchParams<{
    gymMachineId?: string;
    gymId?: string;
    naverPlace?: string;
  }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCompressing, setIsCompressing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  async function handleCompressAndNavigate(uri: string) {
    setIsCompressing(true);
    try {
      const compressedUri = await compressImage(uri);
      if (__DEV__) {
        const info = await getInfoAsync(compressedUri);
        if (info.exists) {
          console.warn('[Upload] compressed size:', info.size, 'bytes');
        }
      }
      router.push({
        pathname: '/(upload)/crop',
        params: { gymMachineId, gymId, compressedUri, naverPlace },
      });
    } catch {
      toast({ title: '사진 처리 중 오류가 발생했어요', preset: 'error' });
    } finally {
      setIsCompressing(false);
    }
  }

  async function handleCapture() {
    if (cameraRef.current === null) return;
    const photo = await cameraRef.current.takePictureAsync();
    await handleCompressAndNavigate(photo.uri);
  }

  async function handlePickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset === undefined) return;
    await handleCompressAndNavigate(asset.uri);
  }

  if (permission === null) {
    return <PermissionLoadingView />;
  }

  if (!permission.granted) {
    return (
      <PermissionDeniedView canAskAgain={permission.canAskAgain} onRequest={requestPermission} />
    );
  }

  return (
    <CameraScreenContent
      cameraRef={cameraRef}
      isCompressing={isCompressing}
      onCapture={handleCapture}
      onPickFromGallery={handlePickFromGallery}
    />
  );
}

function PermissionLoadingView() {
  return (
    <View className="flex-1 items-center justify-center bg-bg-base">
      <ActivityIndicator />
    </View>
  );
}

interface PermissionDeniedViewProps {
  canAskAgain: boolean;
  onRequest: () => Promise<unknown>;
}

function PermissionDeniedView({ canAskAgain, onRequest }: PermissionDeniedViewProps) {
  const buttonLabel = canAskAgain ? '권한 요청하기' : '설정에서 변경하기';

  function handlePress() {
    if (canAskAgain) {
      void onRequest();
    } else {
      void Linking.openSettings();
    }
  }

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-bg-base px-6">
      <AppText className="text-center text-body text-text-secondary">
        카메라 권한이 필요해요
      </AppText>
      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        style={pressedOpacity}
        className="rounded-lg bg-accent px-6 py-3"
      >
        <AppText className="text-body font-medium text-white">{buttonLabel}</AppText>
      </Pressable>
    </View>
  );
}

interface CameraScreenContentProps {
  cameraRef: React.RefObject<CameraView | null>;
  isCompressing: boolean;
  onCapture: () => Promise<void>;
  onPickFromGallery: () => Promise<void>;
}

function CameraScreenContent({
  cameraRef,
  isCompressing,
  onCapture,
  onPickFromGallery,
}: CameraScreenContentProps) {
  // Guidance composition: the always-visible hint strip sits between the
  // preview and the capture buttons so it's read just before the user
  // commits to the shot. The top-right '?' is the user's re-entry point
  // into the LabelInfoSheet — replaces the prior PhotoGuidanceBanner that
  // could be dismissed once and never resurfaced from inside the app.
  const [isLabelInfoVisible, setLabelInfoVisible] = useState(false);

  return (
    <View className="flex-1 bg-black">
      <View className="flex-1">
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        {isCompressing ? <CompressingOverlay /> : null}
        <Pressable
          testID="upload-photo-label-info"
          accessibilityRole="button"
          accessibilityLabel="라벨이 뭔지 알아보기"
          accessibilityHint="라벨 예시와 설명을 시트로 표시"
          onPress={function openLabelInfo() {
            setLabelInfoVisible(true);
          }}
          // hitSlop expands the touch target to the 44pt minimum without
          // inflating the glyph itself. Pressed-opacity feedback keeps the
          // button quiet against the live preview behind it.
          hitSlop={12}
          style={pressedOpacity}
          className="absolute right-4 top-4 h-9 w-9 items-center justify-center rounded-full bg-black/55"
        >
          <MaterialIcons name="help-outline" size={20} color={colors.text.inverse} />
        </Pressable>
      </View>

      <PhotoGuidanceHintStrip />

      <CameraActions
        isCompressing={isCompressing}
        onCapture={onCapture}
        onPickFromGallery={onPickFromGallery}
      />
      {isLabelInfoVisible ? (
        <LabelInfoSheet
          onClose={function closeLabelInfo() {
            setLabelInfoVisible(false);
          }}
        />
      ) : null}
    </View>
  );
}

function CompressingOverlay() {
  return (
    <View className="absolute inset-0 items-center justify-center bg-black/50">
      <ActivityIndicator color="white" />
    </View>
  );
}

interface CameraActionsProps {
  isCompressing: boolean;
  onCapture: () => Promise<void>;
  onPickFromGallery: () => Promise<void>;
}

function CameraActions({ isCompressing, onCapture, onPickFromGallery }: CameraActionsProps) {
  return (
    <View className="bg-black px-6 pb-10 pt-6 gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="촬영하기"
        onPress={() => {
          void onCapture();
        }}
        disabled={isCompressing}
        style={pressedOpacity}
        className="items-center rounded-xl bg-accent py-4"
      >
        <AppText className="text-body font-semibold text-white">촬영하기</AppText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="갤러리에서 선택"
        onPress={() => {
          void onPickFromGallery();
        }}
        disabled={isCompressing}
        style={pressedOpacity}
        className="items-center rounded-xl border border-white/30 py-4"
      >
        <AppText className="text-body font-medium text-white">갤러리에서 선택</AppText>
      </Pressable>
    </View>
  );
}
