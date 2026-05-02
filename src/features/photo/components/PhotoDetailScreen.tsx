import { MaterialIcons } from '@expo/vector-icons';
import { toast } from 'burnt';
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
const REPORT_TOAST = 'Phase 2에서 제공 예정';
const TOP_BAR_GUTTER = 8;
const FOOTER_GUTTER = 16;
const SKELETON_SIZE = 300;

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

  function handleReport() {
    toast({ title: REPORT_TOAST });
  }

  return (
    <View className="flex-1 bg-black">
      <View
        className="absolute left-0 right-0 top-0 z-10 px-4"
        style={{ paddingTop: insets.top + TOP_BAR_GUTTER }}
      >
        <TopBar onClose={handleClose} onReport={handleReport} />
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
  onReport: () => void;
}

function TopBar({ onClose, onReport }: TopBarProps) {
  return (
    <View className="flex-row items-center justify-between">
      <CircleButton icon="close" label="닫기" onPress={onClose} />
      <CircleButton icon="flag" label="신고" onPress={onReport} />
    </View>
  );
}

interface CircleButtonProps {
  icon: 'close' | 'flag';
  label: string;
  onPress: () => void;
}

function CircleButton({ icon, label, onPress }: CircleButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={pressedOpacity}
      className="h-10 w-10 items-center justify-center rounded-full bg-black/50"
    >
      <MaterialIcons
        name={icon}
        size={20}
        color="#fff"
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </Pressable>
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
