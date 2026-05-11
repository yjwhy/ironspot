import * as SentryRN from '@sentry/react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { forwardRenderErrorToSentry } from '@/shared/lib/sentry';

import { ErrorBoundary } from '../ErrorBoundary';

// Mock the lowest layer (Sentry SDK) so the test exercises the real
// `forwardRenderErrorToSentry` function that _layout.tsx actually wires —
// not a test-local lambda that calls captureError directly.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
}));

function Throws({ message }: { message: string }): never {
  throw new Error(message);
}

function RetryHarness() {
  const [retried, setRetried] = useState(false);
  return (
    <ErrorBoundary
      onReset={() => {
        setRetried(true);
      }}
    >
      {retried ? <Text>after retry</Text> : <Throws message="boom" />}
    </ErrorBoundary>
  );
}

describe('ErrorBoundary', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>healthy</Text>
      </ErrorBoundary>,
    );
    expect(getByText('healthy')).toBeTruthy();
  });

  it('renders fallback UI with the error message when a child throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Throws message="boom" />
      </ErrorBoundary>,
    );
    expect(getByText('문제가 발생했어요')).toBeTruthy();
    expect(getByText('boom')).toBeTruthy();
    expect(getByText('다시 시도')).toBeTruthy();
  });

  it('recovers when retry is pressed and the child no longer throws', () => {
    const { getByText, queryByText } = render(<RetryHarness />);
    expect(getByText('문제가 발생했어요')).toBeTruthy();
    fireEvent.press(getByText('다시 시도'));
    expect(queryByText('문제가 발생했어요')).toBeNull();
    expect(getByText('after retry')).toBeTruthy();
  });

  it('forwards render errors to Sentry through forwardRenderErrorToSentry', () => {
    jest.mocked(SentryRN.captureException).mockClear();

    render(
      <ErrorBoundary onError={forwardRenderErrorToSentry}>
        <Throws message="captured" />
      </ErrorBoundary>,
    );

    expect(SentryRN.captureException).toHaveBeenCalledTimes(1);
    const calls = jest.mocked(SentryRN.captureException).mock.calls;
    const firstCall = calls[0];
    if (!firstCall) throw new Error('unreachable — assertion above guarantees length 1');
    const [errorArg, contextArg] = firstCall;
    expect(errorArg).toBeInstanceOf(Error);
    expect((errorArg as Error).message).toBe('captured');
    const componentStack = (contextArg as { contexts?: { react?: { componentStack?: unknown } } })
      .contexts?.react?.componentStack;
    expect(typeof componentStack).toBe('string');
  });
});
