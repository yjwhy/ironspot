import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { useQueue } from '@/shared/generated/owner/owner';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

import { PROFILE_ROUTES } from '../routes';

const QUEUE_PREVIEW_LIMIT = 1;

// E4 (ADR 0023 Q6): owner activity card. Surfaces a pending-queue count so the
// owner does not need to navigate into /owner just to know if anything is
// waiting. Tapping the card routes to the owner home. Hidden for non-owner
// roles (the AuthenticatedProfile parent gates rendering on user.role).
export function OwnerActivityWidget() {
  const queueQuery = useQueue({ limit: QUEUE_PREVIEW_LIMIT });
  const pendingCount = queueQuery.data?.data.length ?? 0;
  const hasPending = pendingCount > 0;

  function handlePress() {
    router.push(PROFILE_ROUTES.ownerHome);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="owner 도구로 이동"
      onPress={handlePress}
      style={pressedOpacity}
      testID="owner-activity-widget"
      className="mx-4 mt-4 rounded-lg bg-bg-elevated p-4 flex-row items-center gap-3"
    >
      <View className="h-10 w-10 rounded-full bg-accent/15 items-center justify-center">
        <MaterialIcons
          name="store"
          size={20}
          color={colors.accent.DEFAULT}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
      </View>
      <View className="flex-1">
        <AppText className="text-body font-semibold text-text-primary">매장 owner 도구</AppText>
        {hasPending ? (
          <AppText className="text-body-sm text-amber-600">처리 대기 중인 신고가 있어요</AppText>
        ) : (
          <AppText className="text-body-sm text-text-tertiary">처리할 작업이 없어요</AppText>
        )}
      </View>
      <MaterialIcons
        name="chevron-right"
        size={20}
        color={colors.text.tertiary}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}
