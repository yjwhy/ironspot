import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { ErrorBoundary } from '../ErrorBoundary';

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
});
