import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

interface NetworkStatus {
  isOnline: boolean;
}

// `isConnected === null` means NetInfo has not determined the state yet.
// Treat that as online so the offline banner does not flash on app start.
function isOnlineFromConnected(isConnected: boolean | null): boolean {
  return isConnected !== false;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(isOnlineFromConnected(state.isConnected));
    });
    return unsubscribe;
  }, []);

  return { isOnline };
}
