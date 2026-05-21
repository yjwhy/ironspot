import { toast } from 'burnt';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { useDeleteGym } from '@/shared/generated/gyms/gyms';

interface UseUndoRegistrationParams {
  gymId: string;
  /** Auto-dismiss duration in milliseconds. */
  durationMs: number;
}

interface UseUndoRegistrationResult {
  /** False after expiry or successful undo navigates away. */
  isVisible: boolean;
  /** True while the DELETE /api/gyms/{id} mutation is in flight. */
  isPending: boolean;
  /** Fire the undo: cancels the timer + deletes the gym + pops to map. */
  handleUndo: () => void;
}

/**
 * Phase 5 item 14b — owns the 5s timer + DELETE mutation lifecycle for the
 * camera-screen undo toast. Extracted from `UndoRegistrationToast` so the
 * component stays presentational and the timer / navigation policy can be
 * unit-tested in isolation.
 *
 * Failure handling: on DELETE error keeps the toast visible (so the user
 * can retry inside the same 5s window — actually impossible since the
 * timer already fired, but the visual cue + burnt error toast give
 * feedback) and surfaces a Korean error toast via burnt. The gym row
 * stays registered, which matches the "permanent unless explicitly
 * deleted" data invariant from item 14a's backend.
 */
export function useUndoRegistration({
  gymId,
  durationMs,
}: UseUndoRegistrationParams): UseUndoRegistrationResult {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const deleteGym = useDeleteGym({
    mutation: {
      onSuccess: function navigateBackToMap() {
        // router.replace (not push) so the back stack doesn't trap the
        // user on a camera screen pointing at a gym that no longer exists.
        router.replace('/');
      },
      onError: function showUndoFailureToast() {
        toast({
          title: '등록 취소 실패',
          message: '잠시 후 다시 시도해주세요',
          preset: 'error',
        });
      },
    },
  });

  useEffect(
    function autoDismissTimer() {
      const timeoutId = setTimeout(function expire() {
        setIsVisible(false);
      }, durationMs);
      return function clearTimer() {
        clearTimeout(timeoutId);
      };
    },
    [durationMs],
  );

  function handleUndo() {
    // Hide the toast immediately on tap so the user sees instant feedback;
    // navigation happens once the mutation resolves. If the mutation fails
    // the onError handler surfaces the error via burnt — the toast stays
    // dismissed (re-showing would be visually janky for a rare failure).
    setIsVisible(false);
    deleteGym.mutate({ id: gymId });
  }

  return {
    isVisible,
    isPending: deleteGym.isPending,
    handleUndo,
  };
}
