import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Skeleton } from '@/shared/components/Skeleton';

import { AVATAR_SIZE } from './AuthenticatedProfile';

const MENU_ROW_HEIGHT = 56;
const MENU_ROW_COUNT = 4;

export function ProfileSkeleton() {
  return (
    <SafeAreaView
      className="flex-1 bg-bg-base"
      accessibilityRole="progressbar"
      accessibilityLabel="프로필 불러오는 중"
    >
      <View className="items-center py-6 gap-2 border-b border-border-DEFAULT">
        <Skeleton variant="circle" size={AVATAR_SIZE} />
        <Skeleton width={120} height={20} />
        <Skeleton width={160} height={14} />
      </View>
      {Array.from({ length: MENU_ROW_COUNT }).map((_, idx) => (
        <View
          key={idx}
          className="border-b border-border-DEFAULT px-4 justify-center"
          style={{ height: MENU_ROW_HEIGHT }}
        >
          <Skeleton width={180} height={18} />
        </View>
      ))}
    </SafeAreaView>
  );
}
