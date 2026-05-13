import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/shared/components/EmptyState';
import { formatRelativeKo } from '@/shared/lib/format';

import { useAdminQueue } from '../hooks/useAdminQueue';
import { ADMIN_ROUTES } from '../routes';

const QUEUE_TITLE = '신고 대기 사진';
const EMPTY_TITLE = '처리 대기 신고 없음';
const EMPTY_DESCRIPTION = '모든 신고가 처리되었어요';
const LOADING_TITLE = '불러오는 중…';
const ERROR_TITLE = '신고 큐를 불러오지 못했어요';

interface QueueItem {
  photoId: string;
  photoUrl: string;
  pendingReportCount: number;
  oldestReportAt: string;
  topReason: string;
}

const THUMB_SIZE = 56;

function keyByPhotoId(item: QueueItem) {
  return item.photoId;
}

function navigateToPhoto(photoId: string) {
  router.push(ADMIN_ROUTES.photo(photoId));
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

  const items: QueueItem[] = data.map(toQueueItem);

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <Header />
      <FlashList
        data={items}
        keyExtractor={keyByPhotoId}
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

function renderQueueRow({ item }: { item: QueueItem }) {
  return <QueueRow item={item} />;
}

function QueueRow({ item }: { item: QueueItem }) {
  return (
    <Pressable
      testID={`admin-queue-row-${item.photoId}`}
      onPress={() => {
        navigateToPhoto(item.photoId);
      }}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-bg-elevated"
    >
      <Image
        source={{ uri: item.photoUrl }}
        style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 8 }}
        cachePolicy="memory-disk"
      />
      <View className="flex-1">
        <Text className="text-base font-medium text-text-primary">
          신고 {item.pendingReportCount}건 · {item.topReason}
        </Text>
        <Text className="text-sm text-text-secondary">{formatRelativeKo(item.oldestReportAt)}</Text>
      </View>
      <Text className="text-text-secondary">›</Text>
    </Pressable>
  );
}

function toQueueItem(row: {
  photoId?: string;
  photoUrl?: string;
  pendingReportCount?: number;
  oldestReportAt?: string;
  topReason?: string;
}): QueueItem {
  return {
    photoId: row.photoId ?? '',
    photoUrl: row.photoUrl ?? '',
    pendingReportCount: row.pendingReportCount ?? 0,
    oldestReportAt: row.oldestReportAt ?? new Date().toISOString(),
    topReason: row.topReason ?? '',
  };
}
