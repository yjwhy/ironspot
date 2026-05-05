import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet, {
  BottomSheetView,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { haversineKm } from '@/shared/lib/geo';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';
import type { GymWithMachineCount } from '@/shared/types/database';

import type { GymBottomSheetMode } from '../types';
import { GymCard } from './GymCard';
import { GymCardSkeleton } from './GymCardSkeleton';
import { GymDetail } from './GymDetail';

export type { GymBottomSheetMode };

interface GymBottomSheetProps {
  mode: GymBottomSheetMode;
}

const SNAP_POINTS = ['10%', '50%', '90%'];

const LIST_PADDING = 16;
const LIST_CONTENT_STYLE = { padding: LIST_PADDING };

const SKELETON_COUNT = 3;

export function GymBottomSheet({ mode }: GymBottomSheetProps) {
  return (
    <BottomSheet snapPoints={SNAP_POINTS} index={1}>
      <BottomSheetView className="flex-1">
        {mode.type === 'detail' ? <DetailMode mode={mode} /> : <ListMode mode={mode} />}
      </BottomSheetView>
    </BottomSheet>
  );
}

type ListMode_Props = Extract<GymBottomSheetMode, { type: 'list' }>;

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
  return (
    <FlashList
      renderScrollComponent={renderScrollComponent}
      data={mode.gyms}
      keyExtractor={keyById}
      contentContainerStyle={LIST_CONTENT_STYLE}
      ItemSeparatorComponent={ListSeparator}
      ListEmptyComponent={
        <EmptyState
          icon="search-off"
          title="조건에 맞는 헬스장이 없어요"
          description="필터를 조정해보세요"
          action={<Button label="필터 초기화" variant="secondary" onPress={mode.onClearFilters} />}
        />
      }
      renderItem={({ item, index }) => (
        <GymCard
          gym={item}
          distanceKm={haversineKm(mode.userLocation, {
            latitude: item.latitude,
            longitude: item.longitude,
          })}
          index={index}
          onPress={() => {
            mode.onSelectGym(item.id);
          }}
        />
      )}
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

function keyById(item: GymWithMachineCount): string {
  return item.id;
}
