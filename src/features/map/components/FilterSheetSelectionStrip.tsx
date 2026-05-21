import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import type { MachineTemplateResponse } from '@/shared/generated/model';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';
import type { SearchFilters } from '@/shared/types/database';

import { formatMachineTemplateLabel } from '../lib/active-filters';

interface FilterSheetSelectionStripProps {
  selectedTemplateIds: readonly string[];
  templates: readonly MachineTemplateResponse[];
  machineFilterMode: SearchFilters['machineFilterMode'];
  onRemoveTemplate: (templateId: string) => void;
  onResetAll: () => void;
  onSetMachineFilterMode: (mode: SearchFilters['machineFilterMode']) => void;
}

const AND_TOGGLE_MIN_SELECTION = 2;

/**
 * Phase 5 item 23 (slice a): the footer strip that hosts the selected
 * machine chips, the AND/OR "전체 보유" Switch (only when ≥2 selected), and
 * the bottom "전체 초기화" CTA.
 *
 * Brand prefix is restored on each chip here (per ADR 0024 결정 3) since the
 * accordion parent context is gone — the user looking at the footer needs to
 * distinguish "Panatta Lat Pulldown" from "Hammer Lat Pulldown".
 */
export function FilterSheetSelectionStrip({
  selectedTemplateIds,
  templates,
  machineFilterMode,
  onRemoveTemplate,
  onResetAll,
  onSetMachineFilterMode,
}: FilterSheetSelectionStripProps) {
  if (selectedTemplateIds.length === 0) return null;

  const templatesById = new Map(templates.map((t) => [t.id, t]));
  const selectedTemplates = selectedTemplateIds
    .map((id) => templatesById.get(id))
    .filter((t): t is MachineTemplateResponse => t !== undefined);

  const showAndToggle = selectedTemplateIds.length >= AND_TOGGLE_MIN_SELECTION;

  return (
    <View className="border-t border-border bg-bg-elevated px-4 pt-3">
      <View className="flex-row items-center justify-between pb-2">
        <AppText className="text-caption font-medium text-text-secondary">
          선택 ({selectedTemplateIds.length})
        </AppText>
        {showAndToggle ? (
          <View className="flex-row items-center gap-2">
            <AppText className="text-caption text-text-secondary">전체 보유</AppText>
            <Switch
              accessibilityLabel="선택한 머신 전체를 보유한 헬스장만"
              value={machineFilterMode === 'and'}
              onValueChange={(value) => {
                onSetMachineFilterMode(value ? 'and' : 'or');
              }}
              trackColor={{ false: colors.bg.subtle, true: colors.accent.DEFAULT }}
              thumbColor={colors.bg.elevated}
            />
          </View>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        className="pb-3"
      >
        {selectedTemplates.map((template) => (
          <View
            key={template.id}
            className="flex-row items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1"
          >
            <AppText className="text-caption text-text-primary">
              {formatMachineTemplateLabel(template)}
            </AppText>
            <Pressable
              onPress={() => {
                onRemoveTemplate(template.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${formatMachineTemplateLabel(template)} 제거`}
              hitSlop={8}
              style={pressedOpacity}
            >
              <MaterialIcons name="close" size={14} color={colors.text.secondary} />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <Pressable
        onPress={onResetAll}
        accessibilityRole="button"
        accessibilityLabel="필터 전체 해제"
        style={pressedOpacity}
        className="h-10 flex-row items-center justify-center border-t border-border"
      >
        <AppText className="text-body-sm font-medium text-accent">전체 초기화</AppText>
      </Pressable>
    </View>
  );
}
