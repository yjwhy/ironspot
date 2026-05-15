import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';

interface RelaxFiltersCTAProps {
  onPress: () => void;
}

export function RelaxFiltersCTA({ onPress }: RelaxFiltersCTAProps) {
  return (
    <View testID="relax-filters-cta" className="bg-bg-base rounded-2xl shadow-md p-4 mx-4 gap-2">
      <AppText className="font-semibold text-body text-text-primary">검색 결과가 없어요</AppText>
      <AppText className="text-body-sm text-text-secondary">
        브랜드와 머신 종류로 다시 검색해볼까요?
      </AppText>
      <Pressable
        onPress={onPress}
        style={pressedOpacity}
        accessibilityRole="button"
        accessibilityLabel="조건 완화하여 필터 검색으로 이동"
        className="mt-2 bg-accent rounded-md py-3 items-center"
      >
        <AppText className="font-semibold text-body text-text-inverse">필터로 검색</AppText>
      </Pressable>
    </View>
  );
}
