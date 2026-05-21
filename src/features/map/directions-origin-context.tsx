import { useActionSheet } from '@expo/react-native-action-sheet';
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

import type { DirectionsOrigin } from '@/shared/lib/directions';

/**
 * Phase 5 item 16 slice c: shared origin-resolution boundary between
 * MapScreen (which knows whether an NL search resolved a reference
 * point) and the DirectionsChip (which fires `openDirections`).
 *
 * When the user has an active NL result whose `resolvedLocation`
 * carries a human-readable reference point ("강남역", "서울대학교"),
 * the chip's first tap of the NL session asks "현재 위치에서 / X에서"
 * via an ActionSheet and remembers the choice for the rest of the
 * session. Subsequent taps within the same NL session use the
 * remembered origin without re-prompting (Q1 locked: per-NL-search
 * session boundary).
 *
 * No active NL reference → the resolver returns `undefined` and the
 * directions lib lets Naver Maps default to the device's last-known
 * location.
 */

export interface NlReferenceOrigin {
  /** Stable identifier for the NL search session — when this changes the
   * remembered choice resets. The MapScreen wires the NL response's
   * resolvedLocation lat/lng concatenation as the id, so a re-search to a
   * different reference point creates a fresh ActionSheet prompt. */
  readonly id: string;
  /** Display name surfaced inside the ActionSheet ("강남역에서" copy is
   * derived from this). */
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

interface DirectionsOriginContextValue {
  /**
   * Resolve the origin to feed `openDirections({ origin })` based on the
   * current NL state + the user's remembered choice. May open an
   * ActionSheet on first call of the NL session; subsequent calls within
   * the same session resolve synchronously from cache.
   */
  resolveOrigin: () => Promise<DirectionsOrigin | undefined>;
}

const DirectionsOriginContext = createContext<DirectionsOriginContextValue>({
  resolveOrigin: () => Promise.resolve(undefined),
});

interface DirectionsOriginProviderProps {
  reference: NlReferenceOrigin | null;
  children: ReactNode;
}

type ChoiceKind = 'gps' | 'reference';

export function DirectionsOriginProvider({ reference, children }: DirectionsOriginProviderProps) {
  const { showActionSheetWithOptions } = useActionSheet();
  // Choice cache, keyed by NlReferenceOrigin.id. A new NL session (different
  // id) automatically invalidates because the key changes — no explicit
  // reset wiring needed.
  const choiceRef = useRef<{ id: string; kind: ChoiceKind } | null>(null);

  const resolveOrigin = useCallback((): Promise<DirectionsOrigin | undefined> => {
    if (reference === null) {
      // No reference → always GPS (Naver Maps picks device location).
      return Promise.resolve(undefined);
    }

    const cached = choiceRef.current;
    if (cached !== null && cached.id === reference.id) {
      return Promise.resolve(
        cached.kind === 'reference'
          ? { latitude: reference.latitude, longitude: reference.longitude }
          : undefined,
      );
    }

    // First tap of this NL session → ask the user.
    return new Promise((resolve) => {
      const referenceLabel = `${reference.name}에서`;
      const options = ['현재 위치에서', referenceLabel, '취소'];
      const cancelButtonIndex = 2;
      showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: '출발지 선택',
        },
        (selectedIndex) => {
          if (selectedIndex === undefined || selectedIndex === cancelButtonIndex) {
            resolve(undefined);
            return;
          }
          const kind: ChoiceKind = selectedIndex === 0 ? 'gps' : 'reference';
          choiceRef.current = { id: reference.id, kind };
          resolve(
            kind === 'reference'
              ? { latitude: reference.latitude, longitude: reference.longitude }
              : undefined,
          );
        },
      );
    });
  }, [reference, showActionSheetWithOptions]);

  const value = useMemo<DirectionsOriginContextValue>(() => ({ resolveOrigin }), [resolveOrigin]);

  return (
    <DirectionsOriginContext.Provider value={value}>{children}</DirectionsOriginContext.Provider>
  );
}

export function useDirectionsOriginResolver(): DirectionsOriginContextValue['resolveOrigin'] {
  return useContext(DirectionsOriginContext).resolveOrigin;
}
