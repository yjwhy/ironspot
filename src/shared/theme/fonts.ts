import { useFonts } from 'expo-font';
import type { FontSource } from 'expo-font';

import PretendardBold from '../../../assets/fonts/Pretendard-Bold.otf';
import PretendardMedium from '../../../assets/fonts/Pretendard-Medium.otf';
import PretendardRegular from '../../../assets/fonts/Pretendard-Regular.otf';
import PretendardSemiBold from '../../../assets/fonts/Pretendard-SemiBold.otf';

export const PRETENDARD_FONTS: Record<string, FontSource> = {
  'Pretendard-Regular': PretendardRegular,
  'Pretendard-Medium': PretendardMedium,
  'Pretendard-SemiBold': PretendardSemiBold,
  'Pretendard-Bold': PretendardBold,
};

export function useAppFonts() {
  return useFonts(PRETENDARD_FONTS);
}
