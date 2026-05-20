import { toast } from 'burnt';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { useCreateGymMachine } from '@/shared/generated/machines/machines';
import type { CreateGymMachineRequest } from '@/shared/generated/model';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import { pressedOpacity } from '@/shared/lib/pressable';

import { OcrScanAnimation } from './OcrScanAnimation';
import { UploadProgressBar } from './UploadProgressBar';
import { type SuggestionPreview, usePhotoUpload } from '../hooks/usePhotoUpload';

const DIRECT_INPUT_VALUE = '__direct__';

// ─── Sub-components ─────────────────────────────────────────────────────────

interface UploadingViewProps {
  compressedUri: string;
  uploadProgress: number;
}

function UploadingView({ compressedUri, uploadProgress }: UploadingViewProps) {
  return (
    <View className="flex-1 gap-4 p-4">
      <View className="relative overflow-hidden rounded-xl">
        <Image
          testID="upload-photo-preview"
          source={{ uri: compressedUri }}
          className="aspect-square w-full"
          resizeMode="cover"
        />
        <View className="absolute inset-x-0 top-0">
          <OcrScanAnimation />
        </View>
      </View>
      <View testID="upload-progress-bar">
        <UploadProgressBar progress={uploadProgress} />
      </View>
      <AppText className="text-center text-body-sm text-text-secondary">
        기구를 분석하고 있어요...
      </AppText>
    </View>
  );
}

interface OcrSuccessViewProps {
  compressedUri: string;
  suggestions: SuggestionPreview[];
  selectedValue: string;
  directInputText: string;
  isRegistering: boolean;
  onSelectSuggestion: (value: string) => void;
  onChangeDirectInput: (text: string) => void;
  onRegister: () => void;
}

function OcrSuccessView({
  compressedUri,
  suggestions,
  selectedValue,
  directInputText,
  isRegistering,
  onSelectSuggestion,
  onChangeDirectInput,
  onRegister,
}: OcrSuccessViewProps) {
  const isDirectInputSelected = selectedValue === DIRECT_INPUT_VALUE;
  const hasSuggestionSelected = selectedValue !== '' && !isDirectInputSelected;
  const hasDirectInputFilled = isDirectInputSelected && directInputText.trim().length > 0;
  const canRegister = hasSuggestionSelected || hasDirectInputFilled;

  return (
    <View className="flex-1 gap-4 p-4">
      <Image
        testID="upload-photo-preview"
        source={{ uri: compressedUri }}
        className="aspect-square w-full rounded-xl"
        resizeMode="cover"
      />
      <AppText className="text-body font-semibold text-text-primary">어떤 기구인가요?</AppText>
      <View className="gap-2">
        {suggestions.slice(0, 3).map(function renderSuggestion(suggestion) {
          const label = `${suggestion.brandName} ${suggestion.name}`;
          const isSelected = selectedValue === suggestion.id;
          return (
            <Pressable
              key={suggestion.id}
              testID={`upload-ocr-suggestion-${suggestion.id}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={function handlePress() {
                onSelectSuggestion(suggestion.id);
              }}
              style={pressedOpacity}
              className={[
                'flex-row items-center gap-3 rounded-xl border p-4',
                isSelected ? 'border-accent bg-accent/10' : 'border-border bg-bg-muted',
              ].join(' ')}
            >
              <RadioDot selected={isSelected} />
              <AppText className="flex-1 text-body text-text-primary">{label}</AppText>
            </Pressable>
          );
        })}
        <Pressable
          testID="upload-direct-input"
          accessibilityRole="radio"
          accessibilityState={{ checked: isDirectInputSelected }}
          onPress={function handlePressDirectInput() {
            onSelectSuggestion(DIRECT_INPUT_VALUE);
          }}
          style={pressedOpacity}
          className={[
            'flex-row items-center gap-3 rounded-xl border p-4',
            isDirectInputSelected ? 'border-accent bg-accent/10' : 'border-border bg-bg-muted',
          ].join(' ')}
        >
          <RadioDot selected={isDirectInputSelected} />
          <AppText className="flex-1 text-body text-text-primary">직접 입력</AppText>
        </Pressable>
        {isDirectInputSelected ? (
          <TextInput
            className="rounded-xl border border-border bg-bg-muted px-4 py-3 text-body text-text-primary"
            placeholder="기구 이름을 입력하세요"
            value={directInputText}
            onChangeText={onChangeDirectInput}
            autoFocus
          />
        ) : null}
      </View>
      <Button
        testID="upload-register-btn"
        label="등록하기"
        onPress={onRegister}
        disabled={!canRegister || isRegistering}
      />
    </View>
  );
}

interface OcrFailViewProps {
  compressedUri: string;
  directInputText: string;
  isRegistering: boolean;
  onChangeDirectInput: (text: string) => void;
  onRetry: () => void;
  onRegister: () => void;
}

function OcrFailView({
  compressedUri,
  directInputText,
  isRegistering,
  onChangeDirectInput,
  onRetry,
  onRegister,
}: OcrFailViewProps) {
  return (
    <View className="flex-1 gap-4 p-4">
      <Image
        testID="upload-photo-preview"
        source={{ uri: compressedUri }}
        className="aspect-square w-full rounded-xl"
        resizeMode="cover"
      />
      <AppText className="text-center text-body text-text-secondary">
        기구를 인식하지 못했어요
      </AppText>
      <TextInput
        testID="upload-direct-input"
        className="rounded-xl border border-border bg-bg-muted px-4 py-3 text-body text-text-primary"
        placeholder="기구 이름을 직접 입력해 주세요"
        value={directInputText}
        onChangeText={onChangeDirectInput}
      />
      <View className="gap-2">
        {directInputText.trim().length > 0 ? (
          <Button
            testID="upload-register-btn"
            label="등록하기"
            onPress={onRegister}
            disabled={isRegistering}
          />
        ) : null}
        <Button testID="upload-retry-btn" label="다시 시도" variant="secondary" onPress={onRetry} />
      </View>
    </View>
  );
}

interface UploadErrorViewProps {
  onRetry: () => void;
}

function UploadErrorView({ onRetry }: UploadErrorViewProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 p-4">
      <AppText className="text-center text-body text-text-secondary">
        업로드 중 오류가 발생했어요
      </AppText>
      <Button testID="upload-retry-btn" label="다시 시도" variant="secondary" onPress={onRetry} />
    </View>
  );
}

interface RadioDotProps {
  selected: boolean;
}

function RadioDot({ selected }: RadioDotProps) {
  return (
    <View
      className={[
        'h-5 w-5 items-center justify-center rounded-full border-2',
        selected ? 'border-accent' : 'border-border',
      ].join(' ')}
    >
      {selected ? <View className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function UploadConfirmScreen() {
  // Phase 5 item 11 slice 2: gymMachineId stays optional. When present the
  // photo is already bound to that machine (existing photo-add flow) and the
  // contribution POST only sends template/freeFormName. When absent (orphan
  // upload from a "register new machine" entry point) the photo's photoId is
  // passed so the backend binds the orphan to the new gym_machine row.
  // gymId is optional at the type level for the same reason: legacy entry
  // points may push without it, and handleRegister guards against the
  // missing-gymId case explicitly rather than letting an undefined leak into
  // the request body.
  const { gymId, gymMachineId, compressedUri } = useLocalSearchParams<{
    gymId?: string;
    gymMachineId?: string;
    compressedUri: string;
  }>();
  const router = useRouter();

  const { upload, isUploading, uploadProgress, uploadError, result } = usePhotoUpload(
    gymMachineId,
    compressedUri,
  );
  const { mutateAsync: createGymMachine, isPending: isRegistering } = useCreateGymMachine();

  const [selectedValue, setSelectedValue] = useState('');
  const [directInputText, setDirectInputText] = useState('');

  const uploadRef = useRef(upload);
  useEffect(function triggerUpload() {
    void uploadRef.current();
  }, []);

  // Synchronous double-tap guard: isRegistering (React state) only flips on
  // the next render after mutateAsync is invoked, so two synchronous taps
  // could both reach mutateAsync before useMutation propagates the in-flight
  // state. A ref flips in the same microtask so the second tap returns early.
  const isSubmittingRef = useRef(false);

  async function handleRegister() {
    if (isSubmittingRef.current || isRegistering) return;

    if (gymId === undefined) {
      // Legacy entry point pushed without gymId — surfaces as user-visible
      // error rather than a silent 400 from the backend.
      toast({ title: '등록할 헬스장 정보가 없어요', preset: 'error' });
      return;
    }

    // OcrFailView has no suggestion list, so the text input is always a
    // direct-input contribution regardless of selectedValue (which stays '').
    // OcrSuccessView discriminates closed-list vs direct-input by selectedValue.
    const isOcrFailFreeForm = result !== null && !result.ocrSucceeded;
    const isDirectInput = isOcrFailFreeForm || selectedValue === DIRECT_INPUT_VALUE;
    const trimmedDirectInput = directInputText.trim();
    if (!isDirectInput && selectedValue === '') return;
    if (isDirectInput && trimmedDirectInput === '') return;

    // Only send photoId on the orphan path. If the photo was already bound to
    // an existing gymMachineId during upload the backend's NULL-guard would
    // reject the rebind with 400.
    const photoIdForOrphanBind = gymMachineId === undefined ? result?.photoId : undefined;

    const selectionFields: Pick<CreateGymMachineRequest, 'templateId' | 'freeFormName'> =
      isDirectInput ? { freeFormName: trimmedDirectInput } : { templateId: selectedValue };
    const requestBody: CreateGymMachineRequest = {
      gymId,
      ...selectionFields,
      ...(photoIdForOrphanBind !== undefined ? { photoId: photoIdForOrphanBind } : {}),
    };

    isSubmittingRef.current = true;
    try {
      const created = unwrapOrvalResponse(await createGymMachine({ data: requestBody }));
      toast(
        created.pendingReview
          ? { title: '등록 요청을 보냈어요', message: '검토 후 반영될 거예요', preset: 'done' }
          : { title: '등록됐어요', preset: 'done' },
      );
      router.back();
    } catch {
      toast({ title: '등록에 실패했어요', message: '잠시 후 다시 시도해 주세요', preset: 'error' });
    } finally {
      isSubmittingRef.current = false;
    }
  }

  function handleRetry() {
    setSelectedValue('');
    setDirectInputText('');
    void upload();
  }

  if (uploadError !== null) {
    return <UploadErrorView onRetry={handleRetry} />;
  }

  const isInitialOrUploading = isUploading || result === null;
  if (isInitialOrUploading) {
    return <UploadingView compressedUri={compressedUri} uploadProgress={uploadProgress} />;
  }

  function handleRegisterPress() {
    void handleRegister();
  }

  if (!result.ocrSucceeded) {
    return (
      <OcrFailView
        compressedUri={compressedUri}
        directInputText={directInputText}
        isRegistering={isRegistering}
        onChangeDirectInput={setDirectInputText}
        onRetry={handleRetry}
        onRegister={handleRegisterPress}
      />
    );
  }

  return (
    <OcrSuccessView
      compressedUri={compressedUri}
      suggestions={result.suggestions}
      selectedValue={selectedValue}
      directInputText={directInputText}
      isRegistering={isRegistering}
      onSelectSuggestion={setSelectedValue}
      onChangeDirectInput={setDirectInputText}
      onRegister={handleRegisterPress}
    />
  );
}
