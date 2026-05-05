import type { Region } from '@mj-studio/react-native-naver-map';

import type { MapBounds } from '@/shared/types/database';

export function regionToMapBounds(region: Region): MapBounds {
  return {
    minLat: region.latitude,
    maxLat: region.latitude + region.latitudeDelta,
    minLng: region.longitude,
    maxLng: region.longitude + region.longitudeDelta,
  };
}
