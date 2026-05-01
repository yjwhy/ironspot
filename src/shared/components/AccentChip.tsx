import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';

interface AccentChipProps {
  children: ReactNode;
  testID?: string;
}

export function AccentChip({ children, testID }: AccentChipProps) {
  return (
    <View testID={testID} className="self-start rounded-full bg-accent-50 px-2 py-0.5">
      <AppText className="font-medium text-body-sm text-accent-dark">{children}</AppText>
    </View>
  );
}
