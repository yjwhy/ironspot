import { type ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/shared/components/AppText';

// Inset for the hairline divider between rows inside a card. Starts under the
// row label (past the leading icon) for an iOS-style grouped-list look:
// horizontal padding (16) + icon (24) + icon→label gap (12).
const ROW_DIVIDER_INSET = 52;

interface ProfileSectionProps {
  /** Optional uppercase caption above the card (e.g. "내 활동", "계정"). */
  title?: string;
  children: ReactNode;
  testID?: string;
}

/**
 * Grouped card section for the profile screen. Renders an optional caption
 * header followed by a rounded white card on the subtle screen background —
 * the contrast (white on bg-subtle) is what makes the card read as a distinct
 * group. Rows inside are separated with {@link CardDivider}; the caller owns
 * divider placement so the last row keeps the card's rounded corner clean.
 */
export function ProfileSection({ title, children, testID }: ProfileSectionProps) {
  return (
    <View className="mx-4 mt-6" testID={testID}>
      {title ? (
        <AppText className="mb-2 px-1 text-caption font-semibold uppercase text-text-tertiary">
          {title}
        </AppText>
      ) : null}
      <View className="overflow-hidden rounded-2xl bg-bg-elevated">{children}</View>
    </View>
  );
}

/** Hairline divider between rows inside a {@link ProfileSection} card. */
export function CardDivider() {
  return <View style={{ marginLeft: ROW_DIVIDER_INSET }} className="h-px bg-border-subtle" />;
}
