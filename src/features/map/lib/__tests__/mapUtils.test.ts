import { regionToMapBounds } from '../mapUtils';

jest.mock('@mj-studio/react-native-naver-map', () => ({}));

describe('regionToMapBounds', () => {
  it('converts region south-west corner + deltas to MapBounds', () => {
    const result = regionToMapBounds({
      latitude: 37.48,
      longitude: 127.02,
      latitudeDelta: 0.04,
      longitudeDelta: 0.06,
    });
    expect(result).toEqual({
      minLat: 37.48,
      maxLat: 37.48 + 0.04,
      minLng: 127.02,
      maxLng: 127.02 + 0.06,
    });
  });

  it('handles zero deltas', () => {
    const result = regionToMapBounds({
      latitude: 37.5,
      longitude: 127.0,
      latitudeDelta: 0,
      longitudeDelta: 0,
    });
    expect(result.minLat).toBe(result.maxLat);
    expect(result.minLng).toBe(result.maxLng);
  });
});
