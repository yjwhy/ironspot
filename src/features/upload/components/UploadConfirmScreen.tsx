import { toast } from 'burnt';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { useCreateGymMachine } from '@/shared/generated/machines/machines';
import type { CreateGymMachineRequest } from '@/shared/generated/model';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import { pressedOpacity } from '@/shared/lib/pressable';
import { templateDisplayName } from '@/shared/lib/template-display-name';

import { MachinePicker, type MachinePickerSelection } from './MachinePicker';
import { OcrScanAnimation } from './OcrScanAnimation';
import { selectedRowClass } from './selectedRowClass';
import { UploadProgressBar } from './UploadProgressBar';
import { MAX_OCR_SUGGESTIONS } from '../constants';
import { type SuggestionPreview, usePhotoUpload } from '../hooks/usePhotoUpload';

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
  // Narrow props (FF coupling): the parent computes which suggestion is the
  // checked one and whether the picker mount slot is open / can register.
  // OcrSuccessView no longer touches the raw selection union nor relays
  // picker onChange — that wiring stays at the screen level. The picker
  // itself is passed in via `children` so OcrSuccessView is purely a layout
  // for "OCR radios + picker mount slot + register button".
  selectedSuggestionId: string | null;
  isPickerOpen: boolean;
  canRegister: boolean;
  onSelectSuggestion: (templateId: string) => void;
  onOpenPicker: () => void;
  onRegister: () => void;
  children?: ReactNode;
}

function OcrSuccessView({
  compressedUri,
  suggestions,
  selectedSuggestionId,
  isPickerOpen,
  canRegister,
  onSelectSuggestion,
  onOpenPicker,
  onRegister,
  children,
}: OcrSuccessViewProps) {
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
        {suggestions.slice(0, MAX_OCR_SUGGESTIONS).map(function renderSuggestion(suggestion) {
          const label = `${suggestion.brandName} ${templateDisplayName(suggestion)}`;
          const isSelected = selectedSuggestionId === suggestion.id;
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
              className={selectedRowClass(isSelected)}
            >
              <RadioDot selected={isSelected} />
              <AppText className="flex-1 text-body text-text-primary">{label}</AppText>
            </Pressable>
          );
        })}
        <Pressable
          testID="upload-direct-input"
          accessibilityRole="radio"
          accessibilityState={{ checked: isPickerOpen }}
          onPress={onOpenPicker}
          style={pressedOpacity}
          className={selectedRowClass(isPickerOpen)}
        >
          <RadioDot selected={isPickerOpen} />
          <AppText className="flex-1 text-body text-text-primary">다른 기구로 등록</AppText>
        </Pressable>
        {children}
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
  selection: MachinePickerSelection;
  canRegister: boolean;
  onPickerChange: (selection: MachinePickerSelection) => void;
  onRetry: () => void;
  onRegister: () => void;
}

function OcrFailView({
  compressedUri,
  selection,
  canRegister,
  onPickerChange,
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
      <MachinePicker value={selection} onChange={onPickerChange} />
      <View className="gap-2">
        {canRegister ? (
          <Button testID="upload-register-btn" label="등록하기" onPress={onRegister} />
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

// A submission is valid when the user has either picked a template from the
// closed list (OCR suggestion radio OR picker) or typed a non-empty free-form
// name via the picker's escape hatch.
function canRegisterSelection(selection: MachinePickerSelection): boolean {
  if (selection.kind === 'template') return true;
  if (selection.kind === 'freeForm') return selection.text.trim() !== '';
  return false;
}

// Returns the OCR-suggestion id that should render as checked, or null when
// the user is browsing the picker or has no pick yet. Centralises the
// "selection refers to one of the OCR top-3" check so the JSX stays declarative.
function pickedSuggestionId(
  selection: MachinePickerSelection,
  suggestions: readonly SuggestionPreview[],
  isPickerOpen: boolean,
): string | null {
  if (isPickerOpen || selection.kind !== 'template') return null;
  const match = suggestions.find((s) => s.id === selection.templateId);
  return match?.id ?? null;
}

// Builds the request payload for the closed-list-vs-direct-input branches.
// Splitting it out lets TypeScript narrow inside this helper rather than
// inside handleRegister's else branch (where the unreachable 'none' case
// trips no-unsafe-member-access).
function selectionFields(
  selection: MachinePickerSelection,
): Pick<CreateGymMachineRequest, 'templateId' | 'freeFormName'> | null {
  if (selection.kind === 'template') return { templateId: selection.templateId };
  if (selection.kind === 'freeForm') return { freeFormName: selection.text.trim() };
  return null;
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

  // Phase 5 item 11 slice 3: selection covers both branches of the OCR-result
  // tree. 'template' is emitted by the OcrSuccess radios AND by the
  // MachinePicker closed-list pick. 'freeForm' is the picker escape hatch.
  // isPickerOpen is only meaningful on the OcrSuccess path — the "다른 기구로
  // 등록" radio toggles it. OcrFail always renders the picker so the boolean
  // is unused there.
  const [selection, setSelection] = useState<MachinePickerSelection>({ kind: 'none' });
  const [isPickerOpen, setIsPickerOpen] = useState(false);

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

    const fields = selectionFields(selection);
    if (fields === null) return;

    // Only send photoId on the orphan path. If the photo was already bound to
    // an existing gymMachineId during upload the backend's NULL-guard would
    // reject the rebind with 400.
    const photoIdForOrphanBind = gymMachineId === undefined ? result?.photoId : undefined;

    const requestBody: CreateGymMachineRequest = {
      gymId,
      ...fields,
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

  function handleRegisterPress() {
    void handleRegister();
  }

  function handleSelectSuggestion(templateId: string) {
    setSelection({ kind: 'template', templateId });
    setIsPickerOpen(false);
  }

  function handleOpenPicker() {
    setSelection({ kind: 'none' });
    setIsPickerOpen(true);
  }

  function handleRetry() {
    setSelection({ kind: 'none' });
    setIsPickerOpen(false);
    void upload();
  }

  if (uploadError !== null) {
    return <UploadErrorView onRetry={handleRetry} />;
  }

  const isInitialOrUploading = isUploading || result === null;
  if (isInitialOrUploading) {
    return <UploadingView compressedUri={compressedUri} uploadProgress={uploadProgress} />;
  }

  const canRegister = canRegisterSelection(selection) && !isRegistering;

  if (!result.ocrSucceeded) {
    return (
      <OcrFailView
        compressedUri={compressedUri}
        selection={selection}
        canRegister={canRegister}
        onPickerChange={setSelection}
        onRetry={handleRetry}
        onRegister={handleRegisterPress}
      />
    );
  }

  const selectedSuggestionId = pickedSuggestionId(selection, result.suggestions, isPickerOpen);

  return (
    <OcrSuccessView
      compressedUri={compressedUri}
      suggestions={result.suggestions}
      selectedSuggestionId={selectedSuggestionId}
      isPickerOpen={isPickerOpen}
      canRegister={canRegister}
      onSelectSuggestion={handleSelectSuggestion}
      onOpenPicker={handleOpenPicker}
      onRegister={handleRegisterPress}
    >
      {isPickerOpen ? <MachinePicker value={selection} onChange={setSelection} /> : null}
    </OcrSuccessView>
  );
}
