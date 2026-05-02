import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { EmptyState } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import { formatVerifiedDate } from '@/shared/lib/format';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';
import type { MachinePhoto } from '@/shared/types/database';

import { PhotoPager } from './PhotoPager';
import { useMachinePhotos } from '../hooks/useMachinePhotos';

const ANONYMOUS_LABEL = '익명';
const TOP_BAR_GUTTER = 8;
const FOOTER_GUTTER = 16;
const SKELETON_SIZE = 300;
const DISABLED_OPACITY = 0.4;

interface PhotoDetailScreenProps {
  photoId: string | undefined;
  machineId: string | undefined;
}

export function PhotoDetailScreen({ photoId, machineId }: PhotoDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const photos = useMachinePhotos(machineId);
  const photoList = photos.data ?? [];
  const initialIndex = photoId ? photoList.findIndex((p) => p.id === photoId) : -1;

  const [pagerIndex, setPagerIndex] = useState<number | null>(null);
  const effectiveIndex = pagerIndex ?? (initialIndex >= 0 ? initialIndex : 0);
  const currentPhoto = photoList[effectiveIndex];

  const hasValidContext = Boolean(machineId) && Boolean(photoId);
  const photoNotFound =
    Boolean(photoId) && !photos.isPending && !photos.isError && initialIndex === -1;
  const showError = !hasValidContext || photos.isError || photoNotFound;

  function handleClose() {
    router.back();
  }

  return (
    <View className="flex-1 bg-black">
      <View
        className="absolute left-0 right-0 top-0 z-10 px-4"
        style={{ paddingTop: insets.top + TOP_BAR_GUTTER }}
      >
        <TopBar onClose={handleClose} />
      </View>

      {showError ? <ErrorView /> : null}
      {!showError && photos.isPending ? <LoadingView /> : null}
      {!showError && !photos.isPending ? (
        <>
          <PhotoPager
            photos={photoList}
            initialIndex={initialIndex >= 0 ? initialIndex : 0}
            onIndexChange={setPagerIndex}
          />
          {currentPhoto ? (
            <FooterBar photo={currentPhoto} bottomInset={insets.bottom + FOOTER_GUTTER} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

interface TopBarProps {
  onClose: () => void;
}

function TopBar({ onClose }: TopBarProps) {
  return (
    <View className="flex-row items-center justify-between">
      <CloseButton onPress={onClose} />
      <ReportButtonDisabled />
    </View>
  );
}

interface CloseButtonProps {
  onPress: () => void;
}

function CloseButton({ onPress }: CloseButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="닫기"
      style={pressedOpacity}
      className="h-10 w-10 items-center justify-center rounded-full bg-black/50"
    >
      <MaterialIcons
        name="close"
        size={20}
        color="#fff"
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

// Phase 1: report is intentionally non-interactive (spec: "Report button
// top-right (disabled Phase 1)"). Rendered as a visually disabled icon so
// the affordance is communicated; full implementation lands in Phase 2.
function ReportButtonDisabled() {
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel="신고"
      accessibilityState={{ disabled: true }}
      style={{ opacity: DISABLED_OPACITY }}
      className="h-10 w-10 items-center justify-center rounded-full bg-black/50"
    >
      <MaterialIcons
        name="flag"
        size={20}
        color="#fff"
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </View>
  );
}

function LoadingView() {
  return (
    <View className="flex-1 items-center justify-center">
      <Skeleton width={SKELETON_SIZE} height={SKELETON_SIZE} />
    </View>
  );
}

function ErrorView() {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <EmptyState
        icon="error-outline"
        title="사진을 불러올 수 없어요"
        description="다시 시도해 주세요"
      />
    </View>
  );
}

interface FooterBarProps {
  photo: MachinePhoto;
  bottomInset: number;
}

function FooterBar({ photo, bottomInset }: FooterBarProps) {
  const dateLabel = formatVerifiedDate(photo.created_at);
  const upvoteLabel = `추천 ${String(photo.upvote_count)}`;
  const uploaderLabel = photo.user_id ? '회원' : ANONYMOUS_LABEL;

  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 pt-3"
      style={{ paddingBottom: bottomInset }}
    >
      <View className="flex-row items-center gap-2">
        <MaterialIcons
          name="favorite"
          size={18}
          color={colors.error}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <AppText className="text-body text-text-inverse">{upvoteLabel}</AppText>
      </View>
      <View className="mt-1 flex-row items-center gap-2">
        <AppText className="text-body-sm text-text-inverse opacity-80">{uploaderLabel}</AppText>
        <AppText className="text-body-sm text-text-inverse opacity-80">·</AppText>
        <AppText className="text-body-sm text-text-inverse opacity-80">{dateLabel}</AppText>
      </View>
    </View>
  );
}
