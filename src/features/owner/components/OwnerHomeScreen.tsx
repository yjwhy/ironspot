import { Link } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { EmptyState } from '@/shared/components/EmptyState';
import { useQueue } from '@/shared/generated/owner/owner';
import { pressedOpacity } from '@/shared/lib/pressable';

import { groupQueueByGym, type OwnedGym } from '../lib/queue-grouping';

const QUEUE_LIMIT = 100;

export function OwnerHomeScreen() {
  const queueQuery = useQueue({ limit: QUEUE_LIMIT });

  if (queueQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (queueQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center px-6">
        <EmptyState
          icon="error-outline"
          title="목록을 불러올 수 없어요"
          description="잠시 후 다시 시도해 주세요"
        />
      </SafeAreaView>
    );
  }

  const queueItems = queueQuery.data?.data ?? [];
  const ownedGyms = groupQueueByGym(queueItems);

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="px-6 py-6 gap-2">
        <AppText className="text-headline font-bold text-text-primary">owner 도구</AppText>
        <AppText className="text-body text-text-secondary">
          내 매장의 신고 처리, 머신 관리, 사진 검증을 할 수 있어요.
        </AppText>
      </View>

      <View className="px-6 pb-4 gap-3">
        <Link href="/owner/queue" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="처리 대기 큐 열기"
            style={pressedOpacity}
            className="flex-row items-center justify-between rounded-lg bg-accent px-4 py-4"
          >
            <AppText className="text-body font-semibold text-white">처리 대기 큐</AppText>
            <AppText className="text-body-sm text-white/90">{queueItems.length}건</AppText>
          </Pressable>
        </Link>
      </View>

      <View className="px-6 pb-2">
        <AppText className="text-body-sm font-medium text-text-secondary">내 매장</AppText>
      </View>

      <FlatList
        data={ownedGyms}
        keyExtractor={(item) => item.gymId}
        renderItem={({ item }) => <OwnedGymRow gym={item} />}
        ListEmptyComponent={
          <View className="px-6 py-8 items-center">
            <AppText className="text-body-sm text-text-tertiary text-center">
              아직 처리할 신고가 없어요.{'\n'}매장 상세 화면에서 직접 진입할 수 있어요.
            </AppText>
          </View>
        }
        contentContainerClassName="px-6 pb-12 gap-3"
      />
    </SafeAreaView>
  );
}

function OwnedGymRow({ gym }: { gym: OwnedGym }) {
  return (
    <View className="rounded-lg bg-bg-elevated p-4 gap-2">
      <AppText className="text-body font-semibold text-text-primary">{gym.gymName}</AppText>
      {gym.pendingCount > 0 ? (
        <AppText className="text-body-sm text-amber-600">
          신고 {gym.pendingCount}건 처리 대기
        </AppText>
      ) : null}
      <View className="flex-row gap-2 pt-1">
        <Link href={{ pathname: '/owner/machines/[gym]', params: { gym: gym.gymId } }} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${gym.gymName} 머신 관리`}
            style={pressedOpacity}
            className="flex-1 rounded-md bg-bg-base py-2 items-center"
          >
            <AppText className="text-body-sm text-text-primary">머신</AppText>
          </Pressable>
        </Link>
        <Link href={{ pathname: '/owner/photos/[gym]', params: { gym: gym.gymId } }} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${gym.gymName} 사진 검증`}
            style={pressedOpacity}
            className="flex-1 rounded-md bg-bg-base py-2 items-center"
          >
            <AppText className="text-body-sm text-text-primary">사진</AppText>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
