import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';

import { GymMarkerView, getOverlaySize } from './GymMarkerView';

interface GymMarkerProps {
  gymId: string;
  latitude: number;
  longitude: number;
  machineCount: number;
  isSelected: boolean;
  onPress: () => void;
}

export function GymMarker({
  gymId,
  latitude,
  longitude,
  machineCount,
  isSelected,
  onPress,
}: GymMarkerProps) {
  const isMismatch = machineCount === 0;
  const { width, height } = getOverlaySize(isSelected);

  return (
    <NaverMapMarkerOverlay
      latitude={latitude}
      longitude={longitude}
      width={width}
      height={height}
      anchor={{ x: 0.5, y: 1 }}
      onTap={onPress}
    >
      <GymMarkerView
        key={`${gymId}/${String(isSelected)}/${String(machineCount)}`}
        machineCount={machineCount}
        isSelected={isSelected}
        isMismatch={isMismatch}
      />
    </NaverMapMarkerOverlay>
  );
}
