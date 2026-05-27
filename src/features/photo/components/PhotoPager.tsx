import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Dimensions, FlatList, View } from 'react-native';

import type { MachinePhoto } from '@/shared/types/database';

import { ZoomableImage } from './ZoomableImage';

// Portrait-locked in app.json; safe to capture once. Revisit if rotation is ever enabled.
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoPagerProps {
  photos: readonly MachinePhoto[];
  initialIndex: number;
  onIndexChange?: (index: number) => void;
}

export function PhotoPager({ photos, initialIndex, onIndexChange }: PhotoPagerProps) {
  if (photos.length === 0) {
    return <View />;
  }

  const safeIndex = clampIndex(initialIndex, photos.length);

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!onIndexChange || SCREEN_WIDTH <= 0) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const next = Math.round(offsetX / SCREEN_WIDTH);
    onIndexChange(clampIndex(next, photos.length));
  }

  function renderItem({ item, index }: { item: MachinePhoto; index: number }) {
    return (
      <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center' }}>
        <ZoomableImage
          contentPath={item.content_path}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          accessibilityLabel={`사진 ${String(index + 1)}`}
        />
      </View>
    );
  }

  return (
    <FlatList
      data={photos}
      keyExtractor={photoKey}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={safeIndex}
      getItemLayout={getItemLayout}
      renderItem={renderItem}
      onMomentumScrollEnd={handleMomentumScrollEnd}
    />
  );
}

function getItemLayout(_data: ArrayLike<MachinePhoto> | null | undefined, index: number) {
  return { length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index };
}

function photoKey(item: MachinePhoto): string {
  return item.id;
}

export function clampIndex(value: number, length: number): number {
  if (length <= 0) return 0;
  if (value < 0) return 0;
  if (value > length - 1) return length - 1;
  return value;
}
