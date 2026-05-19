import { View } from 'react-native';

import { Card } from '@/shared/components/Card';
import { Skeleton } from '@/shared/components/Skeleton';

import { GYM_CARD_THUMBNAIL_SIZE } from './GymCard';

interface GymCardSkeletonProps {
  testID?: string;
}

const THUMBNAIL = { size: GYM_CARD_THUMBNAIL_SIZE } as const;
const TITLE = { width: 140, height: 16 } as const;
const META = { width: 80, height: 14 } as const;
const COUNT = { width: 100, height: 14 } as const;
// height 12 is intentionally smaller than body-sm (13px) to minimise visual weight at the bottom
const VERIFIED_DATE = { width: 60, height: 12 } as const;

export function GymCardSkeleton({ testID = 'gym-card-skeleton' }: GymCardSkeletonProps) {
  return (
    <Card padding="md" testID={testID} accessibilityLabel="헬스장 정보 로딩 중">
      <View className="flex-row gap-3">
        <Skeleton variant="rectangle" width={THUMBNAIL.size} height={THUMBNAIL.size} />
        <View className="flex-1 justify-between">
          <View className="gap-2">
            <Skeleton width={TITLE.width} height={TITLE.height} />
            <Skeleton width={META.width} height={META.height} />
            <Skeleton width={COUNT.width} height={COUNT.height} />
          </View>
          <View className="items-end">
            <Skeleton width={VERIFIED_DATE.width} height={VERIFIED_DATE.height} />
          </View>
        </View>
      </View>
    </Card>
  );
}
