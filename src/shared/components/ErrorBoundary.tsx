import type { ComponentType, ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';
import { Pressable, Text, View } from 'react-native';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  onError?: (error: Error, info: { componentStack?: string | null }) => void;
  FallbackComponent?: ComponentType<FallbackProps>;
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
      <Pressable
        onPress={resetErrorBoundary}
        accessibilityRole="button"
        className="mt-6 h-12 items-center justify-center rounded-md bg-accent px-6"
      >
        <Text className="font-semibold text-text-inverse">다시 시도</Text>
      </Pressable>
    </View>
  );
}

export function ErrorBoundary({
  children,
  onReset,
  onError,
  FallbackComponent = DefaultFallback,
}: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={FallbackComponent}
      onReset={onReset}
      onError={(error, info) => {
        console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
        onError?.(error, info);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
