import { render } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import type { ComponentProps, ReactNode } from 'react';
import type * as ReactNativeModule from 'react-native';
import { Text, View } from 'react-native';

import { useAppFonts } from '@/shared/theme/fonts';

import RootLayout from '../_layout';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-router', () => {
  const RN = jest.requireActual<typeof ReactNativeModule>('react-native');
  function Stack({ children }: { children?: ReactNode }) {
    return <RN.View testID="stack">{children}</RN.View>;
  }
  Stack.Screen = function Screen({ name }: { name: string }) {
    return <RN.View testID={`stack-screen-${name}`} />;
  };
  return { Stack };
});

jest.mock('react-native-gesture-handler', () => {
  const RN = jest.requireActual<typeof ReactNativeModule>('react-native');
  return {
    GestureHandlerRootView: ({ children }: ComponentProps<typeof RN.View>) => (
      <RN.View testID="gesture-root">{children}</RN.View>
    ),
  };
});

jest.mock('@/shared/theme/fonts', () => ({
  useAppFonts: jest.fn(),
}));

jest.mock('@/shared/lib/query-client', () => ({
  queryClient: { mount: () => undefined, unmount: () => undefined },
}));

jest.mock('../../global.css', () => ({}), { virtual: true });

const mockedHideAsync = SplashScreen.hideAsync as jest.Mock;
const mockedPreventAutoHide = SplashScreen.preventAutoHideAsync as jest.Mock;
const mockedUseAppFonts = useAppFonts as unknown as jest.Mock;

// preventAutoHideAsync runs at module load time (top-level side effect),
// captured before any test mutates mock state.
const preventAutoHideCallsAtModuleLoad = mockedPreventAutoHide.mock.calls.length;

describe('app/_layout (RootLayout)', () => {
  beforeEach(() => {
    mockedHideAsync.mockClear();
    mockedUseAppFonts.mockReset();
  });

  it('renders nothing while fonts have not loaded and no error has surfaced', () => {
    mockedUseAppFonts.mockReturnValue([false, null]);
    const { queryByTestId } = render(<RootLayout />);
    expect(queryByTestId('stack')).toBeNull();
    expect(queryByTestId('gesture-root')).toBeNull();
    expect(mockedHideAsync).not.toHaveBeenCalled();
  });

  it('renders providers, status bar, and stack with the three named screens once fonts load', () => {
    mockedUseAppFonts.mockReturnValue([true, null]);
    const { getByTestId } = render(<RootLayout />);
    expect(getByTestId('gesture-root')).toBeTruthy();
    expect(getByTestId('stack')).toBeTruthy();
    expect(getByTestId('stack-screen-(tabs)')).toBeTruthy();
    expect(getByTestId('stack-screen-gym/[id]/machine/[machineId]')).toBeTruthy();
    expect(getByTestId('stack-screen-photo/[id]')).toBeTruthy();
  });

  it('hides the splash screen as soon as fonts are loaded', () => {
    mockedUseAppFonts.mockReturnValue([true, null]);
    render(<RootLayout />);
    expect(mockedHideAsync).toHaveBeenCalledTimes(1);
  });

  it('does not hide the splash screen while fonts are still loading', () => {
    mockedUseAppFonts.mockReturnValue([false, null]);
    render(<RootLayout />);
    expect(mockedHideAsync).not.toHaveBeenCalled();
  });

  it('hides the splash screen and unblocks rendering when fonts fail to load', () => {
    mockedUseAppFonts.mockReturnValue([false, new Error('font load failed')]);
    const { getByTestId } = render(<RootLayout />);
    expect(mockedHideAsync).toHaveBeenCalledTimes(1);
    // Without this, the splash would stay forever and the user would be stuck.
    expect(getByTestId('stack')).toBeTruthy();
  });

  it('keeps the splash screen visible at module load via preventAutoHideAsync', () => {
    expect(preventAutoHideCallsAtModuleLoad).toBe(1);
  });

  // Smoke check that vanilla react-native primitives still render under our mocks.
  it('react-native primitives still render alongside RootLayout (mock sanity)', () => {
    mockedUseAppFonts.mockReturnValue([true, null]);
    expect(() => render(<RootLayout />)).not.toThrow();
    expect(() =>
      render(
        <View>
          <Text>ok</Text>
        </View>,
      ),
    ).not.toThrow();
  });
});
