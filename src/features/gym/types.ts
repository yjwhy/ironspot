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
      /**
       * NL Search 0-result fallback. When present and `gyms` is empty, the bottom
       * sheet renders an NL-specific empty state instead of the default
       * "필터를 조정해보세요". The map (MapScreen) is the caller that wires this.
       */
      nlEmpty?: {
        subtitle: string;
        onRelaxFilters: () => void;
      };
    };
