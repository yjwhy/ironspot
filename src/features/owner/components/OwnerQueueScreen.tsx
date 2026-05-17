import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import type { OwnerQueueItem } from '@/shared/generated/model';
import { useDispose, useQueue, getQueueQueryKey } from '@/shared/generated/owner/owner';
import { pressedOpacity } from '@/shared/lib/pressable';
import { captureError } from '@/shared/lib/sentry';

const QUEUE_LIMIT = 100;

export function OwnerQueueScreen() {
  const queueQuery = useQueue({ limit: QUEUE_LIMIT });
  const disposeMutation = useDispose();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<OwnerQueueItem | null>(null);

  async function handleDispose(disposition: 'actioned' | 'dismissed') {
    if (selected === null) return;
    try {
      await disposeMutation.mutateAsync({
        id: selected.reportId,
        data: { disposition },
      });
      burnt.toast({
        title: disposition === 'actioned' ? '처리 완료' : '기각 처리',
        preset: 'done',
      });
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: getQueueQueryKey({ limit: QUEUE_LIMIT }) });
    } catch (err) {
      captureError(err);
      burnt.toast({ title: '처리에 실패했어요', preset: 'error' });
    }
  }

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
        <EmptyState icon="error-outline" title="큐를 불러올 수 없어요" />
      </SafeAreaView>
    );
  }

  const items = queueQuery.data?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="px-6 py-4">
        <AppText className="text-headline font-bold text-text-primary">처리 대기 큐</AppText>
        <AppText className="text-body-sm text-text-secondary">{items.length}건 대기 중</AppText>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.reportId}
        renderItem={({ item }) => <QueueRow item={item} onSelect={setSelected} />}
        ListEmptyComponent={
          <View className="px-6 py-12">
            <EmptyState icon="check-circle-outline" title="처리할 신고가 없어요" />
          </View>
        }
        contentContainerClassName="px-6 pb-12 gap-3"
      />

      {selected !== null ? (
        <DisposeSheet
          item={selected}
          isPending={disposeMutation.isPending}
          onActioned={() => {
            void handleDispose('actioned');
          }}
          onDismissed={() => {
            void handleDispose('dismissed');
          }}
          onCancel={() => {
            setSelected(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

interface QueueRowProps {
  item: OwnerQueueItem;
  onSelect: (item: OwnerQueueItem) => void;
}

function QueueRow({ item, onSelect }: QueueRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label} 처리하기`}
      onPress={() => {
        onSelect(item);
      }}
      style={pressedOpacity}
      className="rounded-lg bg-bg-elevated p-4 gap-1"
    >
      <View className="flex-row items-center justify-between">
        <AppText className="text-body font-semibold text-text-primary" numberOfLines={1}>
          {item.label}
        </AppText>
        <AppText className="text-caption text-text-tertiary">{item.gymName}</AppText>
      </View>
      <AppText className="text-body-sm text-amber-600">{item.reason}</AppText>
      {typeof item.detail === 'string' && item.detail.length > 0 ? (
        <AppText className="text-body-sm text-text-secondary" numberOfLines={2}>
          {item.detail}
        </AppText>
      ) : null}
    </Pressable>
  );
}

interface DisposeSheetProps {
  item: OwnerQueueItem;
  isPending: boolean;
  onActioned: () => void;
  onDismissed: () => void;
  onCancel: () => void;
}

function DisposeSheet({ item, isPending, onActioned, onDismissed, onCancel }: DisposeSheetProps) {
  return (
    <View testID="dispose-sheet" className="absolute inset-0 bg-black/50 items-center justify-end">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onCancel}
        className="absolute inset-0"
      />
      <View className="w-full rounded-t-2xl bg-bg-base p-6 gap-3">
        <AppText className="text-body font-semibold text-text-primary">{item.label}</AppText>
        <AppText className="text-body-sm text-text-secondary">{item.reason}</AppText>
        <Button
          label="조치하기 (신고 인정)"
          variant="primary"
          onPress={onActioned}
          loading={isPending}
        />
        <Button
          label="기각하기 (문제 없음)"
          variant="secondary"
          onPress={onDismissed}
          loading={isPending}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="취소"
          onPress={onCancel}
          style={pressedOpacity}
          className="items-center py-2"
        >
          <AppText className="text-body-sm text-text-tertiary">취소</AppText>
        </Pressable>
      </View>
    </View>
  );
}
