import { router } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';

import { AuthedImage } from '@/shared/components/AuthedImage';
import type { PhotoResponse } from '@/shared/generated/model/photoResponse';
import { pressedOpacity } from '@/shared/lib/pressable';

const THUMB_SIZE = 72;
// Recent uploads peeked under the "내가 올린 사진" row. Capped so the strip
// stays a quick glance, not a second full gallery (the row itself routes to
// the complete grid).
const PREVIEW_LIMIT = 8;

interface ProfilePhotoStripProps {
  photos: readonly PhotoResponse[];
}

/**
 * Horizontal peek of the user's most recent uploads, shown inside the profile
 * "내 활동" card directly beneath the "내가 올린 사진" row. Tapping a thumbnail
 * opens the full-screen photo detail, same destination as the grid cell.
 * Renders nothing when the user has no photos.
 */
export function ProfilePhotoStrip({ photos }: ProfilePhotoStripProps) {
  const preview = photos.slice(0, PREVIEW_LIMIT);
  if (preview.length === 0) return null;

  function handlePressPhoto(photo: PhotoResponse) {
    router.push({
      pathname: '/photo/[id]',
      params: { id: photo.id, machineId: photo.gymMachineId },
    });
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4 pb-4 pt-1"
      testID="profile-photo-strip"
    >
      {preview.map((photo) => (
        <Pressable
          key={photo.id}
          testID={`profile-photo-strip-cell-${photo.id}`}
          accessibilityRole="button"
          accessibilityLabel="내가 올린 사진 보기"
          onPress={() => {
            handlePressPhoto(photo);
          }}
          style={pressedOpacity}
          className="overflow-hidden rounded-lg bg-bg-muted"
        >
          <AuthedImage
            contentPath={photo.contentPath}
            style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
            contentFit="cover"
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}
