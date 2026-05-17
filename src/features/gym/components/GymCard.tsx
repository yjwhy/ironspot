import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AccentChip } from '@/shared/components/AccentChip';
import { AppText } from '@/shared/components/AppText';
import { Card } from '@/shared/components/Card';
import { formatDistanceKm, formatVerifiedDate } from '@/shared/lib/format';
import { ANIMATION, colors } from '@/shared/theme/tokens';
import type { GymWithMachineCount } from '@/shared/types/database';

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
// chip, verified-date) or their sizes, update GymCardSkeleton to match.
export const GYM_CARD_THUMBNAIL_SIZE = 80;

// ADR 0022 / Slice 45i: top 3 matched machines shown inline; rest collapsed
// into "외 +N". Card height stays bounded regardless of match count.
const MATCHED_MACHINES_INLINE_LIMIT = 3;

function formatMatchedMachines(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length <= MATCHED_MACHINES_INLINE_LIMIT) return names.join(', ');
  const head = names.slice(0, MATCHED_MACHINES_INLINE_LIMIT).join(', ');
  const remainder = names.length - MATCHED_MACHINES_INLINE_LIMIT;
  return `${head} 외 +${String(remainder)}`;
}

function buildAccessibilityLabel(
  name: string,
  distanceLabel: string,
  machineCount: number,
  matchedPreview: string | null,
  verifiedLabel: string | null,
): string {
  const parts = [name, distanceLabel, `기구 ${String(machineCount)}대`];
  if (matchedPreview) parts.push(`매칭 머신 ${matchedPreview}`);
  if (verifiedLabel) parts.push(verifiedLabel);
  return parts.join(', ');
}

export function GymCard({ gym, distanceKm, index, thumbnailUrl, onPress, testID }: GymCardProps) {
  const distanceLabel = formatDistanceKm(distanceKm);
  const matchedPreview = formatMatchedMachines(gym.matched_machine_names);
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
          matchedPreview,
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
              <View className="flex-row items-center gap-1">
                <MaterialIcons name="place" size={14} color={colors.text.secondary} />
                <AppText className="text-body-sm text-text-secondary">{distanceLabel}</AppText>
              </View>
              <AccentChip>기구 {gym.machine_count}대</AccentChip>
              {matchedPreview ? (
                <AppText
                  className="text-body-sm text-text-secondary"
                  numberOfLines={1}
                  testID="gym-card-matched-machines"
                >
                  ✓ {matchedPreview}
                </AppText>
              ) : null}
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
