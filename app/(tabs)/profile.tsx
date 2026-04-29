import { Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-bg-base">
      <Text className="font-bold text-heading-md text-text-primary">마이페이지</Text>
      <Text className="font-sans text-body-sm text-text-secondary mt-2">Phase 2에서 제공 예정</Text>
    </View>
  );
}
