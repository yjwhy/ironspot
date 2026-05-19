import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';

import { UnregisteredMarkerView, getUnregisteredOverlaySize } from './UnregisteredMarkerView';

interface UnregisteredMarkerProps {
  naverPlaceId: string;
  latitude: number;
  longitude: number;
  onPress: () => void;
}

export function UnregisteredMarker({
  naverPlaceId,
  latitude,
  longitude,
  onPress,
}: UnregisteredMarkerProps) {
  const { width, height } = getUnregisteredOverlaySize();

  return (
    <NaverMapMarkerOverlay
      latitude={latitude}
      longitude={longitude}
      width={width}
      height={height}
      anchor={{ x: 0.5, y: 1 }}
      isHideCollidedSymbols
      isForceShowIcon
      globalZIndex={399000}
      onTap={onPress}
    >
      <UnregisteredMarkerView key={naverPlaceId} />
    </NaverMapMarkerOverlay>
  );
}
