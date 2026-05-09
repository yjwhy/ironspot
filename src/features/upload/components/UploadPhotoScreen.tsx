import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';

const COMPRESS_MAX_WIDTH = 1200;
const COMPRESS_QUALITY = 0.8;

async function compressImage(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: COMPRESS_MAX_WIDTH });
  const imageRef = await context.renderAsync();
  const result = await imageRef.saveAsync({ compress: COMPRESS_QUALITY, format: SaveFormat.WEBP });
  context.release();
  imageRef.release();
  return result.uri;
}

export function UploadPhotoScreen() {
  const { gymMachineId } = useLocalSearchParams<{ gymMachineId: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCompressing, setIsCompressing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  async function handleCompressAndNavigate(uri: string) {
    setIsCompressing(true);
    try {
      const compressedUri = await compressImage(uri);
      if (__DEV__) {
        console.warn('[Upload] compressed:', compressedUri);
      }
      router.push({
        pathname: '/(upload)/confirm' as never,
        params: { gymMachineId, compressedUri },
      });
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
    return <PermissionDeniedView onRequest={requestPermission} />;
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
  onRequest: () => Promise<unknown>;
}

function PermissionDeniedView({ onRequest }: PermissionDeniedViewProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-bg-base px-6">
      <AppText className="text-center text-body text-text-secondary">
        카메라 권한이 필요해요
      </AppText>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void onRequest();
        }}
        style={pressedOpacity}
        className="rounded-lg bg-accent px-6 py-3"
      >
        <AppText className="text-body font-medium text-white">권한 허용하기</AppText>
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
  return (
    <View className="flex-1 bg-black">
      <View className="flex-1">
        <CameraView ref={cameraRef} className="flex-1" facing="back" />
        {isCompressing ? <CompressingOverlay /> : null}
      </View>

      <CameraActions
        isCompressing={isCompressing}
        onCapture={onCapture}
        onPickFromGallery={onPickFromGallery}
      />
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
