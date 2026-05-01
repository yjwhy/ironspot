import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AccentChip } from '@/shared/components/AccentChip';
import { AppText } from '@/shared/components/AppText';
import { EmptyState } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import { formatVerifiedDate } from '@/shared/lib/format';
import type { Gym, GymMachineWithDetails } from '@/shared/types/database';

import { MachineList } from './MachineList';
import { useGymMachines } from '../hooks/useGymMachines';

interface GymDetailProps {
  gym: Gym;
  onPressMachine: (gymMachineId: string) => void;
}

export function GymDetail({ gym, onPressMachine }: GymDetailProps) {
  const { data, isPending, isError } = useGymMachines(gym.id);

  return (
    <View className="flex-1 gap-4 bg-bg-base p-4">
      <GymHeader gym={gym} />
      <MachinesBody
        data={data}
        isPending={isPending}
        isError={isError}
        onPressMachine={onPressMachine}
      />
    </View>
  );
}

function GymHeader({ gym }: { gym: Gym }) {
  return (
    <View className="gap-1">
      <AppText accessibilityRole="header" className="text-heading-lg text-text-primary">
        {gym.name}
      </AppText>
      <MetaLine>{gym.address}</MetaLine>
      {gym.phone ? <MetaLine>{gym.phone}</MetaLine> : null}
      {gym.operating_hours ? <MetaLine>{gym.operating_hours}</MetaLine> : null}
      {gym.last_verified_at ? (
        <View className="mt-1">
          <AccentChip>확인일 {formatVerifiedDate(gym.last_verified_at)}</AccentChip>
        </View>
      ) : null}
    </View>
  );
}

function MetaLine({ children }: { children: ReactNode }) {
  return <AppText className="text-body-sm text-text-secondary">{children}</AppText>;
}

interface MachinesBodyProps {
  data: readonly GymMachineWithDetails[] | undefined;
  isPending: boolean;
  isError: boolean;
  onPressMachine: (gymMachineId: string) => void;
}

function MachinesBody({ data, isPending, isError, onPressMachine }: MachinesBodyProps) {
  if (isPending) {
    return (
      <View className="gap-2">
        <Skeleton width={280} height={20} />
        <Skeleton width={240} height={20} />
        <Skeleton width={200} height={20} />
      </View>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon="error-outline"
        title="기구 정보를 불러오지 못했어요"
        description="잠시 후 다시 시도해주세요"
      />
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState icon="info-outline" title="등록된 기구가 없어요" />;
  }

  return <MachineList machines={data} onPressMachine={onPressMachine} />;
}
