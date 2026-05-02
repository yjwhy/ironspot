import { useLocalSearchParams } from 'expo-router';

import { MachinePhotoGalleryScreen } from '@/features/photo/components/MachinePhotoGalleryScreen';

export default function MachinePhotoGalleryRoute() {
  const params = useLocalSearchParams<{ id?: string; machineId?: string }>();
  const gymId = typeof params.id === 'string' ? params.id : undefined;
  const machineId = typeof params.machineId === 'string' ? params.machineId : undefined;
  return <MachinePhotoGalleryScreen gymId={gymId} machineId={machineId} />;
}
