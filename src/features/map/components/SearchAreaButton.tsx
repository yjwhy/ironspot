import { Pressable } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';

interface SearchAreaButtonProps {
  visible: boolean;
  onPress: () => void;
}

export function SearchAreaButton({ visible, onPress }: SearchAreaButtonProps) {
  if (!visible) return null;

  return (
    <Pressable
      onPress={onPress}
      style={pressedOpacity}
      className="bg-bg-base rounded-full px-4 py-2 shadow-md border border-border"
      accessibilityRole="button"
    >
      <AppText className="font-semibold text-body-sm text-text-primary">이 지역 재검색</AppText>
    </Pressable>
  );
}
