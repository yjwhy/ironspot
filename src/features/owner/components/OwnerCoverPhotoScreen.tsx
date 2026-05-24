import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'burnt';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGymDetail } from '@/features/gym/hooks/useGymDetail';
import { gymKeys } from '@/features/gym/query-keys';
import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { useDeleteGymCoverPhoto, useUploadGymCoverPhoto } from '@/shared/generated/owner/owner';
import { pressedOpacity } from '@/shared/lib/pressable';
import { captureError } from '@/shared/lib/sentry';

// Backend caps uploads at 2MB. 1280×720 WebP @ 0.8 quality lands comfortably
// under that for realistic gym photos (200~600KB), so the post-crop pipeline
// guarantees the server never refuses on size alone.
const COVER_RESIZE_WIDTH = 1280;
const COVER_QUALITY = 0.8;

async function compressCover(uri: string): Promise<Blob> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: COVER_RESIZE_WIDTH });
  const imageRef = await context.renderAsync();
  try {
    const result = await imageRef.saveAsync({
      compress: COVER_QUALITY,
      format: SaveFormat.WEBP,
    });
    const response = await fetch(result.uri);
    return await response.blob();
  } finally {
    imageRef.release();
    context.release();
  }
}

export function OwnerCoverPhotoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ gym: string }>();
  const gymId = params.gym;
  const { data: gym, isLoading, isError } = useGymDetail(gymId);
  const uploadMutation = useUploadGymCoverPhoto();
  const deleteMutation = useDeleteGymCoverPhoto();
  const [pickerOpen, setPickerOpen] = useState(false);

  const coverUrl = gym?.cover_photo_url ?? null;
  const hasCover = coverUrl !== null;
  const busy = uploadMutation.isPending || deleteMutation.isPending;

  async function pickFromCamera() {
    setPickerOpen(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast({ title: '카메라 권한이 필요해요', preset: 'error' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    if (result.canceled) return;
    void runUpload(result.assets[0]?.uri);
  }

  async function pickFromGallery() {
    setPickerOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast({ title: '갤러리 권한이 필요해요', preset: 'error' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    if (result.canceled) return;
    void runUpload(result.assets[0]?.uri);
  }

  async function runUpload(uri: string | undefined) {
    if (uri === undefined) return;
    try {
      const blob = await compressCover(uri);
      await uploadMutation.mutateAsync({ gymId, data: { image: blob } });
      await queryClient.invalidateQueries({ queryKey: gymKeys.detail(gymId) });
      toast({
        title: hasCover ? '대표 사진이 변경됐어요' : '대표 사진이 업로드됐어요',
        preset: 'done',
      });
    } catch (err) {
      captureError(err);
      toast({ title: '업로드에 실패했어요. 다시 시도해 주세요', preset: 'error' });
    }
  }

  function confirmRemove() {
    Alert.alert('대표 사진을 제거하시겠어요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '제거',
        style: 'destructive',
        onPress: () => {
          void runRemove();
        },
      },
    ]);
  }

  async function runRemove() {
    try {
      await deleteMutation.mutateAsync({ gymId });
      await queryClient.invalidateQueries({ queryKey: gymKeys.detail(gymId) });
      toast({ title: '대표 사진이 제거됐어요', preset: 'done' });
    } catch (err) {
      captureError(err);
      toast({ title: '제거에 실패했어요. 다시 시도해 주세요', preset: 'error' });
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (isError || gym === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center px-6">
        <EmptyState
          icon="error-outline"
          title="매장 정보를 불러올 수 없어요"
          description="잠시 후 다시 시도해 주세요"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="px-6 py-6 gap-2">
        <AppText className="text-headline font-bold text-text-primary">
          {gym.name} 대표 사진
        </AppText>
        <AppText className="text-body text-text-secondary">
          매장 검색 결과 카드에 노출되는 대표 사진을 관리할 수 있어요.
        </AppText>
      </View>

      <View className="px-6">
        <View
          className="w-full items-center justify-center overflow-hidden rounded-xl bg-bg-elevated"
          style={{ aspectRatio: 16 / 9 }}
          accessibilityLabel={hasCover ? '현재 대표 사진' : '대표 사진 미설정 자리'}
        >
          {coverUrl !== null ? (
            <Image
              source={{ uri: coverUrl }}
              resizeMode="cover"
              className="h-full w-full"
              accessibilityLabel="대표 사진"
            />
          ) : (
            <AppText className="text-body-sm text-text-secondary">대표 사진이 없습니다</AppText>
          )}
        </View>
      </View>

      {pickerOpen ? (
        <View className="gap-3 px-6 pt-4">
          <Button
            label="카메라로 촬영"
            onPress={() => {
              void pickFromCamera();
            }}
            disabled={busy}
          />
          <Button
            label="갤러리에서 선택"
            onPress={() => {
              void pickFromGallery();
            }}
            variant="secondary"
            disabled={busy}
          />
          <Pressable
            onPress={() => {
              setPickerOpen(false);
            }}
            style={pressedOpacity}
            className="items-center py-2"
          >
            <AppText className="text-body-sm text-text-secondary">취소</AppText>
          </Pressable>
        </View>
      ) : (
        <View className="gap-3 px-6 pt-6">
          <Button
            label={hasCover ? '사진 변경' : '사진 업로드'}
            onPress={() => {
              setPickerOpen(true);
            }}
            loading={uploadMutation.isPending}
            disabled={busy}
          />
          {hasCover ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="대표 사진 제거"
              onPress={confirmRemove}
              disabled={busy}
              style={pressedOpacity}
              className="items-center py-3"
            >
              <AppText className="text-body text-red-600">사진 제거</AppText>
            </Pressable>
          ) : null}
        </View>
      )}

      <View className="flex-1" />

      <View className="px-6 pb-6">
        <Pressable
          onPress={() => {
            router.back();
          }}
          style={pressedOpacity}
          className="items-center py-3"
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <AppText className="text-body-sm text-text-secondary">뒤로 가기</AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
