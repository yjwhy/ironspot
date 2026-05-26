import type { ComponentType, ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';

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
      <AppText className="text-heading-md text-text-primary text-center">문제가 발생했어요</AppText>
      <AppText className="mt-2 text-body-sm text-text-secondary text-center">{message}</AppText>
      <Pressable
        onPress={resetErrorBoundary}
        accessibilityRole="button"
        className="mt-6 h-12 items-center justify-center rounded-md bg-accent px-6"
      >
        <AppText className="font-semibold text-text-inverse">다시 시도</AppText>
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
        // Security F3: component stacks can include user-supplied props
        // (gym names, photos, search terms). Restrict the verbose console
        // dump to __DEV__ so production logs / device logcat never see
        // them. Sentry capture stays unaffected (it's plumbed via the
        // host onError handler downstream).
        if (__DEV__) {
          console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
        }
        onError?.(error, info);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
