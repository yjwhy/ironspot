import { toast } from 'burnt';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import type { OwnerClaimResponse } from '@/shared/generated/model';
import { useClaim } from '@/shared/generated/owner/owner';
import { pressedOpacity } from '@/shared/lib/pressable';
import { captureError } from '@/shared/lib/sentry';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // mirrors backend OwnerController.MAX_UPLOAD_BYTES
const VERIFY_TIMEOUT_MS = 30_000; // ADR 0023 Q6 sub: 30s ceiling, then offer retry

type ClaimStatus = 'VERIFIED' | 'DISPUTED' | 'FAILED';

interface OwnerClaimScreenProps {
  gymId: string;
  gymName: string;
}

export function OwnerClaimScreen({ gymId, gymName }: OwnerClaimScreenProps) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<OwnerClaimResponse | null>(null);

  const claimMutation = useClaim();
  const submitting = claimMutation.isPending;

  async function handlePickFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast({ title: '카메라 권한이 필요해요', preset: 'error' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset === undefined) return;
    acceptAssetOrReject(asset);
  }

  async function handlePickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast({ title: '갤러리 권한이 필요해요', preset: 'error' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset === undefined) return;
    acceptAssetOrReject(asset);
  }

  function acceptAssetOrReject(asset: ImagePicker.ImagePickerAsset) {
    // Reject oversize BEFORE upload so the user does not wait on Vision API to find out.
    // Backend enforces the same cap (OwnerController.MAX_UPLOAD_BYTES = 2MB).
    if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_IMAGE_BYTES) {
      toast({ title: '사진 크기는 2MB 이하여야 해요', preset: 'error' });
      return;
    }
    setPickedImageUri(asset.uri);
  }

  async function handleSubmit() {
    if (!pickedImageUri || !consent) return;

    try {
      const response = await fetch(pickedImageUri);
      const blob = await response.blob();
      const claimResult = await claimMutation.mutateAsync({
        params: { gymId, consent: true },
        data: { image: blob },
      });
      const claimResponse = claimResult.data;
      setResult(claimResponse);
    } catch (err) {
      captureError(err);
      toast({ title: '인증 요청에 실패했어요. 다시 시도해 주세요', preset: 'error' });
    }
  }

  function handleResetForRetry() {
    setResult(null);
    setPickedImageUri(null);
  }

  function handleGoToQueue() {
    // typedRoutes does not know about /owner until app/owner/index.tsx lands in slice 47j.
    // Until then, treat it as a relative path the router will resolve once present.
    router.replace('/owner' as never);
  }

  function handleGoBack() {
    router.back();
  }

  if (result !== null) {
    return (
      <ResultView
        result={result}
        gymName={gymName}
        onRetry={handleResetForRetry}
        onGoToOwnerHome={handleGoToQueue}
        onGoBack={handleGoBack}
      />
    );
  }

  if (submitting) {
    return <SubmittingView />;
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <ScrollView className="flex-1 px-6" contentContainerClassName="py-8 gap-6">
        <View className="gap-2">
          <AppText className="text-headline font-bold text-text-primary">
            {gymName}의 매장 소유자 인증
          </AppText>
          <AppText className="text-body text-text-secondary">
            사업자등록증 사진을 업로드하면 자동으로 검증해 드려요. 사진은 검증 즉시 폐기되며
            저장되지 않아요.
          </AppText>
        </View>

        <ConsentBlock consent={consent} onToggle={setConsent} />

        {consent ? (
          <View className="gap-3">
            <AppText className="text-body-sm font-medium text-text-secondary">
              사업자등록증 사진 선택
            </AppText>
            <Button
              label="카메라로 촬영"
              variant="primary"
              onPress={() => {
                void handlePickFromCamera();
              }}
            />
            <Button
              label="갤러리에서 선택"
              variant="secondary"
              onPress={() => {
                void handlePickFromGallery();
              }}
            />
          </View>
        ) : null}

        {pickedImageUri !== null ? (
          <View className="gap-3">
            <AppText className="text-body-sm text-text-tertiary">선택된 사진</AppText>
            <View
              testID="picked-image-preview"
              className="aspect-[3/2] w-full rounded-lg bg-bg-elevated items-center justify-center"
            >
              <AppText className="text-body-sm text-text-tertiary">미리보기</AppText>
            </View>
            <Button
              label="제출하기"
              variant="primary"
              onPress={() => {
                void handleSubmit();
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

interface ConsentBlockProps {
  consent: boolean;
  onToggle: (next: boolean) => void;
}

function ConsentBlock({ consent, onToggle }: ConsentBlockProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel="개인정보 처리에 동의합니다"
      accessibilityState={{ checked: consent }}
      onPress={() => {
        onToggle(!consent);
      }}
      style={pressedOpacity}
      className="flex-row items-start gap-3 rounded-lg bg-bg-elevated p-4"
    >
      <View
        className={`mt-0.5 h-5 w-5 rounded border-2 ${
          consent ? 'border-accent bg-accent' : 'border-text-tertiary bg-transparent'
        }`}
      >
        {consent ? <AppText className="text-center text-caption text-white">✓</AppText> : null}
      </View>
      <View className="flex-1 gap-1">
        <AppText className="text-body font-medium text-text-primary">
          개인정보 처리에 동의합니다
        </AppText>
        <AppText className="text-body-sm text-text-tertiary">
          사업자등록증 사진은 OCR + 국세청 진위확인에만 사용되며 검증 직후 폐기돼요. 사업자번호는
          해시로만 저장돼요.
        </AppText>
      </View>
    </Pressable>
  );
}

function SubmittingView() {
  return (
    <SafeAreaView className="flex-1 bg-bg-base items-center justify-center px-6 gap-4">
      <ActivityIndicator size="large" />
      <AppText className="text-body font-medium text-text-primary">검증 중...</AppText>
      <AppText className="text-body-sm text-text-tertiary text-center">
        10초 정도 걸려요. 잠시만 기다려 주세요.
      </AppText>
    </SafeAreaView>
  );
}

interface ResultViewProps {
  result: OwnerClaimResponse;
  gymName: string;
  onRetry: () => void;
  onGoToOwnerHome: () => void;
  onGoBack: () => void;
}

function ResultView({ result, gymName, onRetry, onGoToOwnerHome, onGoBack }: ResultViewProps) {
  const status: ClaimStatus = (result.status as ClaimStatus | undefined) ?? 'FAILED';
  const isVerified = status === 'VERIFIED';
  const isDisputed = status === 'DISPUTED';

  const headline = isVerified
    ? `${gymName}의 owner 가 되었어요`
    : isDisputed
      ? '검증이 보류되었어요'
      : '검증에 실패했어요';
  const tone = isVerified ? 'text-accent' : isDisputed ? 'text-amber-600' : 'text-red-600';

  return (
    <SafeAreaView className="flex-1 bg-bg-base items-center justify-center px-6 gap-4">
      <AppText className={`text-headline font-bold ${tone}`}>{headline}</AppText>
      {typeof result.message === 'string' && result.message.length > 0 ? (
        <AppText className="text-body text-text-secondary text-center">{result.message}</AppText>
      ) : null}
      {isVerified ? (
        <Button label="owner 도구로 이동" variant="primary" onPress={onGoToOwnerHome} />
      ) : (
        <View className="gap-3 w-full">
          <Button label="다시 시도하기" variant="primary" onPress={onRetry} />
          <Button label="나중에 하기" variant="secondary" onPress={onGoBack} />
        </View>
      )}
    </SafeAreaView>
  );
}

// Exported for testing the timeout constant without re-importing the file
export const OWNER_CLAIM_VERIFY_TIMEOUT_MS = VERIFY_TIMEOUT_MS;
