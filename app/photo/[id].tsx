import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/shared/components/AppText';

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 items-center justify-center bg-black">
      <AppText className="font-bold text-heading-md text-text-inverse">사진 상세</AppText>
      <AppText className="text-body-sm text-text-tertiary mt-2">photo {id}</AppText>
      <AppText className="text-body-sm text-text-tertiary mt-1">Task 11에서 구현</AppText>
    </View>
  );
}
