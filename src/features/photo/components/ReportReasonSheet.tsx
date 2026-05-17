import { MaterialIcons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

import { useReport } from '../hooks/useReport';
import { useReportGymMachine } from '../hooks/useReportGymMachine';
import {
  GYM_MACHINE_REASONS,
  PHOTO_GENERAL_REASONS,
  PHOTO_URGENT_REASONS,
  isOtherReason,
  type ReportReasonId,
  type ReportReasonOption,
} from '../lib/reportReasons';

/**
 * ADR 0022 follow-up (Task 46): generalized to both photo and gym_machine
 * surfaces. Pass `target` as a discriminated union; the sheet picks the right
 * reason subset + mutation hook internally.
 */
export type ReportTarget =
  | { type: 'photo'; photoId: string }
  | { type: 'gymMachine'; gymMachineId: string };

interface ReportReasonSheetProps {
  target: ReportTarget;
  onClose: () => void;
}

// 5 reason rows + section divider + textarea + submit button fit on iPhone
// 13 mini at this height without scrolling.
const SNAP_POINTS = ['65%'];
const BACKGROUND_STYLE = { backgroundColor: colors.bg.elevated };
const PRESENT_DELAY_MS = 50;
// Mirrors backend `CreateReportRequest.detail` `@maxLength`. Keep in sync if
// the spec changes; orval-generated types do not enforce maxLength at runtime.
const DETAIL_MAX_LENGTH = 500;

export function ReportReasonSheet({ target, onClose }: ReportReasonSheetProps) {
  return (
    <BottomSheetModalProvider>
      <ReportReasonSheetInner target={target} onClose={onClose} />
    </BottomSheetModalProvider>
  );
}

function ReportReasonSheetInner({ target, onClose }: ReportReasonSheetProps) {
  const ref = useRef<React.ComponentRef<typeof BottomSheetModal>>(null);
  const [selected, setSelected] = useState<ReportReasonId | null>(null);
  const [detail, setDetail] = useState('');
  const showDetailInput = isOtherReason(selected);

  // React Hooks rules require unconditional calls — invoke both mutation hooks
  // and pick the active one. The "off" hook gets an empty id and is never
  // triggered (mutation.mutate is only called on the picked variant below).
  const photoMutation = useReport(target.type === 'photo' ? target.photoId : '', {
    onSuccess: () => ref.current?.dismiss(),
  });
  const gymMachineMutation = useReportGymMachine(
    target.type === 'gymMachine' ? target.gymMachineId : '',
    { onSuccess: () => ref.current?.dismiss() },
  );
  const { handleReport, isPending } = target.type === 'photo' ? photoMutation : gymMachineMutation;

  const generalReasons = target.type === 'photo' ? PHOTO_GENERAL_REASONS : GYM_MACHINE_REASONS;
  // gym_machine surface has no urgent reasons (LEGAL_PERSONAL is photo-specific).
  const urgentReasons = target.type === 'photo' ? PHOTO_URGENT_REASONS : null;

  useEffect(function presentOnMount() {
    // bottom-sheet v5.2.10: present() can race with the modal's internal
    // mount flag. The same delay+cleanup pattern is used in GymBottomSheet.
    const id = setTimeout(() => {
      ref.current?.present();
    }, PRESENT_DELAY_MS);
    return () => {
      clearTimeout(id);
    };
  }, []);

  // RC: BottomSheetModal's backdropComponent is a render prop the library
  // diffs by reference; useCallback keeps the identity stable across renders.
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  function handleSubmit() {
    if (!selected || isPending) return;
    handleReport({ reason: selected, detail: showDetailInput ? detail : undefined });
  }

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={SNAP_POINTS}
      backgroundStyle={BACKGROUND_STYLE}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
    >
      <BottomSheetView className="flex-1 px-5 pb-6">
        <AppText className="text-heading-md mb-4">신고하기</AppText>

        <ReasonSection
          title={urgentReasons === null ? '신고 사유' : '일반 사유'}
          options={generalReasons}
          selected={selected}
          onSelect={setSelected}
        />

        {showDetailInput ? <DetailInput value={detail} onChangeText={setDetail} /> : null}

        {urgentReasons !== null ? (
          <>
            <View className="my-4 h-px bg-border-subtle" />
            <ReasonSection
              title="긴급 (즉시 검토)"
              options={urgentReasons}
              selected={selected}
              onSelect={setSelected}
            />
          </>
        ) : null}

        <View className="mt-6">
          <Button
            label="신고 제출"
            onPress={handleSubmit}
            disabled={!selected || isPending}
            loading={isPending}
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

interface ReasonSectionProps {
  title: string;
  options: readonly ReportReasonOption[];
  selected: ReportReasonId | null;
  onSelect: (id: ReportReasonId) => void;
}

function ReasonSection({ title, options, selected, onSelect }: ReasonSectionProps) {
  return (
    <View>
      <AppText className="text-body-sm text-text-tertiary mb-2">{title}</AppText>
      {options.map((option) => (
        <RadioRow
          key={option.id}
          option={option}
          checked={selected === option.id}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

interface RadioRowProps {
  option: ReportReasonOption;
  checked: boolean;
  onSelect: (id: ReportReasonId) => void;
}

function RadioRow({ option, checked, onSelect }: RadioRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      accessibilityState={{ checked }}
      onPress={() => {
        onSelect(option.id);
      }}
      style={pressedOpacity}
      className="flex-row items-center py-3"
    >
      <MaterialIcons
        name={checked ? 'radio-button-checked' : 'radio-button-unchecked'}
        size={20}
        color={checked ? colors.accent.DEFAULT : colors.text.tertiary}
      />
      <AppText className="ml-3 text-body-md">{option.label}</AppText>
    </Pressable>
  );
}

interface DetailInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

function DetailInput({ value, onChangeText }: DetailInputProps) {
  return (
    <View className="mt-3">
      <AppText
        className="text-body-sm text-text-tertiary mb-1"
        accessibilityLabel="신고 사유 자유 입력 안내"
      >
        상세 사유 (선택)
      </AppText>
      <BottomSheetTextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel="신고 사유 자유 입력"
        maxLength={DETAIL_MAX_LENGTH}
        multiline
        numberOfLines={3}
        className="rounded-lg bg-bg-muted px-3 py-2 text-body-md text-text-primary"
        placeholder="자세히 알려주세요 (선택)"
        placeholderTextColor={colors.text.tertiary}
      />
    </View>
  );
}
