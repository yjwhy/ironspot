import { MaterialIcons } from '@expo/vector-icons';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { useOwnerPendingDot } from '@/features/owner/hooks/useOwnerPendingDot';
import { colors } from '@/shared/theme/tokens';

const DOT_SIZE = 8;

export default function TabLayout() {
  const { showDot } = useOwnerPendingDot();

  return (
    <BottomSheetModalProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent.DEFAULT,
          tabBarInactiveTintColor: colors.text.tertiary,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarLabel: '지도',
            tabBarIcon: ({ color, size }) => <MaterialIcons name="map" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarLabel: '마이',
            tabBarIcon: ({ color, size }) => (
              <View>
                <MaterialIcons name="person" size={size} color={color} />
                {showDot ? (
                  <View
                    testID="profile-tab-pending-dot"
                    accessibilityLabel="처리 대기 알림"
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: DOT_SIZE,
                      height: DOT_SIZE,
                      borderRadius: DOT_SIZE / 2,
                      backgroundColor: colors.error,
                    }}
                  />
                ) : null}
              </View>
            ),
          }}
        />
      </Tabs>
    </BottomSheetModalProvider>
  );
}
