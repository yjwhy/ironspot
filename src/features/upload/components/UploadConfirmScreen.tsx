import { toast } from 'burnt';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { pressedOpacity } from '@/shared/lib/pressable';

import { OcrScanAnimation } from './OcrScanAnimation';
import { UploadProgressBar } from './UploadProgressBar';
import { usePhotoUpload } from '../hooks/usePhotoUpload';

interface SuggestionItem {
  id: string;
  brandName: string;
  name: string;
}

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
  suggestions: SuggestionItem[];
  selectedValue: string;
  directInputText: string;
  onSelectSuggestion: (value: string) => void;
  onChangeDirectInput: (text: string) => void;
  onRegister: () => void;
}

function OcrSuccessView({
  compressedUri,
  suggestions,
  selectedValue,
  directInputText,
  onSelectSuggestion,
  onChangeDirectInput,
  onRegister,
}: OcrSuccessViewProps) {
  const isDirectInputSelected = selectedValue === DIRECT_INPUT_VALUE;
  const canRegister =
    selectedValue !== '' && (!isDirectInputSelected || directInputText.trim().length > 0);

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
        disabled={!canRegister}
      />
    </View>
  );
}

interface OcrFailViewProps {
  compressedUri: string;
  directInputText: string;
  onChangeDirectInput: (text: string) => void;
  onRetry: () => void;
  onRegister: () => void;
}

function OcrFailView({
  compressedUri,
  directInputText,
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
          <Button label="등록하기" onPress={onRegister} />
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
  const { gymMachineId, compressedUri } = useLocalSearchParams<{
    gymMachineId: string;
    compressedUri: string;
  }>();
  const router = useRouter();

  const { upload, retry, isUploading, uploadProgress, uploadError, result } = usePhotoUpload(
    gymMachineId,
    compressedUri,
  );

  const [selectedValue, setSelectedValue] = useState('');
  const [directInputText, setDirectInputText] = useState('');

  useEffect(
    function triggerUpload() {
      void upload();
    },
    [upload],
  );

  function handleRegister() {
    // Stub: registration call goes here in a future task
    toast({ title: '사진이 등록됐어요!', preset: 'done' });
    router.back();
  }

  function handleRetry() {
    setSelectedValue('');
    setDirectInputText('');
    void retry();
  }

  if (uploadError !== null) {
    return <UploadErrorView onRetry={handleRetry} />;
  }

  if (isUploading || result === null) {
    return <UploadingView compressedUri={compressedUri} uploadProgress={uploadProgress} />;
  }

  if (!result.ocrSucceeded) {
    return (
      <OcrFailView
        compressedUri={compressedUri}
        directInputText={directInputText}
        onChangeDirectInput={setDirectInputText}
        onRetry={handleRetry}
        onRegister={handleRegister}
      />
    );
  }

  return (
    <OcrSuccessView
      compressedUri={compressedUri}
      suggestions={result.suggestions}
      selectedValue={selectedValue}
      directInputText={directInputText}
      onSelectSuggestion={setSelectedValue}
      onChangeDirectInput={setDirectInputText}
      onRegister={handleRegister}
    />
  );
}
