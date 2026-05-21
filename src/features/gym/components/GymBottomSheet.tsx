import { MaterialIcons } from '@expo/vector-icons';
import { BottomSheetFlatList, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { toTestSlug } from '@/shared/lib/format';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

import { bottomSheetListItemKey, buildBottomSheetList } from '../lib/sort-bottom-sheet-list';
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
const BACKGROUND_STYLE = { backgroundColor: '#FFFFFF' };
const CONTENT_STYLE = { flex: 1 };
// Phase 5 hotfix 2026-05-21: tab bar (~49pt) + iPhone Plus safe-area bottom
// (~34pt) = ~83pt. We empirically observed `useBottomTabBarHeight()` returning
// ~7pt inside the bottom-sheet portal context, so we don't trust it as a
// dynamic source. The list reserves this fixed pad as bottom-of-content
// breathing room so the last card never sits flush against (or behind) the
// tab bar regardless of how gorhom positions the sheet itself.
const LIST_BOTTOM_PAD_FOR_TABS = 96;

const SKELETON_COUNT = 3;
const PRESENT_DELAY_MS = 300;
const SNAP_DELAY_MS = 50;

export function GymBottomSheet({ mode }: GymBottomSheetProps) {
  const ref = useRef<React.ComponentRef<typeof BottomSheetModal>>(null);
  // Phase 5 hotfix 2026-05-21: these hooks must be read in the parent (which
  // is mounted inside the Tab.Screen) — calling them from ListMode crashes
  // because BottomSheetView is portaled out of the tab navigator tree and
  // loses the bottom-tab context. We thread the values down as a prop.
  const tabBarHeight = useBottomTabBarHeight();
  const safeAreaInsets = useSafeAreaInsets();
  const listBottomPad = Math.max(
    LIST_BOTTOM_PAD_FOR_TABS,
    tabBarHeight + safeAreaInsets.bottom + LIST_PADDING,
  );
  // Phase 5 hotfix 2026-05-21: `useBottomTabBarHeight()` was observed
  // returning ~7pt on iPhone 16 Plus sim (likely a portal-context quirk),
  // so we floor the bottom inset to a safe constant (~83pt = tab bar 49
  // + iPhone Plus safe-area bottom ~34). This is what keeps the
  // BottomSheetModal from covering the "지도 / 마이" tab bar.
  const sheetBottomInset = Math.max(83, tabBarHeight + safeAreaInsets.bottom);

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
      // @gorhom/bottom-sheet v5 defaults `enableDynamicSizing={true}` which
      // tries to autosize the sheet to its child's measured height. When the
      // first render is the loading skeleton or an EmptyState that hasn't
      // measured yet, the sheet locks in at handle-only height (~24pt) and
      // refuses to expand even after content arrives. Forcing dynamic
      // sizing off pins the sheet to `snapPoints` regardless of content.
      enableDynamicSizing={false}
      // Phase 5 hotfix 2026-05-21: gorhom v5 normally locks the inner
      // scrollable until the sheet hits the EXTENDED snap. We saw on
      // iOS that this lock fired even at the 90% (max) snap — every
      // swipe-scroll bounced back to offset 0 (the "scroll happens
      // then jumps back to top" symptom). Force-UNLOCK by passing
      // `enableContentPanningGesture={false}` (per useScrollable.ts:
      // 42-44, that short-circuits the status to UNLOCKED regardless
      // of sheet state). Trade-off: swipe-up on a card no longer
      // expands the sheet from a mid snap — the user has to drag the
      // handle. Acceptable since the canonical UX never worked
      // reliably for this combo anyway.
      enableContentPanningGesture={false}
      bottomInset={sheetBottomInset}
      backdropComponent={undefined}
      backgroundStyle={BACKGROUND_STYLE}
    >
      {mode.type === 'detail' ? (
        <BottomSheetView style={CONTENT_STYLE}>
          <DetailMode mode={mode} />
        </BottomSheetView>
      ) : (
        <ListMode mode={mode} listBottomPad={listBottomPad} />
      )}
    </BottomSheetModal>
  );
}

type ListMode_Props = Extract<GymBottomSheetMode, { type: 'list' }>;

// Phase 5 item 20: three-way empty-state copy.
// Priority: NL search empty (user explicitly searched)
//        → filter-tuning (user actively narrowed and got 0)
//        → viewport-empty (default; data sparsity, not the user's fault).
function renderEmptyState(mode: ListMode_Props) {
  if (mode.nlEmpty !== undefined) {
    return (
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
    );
  }
  if (mode.hasActiveFilters) {
    return (
      <EmptyState
        icon="search-off"
        title="조건에 맞는 헬스장이 없어요"
        description="필터를 조정해보세요"
        action={<Button label="필터 초기화" variant="secondary" onPress={mode.onClearFilters} />}
      />
    );
  }
  return (
    <EmptyState
      icon="search-off"
      title="이 주변엔 아직 등록된 헬스장이 없어요"
      description="지도를 옮기거나 검색해보세요"
    />
  );
}

function ListMode({ mode, listBottomPad }: { mode: ListMode_Props; listBottomPad: number }) {
  const listContentStyle = {
    paddingTop: LIST_PADDING,
    paddingHorizontal: LIST_PADDING,
    paddingBottom: listBottomPad,
  };

  if (mode.isLoading) {
    return (
      <View className="gap-3 p-4">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <GymCardSkeleton key={i} />
        ))}
      </View>
    );
  }
  const items = buildBottomSheetList(mode.userLocation, mode.gyms, mode.unregisteredPlaces);
  if (items.length === 0) {
    return <View className="flex-1 p-4">{renderEmptyState(mode)}</View>;
  }
  // Phase 5 hotfix 2026-05-21: BottomSheetFlatList. After cycling
  // through FlashList + renderScrollComponent, plain RN ScrollView,
  // and BottomSheetScrollView (with and without BottomSheetView
  // wrapper, with `enableContentPanningGesture={true|false}`, with
  // 90% vs 100% top snap), none of them scrolled inside the modal
  // on iOS — every swipe in the card area was a no-op. The
  // deprecated-but-still-shipped `BottomSheetFlatList` is gorhom v5's
  // original integrated FlatList wrapper and is the only scroll
  // primitive in this lib that reliably hooks the touch path on iOS
  // simulator and device for this config. Lists here are ≤6 items so
  // FlatList's lack of recycler-style virtualization doesn't matter.
  return (
    <BottomSheetFlatList
      data={items}
      keyExtractor={bottomSheetListItemKey}
      contentContainerStyle={listContentStyle}
      ItemSeparatorComponent={ListSeparator}
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
            isPending={mode.pendingUnregisteredPlaceId === item.place.naverPlaceId}
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
