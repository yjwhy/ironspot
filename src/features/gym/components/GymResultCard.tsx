import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AppText } from '@/shared/components/AppText';
import { Card } from '@/shared/components/Card';
import { formatDistanceKm, formatVerifiedDate } from '@/shared/lib/format';
import { ANIMATION, colors } from '@/shared/theme/tokens';

import { DirectionsChip } from './DirectionsChip';
import type { GymResultCardModel } from '../lib/gym-result-card-model';

// Shared with GymCardSkeleton so the loading footprint matches the loaded
// card pixel-for-pixel. If you change layout slots (thumbnail, name, meta,
// count, verified-date) or their sizes, update GymCardSkeleton to match.
export const GYM_CARD_THUMBNAIL_SIZE = 80;

const EMPTY_COUNT_COPY = '아직 등록된 머신이 없어요';
const ADD_CTA_LABEL = '첫 정보 추가하기';
const PENDING_LABEL = '등록 중...';

interface GymResultCardProps {
  model: GymResultCardModel;
  index: number;
  onPress: () => void;
  /**
   * Optimistic registration in flight for an unregistered place: swaps the
   * CTA to "등록 중..." with a spinner and disables the card. Registered gyms
   * never set this.
   */
  isPending?: boolean;
  testID?: string;
}

function formatMachineCount(machineCount: number): string {
  // Phase 5 item 19: explicit "등록된" prefix prevents the wrong mental model
  // ("this gym only has N machines"). N=0 routes to the shared empty sentence
  // so a confirmed-empty registered gym and an unregistered place read the
  // same, priming the contribution loop either way.
  return machineCount === 0 ? EMPTY_COUNT_COPY : `등록된 머신 ${String(machineCount)}대`;
}

function buildAccessibilityLabel(model: GymResultCardModel, verifiedLabel: string | null): string {
  const parts = [
    model.name,
    formatDistanceKm(model.distanceKm),
    formatMachineCount(model.machineCount),
  ];
  if (model.machineCount === 0) parts.push(ADD_CTA_LABEL);
  if (verifiedLabel) parts.push(verifiedLabel);
  return parts.join(', ');
}

/**
 * Unified gym result card for the map bottom sheet. Renders both a registered
 * gym and an unregistered Naver place with identical chrome, copy and CTA —
 * the only differences are content-driven (thumbnail + verified date appear
 * when present). The empty state (machineCount === 0) invites the first
 * contribution; a populated gym shows its machine count instead. See
 * {@link GymResultCardModel} for why the two sources collapse into one model.
 */
export function GymResultCard({
  model,
  index,
  onPress,
  isPending = false,
  testID,
}: GymResultCardProps) {
  const distanceLabel = formatDistanceKm(model.distanceKm);
  const isEmpty = model.machineCount === 0;
  const verifiedLabel = model.lastVerifiedAt
    ? `확인일 ${formatVerifiedDate(model.lastVerifiedAt)}`
    : null;
  const ctaLabel = isPending ? PENDING_LABEL : `${ADD_CTA_LABEL} →`;

  return (
    <Animated.View
      entering={FadeInUp.duration(ANIMATION.transitionDuration).delay(index * ANIMATION.stagger)}
    >
      <Card
        onPress={isPending ? undefined : onPress}
        padding="md"
        testID={testID}
        accessibilityLabel={buildAccessibilityLabel(model, verifiedLabel)}
      >
        <View className="flex-row gap-3">
          <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-accent-50">
            {model.thumbnailUrl ? (
              <Image
                source={{ uri: model.thumbnailUrl }}
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
                {model.name}
              </AppText>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1">
                  <MaterialIcons name="place" size={14} color={colors.text.secondary} />
                  <AppText className="text-body-sm text-text-secondary">{distanceLabel}</AppText>
                </View>
                <DirectionsChip
                  gym={{
                    id: model.id,
                    name: model.name,
                    latitude: model.latitude,
                    longitude: model.longitude,
                    naverPlaceId: model.naverPlaceId,
                  }}
                  source="card"
                />
              </View>
              {model.address ? (
                <AppText
                  className="text-body-sm text-text-tertiary"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {model.address}
                </AppText>
              ) : null}
              <AppText className="text-body-sm text-text-secondary">
                {formatMachineCount(model.machineCount)}
              </AppText>
              {isEmpty ? (
                <View className="mt-1 flex-row items-center gap-2">
                  <View className="self-start rounded-full bg-accent/10 px-3 py-1.5">
                    <AppText className="text-body-xs font-semibold text-accent">{ctaLabel}</AppText>
                  </View>
                  {isPending ? (
                    <ActivityIndicator
                      testID={testID ? `${testID}-pending-indicator` : undefined}
                      color={colors.accent.DEFAULT}
                    />
                  ) : null}
                </View>
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
