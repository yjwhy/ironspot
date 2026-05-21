import { Pressable } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';

import { useUndoRegistration } from '../hooks/useUndoRegistration';

/**
 * Phase 5 item 14b — 5-second undo affordance for the optimistic
 * unregistered-card-tap path. MapScreen fires `useCreateGym` immediately on
 * tap (Quick Reference §8 `undo-support` — trust the tap, provide escape
 * hatch instead of a confirmation modal). This toast surfaces on the
 * camera screen with the just-registered gym name + a "취소" button that
 * fires `DELETE /api/gyms/{id}` (item 14a / V9) and pops the user back to
 * the map.
 *
 * Lifecycle:
 *   - mounts when UploadPhotoScreen sees `justRegisteredGymId` +
 *     `justRegisteredGymName` route params (only present after the
 *     unregistered-card-tap path, not the FAB / gym-detail paths).
 *   - 5s timer via {@link useUndoRegistration}; user can cancel within the
 *     window. Past 5s the toast slides out and the gym row is final.
 *   - Tap "취소" fires `useDeleteGym` then `router.replace('/')`; on error
 *     keeps the gym + surfaces a burnt error toast (handled by the hook).
 */
export const UNDO_TOAST_DURATION_MS = 5000;
export const UNDO_TOAST_ENTER_EXIT_MS = 250;

interface UndoRegistrationToastProps {
  gymId: string;
  gymName: string;
  testID?: string;
}

export function UndoRegistrationToast({ gymId, gymName, testID }: UndoRegistrationToastProps) {
  const insets = useSafeAreaInsets();
  const { isVisible, isPending, handleUndo } = useUndoRegistration({
    gymId,
    durationMs: UNDO_TOAST_DURATION_MS,
  });

  if (!isVisible) return null;

  return (
    <Animated.View
      testID={testID ?? 'undo-registration-toast'}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      entering={SlideInUp.duration(UNDO_TOAST_ENTER_EXIT_MS)}
      exiting={SlideOutUp.duration(UNDO_TOAST_ENTER_EXIT_MS)}
      style={{ paddingTop: insets.top }}
      className="absolute left-0 right-0 top-0 z-50 bg-text-primary"
    >
      <Animated.View className="flex-row items-center justify-between px-4 py-3">
        <AppText className="mr-3 flex-1 text-body-sm text-text-inverse" numberOfLines={2}>
          {`"${gymName}"을(를) 등록했어요`}
        </AppText>
        <Pressable
          testID="undo-registration-toast-cancel"
          accessibilityRole="button"
          accessibilityLabel={`"${gymName}" 등록 취소`}
          accessibilityState={{ disabled: isPending }}
          disabled={isPending}
          onPress={handleUndo}
          hitSlop={8}
          className="h-9 justify-center px-3"
          style={({ pressed }) => ({ opacity: pressed || isPending ? 0.6 : 1 })}
        >
          <AppText className="text-body-sm font-medium text-accent-amber">
            {isPending ? '취소 중...' : '취소'}
          </AppText>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
