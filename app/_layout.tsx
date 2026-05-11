import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { OfflineBanner } from '@/shared/components/OfflineBanner';
import { queryClient } from '@/shared/lib/query-client';
import { forwardRenderErrorToSentry, initSentry } from '@/shared/lib/sentry';
import { useAppFonts } from '@/shared/theme/fonts';

import '../global.css';

// Sentry must be initialised before any code that might throw — keep this at module load.
// initSentry no-ops when EXPO_PUBLIC_SENTRY_DSN is empty (dev / first-time-setup).
initSentry();

// Expo convention: keep the native splash screen visible until fonts load
// (or fail to load), then hide it from the effect below.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const fontsReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontsReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  // Render nothing while fonts are still resolving so the splash screen
  // remains the only thing the user sees. A font error still resolves the
  // gate so the app does not freeze on the splash forever.
  if (!fontsReady) {
    return null;
  }

  return (
    <ErrorBoundary onError={forwardRenderErrorToSentry}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="gym/[id]/machine/[machineId]" />
              <Stack.Screen
                name="photo/[id]"
                options={{
                  presentation: 'modal',
                  contentStyle: { backgroundColor: '#000' },
                }}
              />
            </Stack>
            <OfflineBanner />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
