import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/shared/components/AppText';

export default function MachinePhotoGalleryScreen() {
  const { id, machineId } = useLocalSearchParams<{ id: string; machineId: string }>();

  return (
    <View className="flex-1 items-center justify-center bg-bg-base">
      <AppText className="font-bold text-heading-md text-text-primary">머신 사진</AppText>
      <AppText className="text-body-sm text-text-secondary mt-2">
        gym {id} · machine {machineId}
      </AppText>
      <AppText className="text-body-sm text-text-tertiary mt-1">Task 11에서 구현</AppText>
    </View>
  );
}
