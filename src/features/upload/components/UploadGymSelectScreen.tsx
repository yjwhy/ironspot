import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { useGymMachines } from '@/features/gym/hooks/useGymMachines';
import { useGymSearch } from '@/features/map/hooks/useGymSearch';
import { AppText } from '@/shared/components/AppText';
import { useCurrentLocation } from '@/shared/hooks/useCurrentLocation';
import { pressedOpacity } from '@/shared/lib/pressable';
import type {
  GymMachineWithDetails,
  GymWithMachineCount,
  MapBounds,
} from '@/shared/types/database';

const SEARCH_RADIUS_KM = 5;
const DEG_PER_KM = 1 / 111;

const EMPTY_FILTERS = { brandId: null, categoryId: null, loadingType: null } as const;

function toBounds(lat: number, lng: number): MapBounds {
  const delta = SEARCH_RADIUS_KM * DEG_PER_KM;
  return {
    minLat: lat - delta,
    minLng: lng - delta,
    maxLat: lat + delta,
    maxLng: lng + delta,
  };
}

export function UploadGymSelectScreen() {
  const router = useRouter();
  const locationState = useCurrentLocation();
  const [searchText, setSearchText] = useState('');
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);

  const location = locationState.status === 'loading' ? null : locationState.location;

  const bounds = location !== null ? toBounds(location.latitude, location.longitude) : null;

  const { data: allGyms, isPending: gymsLoading } = useGymSearch(bounds, EMPTY_FILTERS);

  function handleGymPress(gymId: string) {
    setSelectedGymId((prev) => (prev === gymId ? null : gymId));
  }

  function handleMachinePress(gymMachineId: string) {
    // Route will exist once the /(upload) segment is scaffolded in Task 25.
    const pathname = '/(upload)/photo' as never;
    router.push({ pathname, params: { gymMachineId } });
  }

  if (locationState.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-bg-base">
        <ActivityIndicator testID="location-loading" />
      </View>
    );
  }

  const filteredGyms =
    searchText.trim() === ''
      ? (allGyms ?? [])
      : (allGyms ?? []).filter((g) => g.name.toLowerCase().includes(searchText.toLowerCase()));

  return (
    <View className="flex-1 bg-bg-base">
      <AppText className="px-4 pt-6 pb-3 text-heading-lg text-text-primary">
        어느 헬스장인가요?
      </AppText>

      <View className="mx-4 mb-3 rounded-lg bg-bg-subtle px-3 py-2">
        <TextInput
          placeholder="헬스장 이름 검색"
          value={searchText}
          onChangeText={setSearchText}
          className="text-body text-text-primary"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <GymListBody
        gymsLoading={gymsLoading}
        gyms={filteredGyms}
        selectedGymId={selectedGymId}
        onGymPress={handleGymPress}
        onMachinePress={handleMachinePress}
      />

      <View className="border-t border-border-subtle px-4 py-3">
        <Pressable
          testID="no-gym-button"
          accessibilityRole="button"
          style={pressedOpacity}
          className="items-center py-2"
        >
          <AppText className="text-body text-accent">헬스장이 없어요?</AppText>
        </Pressable>
      </View>
    </View>
  );
}

interface GymListBodyProps {
  gymsLoading: boolean;
  gyms: GymWithMachineCount[];
  selectedGymId: string | null;
  onGymPress: (gymId: string) => void;
  onMachinePress: (gymMachineId: string) => void;
}

function GymListBody({
  gymsLoading,
  gyms,
  selectedGymId,
  onGymPress,
  onMachinePress,
}: GymListBodyProps) {
  if (gymsLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator testID="gyms-loading" />
      </View>
    );
  }

  if (gyms.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4" testID="no-gyms-empty">
        <AppText className="text-body text-text-secondary">주변 헬스장을 찾을 수 없어요</AppText>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      {gyms.map((gym) => (
        <GymItem
          key={gym.id}
          gym={gym}
          isSelected={selectedGymId === gym.id}
          onPress={onGymPress}
          onMachinePress={onMachinePress}
        />
      ))}
    </ScrollView>
  );
}

interface GymItemProps {
  gym: GymWithMachineCount;
  isSelected: boolean;
  onPress: (gymId: string) => void;
  onMachinePress: (gymMachineId: string) => void;
}

function GymItem({ gym, isSelected, onPress, onMachinePress }: GymItemProps) {
  return (
    <View>
      <Pressable
        testID={`gym-item-${gym.id}`}
        accessibilityRole="button"
        accessibilityLabel={gym.name}
        onPress={() => {
          onPress(gym.id);
        }}
        style={pressedOpacity}
        className="flex-row items-center justify-between px-4 py-3"
      >
        <View className="flex-1 gap-0.5">
          <AppText className="text-body font-medium text-text-primary">{gym.name}</AppText>
          <AppText className="text-body-sm text-text-secondary">{gym.address}</AppText>
        </View>
        <AppText className="text-body-sm text-text-tertiary">
          기구 {String(gym.machine_count)}개
        </AppText>
      </Pressable>

      {isSelected ? <GymMachineSubList gymId={gym.id} onMachinePress={onMachinePress} /> : null}
    </View>
  );
}

interface GymMachineSubListProps {
  gymId: string;
  onMachinePress: (gymMachineId: string) => void;
}

function GymMachineSubList({ gymId, onMachinePress }: GymMachineSubListProps) {
  const { data: machines, isPending } = useGymMachines(gymId);

  if (isPending) {
    return (
      <View className="items-center py-3">
        <ActivityIndicator />
      </View>
    );
  }

  if (!machines || machines.length === 0) {
    return (
      <View className="px-4 py-2">
        <AppText className="text-body-sm text-text-secondary">등록된 기구가 없어요</AppText>
      </View>
    );
  }

  return (
    <View className="bg-bg-subtle pb-2">
      {machines.map((machine) => (
        <MachineItem key={machine.id} machine={machine} onPress={onMachinePress} />
      ))}
    </View>
  );
}

interface MachineItemProps {
  machine: GymMachineWithDetails;
  onPress: (gymMachineId: string) => void;
}

function MachineItem({ machine, onPress }: MachineItemProps) {
  const displayName = machine.custom_name ?? machine.template.name;

  return (
    <Pressable
      testID={`machine-item-${machine.id}`}
      accessibilityRole="button"
      accessibilityLabel={displayName}
      onPress={() => {
        onPress(machine.id);
      }}
      style={pressedOpacity}
      className="flex-row items-center justify-between px-6 py-2.5"
    >
      <AppText className="text-body text-text-primary">{displayName}</AppText>
      <AppText className="text-body-sm text-text-tertiary">{machine.template.brand.name}</AppText>
    </Pressable>
  );
}
