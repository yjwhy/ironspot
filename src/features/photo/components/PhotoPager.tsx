import { Dimensions, FlatList, View } from 'react-native';

import type { MachinePhoto } from '@/shared/types/database';

import { ZoomableImage } from './ZoomableImage';

// Portrait-locked in app.json; safe to capture once. Revisit if rotation is ever enabled.
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoPagerProps {
  photos: readonly MachinePhoto[];
  initialIndex: number;
}

export function PhotoPager({ photos, initialIndex }: PhotoPagerProps) {
  if (photos.length === 0) {
    return <View />;
  }

  const safeIndex = clampIndex(initialIndex, photos.length);

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
    />
  );
}

function renderItem({ item, index }: { item: MachinePhoto; index: number }) {
  return (
    <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center' }}>
      <ZoomableImage
        uri={item.photo_url}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        accessibilityLabel={`사진 ${String(index + 1)}`}
      />
    </View>
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
