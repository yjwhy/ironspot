import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { useGymMachines } from '@/features/gym/hooks/useGymMachines';
import { useGymSearch } from '@/features/map/hooks/useGymSearch';
import { AppText } from '@/shared/components/AppText';
import type { NaverPlaceResult } from '@/shared/generated/model/naverPlaceResult';
import { useCurrentLocation } from '@/shared/hooks/useCurrentLocation';
import { toBounds } from '@/shared/lib/geo';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';
import type { GymMachineWithDetails, GymWithMachineCount } from '@/shared/types/database';

import { useCreateGym } from '../hooks/useCreateGym';
import { useNaverPlacesSearch } from '../hooks/useNaverPlacesSearch';

const SEARCH_RADIUS_KM = 5;

const EMPTY_FILTERS = {
  brandIds: [],
  categoryIds: [],
  templateIds: [],
  machineFilterMode: 'or',
} as const;

type ScreenMode = 'list' | 'naver-search';

export function UploadGymSelectScreen() {
  const locationState = useCurrentLocation();
  // F7 deep-link from UnregisteredGymCard ("첫 등록자 되기" CTA): when the
  // route is opened with `?openNewGym=1&initialQuery=<name>` the screen lands
  // in Naver-search mode with the place name pre-filled, so the user can
  // confirm + tap the same place + continue.
  const params = useLocalSearchParams<{ openNewGym?: string; initialQuery?: string }>();
  const initialMode: ScreenMode = params.openNewGym === '1' ? 'naver-search' : 'list';
  const [searchText, setSearchText] = useState('');
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [mode, setMode] = useState<ScreenMode>(initialMode);

  const location = locationState.status === 'loading' ? null : locationState.location;
  const bounds =
    location !== null ? toBounds(location.latitude, location.longitude, SEARCH_RADIUS_KM) : null;

  const {
    data: allGyms,
    isPending: gymsLoading,
    isError: gymsError,
  } = useGymSearch(bounds, EMPTY_FILTERS);

  function handleGymPress(gymId: string) {
    setSelectedGymId((prev) => (prev === gymId ? null : gymId));
  }

  function handleEnterNaverSearch() {
    setMode('naver-search');
  }

  function handleExitNaverSearch() {
    setMode('list');
  }

  if (locationState.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-bg-base">
        <ActivityIndicator testID="location-loading" />
      </View>
    );
  }

  if (mode === 'naver-search') {
    return (
      <NaverGymRegistrationPanel
        onClose={handleExitNaverSearch}
        initialQuery={params.initialQuery}
      />
    );
  }

  const filteredGyms =
    searchText.trim() === ''
      ? (allGyms ?? [])
      : (allGyms ?? []).filter((g) => g.name.toLowerCase().includes(searchText.toLowerCase()));

  return (
    <GymSelectContent
      searchText={searchText}
      onSearchChange={setSearchText}
      gymsLoading={gymsLoading}
      gymsError={gymsError}
      filteredGyms={filteredGyms}
      selectedGymId={selectedGymId}
      onGymPress={handleGymPress}
      onAddGym={handleEnterNaverSearch}
    />
  );
}

interface GymSelectContentProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  gymsLoading: boolean;
  gymsError: boolean;
  filteredGyms: GymWithMachineCount[];
  selectedGymId: string | null;
  onGymPress: (gymId: string) => void;
  onAddGym: () => void;
}

function GymSelectContent({
  searchText,
  onSearchChange,
  gymsLoading,
  gymsError,
  filteredGyms,
  selectedGymId,
  onGymPress,
  onAddGym,
}: GymSelectContentProps) {
  return (
    <View className="flex-1 bg-bg-base">
      <AppText className="px-4 pt-6 pb-3 text-heading-lg text-text-primary">
        어느 헬스장인가요?
      </AppText>

      <View className="mx-4 mb-3 rounded-lg bg-bg-subtle px-3 py-2">
        <TextInput
          placeholder="헬스장 이름 검색"
          value={searchText}
          onChangeText={onSearchChange}
          className="text-body text-text-primary"
          placeholderTextColor={colors.text.tertiary}
        />
      </View>

      <GymListBody
        gymsLoading={gymsLoading}
        gymsError={gymsError}
        gyms={filteredGyms}
        selectedGymId={selectedGymId}
        onGymPress={onGymPress}
      />

      <View className="border-t border-border-subtle px-4 py-3">
        <Pressable
          testID="no-gym-button"
          accessibilityRole="button"
          onPress={onAddGym}
          style={pressedOpacity}
          className="items-center py-2"
        >
          <AppText className="text-body text-accent">헬스장이 없어요?</AppText>
        </Pressable>
      </View>
    </View>
  );
}

interface NaverGymRegistrationPanelProps {
  onClose: () => void;
  /** F7 deep-link from UnregisteredGymCard. When present, the Naver search
   * input is pre-filled and a search auto-fires on mount. */
  initialQuery?: string;
}

function NaverGymRegistrationPanel({ onClose, initialQuery }: NaverGymRegistrationPanelProps) {
  const [query, setQuery] = useState(initialQuery ?? '');
  // When the screen is entered via the F7 deep-link with an `initialQuery`,
  // sync the value once on mount so the Naver search auto-fires for the
  // place the user tapped. Subsequent edits stay user-driven.
  useEffect(
    function syncInitialQueryOnce() {
      if (initialQuery !== undefined && initialQuery !== '') {
        setQuery(initialQuery);
      }
    },
    [initialQuery],
  );
  const { places, isFetching, isError } = useNaverPlacesSearch(query);
  const { handleCreateGym, isPending } = useCreateGym({ onSuccess: onClose });

  function handlePlacePress(place: NaverPlaceResult) {
    if (isPending) return;
    handleCreateGym(place);
  }

  return (
    <View className="flex-1 bg-bg-base">
      <View className="flex-row items-center justify-between px-4 pt-6 pb-3">
        <AppText className="text-heading-lg text-text-primary">새 헬스장 등록</AppText>
        <Pressable
          testID="cancel-add-gym"
          accessibilityRole="button"
          accessibilityLabel="취소"
          onPress={onClose}
          style={pressedOpacity}
          className="px-2 py-1"
        >
          <AppText className="text-body text-accent">취소</AppText>
        </Pressable>
      </View>

      <View className="mx-4 mb-3 rounded-lg bg-bg-subtle px-3 py-2">
        <TextInput
          testID="naver-search-input"
          placeholder="헬스장 이름으로 검색"
          value={query}
          onChangeText={setQuery}
          className="text-body text-text-primary"
          placeholderTextColor={colors.text.tertiary}
          autoFocus
        />
      </View>

      <NaverPlacesBody
        query={query}
        places={places}
        isFetching={isFetching}
        isError={isError}
        isCreating={isPending}
        onPlacePress={handlePlacePress}
      />
    </View>
  );
}

interface NaverPlacesBodyProps {
  query: string;
  places: NaverPlaceResult[];
  isFetching: boolean;
  isError: boolean;
  isCreating: boolean;
  onPlacePress: (place: NaverPlaceResult) => void;
}

function NaverPlacesBody({
  query,
  places,
  isFetching,
  isError,
  isCreating,
  onPlacePress,
}: NaverPlacesBodyProps) {
  if (query.trim().length < NAVER_QUERY_MIN_LENGTH) {
    return (
      <View className="flex-1 items-center justify-center px-4" testID="naver-search-hint">
        <AppText className="text-body text-text-secondary">두 글자 이상 입력해주세요</AppText>
      </View>
    );
  }

  if (isFetching) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator testID="naver-search-loading" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-4" testID="naver-search-error">
        <AppText className="text-body text-text-secondary">
          네이버 검색에 실패했어요. 잠시 후 다시 시도해주세요.
        </AppText>
      </View>
    );
  }

  if (places.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4" testID="naver-search-empty">
        <AppText className="text-body text-text-secondary">검색 결과가 없어요</AppText>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      {places.map((place) => (
        <NaverPlaceItem key={place.id} place={place} disabled={isCreating} onPress={onPlacePress} />
      ))}
    </ScrollView>
  );
}

interface NaverPlaceItemProps {
  place: NaverPlaceResult;
  disabled: boolean;
  onPress: (place: NaverPlaceResult) => void;
}

function NaverPlaceItem({ place, disabled, onPress }: NaverPlaceItemProps) {
  return (
    <Pressable
      testID={`naver-place-${place.id}`}
      accessibilityRole="button"
      accessibilityLabel={place.name}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        onPress(place);
      }}
      style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}
      className="border-b border-border-subtle px-4 py-3"
    >
      <AppText className="text-body font-medium text-text-primary">{place.name}</AppText>
      <AppText className="text-body-sm text-text-secondary">{place.roadAddress}</AppText>
    </Pressable>
  );
}

const NAVER_QUERY_MIN_LENGTH = 2;

interface GymListBodyProps {
  gymsLoading: boolean;
  gymsError: boolean;
  gyms: GymWithMachineCount[];
  selectedGymId: string | null;
  onGymPress: (gymId: string) => void;
}

function GymListBody({
  gymsLoading,
  gymsError,
  gyms,
  selectedGymId,
  onGymPress,
}: GymListBodyProps) {
  if (gymsLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator testID="gyms-loading" />
      </View>
    );
  }

  if (gymsError) {
    return (
      <View className="flex-1 items-center justify-center px-4" testID="gyms-error">
        <AppText className="text-body text-text-secondary">헬스장 정보를 불러오지 못했어요</AppText>
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
        />
      ))}
    </ScrollView>
  );
}

interface GymItemProps {
  gym: GymWithMachineCount;
  isSelected: boolean;
  onPress: (gymId: string) => void;
}

function GymItem({ gym, isSelected, onPress }: GymItemProps) {
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

      {isSelected ? <GymMachineSubList gymId={gym.id} /> : null}
    </View>
  );
}

interface GymMachineSubListProps {
  gymId: string;
}

function GymMachineSubList({ gymId }: GymMachineSubListProps) {
  const router = useRouter();
  const { data: machines, isPending, isError } = useGymMachines(gymId);

  if (isPending) {
    return (
      <View className="items-center py-3">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="px-4 py-2" testID="machines-error">
        <AppText className="text-body-sm text-text-secondary">
          기구 목록을 불러오지 못했어요
        </AppText>
      </View>
    );
  }

  if (machines.length === 0) {
    return (
      <View className="px-4 py-2">
        <AppText className="text-body-sm text-text-secondary">등록된 기구가 없어요</AppText>
      </View>
    );
  }

  function handleMachinePress(gymMachineId: string) {
    router.push({ pathname: '/(upload)/photo', params: { gymMachineId } });
  }

  return (
    <View className="bg-bg-subtle pb-2">
      {machines.map((machine) => (
        <MachineItem key={machine.id} machine={machine} onPress={handleMachinePress} />
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
