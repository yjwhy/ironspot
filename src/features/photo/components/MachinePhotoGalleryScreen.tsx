import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequireAuth } from '@/features/auth/hooks/useRequireAuth';
import { useGymDetail } from '@/features/gym/hooks/useGymDetail';
import { useGymMachines } from '@/features/gym/hooks/useGymMachines';
import { machineDisplayName } from '@/features/gym/lib/group-machines';
import { UPLOAD_PHOTO_PATHNAME } from '@/features/upload/constants';
import { AppText } from '@/shared/components/AppText';
import { EmptyState } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import { pressedOpacity } from '@/shared/lib/pressable';
import type { Gym, GymMachineWithDetails, MachinePhoto } from '@/shared/types/database';

import { PhotoGrid } from './PhotoGrid';
import { useMachinePhotos } from '../hooks/useMachinePhotos';

interface MachinePhotoGalleryScreenProps {
  gymId: string | undefined;
  machineId: string | undefined;
}

const SCROLL_HORIZONTAL_PADDING = 16;
const SCROLL_BOTTOM_PADDING = 96;
const SKELETON_HERO_WIDTH = 320;
const SKELETON_HERO_HEIGHT = 200;
const SKELETON_CELL_SIZE = 100;

export function MachinePhotoGalleryScreen({ gymId, machineId }: MachinePhotoGalleryScreenProps) {
  const insets = useSafeAreaInsets();
  const gym = useGymDetail(gymId);
  const machines = useGymMachines(gymId);
  const photos = useMachinePhotos(machineId);
  const requireAuth = useRequireAuth();

  const machine = machines.data?.find((m) => m.id === machineId) ?? null;

  function handlePressPhoto(photoId: string) {
    if (!machineId) return;
    router.push({
      pathname: '/photo/[id]',
      params: { id: photoId, machineId },
    });
  }

  function handleRefresh() {
    void Promise.all([gym.refetch(), machines.refetch(), photos.refetch()]);
  }

  function handlePressUpload() {
    // Skip the gym-select hop: this gallery is already bound to a specific
    // gym+machine pair, so push both onto the camera so UploadConfirmScreen
    // can fall back to the gymId-only contribution path on OCR mismatch.
    if (!gymId || !machineId) return;
    requireAuth(function navigateToUpload() {
      router.push({
        pathname: UPLOAD_PHOTO_PATHNAME,
        params: { gymId, gymMachineId: machineId },
      });
    });
  }

  return (
    <View className="flex-1 bg-bg-base">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + SCROLL_HORIZONTAL_PADDING,
          paddingHorizontal: SCROLL_HORIZONTAL_PADDING,
          paddingBottom: SCROLL_BOTTOM_PADDING,
        }}
        refreshControl={
          <RefreshControl
            refreshing={photos.isFetching || gym.isFetching || machines.isFetching}
            onRefresh={handleRefresh}
          />
        }
      >
        <Header gym={gym.data ?? null} machine={machine} />
        <Body
          isPending={photos.isPending}
          isError={photos.isError}
          photos={photos.data ?? []}
          onPressPhoto={handlePressPhoto}
        />
      </ScrollView>
      <UploadFab onPress={handlePressUpload} />
    </View>
  );
}

interface HeaderProps {
  gym: Gym | null;
  machine: GymMachineWithDetails | null;
}

function Header({ gym, machine }: HeaderProps) {
  // Phase 5 item 18: detail-surface treatment — Korean primary heading +
  // smaller English secondary line so users who recognise the brand+model
  // in English can still confirm the exact reference. machineDisplayName()
  // already returns Korean primary (or English fallback for legacy rows).
  const title = machine ? machineDisplayName(machine) : '머신 사진';
  const englishSecondary =
    machine && !machine.is_custom && machine.template.name_ko
      ? `${machine.template.brand.name} ${machine.template.name_en}`
      : null;
  return (
    <View className="mb-4 gap-1">
      <AppText accessibilityRole="header" className="text-heading-lg text-text-primary">
        {title}
      </AppText>
      {englishSecondary ? (
        <AppText className="text-body-sm text-text-tertiary">{englishSecondary}</AppText>
      ) : null}
      {gym ? <AppText className="text-body-sm text-text-secondary">{gym.name}</AppText> : null}
    </View>
  );
}

interface BodyProps {
  isPending: boolean;
  isError: boolean;
  photos: readonly MachinePhoto[];
  onPressPhoto: (photoId: string) => void;
}

function Body({ isPending, isError, photos, onPressPhoto }: BodyProps) {
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
    return (
      <EmptyState
        icon="photo-camera"
        title="아직 사진이 없어요"
        description="첫 번째 사진을 올려보세요!"
      />
    );
  }
  return <PhotoGrid photos={photos} onPressPhoto={onPressPhoto} />;
}

function SkeletonGrid() {
  return (
    <View className="gap-4">
      <Skeleton width={SKELETON_HERO_WIDTH} height={SKELETON_HERO_HEIGHT} />
      <View className="-mx-1 flex-row flex-wrap">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} className="mb-2 w-1/3 px-1">
            <Skeleton width={SKELETON_CELL_SIZE} height={SKELETON_CELL_SIZE} />
          </View>
        ))}
      </View>
    </View>
  );
}

interface UploadFabProps {
  onPress: () => void;
}

function UploadFab({ onPress }: UploadFabProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="사진 올리기"
      style={pressedOpacity}
      className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg"
    >
      <MaterialIcons
        name="add-a-photo"
        size={24}
        color="#fff"
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}
