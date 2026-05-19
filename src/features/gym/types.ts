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
      /**
       * `true` iff the user has explicitly selected at least one brand /
       * category / template / loadingType filter. Distinguishes "filtered
       * empty" (user-induced) from "no data in this area" (auto map-bound
       * load on app open). The bottom sheet renders different empty-state
       * copy + CTA for each case so the auto-load empty state doesn't
       * misleadingly tell the user to "adjust filters" before they have set
       * any.
       */
      hasActiveFilters: boolean;
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
