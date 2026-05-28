import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

import { UPLOAD_MANUAL_INPUT_PATHNAME, UPLOAD_PHOTO_PATHNAME } from '../constants';

// Phase 5 follow-up G: entry choice between OCR-driven label capture and
// manual brand+template input. Some machines have no readable plate (faded
// sticker, head-only design, old equipment) — forcing every user through a
// label shot wastes a Vision quota call and leaves them at the OcrFailView
// picker anyway. This screen offers both paths up front so the user picks
// based on what they're standing next to.
//
// The label path is recommended (primary visual weight) because OCR matches
// give better follow-on quality when it works.
export function UploadMethodChoiceScreen() {
  const router = useRouter();
  const { gymId, naverPlace } = useLocalSearchParams<{
    gymId?: string;
    naverPlace?: string;
  }>();

  function handleLabelPath() {
    router.push({
      pathname: UPLOAD_PHOTO_PATHNAME,
      params: { gymId, naverPlace },
    });
  }

  function handleManualPath() {
    router.push({
      pathname: UPLOAD_MANUAL_INPUT_PATHNAME,
      params: { gymId, naverPlace },
    });
  }

  return (
    <View className="flex-1 gap-4 bg-bg-base p-6">
      <AppText className="text-h2 font-semibold text-text-primary">어떻게 추가할까요?</AppText>
      <AppText className="text-body text-text-secondary">
        머신의 라벨이 잘 보이면 사진으로, 라벨이 없거나 보이지 않으면 직접 입력으로 선택해주세요
      </AppText>

      <View className="mt-2 gap-3">
        <ChoiceCard
          testID="upload-method-label"
          icon="qr-code-scanner"
          title="라벨 사진으로 검색"
          subtitle="브랜드/모델명이 적힌 라벨을 찍으면 자동으로 인식돼요"
          variant="primary"
          onPress={handleLabelPath}
        />
        <ChoiceCard
          testID="upload-method-manual"
          icon="edit-note"
          title="직접 입력"
          subtitle="라벨이 없거나 보이지 않을 때"
          variant="secondary"
          onPress={handleManualPath}
        />
      </View>
    </View>
  );
}

interface ChoiceCardProps {
  testID: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  variant: 'primary' | 'secondary';
  onPress: () => void;
}

function ChoiceCard({ testID, icon, title, subtitle, variant, onPress }: ChoiceCardProps) {
  const isPrimary = variant === 'primary';
  const containerClass = isPrimary
    ? 'rounded-2xl border-2 border-accent bg-bg-elevated p-5 gap-3'
    : 'rounded-2xl border border-border bg-bg-base p-5 gap-3';
  const iconColor = isPrimary ? colors.accent.DEFAULT : colors.text.primary;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={pressedOpacity}
      className={containerClass}
    >
      <MaterialIcons name={icon} size={32} color={iconColor} />
      <AppText className="text-body-lg font-semibold text-text-primary">{title}</AppText>
      <AppText className="text-body-sm text-text-secondary">{subtitle}</AppText>
    </Pressable>
  );
}
