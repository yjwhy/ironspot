import { View } from 'react-native';

import { AppText } from '@/shared/components/AppText';

export default function MapScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-bg-base">
      <AppText className="font-bold text-heading-md text-text-primary">지도 화면</AppText>
      <AppText className="text-body-sm text-text-secondary mt-2">Task 13에서 구현</AppText>
    </View>
  );
}
