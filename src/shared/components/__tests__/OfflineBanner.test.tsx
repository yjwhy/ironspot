import NetInfo from '@react-native-community/netinfo';
import { act, render } from '@testing-library/react-native';

import { OfflineBanner } from '../OfflineBanner';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

type NetInfoListener = (state: { isConnected: boolean | null }) => void;

function captureListener(): { listenerRef: { current: NetInfoListener | null } } {
  const listenerRef: { current: NetInfoListener | null } = { current: null };
  (NetInfo.addEventListener as jest.Mock).mockImplementation((cb: NetInfoListener) => {
    listenerRef.current = cb;
    return () => undefined;
  });
  return { listenerRef };
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing while online', () => {
    (NetInfo.addEventListener as jest.Mock).mockReturnValue(() => undefined);
    const { queryByText } = render(<OfflineBanner />);
    expect(queryByText('오프라인 상태입니다')).toBeNull();
  });

  it('renders the offline copy when NetInfo reports isConnected=false', () => {
    const { listenerRef } = captureListener();
    const { getByText } = render(<OfflineBanner />);
    act(() => {
      listenerRef.current?.({ isConnected: false });
    });
    expect(getByText('오프라인 상태입니다')).toBeTruthy();
  });

  it('hides the banner again when connectivity returns', () => {
    const { listenerRef } = captureListener();
    const { queryByText } = render(<OfflineBanner />);
    act(() => {
      listenerRef.current?.({ isConnected: false });
    });
    act(() => {
      listenerRef.current?.({ isConnected: true });
    });
    expect(queryByText('오프라인 상태입니다')).toBeNull();
  });

  it('exposes accessibilityRole="alert" so screen readers announce it', () => {
    // RNTL's getByRole does not include "alert" in its native-role map, so we
    // assert the prop directly via testID instead. The role is required for
    // iOS VoiceOver / Android TalkBack to announce the banner on appear.
    const { listenerRef } = captureListener();
    const { getByTestId } = render(<OfflineBanner />);
    act(() => {
      listenerRef.current?.({ isConnected: false });
    });
    expect(getByTestId('offline-banner')).toHaveProp('accessibilityRole', 'alert');
  });
});
