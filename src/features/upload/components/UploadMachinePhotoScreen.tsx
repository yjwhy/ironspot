import { toast } from 'burnt';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { useCreateGymMachine } from '@/shared/generated/machines/machines';
import type { CreateGymMachineRequest, CreateGymRequest } from '@/shared/generated/model';
import { useUpload } from '@/shared/generated/photos/photos';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import { pressedOpacity } from '@/shared/lib/pressable';

import type { MachinePickerSelection } from './MachinePicker';
import { PHOTO_FILENAME, PHOTO_MIME_TYPE, UPLOAD_IMAGE_FORMAT } from '../constants';

// Phase 5 follow-up G whole-machine capture step. Common terminus for both
// the label-OCR path (UploadConfirmScreen pushes here after the user selects
// a template) and the manual-input path (UploadManualInputScreen pushes
// here once a brand+template is picked). Captures the gym-facing photo
// that lands in machine_photos + the machine gallery, then registers the
// gym_machine in one shot.
//
// Cancel semantics (grill 2026-05-23): back returns to the previous step so
// the user can re-shoot or re-pick. Explicit cancel (X) prompts "등록 취소
// 됩니다" before bailing — half-typed selections shouldn't disappear
// silently when the user is mid-flow.
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

// Selection that's actually submittable from the manual-input / label-OCR
// upstream screens — never the `{ kind: 'none' }` placeholder used inside
// MachinePicker. Narrowing the parse result to this tighter type means
// registerWithPhoto's closure doesn't need to re-handle the unreachable
// 'none' case (TypeScript can't otherwise prove it's gone).
type SubmittableSelection =
  | { kind: 'template'; templateId: string }
  | { kind: 'freeForm'; text: string };

function parseSelection(raw: string | undefined): SubmittableSelection | null {
  if (raw === undefined || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as MachinePickerSelection;
    if (parsed.kind === 'template' && typeof parsed.templateId === 'string') {
      return { kind: 'template', templateId: parsed.templateId };
    }
    if (parsed.kind === 'freeForm' && typeof parsed.text === 'string') {
      return { kind: 'freeForm', text: parsed.text };
    }
    return null;
  } catch {
    return null;
  }
}

function parseNaverPlaceParam(raw: string | undefined): CreateGymRequest | null {
  if (raw === undefined || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<{
      naverPlaceId: string;
      name: string;
      address: string;
      latitude: number;
      longitude: number;
    }>;
    if (
      typeof parsed.naverPlaceId !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.address !== 'string' ||
      typeof parsed.latitude !== 'number' ||
      typeof parsed.longitude !== 'number'
    ) {
      return null;
    }
    return {
      naverPlaceId: parsed.naverPlaceId,
      name: parsed.name,
      address: parsed.address,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
    };
  } catch {
    return null;
  }
}

export function UploadMachinePhotoScreen() {
  const router = useRouter();
  const {
    gymId,
    naverPlace,
    selection: selectionRaw,
  } = useLocalSearchParams<{
    gymId?: string;
    naverPlace?: string;
    selection?: string;
  }>();

  const selection = parseSelection(selectionRaw);
  const parsedNaverPlace = parseNaverPlaceParam(naverPlace);

  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const { mutateAsync: uploadPhoto } = useUpload();
  const { mutateAsync: createGymMachine } = useCreateGymMachine();

  // Guard: dropped here without a valid selection / target → bail. Use a
  // ref-tracked one-shot effect rather than render-time redirect so the
  // toast fires once and back-stack manipulation runs cleanly.
  const bailedRef = useRef(false);
  useEffect(
    function guardSelection() {
      if (bailedRef.current) return;
      if (selection === null || (gymId === undefined && parsedNaverPlace === null)) {
        bailedRef.current = true;
        toast({ title: '잘못된 접근이에요', preset: 'error' });
        router.replace('/');
      }
    },
    [selection, gymId, parsedNaverPlace, router],
  );

  if (selection === null) return null;
  // Bind the narrowed selection to a stable const so the async closures
  // below see the post-guard type (SubmittableSelection, no null).
  const submittableSelection: SubmittableSelection = selection;

  async function handleCapture() {
    if (cameraRef.current === null || isProcessing) return;
    setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      const compressedUri = await compressImage(photo.uri);
      await registerWithPhoto(compressedUri, submittableSelection);
    } catch (e) {
      toast({
        title: '사진 처리 중 오류가 발생했어요',
        message: e instanceof Error ? e.message : undefined,
        preset: 'error',
      });
      setIsProcessing(false);
    }
  }

  async function registerWithPhoto(compressedUri: string, pickedSelection: SubmittableSelection) {
    const uploadResponse = await uploadPhoto({
      params: {},
      data: {
        image: {
          uri: compressedUri,
          name: PHOTO_FILENAME,
          type: PHOTO_MIME_TYPE,
        } as unknown as Blob,
      },
    });
    const { photoId } = unwrapOrvalResponse(uploadResponse);

    const fields: Pick<CreateGymMachineRequest, 'templateId' | 'freeFormName'> =
      pickedSelection.kind === 'template'
        ? { templateId: pickedSelection.templateId }
        : { freeFormName: pickedSelection.text.trim() };

    const requestBody: CreateGymMachineRequest = {
      ...(gymId !== undefined ? { gymId } : {}),
      ...(parsedNaverPlace !== null ? { naverPlace: parsedNaverPlace } : {}),
      ...fields,
      photoId,
    };

    const created = unwrapOrvalResponse(await createGymMachine({ data: requestBody }));
    toast(
      created.pendingReview
        ? { title: '등록 요청을 보냈어요', message: '검토 후 반영될 거예요', preset: 'done' }
        : { title: '등록됐어요', preset: 'done' },
    );
    router.replace('/');
  }

  function handleCancel() {
    Alert.alert('등록을 취소할까요?', '지금 나가면 등록되지 않아요', [
      { text: '계속 등록', style: 'cancel' },
      {
        text: '등록 취소',
        style: 'destructive',
        onPress: () => {
          router.replace('/');
        },
      },
    ]);
  }

  if (permission === null) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-base">
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain;
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-bg-base px-6">
        <AppText className="text-center text-body text-text-secondary">
          카메라 권한이 필요해요
        </AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (canAskAgain) {
              void requestPermission();
            } else {
              void Linking.openSettings();
            }
          }}
          style={pressedOpacity}
          className="rounded-lg bg-accent px-6 py-3"
        >
          <AppText className="text-body font-medium text-white">
            {canAskAgain ? '권한 요청하기' : '설정에서 변경하기'}
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <View className="flex-1">
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        {isProcessing ? (
          <View className="absolute inset-0 items-center justify-center bg-black/50">
            <ActivityIndicator color="white" />
            <AppText className="mt-3 text-body-sm text-white/80">등록 중이에요</AppText>
          </View>
        ) : null}
      </View>

      <View className="bg-black px-6 pb-2 pt-3">
        <AppText className="text-body-sm text-white/80">
          기구 전체가 잘 보이도록 한 발 뒤에서 찍어주세요
        </AppText>
      </View>

      <View className="gap-3 bg-black px-6 pb-10 pt-3">
        <Pressable
          testID="upload-machine-photo-capture"
          accessibilityRole="button"
          accessibilityLabel="촬영하기"
          onPress={() => {
            void handleCapture();
          }}
          disabled={isProcessing}
          style={pressedOpacity}
          className="items-center rounded-xl bg-accent py-4"
        >
          <AppText className="text-body font-semibold text-white">촬영하고 등록하기</AppText>
        </Pressable>
        <Pressable
          testID="upload-machine-photo-cancel"
          accessibilityRole="button"
          onPress={handleCancel}
          disabled={isProcessing}
          style={pressedOpacity}
          className="items-center rounded-xl border border-white/30 py-4"
        >
          <AppText className="text-body font-medium text-white">등록 취소</AppText>
        </Pressable>
      </View>
    </View>
  );
}
