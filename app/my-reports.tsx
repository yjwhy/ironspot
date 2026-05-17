import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';

// Placeholder for slice 47m. The route exists so typed-routes accept
// /my-reports as a destination from ProfileScreen menu. Slice 47m replaces
// this body with the MyReportsScreen + useMyReports hook + escalate flow.
export default function MyReportsPlaceholder() {
  return (
    <SafeAreaView className="flex-1 bg-bg-base items-center justify-center px-6">
      <View className="gap-2">
        <AppText className="text-headline font-bold text-text-primary text-center">
          내가 한 신고들
        </AppText>
        <AppText className="text-body text-text-secondary text-center">
          이 화면은 곧 추가될 거예요.
        </AppText>
      </View>
    </SafeAreaView>
  );
}
