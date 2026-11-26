import { useEffect, useState } from 'react';

import { ANIMATION } from '@/shared/theme/tokens';
import type { GymWithMachineCount } from '@/shared/types/database';

export function useMarkerReveal(gyms: readonly GymWithMachineCount[]) {
  const [visibleMarkerIds, setVisibleMarkerIds] = useState<readonly string[]>([]);

  useEffect(
    function staggerRevealMarkers() {
      if (gyms.length === 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset before staggering markers back in via the timers below
        setVisibleMarkerIds([]);
        return;
      }
      setVisibleMarkerIds([]);
      const ids = gyms.map((g) => g.id);
      const timers = ids.map((id, i) =>
        setTimeout(() => {
          setVisibleMarkerIds((prev) => [...prev, id]);
        }, i * ANIMATION.stagger),
      );
      return () => {
        timers.forEach(clearTimeout);
      };
    },
    [gyms],
  );

  return { visibleMarkerIds };
}
