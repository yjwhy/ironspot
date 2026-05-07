import { MaterialIcons } from '@expo/vector-icons';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Tabs } from 'expo-router';

import { colors } from '@/shared/theme/tokens';

export default function TabLayout() {
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
              <MaterialIcons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </BottomSheetModalProvider>
  );
}
