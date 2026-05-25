import { useLocalSearchParams } from 'expo-router';

import { MachinePhotoGalleryScreen } from '@/features/photo/components/MachinePhotoGalleryScreen';
import { gymMachineRouteParams, parseRouteParams } from '@/shared/lib/deeplink-params';

export default function MachinePhotoGalleryRoute() {
  // Security task #35: Zod-validate UUIDs at the route boundary so a
  // crafted deep link (e.g. ironspot:///gym/<malicious>/machine/<x>)
  // can't drive an API request with a non-UUID string.
  const parsed = parseRouteParams(gymMachineRouteParams, useLocalSearchParams());
  return <MachinePhotoGalleryScreen gymId={parsed?.id} machineId={parsed?.machineId} />;
}
