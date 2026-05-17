import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';

// Placeholder for slice 47j. The route exists so typed-routes accept /owner as a
// destination from OwnerClaimScreen on success. 47j replaces this body with the
// OwnerGuard + owner home (gym list + queue/machines/photos entry points).
export default function OwnerHomePlaceholder() {
  return (
    <SafeAreaView className="flex-1 bg-bg-base items-center justify-center px-6">
      <View className="gap-2">
        <AppText className="text-headline font-bold text-text-primary text-center">
          owner 도구
        </AppText>
        <AppText className="text-body text-text-secondary text-center">
          매장 관리 화면은 곧 추가될 거예요.
        </AppText>
      </View>
    </SafeAreaView>
  );
}
