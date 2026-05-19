import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AppText } from '@/shared/components/AppText';
import { Card } from '@/shared/components/Card';
import { formatDistanceKm } from '@/shared/lib/format';
import { pressedOpacity } from '@/shared/lib/pressable';
import { ANIMATION, colors } from '@/shared/theme/tokens';

interface UnregisteredGymCardProps {
  /** Naver place identifier — used as the idempotent key when the upload
   * flow registers the gym into IronSpot. */
  naverPlaceId: string;
  name: string;
  address: string;
  distanceKm: number;
  /** Index in the merged list, used to stagger the FadeInUp animation in
   * sync with the registered GymCard so both card types feel like the same
   * scroll. */
  index: number;
  /** Tap routes the user to the upload flow with this place pre-filled so
   * the user can become the first registrant. */
  onPress: () => void;
  /**
   * Phase 5 item 14: when the optimistic `useCreateGym` mutation is in
   * flight for THIS place, render a spinner overlay + "등록 중..." copy and
   * disable taps. Other unregistered cards stay interactive so the user can
   * cancel by tapping a different place (the in-flight one will resolve and
   * route them).
   */
  isPending?: boolean;
  testID?: string;
}

const CTA_LABEL = '첫 등록자 되어 정보 추가하기';
const UNREGISTERED_LABEL = '아직 등록되지 않은 헬스장';
const PENDING_LABEL = '등록 중...';

export function UnregisteredGymCard({
  name,
  address,
  distanceKm,
  index,
  onPress,
  isPending = false,
  testID,
}: UnregisteredGymCardProps) {
  const distanceLabel = formatDistanceKm(distanceKm);
  const resolvedTestID = testID ?? 'unregistered-gym-card';
  const ctaLabel = isPending ? PENDING_LABEL : CTA_LABEL;

  return (
    <Animated.View
      entering={FadeInUp.duration(ANIMATION.microDuration)
        .delay(index * ANIMATION.stagger)
        .springify()}
    >
      <Card>
        <Pressable
          onPress={onPress}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityState={{ disabled: isPending, busy: isPending }}
          accessibilityLabel={`${name}, ${distanceLabel}, ${UNREGISTERED_LABEL}, ${ctaLabel}`}
          style={pressedOpacity}
          testID={resolvedTestID}
          className="flex-row gap-3 p-3 bg-bg-base/40 rounded-xl"
        >
          <View
            className="rounded-lg items-center justify-center bg-bg-base"
            style={{ width: 80, height: 80 }}
          >
            <MaterialIcons name="add-business" size={36} color={colors.text.tertiary} />
          </View>
          <View className="flex-1 gap-1.5">
            <View className="flex-row items-baseline justify-between gap-2">
              <AppText
                className="text-body-md text-text-primary flex-1"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {name}
              </AppText>
              <AppText className="text-body-sm text-text-secondary">{distanceLabel}</AppText>
            </View>
            <AppText
              className="text-body-sm text-text-tertiary"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {address}
            </AppText>
            <View className="flex-row items-center gap-1 mt-1">
              <MaterialIcons name="info-outline" size={14} color={colors.text.tertiary} />
              <AppText className="text-body-xs text-text-tertiary">{UNREGISTERED_LABEL}</AppText>
            </View>
            <View className="mt-2 flex-row items-center gap-2">
              <View className="self-start rounded-full bg-accent/10 px-3 py-1.5">
                <AppText className="text-body-xs text-accent font-semibold">
                  {isPending ? ctaLabel : `${ctaLabel} →`}
                </AppText>
              </View>
              {isPending ? (
                <ActivityIndicator
                  testID={`${resolvedTestID}-pending-indicator`}
                  color={colors.accent.DEFAULT}
                />
              ) : null}
            </View>
          </View>
        </Pressable>
      </Card>
    </Animated.View>
  );
}
