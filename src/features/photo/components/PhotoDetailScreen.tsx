import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequireAuth } from '@/features/auth/hooks/useRequireAuth';
import { AppText } from '@/shared/components/AppText';
import { EmptyState } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import { formatVerifiedDate } from '@/shared/lib/format';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';
import type { MachinePhoto } from '@/shared/types/database';

import { PhotoPager } from './PhotoPager';
import { ReportReasonSheet } from './ReportReasonSheet';
import { useMachinePhotos } from '../hooks/useMachinePhotos';
import { useUpvote } from '../hooks/useUpvote';

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

  const requireAuth = useRequireAuth();
  const [reportSheetVisible, setReportSheetVisible] = useState(false);

  function handleClose() {
    router.back();
  }

  function handleReport() {
    requireAuth(() => {
      setReportSheetVisible(true);
    });
  }

  function handleReportSheetClose() {
    setReportSheetVisible(false);
  }

  const isPhotoReady = currentPhoto !== undefined;

  return (
    <View className="flex-1 bg-black">
      <View
        className="absolute left-0 right-0 top-0 z-10 px-4"
        style={{ paddingTop: insets.top + TOP_BAR_GUTTER }}
      >
        <TopBar onClose={handleClose} onReport={handleReport} canReport={isPhotoReady} />
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

      {reportSheetVisible && currentPhoto ? (
        <ReportReasonSheet
          target={{
            type: 'photo',
            photoId: currentPhoto.id,
            verifiedByOwnerAt: currentPhoto.verified_by_owner_at ?? null,
          }}
          onClose={handleReportSheetClose}
        />
      ) : null}
    </View>
  );
}

interface TopBarProps {
  onClose: () => void;
  onReport: () => void;
  canReport: boolean;
}

function TopBar({ onClose, onReport, canReport }: TopBarProps) {
  return (
    <View className="flex-row items-center justify-between">
      <CloseButton onPress={onClose} />
      {canReport ? <ReportButton onPress={onReport} /> : <ReportButtonDisabled />}
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

interface ReportButtonProps {
  onPress: () => void;
}

function ReportButton({ onPress }: ReportButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="신고하기"
      style={pressedOpacity}
      className="h-10 w-10 items-center justify-center rounded-full bg-black/50"
    >
      <MaterialIcons
        name="flag"
        size={20}
        color="#fff"
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

// Disabled placeholder shown while photos are loading or unavailable so the
// header keeps its layout. Becomes active once a photo is in view. Same
// label as the active button so screen readers don't re-announce on
// state transition; disabled-ness is communicated via accessibilityState.
function ReportButtonDisabled() {
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel="신고하기"
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

const HEART_BOUNCE_PEAK_SCALE = 1.5;
const HEART_BOUNCE_PEAK_DAMPING = 4;
const HEART_BOUNCE_PEAK_STIFFNESS = 400;
const HEART_BOUNCE_REST_DAMPING = 8;
const HEART_BOUNCE_REST_STIFFNESS = 200;

function disabledOrPressedStyle({ pressed }: { pressed: boolean }, isPending: boolean) {
  if (isPending) return { opacity: DISABLED_OPACITY };
  return pressedOpacity({ pressed });
}

function FooterBar({ photo, bottomInset }: FooterBarProps) {
  const dateLabel = formatVerifiedDate(photo.created_at);
  const upvoteLabel = `추천 ${String(photo.upvote_count)}`;
  const uploaderLabel = photo.user_id ? '회원' : ANONYMOUS_LABEL;
  const { handleUpvote, isPending, isUpvotedByMe } = useUpvote(photo);
  const heartScale = useSharedValue(1);

  function handleOpenMachine() {
    if (!photo.gym_id) return;
    router.push({
      pathname: '/gym/[id]/machine/[machineId]',
      params: { id: photo.gym_id, machineId: photo.gym_machine_id },
    });
  }

  function handlePress() {
    heartScale.value = withSequence(
      withSpring(HEART_BOUNCE_PEAK_SCALE, {
        damping: HEART_BOUNCE_PEAK_DAMPING,
        stiffness: HEART_BOUNCE_PEAK_STIFFNESS,
      }),
      withSpring(1, {
        damping: HEART_BOUNCE_REST_DAMPING,
        stiffness: HEART_BOUNCE_REST_STIFFNESS,
      }),
    );
    handleUpvote();
  }

  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 pt-3"
      style={{ paddingBottom: bottomInset }}
    >
      {photo.gym_name ? (
        <GymMachineLine
          gymName={photo.gym_name}
          machineName={photo.machine_name ?? null}
          onPress={handleOpenMachine}
        />
      ) : null}
      <Pressable
        onPress={handlePress}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel={isUpvotedByMe ? '추천 취소' : upvoteLabel}
        accessibilityState={{ disabled: isPending }}
        style={(state) => disabledOrPressedStyle(state, isPending)}
        className="flex-row items-center gap-2 self-start"
      >
        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
          <MaterialIcons
            name={isUpvotedByMe ? 'favorite' : 'favorite-border'}
            size={18}
            color={colors.error}
            importantForAccessibility="no"
            accessibilityElementsHidden
          />
        </Animated.View>
        <AppText className="text-body text-text-inverse">{upvoteLabel}</AppText>
      </Pressable>
      <View className="mt-1 flex-row items-center gap-2">
        <AppText className="text-body-sm text-text-inverse opacity-80">{uploaderLabel}</AppText>
        <AppText className="text-body-sm text-text-inverse opacity-80">·</AppText>
        <AppText className="text-body-sm text-text-inverse opacity-80">{dateLabel}</AppText>
        {typeof photo.verified_by_owner_at === 'string' && photo.verified_by_owner_at.length > 0 ? (
          <OwnerVerifiedBadge />
        ) : null}
      </View>
    </View>
  );
}

interface GymMachineLineProps {
  gymName: string;
  machineName: string | null;
  onPress: () => void;
}

// Photo-context line: tells the viewer which gym (and machine) this photo
// belongs to — the "어느 헬스장에 등록된 사진인지" affordance. Tapping opens
// that machine's gallery for the full catalog context. Gym leads (the user's
// primary question is "where"), machine follows after a middot.
function GymMachineLine({ gymName, machineName, onPress }: GymMachineLineProps) {
  const label = machineName !== null ? `${gymName} · ${machineName}` : gymName;
  return (
    <Pressable
      testID="photo-detail-gym-machine"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} 머신 보기`}
      style={pressedOpacity}
      className="mb-2 flex-row items-center gap-1 self-start"
    >
      <MaterialIcons
        name="place"
        size={14}
        color={colors.text.inverse}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      <AppText className="text-body-sm font-medium text-text-inverse" numberOfLines={1}>
        {label}
      </AppText>
      <MaterialIcons
        name="chevron-right"
        size={16}
        color={colors.text.inverse}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

// Task 47 / ADR 0023 Q5 T1+T2: green badge surfaced when an active gym owner
// has marked the photo as verified. The verifiedByOwnerAt instant itself is
// for debugging / admin tooling — users see only the badge.
function OwnerVerifiedBadge() {
  return (
    <View
      testID="owner-verified-badge"
      accessibilityRole="text"
      accessibilityLabel="매장 owner 인증 사진"
      className="flex-row items-center gap-1 rounded-full bg-green-600/30 px-2 py-0.5"
    >
      <MaterialIcons
        name="verified"
        size={12}
        color={colors.success}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      <AppText className="text-caption text-text-inverse">owner 인증</AppText>
    </View>
  );
}
