import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';

import {
  GymMarkerView,
  MARKER_SIZE_DEFAULT,
  MARKER_SIZE_SELECTED,
  TRIANGLE_HEIGHT,
} from './GymMarkerView';

interface GymMarkerProps {
  gymId: string;
  latitude: number;
  longitude: number;
  machineCount: number;
  isSelected: boolean;
  isMismatch: boolean;
  onPress: () => void;
}

export function GymMarker({
  gymId,
  latitude,
  longitude,
  machineCount,
  isSelected,
  isMismatch,
  onPress,
}: GymMarkerProps) {
  const size = isSelected ? MARKER_SIZE_SELECTED : MARKER_SIZE_DEFAULT;
  const totalHeight = size.height + TRIANGLE_HEIGHT;

  return (
    <NaverMapMarkerOverlay
      latitude={latitude}
      longitude={longitude}
      width={size.width}
      height={totalHeight}
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
