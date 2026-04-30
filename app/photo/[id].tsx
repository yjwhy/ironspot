import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 items-center justify-center bg-black">
      <Text className="font-bold text-heading-md text-text-inverse">사진 상세</Text>
      <Text className="font-sans text-body-sm text-text-tertiary mt-2">photo {id}</Text>
      <Text className="font-sans text-body-sm text-text-tertiary mt-1">Task 11에서 구현</Text>
    </View>
  );
}
