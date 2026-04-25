import type { ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';
import { Text, View } from 'react-native';

import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  onError?: (error: Error, info: { componentStack?: string | null }) => void;
}

function DefaultFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : '알 수 없는 오류';

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`오류: ${message}`}
      className="flex-1 items-center justify-center bg-bg-base px-6"
    >
      <Text className="text-heading-md text-text-primary text-center">문제가 발생했어요</Text>
      <Text className="mt-2 text-body-sm text-text-secondary text-center">{message}</Text>
      <View className="mt-6">
        <Button label="다시 시도" onPress={resetErrorBoundary} variant="primary" size="md" />
      </View>
    </View>
  );
}

function logError(error: Error, info: { componentStack?: string | null }) {
  console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
}

export function ErrorBoundary({ children, onReset, onError = logError }: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary FallbackComponent={DefaultFallback} onReset={onReset} onError={onError}>
      {children}
    </ReactErrorBoundary>
  );
}
