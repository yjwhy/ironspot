import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useRequireAuth } from '@/features/auth/hooks/useRequireAuth';
import { UPLOAD_METHOD_CHOICE_PATHNAME } from '@/features/upload/constants';
import { AccentChip } from '@/shared/components/AccentChip';
import { AppText } from '@/shared/components/AppText';
import { EmptyState } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import { formatVerifiedDate } from '@/shared/lib/format';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';
import type { Gym, GymMachineWithDetails } from '@/shared/types/database';

import { DirectionsChip } from './DirectionsChip';
import { GymOwnerEntry } from './GymOwnerEntry';
import { MachineList } from './MachineList';
import { useGymMachines } from '../hooks/useGymMachines';

interface GymDetailProps {
  gym: Gym;
  onPressMachine: (gymMachineId: string) => void;
}

export function GymDetail({ gym, onPressMachine }: GymDetailProps) {
  const { data, isPending, isError } = useGymMachines(gym.id);
  const [heroFailed, setHeroFailed] = useState(false);

  const heroUrl = gym.cover_photo_url;
  const showHero = heroUrl !== null && !heroFailed;

  return (
    <View className="flex-1 bg-bg-base">
      <ScrollView contentContainerClassName="pb-24">
        {showHero ? (
          // bg-bg-muted is the solid colour visible during expo-image's
          // 200ms fade-in transition — avoids a "white flash before image
          // appears" on slow networks without needing a blurhash.
          <View
            className="w-full bg-bg-muted"
            style={{ aspectRatio: 16 / 9 }}
            accessibilityLabel={`${gym.name} 대표 사진`}
          >
            <Image
              source={{ uri: heroUrl }}
              contentFit="cover"
              transition={200}
              onError={() => {
                setHeroFailed(true);
              }}
              style={{ width: '100%', height: '100%' }}
            />
          </View>
        ) : null}
        <View className="gap-4 p-4">
          <GymHeader gym={gym} />
          <GymOwnerEntry gymId={gym.id} gymName={gym.name} />
          <MachinesBody
            data={data}
            isPending={isPending}
            isError={isError}
            onPressMachine={onPressMachine}
          />
        </View>
      </ScrollView>
      <AddPhotoFab gymId={gym.id} />
    </View>
  );
}

function GymHeader({ gym }: { gym: Gym }) {
  return (
    <View className="gap-1">
      <View className="flex-row items-start justify-between gap-3">
        <AppText accessibilityRole="header" className="flex-1 text-heading-lg text-text-primary">
          {gym.name}
        </AppText>
        <DirectionsChip
          gym={{
            id: gym.id,
            name: gym.name,
            latitude: gym.latitude,
            longitude: gym.longitude,
            // See GymCard for the rationale — naver_place_id isn't surfaced
            // through the current DTO, so the directions lib falls back to
            // the lat/lng route deeplink.
            naverPlaceId: null,
          }}
          source="detail"
        />
      </View>
      <MetaLine>{gym.address}</MetaLine>
      {gym.phone ? <MetaLine>{gym.phone}</MetaLine> : null}
      {gym.operating_hours ? <MetaLine>{gym.operating_hours}</MetaLine> : null}
      {gym.last_verified_at ? (
        <View className="mt-1">
          <AccentChip>확인일 {formatVerifiedDate(gym.last_verified_at)}</AccentChip>
        </View>
      ) : null}
    </View>
  );
}

function MetaLine({ children }: { children: ReactNode }) {
  return <AppText className="text-body-sm text-text-secondary">{children}</AppText>;
}

interface MachinesBodyProps {
  data: readonly GymMachineWithDetails[] | undefined;
  isPending: boolean;
  isError: boolean;
  onPressMachine: (gymMachineId: string) => void;
}

function MachinesBody({ data, isPending, isError, onPressMachine }: MachinesBodyProps) {
  if (isPending) {
    return (
      <View className="gap-2">
        <Skeleton width={280} height={20} />
        <Skeleton width={240} height={20} />
        <Skeleton width={200} height={20} />
      </View>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon="error-outline"
        title="기구 정보를 불러오지 못했어요"
        description="잠시 후 다시 시도해주세요"
      />
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState icon="info-outline" title="등록된 기구가 없어요" />;
  }

  return <MachineList machines={data} onPressMachine={onPressMachine} />;
}

interface AddPhotoFabProps {
  gymId: string;
}

function AddPhotoFab({ gymId }: AddPhotoFabProps) {
  const requireAuth = useRequireAuth();
  function handlePress() {
    requireAuth(function navigateToUpload() {
      // Phase 5 follow-up G: route through method-choice (OCR vs manual)
      // before the camera. Existing-machine photo-add callers
      // (MachinePhotoGalleryScreen) still go directly to UPLOAD_PHOTO_PATHNAME.
      router.push({
        pathname: UPLOAD_METHOD_CHOICE_PATHNAME,
        params: { gymId },
      });
    });
  }
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="사진 추가"
      style={pressedOpacity}
      className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg"
    >
      <MaterialIcons
        name="add-a-photo"
        size={24}
        color={colors.text.inverse}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}
