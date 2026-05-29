import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { AppText } from '@/shared/components/AppText';
import { formatVerifiedDate } from '@/shared/lib/format';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

import { OwnerActivityWidget } from './OwnerActivityWidget';
import { ProfileMenuRow } from './ProfileMenuRow';
import { ProfilePhotoStrip } from './ProfilePhotoStrip';
import { CardDivider, ProfileSection } from './ProfileSection';
import { useLogout } from '../hooks/useLogout';
import { useMyPhotos } from '../hooks/useMyPhotos';
import { useMyVotes } from '../hooks/useMyVotes';
import { PROFILE_ROUTES } from '../routes';

export const AVATAR_SIZE = 64;
const AVATAR_ICON_SIZE = 32;
const LOGOUT_ICON_SIZE = 20;
const SCROLL_BOTTOM_PADDING = 40;

function formatCount(count: number | undefined): string {
  return `${String(count ?? 0)}장`;
}

function navigateToMyPhotos() {
  router.push(PROFILE_ROUTES.myPhotos);
}

function navigateToMyVotes() {
  router.push(PROFILE_ROUTES.myVotes);
}

function navigateToAccountSettings() {
  router.push(PROFILE_ROUTES.accountSettings);
}

function navigateToOwnerHome() {
  router.push(PROFILE_ROUTES.ownerHome);
}

function navigateToMyReports() {
  router.push(PROFILE_ROUTES.myReports);
}

export function AuthenticatedProfile() {
  const userQuery = useCurrentUser();
  const myPhotos = useMyPhotos();
  const myVotes = useMyVotes();
  const { handleLogout, isPending: isLogoutPending } = useLogout();

  const user = userQuery.data;
  const isStaff = user?.role === 'owner' || user?.role === 'admin';
  const photos = myPhotos.data ?? [];

  function onLogoutPress() {
    void handleLogout();
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-subtle" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader nickname={user?.nickname ?? ''} createdAt={user?.createdAt} />

        {isStaff ? <OwnerActivityWidget /> : null}

        <ProfileSection title="내 활동">
          <ProfileMenuRow
            testID="profile-menu-my-photos"
            icon="photo-library"
            label="내가 올린 사진"
            badge={formatCount(myPhotos.data?.length)}
            onPress={navigateToMyPhotos}
            showChevron={photos.length === 0}
          />
          <ProfilePhotoStrip photos={photos} />
          <CardDivider />
          <ProfileMenuRow
            testID="profile-menu-my-votes"
            icon="favorite"
            label="내가 추천한 사진"
            badge={formatCount(myVotes.data?.length)}
            onPress={navigateToMyVotes}
          />
          <CardDivider />
          <ProfileMenuRow
            testID="profile-menu-my-reports"
            icon="flag"
            label="내가 한 신고들"
            onPress={navigateToMyReports}
          />
          {isStaff ? (
            <>
              <CardDivider />
              <ProfileMenuRow
                testID="profile-menu-owner-home"
                icon="store"
                label="내 매장 관리하기"
                onPress={navigateToOwnerHome}
              />
            </>
          ) : null}
        </ProfileSection>

        <ProfileSection title="계정">
          <ProfileMenuRow
            testID="profile-menu-account-settings"
            icon="settings"
            label="계정 설정"
            onPress={navigateToAccountSettings}
          />
        </ProfileSection>

        <LogoutButton onPress={onLogoutPress} disabled={isLogoutPending} />
      </ScrollView>
    </SafeAreaView>
  );
}

interface ProfileHeaderProps {
  nickname: string;
  createdAt: string | undefined;
}

function ProfileHeader({ nickname, createdAt }: ProfileHeaderProps) {
  const joinDateLabel = createdAt ? formatVerifiedDate(createdAt) : '';
  return (
    <View className="items-center gap-2 py-8" testID="profile-header">
      <View
        className="items-center justify-center rounded-full bg-bg-elevated"
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
      <AppText className="text-heading-sm font-semibold text-text-primary">{nickname}</AppText>
      {joinDateLabel ? (
        <AppText className="text-body-sm text-text-tertiary">{`가입일: ${joinDateLabel}`}</AppText>
      ) : null}
    </View>
  );
}

interface LogoutButtonProps {
  onPress: () => void;
  disabled: boolean;
}

function LogoutButton({ onPress, disabled }: LogoutButtonProps) {
  return (
    <Pressable
      testID="profile-menu-logout"
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="로그아웃"
      accessibilityState={{ disabled }}
      style={pressedOpacity}
      className="mx-4 mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-bg-elevated py-4"
    >
      <MaterialIcons
        name="logout"
        size={LOGOUT_ICON_SIZE}
        color={colors.error}
        importantForAccessibility="no"
        accessibilityElementsHidden={true}
      />
      <AppText className="text-body font-medium text-error">로그아웃</AppText>
    </Pressable>
  );
}
