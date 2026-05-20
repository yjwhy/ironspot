import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { EmptyState } from '@/shared/components/EmptyState';
import { useListMachines, getListMachinesQueryKey } from '@/shared/generated/machines/machines';
import { useDelete } from '@/shared/generated/owner/owner';
import { pressedOpacity } from '@/shared/lib/pressable';
import { captureError } from '@/shared/lib/sentry';
import { gymMachineDisplayName } from '@/shared/lib/template-display-name';

export function OwnerMachinesScreen() {
  const params = useLocalSearchParams<{ gym: string }>();
  const gymId = params.gym;
  const machinesQuery = useListMachines(gymId);
  const deleteMutation = useDelete();
  const queryClient = useQueryClient();
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  async function handleConfirmDelete(machineId: string) {
    try {
      await deleteMutation.mutateAsync({ id: machineId });
      burnt.toast({ title: '머신을 삭제했어요', preset: 'done' });
      await queryClient.invalidateQueries({ queryKey: getListMachinesQueryKey(gymId) });
    } catch (err) {
      captureError(err);
      burnt.toast({ title: '삭제에 실패했어요', preset: 'error' });
    } finally {
      setConfirmingDeleteId(null);
    }
  }

  if (machinesQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (machinesQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center px-6">
        <EmptyState icon="error-outline" title="머신을 불러올 수 없어요" />
      </SafeAreaView>
    );
  }

  const machines = machinesQuery.data?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="px-6 py-4 flex-row items-center justify-between">
        <AppText className="text-headline font-bold text-text-primary">머신 관리</AppText>
        <Link href={{ pathname: '/owner/machines/[gym]/new', params: { gym: gymId } }} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="머신 추가"
            style={pressedOpacity}
            className="rounded-md bg-accent px-3 py-2"
          >
            <AppText className="text-body-sm font-medium text-white">+ 추가</AppText>
          </Pressable>
        </Link>
      </View>

      <FlatList
        data={machines}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="rounded-lg bg-bg-elevated p-4 gap-2">
            <AppText className="text-body font-semibold text-text-primary">
              {`${item.brandName ?? ''} ${gymMachineDisplayName(item) || '머신'}`}
            </AppText>
            <AppText className="text-body-sm text-text-secondary">수량 {item.quantity}대</AppText>
            <View className="flex-row gap-2 pt-1">
              <Link
                href={{
                  pathname: '/owner/machines/[gym]/[id]',
                  params: { gym: gymId, id: item.id },
                }}
                asChild
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="수정"
                  style={pressedOpacity}
                  className="flex-1 rounded-md bg-bg-base py-2 items-center"
                >
                  <AppText className="text-body-sm text-text-primary">수정</AppText>
                </Pressable>
              </Link>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="삭제"
                onPress={() => {
                  setConfirmingDeleteId(item.id);
                }}
                style={pressedOpacity}
                className="flex-1 rounded-md bg-red-50 py-2 items-center"
              >
                <AppText className="text-body-sm text-red-600">삭제</AppText>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="px-6 py-12">
            <EmptyState
              icon="inbox"
              title="등록된 머신이 없어요"
              description="+ 추가 버튼으로 시작해 보세요"
            />
          </View>
        }
        contentContainerClassName="px-6 pb-12 gap-3"
      />

      {confirmingDeleteId !== null ? (
        <ConfirmDeleteSheet
          isPending={deleteMutation.isPending}
          onConfirm={() => {
            void handleConfirmDelete(confirmingDeleteId);
          }}
          onCancel={() => {
            setConfirmingDeleteId(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

interface ConfirmDeleteSheetProps {
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDeleteSheet({ isPending, onConfirm, onCancel }: ConfirmDeleteSheetProps) {
  return (
    <View
      testID="confirm-delete-sheet"
      className="absolute inset-0 bg-black/50 items-center justify-end"
    >
      <Pressable accessibilityLabel="취소" onPress={onCancel} className="absolute inset-0" />
      <View className="w-full rounded-t-2xl bg-bg-base p-6 gap-3">
        <AppText className="text-body font-semibold text-text-primary">머신을 삭제할까요?</AppText>
        <AppText className="text-body-sm text-text-secondary">
          소프트 삭제예요. 운영자에게 요청하면 복구할 수 있어요.
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="삭제 확인"
          onPress={onConfirm}
          disabled={isPending}
          style={pressedOpacity}
          className="rounded-md bg-red-600 py-3 items-center"
        >
          <AppText className="text-body font-semibold text-white">삭제하기</AppText>
        </Pressable>
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
