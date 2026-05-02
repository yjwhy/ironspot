import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { ANIMATION } from '@/shared/theme/tokens';

import { AppText } from './AppText';

const BANNER_COPY = '오프라인 상태입니다';

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <Animated.View
      testID="offline-banner"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      entering={SlideInUp.duration(ANIMATION.microDuration)}
      exiting={SlideOutUp.duration(ANIMATION.microDuration)}
      style={{ paddingTop: insets.top }}
      className="absolute left-0 right-0 top-0 z-50 bg-text-primary"
    >
      <AppText className="px-4 py-2 text-center text-body-sm text-text-inverse">
        {BANNER_COPY}
      </AppText>
    </Animated.View>
  );
}
