import { View } from 'react-native';

import { AppText } from '@/shared/components/AppText';

interface NlQuotaHintProps {
  used: number;
  limit: number;
}

const LOW_REMAINING_THRESHOLD = 10;

/**
 * Tiny one-liner below the InterpretationChip showing "남은 NL 검색 N/limit".
 * Rendered after every successful NL search so the user always knows where
 * they stand against the monthly quota — chosen over a "warn near limit only"
 * design because surprise quota-exhaustion was the original UX complaint.
 *
 * Switches to a warning tone (red) once the remaining count drops to or
 * below `LOW_REMAINING_THRESHOLD`, so the indicator earns visual weight only
 * when it actually matters.
 */
export function NlQuotaHint({ used, limit }: NlQuotaHintProps) {
  const remaining = Math.max(0, limit - used);
  const isLow = remaining <= LOW_REMAINING_THRESHOLD;
  const toneClass = isLow ? 'text-red-600' : 'text-text-tertiary';
  return (
    <View className="self-start px-3 pt-1">
      <AppText className={`text-caption ${toneClass}`}>
        이번 달 검색 {remaining}/{limit}회 남음
      </AppText>
    </View>
  );
}
