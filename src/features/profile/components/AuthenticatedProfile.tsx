import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { AppText } from '@/shared/components/AppText';
import { formatVerifiedDate } from '@/shared/lib/format';
import { colors } from '@/shared/theme/tokens';

import { ProfileMenuRow } from './ProfileMenuRow';
import { useLogout } from '../hooks/useLogout';
import { useMyPhotos } from '../hooks/useMyPhotos';
import { useMyVotes } from '../hooks/useMyVotes';
import { PROFILE_ROUTES } from '../routes';

export const AVATAR_SIZE = 64;
const AVATAR_ICON_SIZE = 32;

function formatCount(count: number | undefined): string {
  return `${String(count ?? 0)}장`;
}

function navigateToMyPhotos() {
  router.push(PROFILE_ROUTES.myPhotos);
}

function navigateToMyVotes() {
  router.push(PROFILE_ROUTES.myVotes);
}

export function AuthenticatedProfile() {
  const userQuery = useCurrentUser();
  const myPhotos = useMyPhotos();
  const myVotes = useMyVotes();
  const { handleLogout, isPending: isLogoutPending } = useLogout();

  const user = userQuery.data;
  const joinDate = user?.createdAt;
  const joinDateLabel = joinDate ? formatVerifiedDate(joinDate) : '';

  function onLogoutPress() {
    void handleLogout();
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View
        className="items-center py-6 gap-2 border-b border-border-DEFAULT"
        testID="profile-header"
      >
        <View
          className="rounded-full bg-bg-muted items-center justify-center"
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        >
          <MaterialIcons
            name="person"
            size={AVATAR_ICON_SIZE}
            color={colors.text.tertiary}
            importantForAccessibility="no"
            accessibilityElementsHidden={true}
          />
        </View>
        <AppText className="text-heading-sm font-semibold text-text-primary">
          {user?.nickname ?? ''}
        </AppText>
        {joinDateLabel ? (
          <AppText className="text-body-sm text-text-tertiary">{`가입일: ${joinDateLabel}`}</AppText>
        ) : null}
      </View>

      <ProfileMenuRow
        testID="profile-menu-my-photos"
        icon="photo-library"
        label="내가 올린 사진"
        badge={formatCount(myPhotos.data?.length)}
        onPress={navigateToMyPhotos}
      />
      <ProfileMenuRow
        testID="profile-menu-my-votes"
        icon="favorite"
        label="내가 추천한 사진"
        badge={formatCount(myVotes.data?.length)}
        onPress={navigateToMyVotes}
      />

      <View className="border-t border-border-DEFAULT mt-4" />

      <ProfileMenuRow
        testID="profile-menu-logout"
        icon="logout"
        label="로그아웃"
        onPress={onLogoutPress}
        disabled={isLogoutPending}
        showChevron={false}
      />
    </SafeAreaView>
  );
}
