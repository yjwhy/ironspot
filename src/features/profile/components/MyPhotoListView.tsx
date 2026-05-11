import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { EmptyState } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import type { PhotoResponse } from '@/shared/generated/model/photoResponse';
import { pressedOpacity } from '@/shared/lib/pressable';
import { ANIMATION, colors } from '@/shared/theme/tokens';

const SCROLL_HORIZONTAL_PADDING = 16;
const SCROLL_BOTTOM_PADDING = 32;
const HEADER_ICON_SIZE = 24;
const SKELETON_CELL_COUNT = 9;
const SKELETON_CELL_SIZE = 100;

interface MyPhotoListViewProps {
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  photos: readonly PhotoResponse[] | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  testID?: string;
}

export function MyPhotoListView({
  title,
  emptyTitle,
  emptyDescription,
  photos,
  isPending,
  isError,
  isFetching,
  onRefresh,
  testID,
}: MyPhotoListViewProps) {
  function handlePressPhoto(photo: PhotoResponse) {
    router.push({
      pathname: '/photo/[id]',
      params: { id: photo.id, machineId: photo.gymMachineId },
    });
  }

  function handleBack() {
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base" testID={testID}>
      <Header title={title} onBack={handleBack} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SCROLL_HORIZONTAL_PADDING,
          paddingBottom: SCROLL_BOTTOM_PADDING,
        }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} />}
      >
        <Body
          isPending={isPending}
          isError={isError}
          photos={photos ?? []}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          onPressPhoto={handlePressPhoto}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

interface HeaderProps {
  title: string;
  onBack: () => void;
}

function Header({ title, onBack }: HeaderProps) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border-DEFAULT">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        style={pressedOpacity}
        className="pr-3"
      >
        <MaterialIcons
          name="arrow-back"
          size={HEADER_ICON_SIZE}
          color={colors.text.primary}
          importantForAccessibility="no"
          accessibilityElementsHidden={true}
        />
      </Pressable>
      <AppText accessibilityRole="header" className="text-heading-sm text-text-primary">
        {title}
      </AppText>
    </View>
  );
}

interface BodyProps {
  isPending: boolean;
  isError: boolean;
  photos: readonly PhotoResponse[];
  emptyTitle: string;
  emptyDescription: string;
  onPressPhoto: (photo: PhotoResponse) => void;
}

function Body({
  isPending,
  isError,
  photos,
  emptyTitle,
  emptyDescription,
  onPressPhoto,
}: BodyProps) {
  if (isPending) {
    return <SkeletonGrid />;
  }
  if (isError) {
    return (
      <EmptyState
        icon="error-outline"
        title="사진을 불러올 수 없어요"
        description="잠시 후 다시 시도해주세요"
      />
    );
  }
  if (photos.length === 0) {
    return <EmptyState icon="photo-library" title={emptyTitle} description={emptyDescription} />;
  }
  return <Grid photos={photos} onPressPhoto={onPressPhoto} />;
}

interface GridProps {
  photos: readonly PhotoResponse[];
  onPressPhoto: (photo: PhotoResponse) => void;
}

function Grid({ photos, onPressPhoto }: GridProps) {
  return (
    <View className="-mx-1 mt-3 flex-row flex-wrap">
      {photos.map((photo, index) => (
        <View key={photo.id} className="mb-2 w-1/3 px-1">
          <GridCell
            photo={photo}
            index={index}
            onPress={() => {
              onPressPhoto(photo);
            }}
          />
        </View>
      ))}
    </View>
  );
}

interface GridCellProps {
  photo: PhotoResponse;
  index: number;
  onPress: () => void;
}

function GridCell({ photo, index, onPress }: GridCellProps) {
  const upvoteLabel = `추천 ${String(photo.upvoteCount)}`;
  return (
    <Animated.View
      entering={FadeIn.duration(ANIMATION.transitionDuration).delay(index * ANIMATION.stagger)}
    >
      <Pressable
        onPress={onPress}
        testID={`my-photo-cell-${photo.id}`}
        accessibilityRole="button"
        accessibilityLabel={`사진, ${upvoteLabel}`}
        style={pressedOpacity}
        className="overflow-hidden rounded-md bg-bg-muted"
      >
        <Image
          source={{ uri: photo.photoUrl }}
          style={{ width: '100%', aspectRatio: 1 }}
          contentFit="cover"
        />
        <View className="px-2 py-1">
          <AppText className="text-caption text-text-tertiary" numberOfLines={1}>
            {upvoteLabel}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SkeletonGrid() {
  return (
    <View className="-mx-1 mt-3 flex-row flex-wrap">
      {Array.from({ length: SKELETON_CELL_COUNT }).map((_, i) => (
        <View key={i} className="mb-2 w-1/3 px-1">
          <Skeleton width={SKELETON_CELL_SIZE} height={SKELETON_CELL_SIZE} />
        </View>
      ))}
    </View>
  );
}
