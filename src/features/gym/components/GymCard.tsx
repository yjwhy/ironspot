import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AppText } from '@/shared/components/AppText';
import { Card } from '@/shared/components/Card';
import { formatDistanceKm, formatVerifiedDate } from '@/shared/lib/format';
import { ANIMATION, colors } from '@/shared/theme/tokens';
import type { GymWithMachineCount } from '@/shared/types/database';

import { DirectionsChip } from './DirectionsChip';

interface GymCardProps {
  gym: GymWithMachineCount;
  distanceKm: number;
  index: number;
  thumbnailUrl?: string | null;
  onPress: () => void;
  testID?: string;
}

// Shared with GymCardSkeleton so the loading footprint matches the loaded
// card pixel-for-pixel. If you change layout slots (thumbnail, name, meta,
// count, verified-date) or their sizes, update GymCardSkeleton to match.
export const GYM_CARD_THUMBNAIL_SIZE = 80;

const EMPTY_COUNT_COPY = '아직 등록된 기구가 없어요';

function formatMachineCount(machineCount: number): string {
  // Phase 5 item 19: explicit "등록된" prefix prevents the wrong mental model
  // ("this gym only has N machines"). N=0 routes to a friendlier sentence
  // that primes the contribution loop instead of reading coldly.
  return machineCount === 0 ? EMPTY_COUNT_COPY : `등록된 기구 ${String(machineCount)}대`;
}

function buildAccessibilityLabel(
  name: string,
  distanceLabel: string,
  machineCount: number,
  verifiedLabel: string | null,
): string {
  const parts = [name, distanceLabel, formatMachineCount(machineCount)];
  if (verifiedLabel) parts.push(verifiedLabel);
  return parts.join(', ');
}

export function GymCard({ gym, distanceKm, index, thumbnailUrl, onPress, testID }: GymCardProps) {
  const distanceLabel = formatDistanceKm(distanceKm);
  const machineCountCopy = formatMachineCount(gym.machine_count);
  const verifiedLabel = gym.last_verified_at
    ? `확인일 ${formatVerifiedDate(gym.last_verified_at)}`
    : null;

  return (
    <Animated.View
      entering={FadeInUp.duration(ANIMATION.transitionDuration).delay(index * ANIMATION.stagger)}
    >
      <Card
        onPress={onPress}
        padding="md"
        testID={testID}
        accessibilityLabel={buildAccessibilityLabel(
          gym.name,
          distanceLabel,
          gym.machine_count,
          verifiedLabel,
        )}
      >
        <View className="flex-row gap-3">
          <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-accent-50">
            {thumbnailUrl ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={{ width: GYM_CARD_THUMBNAIL_SIZE, height: GYM_CARD_THUMBNAIL_SIZE }}
                contentFit="cover"
              />
            ) : (
              <MaterialIcons name="fitness-center" size={32} color={colors.accent.dark} />
            )}
          </View>
          <View className="flex-1 justify-between">
            <View className="gap-1">
              <AppText className="text-heading-sm text-text-primary" numberOfLines={1}>
                {gym.name}
              </AppText>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1">
                  <MaterialIcons name="place" size={14} color={colors.text.secondary} />
                  <AppText className="text-body-sm text-text-secondary">{distanceLabel}</AppText>
                </View>
                <DirectionsChip
                  gym={{
                    id: gym.id,
                    name: gym.name,
                    latitude: gym.latitude,
                    longitude: gym.longitude,
                    // `naver_place_id` is on the gyms table but not in the
                    // current `GymWithMachineCountResponse` projection — the
                    // directions lib treats omitted/null as "no place id" and
                    // falls back to the lat/lng route deeplink. A follow-up
                    // can surface the field through the DTO + Orval regen if
                    // the conversion metric shows the place card lands better.
                    naverPlaceId: null,
                  }}
                  source="card"
                />
              </View>
              <AppText className="text-body-sm text-text-secondary">{machineCountCopy}</AppText>
            </View>
            {verifiedLabel ? (
              <AppText className="self-end text-body-sm text-text-tertiary">
                {verifiedLabel}
              </AppText>
            ) : null}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}
