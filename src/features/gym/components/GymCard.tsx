import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

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

function buildAccessibilityLabel(
  name: string,
  distanceLabel: string,
  machineCount: number,
  verifiedLabel: string | null,
): string {
  const parts = [name, distanceLabel, `기구 ${String(machineCount)}대`];
  if (verifiedLabel) parts.push(verifiedLabel);
  return parts.join(', ');
}

export function GymCard({ gym, distanceKm, index, thumbnailUrl, onPress, testID }: GymCardProps) {
  const distanceLabel = formatDistanceKm(distanceKm);
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
                style={{ width: 80, height: 80 }}
                contentFit="cover"
              />
            ) : (
              <MaterialIcons name="fitness-center" size={32} color={colors.accent.dark} />
            )}
          </View>
          <View className="flex-1 justify-between">
            <View className="gap-1">
              <Text className="text-heading-sm text-text-primary" numberOfLines={1}>
                {gym.name}
              </Text>
              <View className="flex-row items-center gap-1">
                <MaterialIcons name="place" size={14} color={colors.text.secondary} />
                <Text className="font-sans text-body-sm text-text-secondary">{distanceLabel}</Text>
              </View>
              <View className="self-start rounded-full bg-accent-50 px-2 py-0.5">
                <Text className="font-medium text-body-sm text-accent-dark">
                  기구 {gym.machine_count}대
                </Text>
              </View>
            </View>
            {verifiedLabel ? (
              <Text className="self-end font-sans text-body-sm text-text-tertiary">
                {verifiedLabel}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}
