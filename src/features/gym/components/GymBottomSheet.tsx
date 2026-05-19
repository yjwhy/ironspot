import { MaterialIcons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetView,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import type { UnregisteredPlace } from '@/shared/generated/model';
import { toTestSlug } from '@/shared/lib/format';
import { haversineKm } from '@/shared/lib/geo';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';
import type { GymWithMachineCount } from '@/shared/types/database';

import type { GymBottomSheetMode } from '../types';
import { GymCard } from './GymCard';
import { GymCardSkeleton } from './GymCardSkeleton';
import { GymDetail } from './GymDetail';
import { UnregisteredGymCard } from './UnregisteredGymCard';

export type { GymBottomSheetMode };

interface GymBottomSheetProps {
  mode: GymBottomSheetMode;
}

// First snap was originally '10%' but on phone-class viewports (iPhone 14: ~852pt
// minus tab bar ~83pt → 10% peek ≈ 77pt) that left only the handle visible and the
// user perceived the sheet as "cut off / empty". Bumping the peek to '25%'
// (≈ 192pt on the same device) reveals 1-2 gym card previews while keeping the map
// dominant. Mid and full retained at 50% / 90%.
const SNAP_POINTS = ['25%', '50%', '90%'];

const LIST_PADDING = 16;
const LIST_CONTENT_STYLE = { padding: LIST_PADDING };
const BACKGROUND_STYLE = { backgroundColor: '#FFFFFF' };
const CONTENT_STYLE = { flex: 1 };

const SKELETON_COUNT = 3;
const PRESENT_DELAY_MS = 300;
const SNAP_DELAY_MS = 50;

export function GymBottomSheet({ mode }: GymBottomSheetProps) {
  const ref = useRef<React.ComponentRef<typeof BottomSheetModal>>(null);
  const tabBarHeight = useBottomTabBarHeight();

  // useFocusEffect (not useEffect) so the portaled BottomSheetModal dismisses when the user
  // leaves the Map tab. Without dismiss-on-blur, the gorhom portal — mounted at the (tabs)
  // layout provider — keeps the sheet visible across tabs. Re-presents on refocus so returning
  // to the Map tab restores the prior content (mode is owned by MapScreen state).
  //
  // useCallback wrap: useFocusEffect treats its argument as a dependency of its internal
  // useEffect, so an unstable callback identity would tear down focus listeners and re-fire
  // the timers on every parent render. React Compiler is usually sufficient, but the explicit
  // memo is the library-aligned posture and immune to any future 'use no memo' directive on
  // this file. Empty deps are correct: the closure captures only `ref` (stable useRef).
  useFocusEffect(
    useCallback(function presentOnFocusDismissOnBlur() {
      let snapId: ReturnType<typeof setTimeout> | undefined;
      const id = setTimeout(() => {
        ref.current?.present();
        // bottom-sheet v5.2.10: present() skips snapToIndex on first mount because
        // mounted.current is false; delay gives React time to commit the
        // setState({mount:true}) before we snap to index 1.
        snapId = setTimeout(() => {
          ref.current?.snapToIndex(1);
        }, SNAP_DELAY_MS);
      }, PRESENT_DELAY_MS);
      return function dismissOnBlur() {
        clearTimeout(id);
        clearTimeout(snapId);
        ref.current?.dismiss();
      };
    }, []),
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={SNAP_POINTS}
      index={1}
      enablePanDownToClose={false}
      backdropComponent={undefined}
      bottomInset={tabBarHeight}
      backgroundStyle={BACKGROUND_STYLE}
    >
      <BottomSheetView style={CONTENT_STYLE}>
        {mode.type === 'detail' ? <DetailMode mode={mode} /> : <ListMode mode={mode} />}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

type ListMode_Props = Extract<GymBottomSheetMode, { type: 'list' }>;

// F7 NL search Naver merge — discriminated union so the list can interleave
// registered IronSpot gyms with unregistered Naver places sorted by distance.
type ListItem =
  | { readonly kind: 'gym'; readonly gym: GymWithMachineCount; readonly distanceKm: number }
  | {
      readonly kind: 'unregistered';
      readonly place: UnregisteredPlace;
      readonly distanceKm: number;
    };

function buildSortedList(mode: ListMode_Props): readonly ListItem[] {
  const gymItems: ListItem[] = mode.gyms.map((gym) => ({
    kind: 'gym' as const,
    gym,
    distanceKm: haversineKm(mode.userLocation, {
      latitude: gym.latitude,
      longitude: gym.longitude,
    }),
  }));
  const placeItems: ListItem[] = (mode.unregisteredPlaces ?? []).map((place) => ({
    kind: 'unregistered' as const,
    place,
    distanceKm: haversineKm(mode.userLocation, {
      latitude: place.latitude,
      longitude: place.longitude,
    }),
  }));
  return [...gymItems, ...placeItems].sort((a, b) => a.distanceKm - b.distanceKm);
}

function listItemKey(item: ListItem): string {
  return item.kind === 'gym' ? `gym:${item.gym.id}` : `naver:${item.place.naverPlaceId}`;
}

function ListMode({ mode }: { mode: ListMode_Props }) {
  const renderScrollComponent = useBottomSheetScrollableCreator();

  if (mode.isLoading) {
    return (
      <View className="gap-3 p-4">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <GymCardSkeleton key={i} />
        ))}
      </View>
    );
  }
  const items = buildSortedList(mode);
  return (
    <FlashList
      renderScrollComponent={renderScrollComponent}
      data={items}
      keyExtractor={listItemKey}
      contentContainerStyle={LIST_CONTENT_STYLE}
      ItemSeparatorComponent={ListSeparator}
      ListEmptyComponent={
        mode.nlEmpty !== undefined ? (
          <EmptyState
            icon="search-off"
            title="이 조건의 헬스장이 없어요"
            description={mode.nlEmpty.subtitle}
            action={
              <Button
                label="조건 바꿔서 검색"
                variant="primary"
                onPress={mode.nlEmpty.onRelaxFilters}
              />
            }
          />
        ) : (
          <EmptyState
            icon="search-off"
            title="조건에 맞는 헬스장이 없어요"
            description="필터를 조정해보세요"
            action={
              <Button label="필터 초기화" variant="secondary" onPress={mode.onClearFilters} />
            }
          />
        )
      }
      renderItem={({ item, index }) =>
        item.kind === 'gym' ? (
          <GymCard
            gym={item.gym}
            distanceKm={item.distanceKm}
            index={index}
            testID={`gym-card-${toTestSlug(item.gym.name)}`}
            onPress={() => {
              mode.onSelectGym(item.gym.id);
            }}
          />
        ) : (
          <UnregisteredGymCard
            naverPlaceId={item.place.naverPlaceId}
            name={item.place.name}
            address={item.place.address}
            distanceKm={item.distanceKm}
            index={index}
            testID={`unregistered-gym-card-${toTestSlug(item.place.name)}`}
            onPress={() => {
              mode.onUnregisteredPress?.(item.place);
            }}
          />
        )
      }
    />
  );
}

type DetailMode_Props = Extract<GymBottomSheetMode, { type: 'detail' }>;

function DetailMode({ mode }: { mode: DetailMode_Props }) {
  return (
    <View className="flex-1">
      <Pressable
        onPress={mode.onCloseDetail}
        accessibilityRole="button"
        accessibilityLabel="목록으로 돌아가기"
        className="flex-row items-center gap-1 px-4 py-3"
        style={pressedOpacity}
      >
        <MaterialIcons
          name="arrow-back"
          size={20}
          color={colors.text.secondary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <AppText className="font-medium text-body-sm text-text-secondary">목록</AppText>
      </Pressable>
      <GymDetail gym={mode.selectedGym} onPressMachine={mode.onPressMachine} />
    </View>
  );
}

function ListSeparator() {
  return <View className="h-3" />;
}
