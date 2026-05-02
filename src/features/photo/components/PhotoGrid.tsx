import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/shared/components/AppText';
import { formatVerifiedDate } from '@/shared/lib/format';
import { pressedOpacity } from '@/shared/lib/pressable';
import { ANIMATION } from '@/shared/theme/tokens';
import type { MachinePhoto } from '@/shared/types/database';

interface PhotoGridProps {
  photos: readonly MachinePhoto[];
  onPressPhoto: (photoId: string) => void;
}

export function PhotoGrid({ photos, onPressPhoto }: PhotoGridProps) {
  const [bestCut, ...rest] = photos;
  if (!bestCut) return null;

  const remaining = sortByCreatedAtDesc(rest);

  return (
    <View className="gap-4">
      <BestCutCard
        photo={bestCut}
        onPress={() => {
          onPressPhoto(bestCut.id);
        }}
      />
      {remaining.length > 0 ? (
        <RemainingGrid photos={remaining} onPressPhoto={onPressPhoto} />
      ) : null}
    </View>
  );
}

interface BestCutCardProps {
  photo: MachinePhoto;
  onPress: () => void;
}

function BestCutCard({ photo, onPress }: BestCutCardProps) {
  const dateLabel = formatVerifiedDate(photo.created_at);
  const upvoteLabel = `추천 ${String(photo.upvote_count)}`;
  const accessibilityLabel = `베스트 컷, ${upvoteLabel}, ${dateLabel}`;

  return (
    <Animated.View entering={FadeIn.duration(ANIMATION.transitionDuration)}>
      <Pressable
        onPress={onPress}
        testID="photo-grid-best-cut"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={pressedOpacity}
        className="overflow-hidden rounded-lg bg-bg-elevated shadow-md"
      >
        <View className="flex-row items-center gap-2 bg-accent-50 px-3 py-2">
          <AppText className="font-semibold text-body-sm text-accent-dark">Best Cut</AppText>
          <AppText className="text-body-sm text-accent-dark">{upvoteLabel}</AppText>
        </View>
        <Image
          source={{ uri: photo.photo_url }}
          style={{ width: '100%', aspectRatio: 16 / 10 }}
          contentFit="cover"
        />
        <View className="px-3 py-2">
          <AppText className="text-body-sm text-text-tertiary">{dateLabel}</AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

interface RemainingGridProps {
  photos: readonly MachinePhoto[];
  onPressPhoto: (photoId: string) => void;
}

function RemainingGrid({ photos, onPressPhoto }: RemainingGridProps) {
  return (
    <View className="-mx-1 flex-row flex-wrap">
      {photos.map((photo, index) => (
        <View key={photo.id} className="mb-2 w-1/3 px-1">
          <PhotoCell
            photo={photo}
            index={index}
            onPress={() => {
              onPressPhoto(photo.id);
            }}
          />
        </View>
      ))}
    </View>
  );
}

interface PhotoCellProps {
  photo: MachinePhoto;
  index: number;
  onPress: () => void;
}

function PhotoCell({ photo, index, onPress }: PhotoCellProps) {
  const dateLabel = formatVerifiedDate(photo.created_at);
  const upvoteLabel = `추천 ${String(photo.upvote_count)}`;
  const accessibilityLabel = `사진, ${upvoteLabel}, ${dateLabel}`;

  return (
    <Animated.View
      entering={FadeIn.duration(ANIMATION.transitionDuration).delay(index * ANIMATION.stagger)}
    >
      <Pressable
        onPress={onPress}
        testID={`photo-grid-cell-${photo.id}`}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={pressedOpacity}
        className="overflow-hidden rounded-md bg-bg-muted"
      >
        <Image
          source={{ uri: photo.photo_url }}
          style={{ width: '100%', aspectRatio: 1 }}
          contentFit="cover"
        />
        <View className="px-2 py-1">
          <AppText className="text-caption text-text-tertiary" numberOfLines={1}>
            {upvoteLabel}
          </AppText>
          <AppText className="text-caption text-text-tertiary" numberOfLines={1}>
            {dateLabel}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function sortByCreatedAtDesc(photos: readonly MachinePhoto[]): readonly MachinePhoto[] {
  return [...photos].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
