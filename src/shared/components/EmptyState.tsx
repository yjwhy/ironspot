import { MaterialIcons } from '@expo/vector-icons';
import { memo } from 'react';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/shared/theme/tokens';

type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

interface EmptyStateProps {
  icon: MaterialIconName;
  title: string;
  description?: string;
  action?: ReactNode;
  testID?: string;
}

const ICON_SIZE = 48;
const ICON_TEST_ID_SUFFIX = '-icon';

function buildA11yLabel(title: string, description?: string): string {
  return description ? `${title}. ${description}` : title;
}

function EmptyStateImpl({ icon, title, description, action, testID }: EmptyStateProps) {
  return (
    <View
      testID={testID}
      accessible={true}
      accessibilityLabel={buildA11yLabel(title, description)}
      className="items-center justify-center px-6 py-8"
    >
      <View
        testID={testID ? `${testID}${ICON_TEST_ID_SUFFIX}` : undefined}
        importantForAccessibility="no"
        accessibilityElementsHidden={true}
      >
        <MaterialIcons name={icon} size={ICON_SIZE} color={colors.text.tertiary} />
      </View>
      <Text className="mt-4 text-heading-md text-text-primary text-center">{title}</Text>
      {description ? (
        <Text className="mt-2 text-body-sm text-text-secondary text-center">{description}</Text>
      ) : null}
      {action ? <View className="mt-6">{action}</View> : null}
    </View>
  );
}

export const EmptyState = memo(EmptyStateImpl);
