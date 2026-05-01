import type { TextProps } from 'react-native';
import { Text } from 'react-native';

const DEFAULT_CLASS = 'font-sans';

export function AppText({ className, ...rest }: TextProps) {
  return <Text {...rest} className={className ? `${DEFAULT_CLASS} ${className}` : DEFAULT_CLASS} />;
}
