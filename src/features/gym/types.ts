import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
import type { GymWithMachineCount } from '@/shared/types/database';

export type GymBottomSheetMode =
  | {
      type: 'detail';
      selectedGym: GymWithMachineCount;
      onCloseDetail: () => void;
      onPressMachine: (gymMachineId: string) => void;
    }
  | {
      type: 'list';
      gyms: readonly GymWithMachineCount[];
      userLocation: Coordinate;
      isLoading: boolean;
      onSelectGym: (gymId: string) => void;
      onClearFilters: () => void;
    };
