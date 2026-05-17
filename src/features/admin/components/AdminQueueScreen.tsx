import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/shared/components/EmptyState';
import type { AdminQueueItem } from '@/shared/generated/model/adminQueueItem';
import { formatRelativeKo } from '@/shared/lib/format';

import { useAdminQueue } from '../hooks/useAdminQueue';
import { ADMIN_ROUTES } from '../routes';

const QUEUE_TITLE = '신고 대기 큐';
const EMPTY_TITLE = '처리 대기 신고 없음';
const EMPTY_DESCRIPTION = '모든 신고가 처리되었어요';
const LOADING_TITLE = '불러오는 중…';
const ERROR_TITLE = '신고 큐를 불러오지 못했어요';

const THUMB_SIZE = 56;

function keyByTarget(item: AdminQueueItem) {
  return `${item.type}:${item.targetId}`;
}

function navigateToItem(item: AdminQueueItem) {
  if (item.type === 'photo') {
    router.push(ADMIN_ROUTES.photo(item.targetId));
    return;
  }
  router.push(ADMIN_ROUTES.gymMachine(item.targetId));
}

export function AdminQueueScreen() {
  const { data, isLoading, isError } = useAdminQueue();

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base">
        <Header />
        <EmptyState icon="error-outline" title={ERROR_TITLE} />
      </SafeAreaView>
    );
  }
  if (isLoading || data === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base">
        <Header />
        <EmptyState icon="hourglass-empty" title={LOADING_TITLE} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <Header />
      <FlashList
        data={data}
        keyExtractor={keyByTarget}
        ItemSeparatorComponent={QueueSeparator}
        ListEmptyComponent={
          <EmptyState icon="inbox" title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />
        }
        renderItem={renderQueueRow}
      />
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View className="border-b border-border px-4 py-3">
      <Text className="text-lg font-semibold text-text-primary">{QUEUE_TITLE}</Text>
    </View>
  );
}

function QueueSeparator() {
  return <View className="h-px bg-border-base" />;
}

function renderQueueRow({ item }: { item: AdminQueueItem }) {
  return <QueueRow item={item} />;
}

function QueueRow({ item }: { item: AdminQueueItem }) {
  const imageUrl = item.type === 'photo' ? item.imageUrl : undefined;
  return (
    <Pressable
      testID={`admin-queue-row-${item.type}-${item.targetId}`}
      onPress={() => {
        navigateToItem(item);
      }}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-bg-elevated"
    >
      {imageUrl !== undefined ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 8 }}
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
          className="items-center justify-center rounded-lg bg-bg-muted"
        >
          <Text className="text-xs text-text-secondary">머신</Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-base font-medium text-text-primary" numberOfLines={1}>
          {item.label} · 신고 {item.pendingReportCount}건
        </Text>
        <Text className="text-sm text-text-secondary">
          {item.topReason} · {formatRelativeKo(item.oldestReportAt)}
        </Text>
      </View>
      <Text className="text-text-secondary">›</Text>
    </Pressable>
  );
}
