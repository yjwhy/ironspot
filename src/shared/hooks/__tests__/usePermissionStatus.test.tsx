import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { makePermission } from '@/test/utils/factories/location-permission';

import { usePermissionStatus } from '../usePermissionStatus';

jest.mock('expo-location', () => ({
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

const mockedGetPermission = Location.getForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.getForegroundPermissionsAsync
>;
const mockedRequestPermission = Location.requestForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.requestForegroundPermissionsAsync
>;

describe('usePermissionStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts with status=null until the initial read resolves', () => {
    mockedGetPermission.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => usePermissionStatus());

    expect(result.current.status).toBeNull();
  });

  it('reads the current permission status on mount', async () => {
    mockedGetPermission.mockResolvedValue(makePermission(Location.PermissionStatus.UNDETERMINED));

    const { result } = renderHook(() => usePermissionStatus());

    await waitFor(() => {
      expect(result.current.status).toBe(Location.PermissionStatus.UNDETERMINED);
    });
    expect(mockedRequestPermission).not.toHaveBeenCalled();
  });

  it('request() prompts the user, updates status, and returns the new status', async () => {
    mockedGetPermission.mockResolvedValue(makePermission(Location.PermissionStatus.UNDETERMINED));
    mockedRequestPermission.mockResolvedValue(makePermission(Location.PermissionStatus.GRANTED));

    const { result } = renderHook(() => usePermissionStatus());
    await waitFor(() => {
      expect(result.current.status).toBe(Location.PermissionStatus.UNDETERMINED);
    });

    let returned: Location.PermissionStatus | undefined;
    await act(async () => {
      returned = await result.current.request();
    });

    expect(returned).toBe(Location.PermissionStatus.GRANTED);
    expect(result.current.status).toBe(Location.PermissionStatus.GRANTED);
    expect(mockedRequestPermission).toHaveBeenCalledTimes(1);
  });
});
