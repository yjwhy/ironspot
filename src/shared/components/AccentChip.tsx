import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

interface AccentChipProps {
  children: ReactNode;
  testID?: string;
}

export function AccentChip({ children, testID }: AccentChipProps) {
  return (
    <View testID={testID} className="self-start rounded-full bg-accent-50 px-2 py-0.5">
      <Text className="font-medium text-body-sm text-accent-dark">{children}</Text>
    </View>
  );
}
