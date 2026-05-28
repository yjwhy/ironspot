import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import type { UnregisteredPlace } from '@/shared/generated/model';
import { formatDistanceKm } from '@/shared/lib/format';
import { colors } from '@/shared/theme/tokens';

interface UnregisteredGymDetailProps {
  place: UnregisteredPlace;
  distanceKm: number;
  /** Tapped from the inline back affordance — pops back to the list mode
   * without touching map state. */
  onClose: () => void;
  /** Tapped from the CTA — slice d wires this to the camera screen with the
   * Naver place pre-filled so the atomic create-on-first-photo path fires.
   * Slice c keeps the bridge wired to the legacy immediate-create handler
   * so the unregistered flow is never blocked mid-refactor. */
  onPressRegisterFirstPhoto: () => void;
}

const REGISTER_CTA_LABEL = '머신 사진 등록하기';
const UNREGISTERED_BADGE = '아직 등록되지 않은 헬스장';
const EMPTY_GALLERY_LABEL = '첫 등록자가 되어 사진을 추가해주세요';

/**
 * Phase 5 item 23 (slice c): read-only detail view for an unregistered
 * Naver place. Renders inside GymBottomSheet when mode.type ===
 * 'unregistered-detail'. The user can review the place metadata
 * (name / address / phone / distance) before committing to first
 * registration, then tap the bottom CTA to enter the camera flow —
 * which is where the gym row actually gets created on the server side
 * (atomic with the first photo upload, per slice a).
 */
export function UnregisteredGymDetail({
  place,
  distanceKm,
  onClose,
  onPressRegisterFirstPhoto,
}: UnregisteredGymDetailProps) {
  const distanceLabel = formatDistanceKm(distanceKm);

  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-1 px-4 py-3">
        <MaterialIcons
          name="arrow-back"
          size={20}
          color={colors.text.secondary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
        />
        <AppText
          className="font-medium text-body-sm text-text-secondary"
          accessibilityRole="button"
          accessibilityLabel="목록으로 돌아가기"
          onPress={onClose}
        >
          목록
        </AppText>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-2 self-start rounded-full bg-bg-muted px-3 py-1">
          <MaterialIcons name="info-outline" size={14} color={colors.text.secondary} />
          <AppText className="text-caption text-text-secondary">{UNREGISTERED_BADGE}</AppText>
        </View>

        <AppText className="mt-4 text-heading-md font-semibold text-text-primary">
          {place.name}
        </AppText>

        <AppText className="mt-1 text-body-sm text-text-secondary">
          현재 위치에서 {distanceLabel}
        </AppText>

        <View className="mt-6 gap-3">
          <DetailRow icon="place" label="주소" value={place.address} />
        </View>

        <View className="mt-8 items-center rounded-lg border border-dashed border-border bg-bg-muted px-4 py-10">
          <MaterialIcons name="photo-camera-back" size={36} color={colors.text.tertiary} />
          <AppText className="mt-3 text-center text-body-sm text-text-secondary">
            {EMPTY_GALLERY_LABEL}
          </AppText>
        </View>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-2 bg-bg-default border-t border-border">
        <Button
          label={REGISTER_CTA_LABEL}
          variant="primary"
          onPress={onPressRegisterFirstPhoto}
          testID="unregistered-detail-register-cta"
        />
      </View>
    </View>
  );
}

interface DetailRowProps {
  icon: 'place';
  label: string;
  value: string;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <View className="flex-row items-start gap-2">
      <MaterialIcons name={icon} size={18} color={colors.text.tertiary} />
      <View className="flex-1">
        <AppText className="text-caption text-text-tertiary">{label}</AppText>
        <AppText className="text-body-sm text-text-primary">{value}</AppText>
      </View>
    </View>
  );
}
