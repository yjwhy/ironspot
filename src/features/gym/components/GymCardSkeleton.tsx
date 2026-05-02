import { View } from 'react-native';

import { Card } from '@/shared/components/Card';
import { Skeleton } from '@/shared/components/Skeleton';

interface GymCardSkeletonProps {
  testID?: string;
}

const THUMBNAIL_SIZE = 80;
const TITLE_WIDTH = 140;
const TITLE_HEIGHT = 16;
const META_WIDTH = 80;
const META_HEIGHT = 14;
const CHIP_WIDTH = 80;
const CHIP_HEIGHT = 20;

export function GymCardSkeleton({ testID = 'gym-card-skeleton' }: GymCardSkeletonProps) {
  return (
    <Card padding="md" testID={testID} accessibilityLabel="헬스장 정보 로딩 중">
      <View className="flex-row gap-3">
        <Skeleton variant="rectangle" width={THUMBNAIL_SIZE} height={THUMBNAIL_SIZE} />
        <View className="flex-1 justify-center gap-2">
          <Skeleton width={TITLE_WIDTH} height={TITLE_HEIGHT} />
          <Skeleton width={META_WIDTH} height={META_HEIGHT} />
          <Skeleton width={CHIP_WIDTH} height={CHIP_HEIGHT} />
        </View>
      </View>
    </Card>
  );
}
