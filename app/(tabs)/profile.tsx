import { View } from 'react-native';

import { AppText } from '@/shared/components/AppText';

export default function ProfileScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-bg-base">
      <AppText className="font-bold text-heading-md text-text-primary">마이페이지</AppText>
      <AppText className="text-body-sm text-text-secondary mt-2">Phase 2에서 제공 예정</AppText>
    </View>
  );
}
