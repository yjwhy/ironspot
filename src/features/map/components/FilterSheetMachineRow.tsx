import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { templateDisplayName } from '@/shared/lib/template-display-name';
import { colors } from '@/shared/theme/tokens';

import type { AccordionMachineRow } from '../lib/group-templates-by-brand';

const LOADING_TYPE_SUFFIX: Record<string, string> = {
  pin: '핀',
  plate: '플레이트',
};

interface FilterSheetMachineRowProps {
  template: AccordionMachineRow;
  selected: boolean;
  onToggle: (templateId: string) => void;
}

/**
 * Phase 5 item 23 (slice a): one machine row inside an expanded brand
 * accordion. The brand prefix is intentionally absent — the parent brand row
 * is right above so the prefix would be redundant (ADR 0024 결정 3:
 * "accordion 안에선 brand prefix 생략(implicit), footer chip은 prefix 복원").
 * The loading-type suffix stays so a brand's pin vs plate variants of the
 * same exercise stay distinguishable.
 */
export function FilterSheetMachineRow({
  template,
  selected,
  onToggle,
}: FilterSheetMachineRowProps) {
  const loadingSuffix = LOADING_TYPE_SUFFIX[template.loadingType] ?? template.loadingType;
  const label = `${templateDisplayName(template)} · ${loadingSuffix}`;
  return (
    <Pressable
      onPress={() => {
        onToggle(template.id);
      }}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={pressedOpacity}
      className="flex-row items-center gap-3 py-2.5 pl-4 pr-3"
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded border ${
          selected ? 'border-accent bg-accent' : 'border-border bg-bg-elevated'
        }`}
      >
        {selected ? <MaterialIcons name="check" size={14} color={colors.bg.elevated} /> : null}
      </View>
      <AppText className="flex-1 text-body-md text-text-primary">{label}</AppText>
      {template.gymCount > 0 ? (
        <View className="rounded-full bg-bg-elevated px-2 py-0.5">
          <AppText className="text-body-sm text-text-secondary">{`${String(template.gymCount)}곳`}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
