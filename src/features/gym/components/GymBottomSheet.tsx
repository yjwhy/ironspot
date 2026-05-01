import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetFlashList, BottomSheetView } from '@gorhom/bottom-sheet';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { EmptyState } from '@/shared/components/EmptyState';
import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
import { haversineKm } from '@/shared/lib/geo';
import { colors } from '@/shared/theme/tokens';
import type { GymWithMachineCount } from '@/shared/types/database';

import { GymCard } from './GymCard';
import { GymDetail } from './GymDetail';

interface GymBottomSheetProps {
  gyms: readonly GymWithMachineCount[];
  userLocation: Coordinate;
  selectedGym: GymWithMachineCount | null;
  onSelectGym: (gymId: string) => void;
  onCloseDetail: () => void;
  onPressMachine: (gymMachineId: string) => void;
}

const SNAP_POINTS = ['10%', '50%', '90%'];

const LIST_CONTENT_STYLE = { padding: 16 };

export function GymBottomSheet(props: GymBottomSheetProps) {
  return (
    <BottomSheet snapPoints={SNAP_POINTS} index={1}>
      <BottomSheetView className="flex-1">
        {props.selectedGym ? (
          <DetailMode
            selectedGym={props.selectedGym}
            onCloseDetail={props.onCloseDetail}
            onPressMachine={props.onPressMachine}
          />
        ) : (
          <ListMode
            gyms={props.gyms}
            userLocation={props.userLocation}
            onSelectGym={props.onSelectGym}
          />
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

interface ListModeProps {
  gyms: readonly GymWithMachineCount[];
  userLocation: Coordinate;
  onSelectGym: (gymId: string) => void;
}

function ListMode({ gyms, userLocation, onSelectGym }: ListModeProps) {
  return (
    <BottomSheetFlashList
      data={gyms}
      keyExtractor={keyById}
      estimatedItemSize={120}
      contentContainerStyle={LIST_CONTENT_STYLE}
      ItemSeparatorComponent={ListSeparator}
      ListEmptyComponent={
        <EmptyState
          icon="search-off"
          title="주변에 헬스장이 없어요"
          description="검색 영역을 옮겨보세요"
        />
      }
      renderItem={({ item, index }) => (
        <GymCard
          gym={item}
          distanceKm={haversineKm(userLocation, {
            latitude: item.latitude,
            longitude: item.longitude,
          })}
          index={index}
          onPress={() => {
            onSelectGym(item.id);
          }}
        />
      )}
    />
  );
}

interface DetailModeProps {
  selectedGym: GymWithMachineCount;
  onCloseDetail: () => void;
  onPressMachine: (gymMachineId: string) => void;
}

function DetailMode({ selectedGym, onCloseDetail, onPressMachine }: DetailModeProps) {
  return (
    <View className="flex-1">
      <Pressable
        onPress={onCloseDetail}
        accessibilityRole="button"
        accessibilityLabel="목록으로 돌아가기"
        className="flex-row items-center gap-1 px-4 py-3"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
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
      <GymDetail gym={selectedGym} onPressMachine={onPressMachine} />
    </View>
  );
}

function ListSeparator() {
  return <View className="h-3" />;
}

function keyById(item: GymWithMachineCount): string {
  return item.id;
}
