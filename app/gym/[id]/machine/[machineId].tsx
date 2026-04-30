import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function MachinePhotoGalleryScreen() {
  const { id, machineId } = useLocalSearchParams<{ id: string; machineId: string }>();

  return (
    <View className="flex-1 items-center justify-center bg-bg-base">
      <Text className="font-bold text-heading-md text-text-primary">머신 사진</Text>
      <Text className="font-sans text-body-sm text-text-secondary mt-2">
        gym {id} · machine {machineId}
      </Text>
      <Text className="font-sans text-body-sm text-text-tertiary mt-1">Task 11에서 구현</Text>
    </View>
  );
}
