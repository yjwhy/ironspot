import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { EmptyState } from '@/shared/components/EmptyState';
import { useListMachines } from '@/shared/generated/machines/machines';
import type { PhotoResponse } from '@/shared/generated/model';
import { useVerify } from '@/shared/generated/owner/owner';
import { getListPhotosQueryKey, useListPhotos } from '@/shared/generated/photos/photos';
import { pressedOpacity } from '@/shared/lib/pressable';
import { captureError } from '@/shared/lib/sentry';

export function OwnerPhotosScreen() {
  const params = useLocalSearchParams<{ gym: string }>();
  const machinesQuery = useListMachines(params.gym);

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
      <View className="px-6 py-4">
        <AppText className="text-headline font-bold text-text-primary">사진 검증</AppText>
        <AppText className="text-body-sm text-text-secondary">
          머신별로 업로드된 사진을 확인하고 owner 인증 마크를 부여할 수 있어요.
        </AppText>
      </View>

      <FlatList
        data={machines}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MachinePhotoGroup
            gymMachineId={item.id}
            label={`${item.brandName ?? ''} ${item.machineNameKo ?? item.machineNameEn ?? item.customName ?? '머신'}`}
          />
        )}
        ListEmptyComponent={
          <View className="px-6 py-12">
            <EmptyState icon="image" title="검증할 사진이 없어요" />
          </View>
        }
        contentContainerClassName="px-6 pb-12 gap-4"
      />
    </SafeAreaView>
  );
}

interface MachinePhotoGroupProps {
  gymMachineId: string;
  label: string;
}

function MachinePhotoGroup({ gymMachineId, label }: MachinePhotoGroupProps) {
  const photosQuery = useListPhotos(gymMachineId);
  const verifyMutation = useVerify();
  const queryClient = useQueryClient();

  async function handleVerify(photoId: string) {
    try {
      await verifyMutation.mutateAsync({ id: photoId });
      burnt.toast({ title: '인증했어요', preset: 'done' });
      await queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey(gymMachineId) });
    } catch (err) {
      captureError(err);
      burnt.toast({ title: '인증에 실패했어요', preset: 'error' });
    }
  }

  const photos: PhotoResponse[] = photosQuery.data?.data ?? [];

  return (
    <View className="rounded-lg bg-bg-elevated p-4 gap-2">
      <AppText className="text-body font-semibold text-text-primary">{label}</AppText>
      {photosQuery.isLoading ? (
        <ActivityIndicator />
      ) : photos.length === 0 ? (
        <AppText className="text-body-sm text-text-tertiary">사진 없음</AppText>
      ) : (
        photos.map((photo) => (
          <View key={photo.id} className="flex-row items-center gap-2">
            <View className="h-12 w-12 rounded-md bg-bg-base" testID={`photo-thumb-${photo.id}`} />
            <View className="flex-1">
              <AppText className="text-body-sm text-text-primary" numberOfLines={1}>
                {photo.id.slice(0, 8)}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 인증"
              onPress={() => {
                void handleVerify(photo.id);
              }}
              style={pressedOpacity}
              className="rounded-md bg-accent px-3 py-2"
              disabled={verifyMutation.isPending}
            >
              <AppText className="text-body-sm text-white">인증</AppText>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}
