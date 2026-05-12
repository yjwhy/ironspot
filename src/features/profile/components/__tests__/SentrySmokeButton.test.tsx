import { fireEvent, render } from '@testing-library/react-native';

import { captureError } from '@/shared/lib/sentry';

import { SentrySmokeButton } from '../SentrySmokeButton';

jest.mock('@/shared/lib/sentry', () => ({
  captureError: jest.fn(),
}));

interface DevGlobal {
  __DEV__?: boolean;
}

describe('SentrySmokeButton', () => {
  const originalDev = (globalThis as unknown as DevGlobal).__DEV__;
  const originalEnv = process.env.EXPO_PUBLIC_SENTRY_SMOKE;

  afterEach(() => {
    (globalThis as unknown as DevGlobal).__DEV__ = originalDev;
    process.env.EXPO_PUBLIC_SENTRY_SMOKE = originalEnv;
    jest.clearAllMocks();
  });

  it('returns null in dev builds even when the flag is on', () => {
    (globalThis as unknown as DevGlobal).__DEV__ = true;
    process.env.EXPO_PUBLIC_SENTRY_SMOKE = 'true';

    const { queryByLabelText } = render(<SentrySmokeButton />);
    expect(queryByLabelText('Sentry smoke trigger (ops only)')).toBeNull();
  });

  it('returns null when EXPO_PUBLIC_SENTRY_SMOKE is unset', () => {
    (globalThis as unknown as DevGlobal).__DEV__ = false;
    delete process.env.EXPO_PUBLIC_SENTRY_SMOKE;

    const { queryByLabelText } = render(<SentrySmokeButton />);
    expect(queryByLabelText('Sentry smoke trigger (ops only)')).toBeNull();
  });

  it('renders and triggers captureError when prod build + flag on', () => {
    (globalThis as unknown as DevGlobal).__DEV__ = false;
    process.env.EXPO_PUBLIC_SENTRY_SMOKE = 'true';

    const { getByLabelText } = render(<SentrySmokeButton />);
    fireEvent.press(getByLabelText('Sentry smoke trigger (ops only)'));

    expect(captureError).toHaveBeenCalledTimes(1);
    const captureMock = captureError as jest.MockedFunction<typeof captureError>;
    const errorArg = captureMock.mock.calls[0]?.[0];
    expect(errorArg).toBeInstanceOf(Error);
    if (errorArg instanceof Error) {
      expect(errorArg.message).toMatch(/^ironspot sentry smoke \d+$/);
    }
  });
});
