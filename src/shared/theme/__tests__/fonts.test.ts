import { renderHook } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import { PRETENDARD_FONTS, useAppFonts } from '../fonts';

jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true, null]),
}));

const useFontsMock = useFonts as jest.MockedFunction<typeof useFonts>;

const EXPECTED_FONT_KEYS = [
  'Pretendard-Regular',
  'Pretendard-Medium',
  'Pretendard-SemiBold',
  'Pretendard-Bold',
] as const;

describe('useAppFonts', () => {
  beforeEach(() => {
    useFontsMock.mockClear();
  });

  it('exposes the four Pretendard weight keys', () => {
    for (const key of EXPECTED_FONT_KEYS) {
      expect(PRETENDARD_FONTS).toHaveProperty(key);
    }
  });

  it('passes the Pretendard font map to expo-font', () => {
    renderHook(() => useAppFonts());

    expect(useFontsMock).toHaveBeenCalledTimes(1);
    expect(useFontsMock).toHaveBeenCalledWith(PRETENDARD_FONTS);
  });
});
