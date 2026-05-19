import type { UnregisteredPlace } from '@/shared/generated/model';
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
       * Phase 5 item 20: branches the empty-state copy when `gyms` is empty.
       * `true` (filters active) → "조건에 맞는 헬스장이 없어요 / 필터를 조정해보세요"
       * + 필터 초기화 button (recovery via filter reset).
       * `false`/omitted (default) → "이 주변엔 아직 등록된 헬스장이 없어요 /
       * 지도를 옮기거나 검색해보세요" with no button (recovery via map / search).
       * Optional + default `false` is the safe fallback so callers that
       * forget to pass the flag never regress into the misleading
       * filter-tuning copy.
       */
      hasActiveFilters?: boolean;
      /**
       * F7 NL search Naver merge — Naver places not yet registered as IronSpot
       * gyms. Bottom sheet interleaves these with `gyms` ordered by distance
       * (Q5 mixing). Empty/undefined for filter-mode and for filtered NL
       * queries where Naver merge is suppressed.
       */
      unregisteredPlaces?: readonly UnregisteredPlace[];
      /** Called when the user taps an unregistered place card — routes to
       * the upload flow with the place pre-filled so the user can become
       * the first registrant. */
      onUnregisteredPress?: (place: UnregisteredPlace) => void;
      /**
       * NL Search 0-result fallback. When present and BOTH `gyms` and
       * `unregisteredPlaces` are empty, the bottom sheet renders an
       * NL-specific empty state instead of the default "필터를 조정해보세요".
       * The map (MapScreen) is the caller that wires this.
       */
      nlEmpty?: {
        subtitle: string;
        onRelaxFilters: () => void;
      };
    };
