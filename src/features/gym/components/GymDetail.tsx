import { Text, View } from 'react-native';

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
      <Text accessibilityRole="header" className="text-heading-lg text-text-primary">
        {gym.name}
      </Text>
      <Text className="font-sans text-body-sm text-text-secondary">{gym.address}</Text>
      {gym.phone ? (
        <Text className="font-sans text-body-sm text-text-secondary">{gym.phone}</Text>
      ) : null}
      {gym.operating_hours ? (
        <Text className="font-sans text-body-sm text-text-secondary">{gym.operating_hours}</Text>
      ) : null}
      {gym.last_verified_at ? (
        <View className="mt-1 self-start rounded-full bg-accent-50 px-2 py-0.5">
          <Text className="font-medium text-body-sm text-accent-dark">
            확인일 {formatVerifiedDate(gym.last_verified_at)}
          </Text>
        </View>
      ) : null}
    </View>
  );
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
