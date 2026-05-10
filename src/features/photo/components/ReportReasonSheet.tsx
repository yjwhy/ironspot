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
import {
  GENERAL_REASONS,
  isOtherReason,
  type ReportReasonId,
  type ReportReasonOption,
  URGENT_REASONS,
} from '../lib/reportReasons';

interface ReportReasonSheetProps {
  photoId: string;
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

export function ReportReasonSheet({ photoId, onClose }: ReportReasonSheetProps) {
  return (
    <BottomSheetModalProvider>
      <ReportReasonSheetInner photoId={photoId} onClose={onClose} />
    </BottomSheetModalProvider>
  );
}

function ReportReasonSheetInner({ photoId, onClose }: ReportReasonSheetProps) {
  const ref = useRef<React.ComponentRef<typeof BottomSheetModal>>(null);
  const [selected, setSelected] = useState<ReportReasonId | null>(null);
  const [detail, setDetail] = useState('');
  const showDetailInput = isOtherReason(selected);

  const { handleReport, isPending } = useReport(photoId, {
    onSuccess: () => ref.current?.dismiss(),
  });

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
          title="일반 사유"
          options={GENERAL_REASONS}
          selected={selected}
          onSelect={setSelected}
        />

        {showDetailInput ? <DetailInput value={detail} onChangeText={setDetail} /> : null}

        <View className="my-4 h-px bg-border-subtle" />

        <ReasonSection
          title="긴급 (즉시 검토)"
          options={URGENT_REASONS}
          selected={selected}
          onSelect={setSelected}
        />

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
  function handlePress() {
    onSelect(option.id);
  }
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={option.label}
      style={pressedOpacity}
      className="flex-row items-center gap-3 py-3"
    >
      <MaterialIcons
        name={checked ? 'radio-button-checked' : 'radio-button-unchecked'}
        size={20}
        color={checked ? colors.accent.DEFAULT : colors.text.tertiary}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      <AppText className="text-body flex-1">{option.label}</AppText>
    </Pressable>
  );
}

interface DetailInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

function DetailInput({ value, onChangeText }: DetailInputProps) {
  return (
    // BottomSheetTextInput plumbs the keyboard-avoidance integration that
    // bare `TextInput` lacks inside a gorhom sheet (iOS keyboard otherwise
    // covers the field; Android focus can dismiss the sheet).
    <BottomSheetTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="신고 사유를 입력해주세요"
      placeholderTextColor={colors.text.tertiary}
      multiline
      maxLength={DETAIL_MAX_LENGTH}
      accessibilityLabel="신고 사유 자유 입력"
      className="border-border-DEFAULT mt-2 min-h-[80px] rounded-md border px-3 py-2 text-body"
      style={{ textAlignVertical: 'top' }}
    />
  );
}
