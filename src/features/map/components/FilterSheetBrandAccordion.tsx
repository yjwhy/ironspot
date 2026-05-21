import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import { AppText } from '@/shared/components/AppText';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

import { FilterSheetMachineRow } from './FilterSheetMachineRow';
import type { BrandGroup } from '../lib/group-templates-by-brand';

interface FilterSheetBrandAccordionProps {
  groups: readonly BrandGroup[];
  expandedBrandIds: ReadonlySet<string>;
  selectedTemplateIds: readonly string[];
  onToggleExpand: (brandId: string) => void;
  onToggleTemplate: (templateId: string) => void;
}

/**
 * Phase 5 item 23 (slice a): the brand accordion body.
 *
 * Renders the precomputed `BrandGroup[]` — each row a tappable brand header
 * that expands into per-운동 부위 sub-sections of machine rows. Slice a is
 * static (no animations, no virtualization); slice c layers in Reanimated
 * `LayoutAnimation` for the expand/collapse motion. ScrollView is the
 * canonical container per Q7 — N=24 brand rows fit comfortably, and only
 * the expanded brands render their machine rows so the worst-case row
 * count stays well under FlashList's threshold.
 */
export function FilterSheetBrandAccordion({
  groups,
  expandedBrandIds,
  selectedTemplateIds,
  onToggleExpand,
  onToggleTemplate,
}: FilterSheetBrandAccordionProps) {
  // Slice c: respect prefers-reduced-motion. When the system flag is on,
  // expand/collapse and brand-row layout shifts snap instantly. We honour
  // the preference by skipping the Animated transitions and falling back
  // to plain View nodes via the `reduceMotion` ternary on `layout`.
  const reduceMotion = useReducedMotion();
  const layoutTransition = reduceMotion ? undefined : LinearTransition.springify().damping(18);

  if (groups.length === 0) {
    return (
      <View className="items-center px-4 py-12">
        <MaterialIcons name="filter-list-off" size={32} color={colors.text.tertiary} />
        <AppText className="mt-3 text-center text-body-sm text-text-secondary">
          필터에 맞는 머신이 없어요
        </AppText>
      </View>
    );
  }

  return (
    <View>
      {groups.map((group) => {
        const isExpanded = expandedBrandIds.has(group.brand.id);
        return (
          <Animated.View
            key={group.brand.id}
            layout={layoutTransition}
            className="border-b border-border"
          >
            <Pressable
              onPress={() => {
                onToggleExpand(group.brand.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={group.brand.name}
              accessibilityState={{ expanded: isExpanded }}
              style={pressedOpacity}
              className="flex-row items-center gap-2 px-4 py-3.5"
            >
              <MaterialIcons
                name={isExpanded ? 'expand-more' : 'chevron-right'}
                size={20}
                color={colors.text.secondary}
              />
              <AppText className="flex-1 text-body-md font-medium text-text-primary">
                {group.brand.name}
              </AppText>
              <AppText className="text-caption text-text-tertiary">
                {String(group.totalCount)}
              </AppText>
            </Pressable>
            {isExpanded ? (
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(180)}
                exiting={reduceMotion ? undefined : FadeOut.duration(140)}
                layout={layoutTransition}
              >
                {group.sections.map((section) => (
                  <View key={section.category.id} className="pb-2">
                    <AppText className="px-4 pt-2 text-caption font-medium text-text-tertiary">
                      {section.category.name} ({section.templates.length})
                    </AppText>
                    {section.templates.map((template) => (
                      <FilterSheetMachineRow
                        key={template.id}
                        template={template}
                        selected={selectedTemplateIds.includes(template.id)}
                        onToggle={onToggleTemplate}
                      />
                    ))}
                  </View>
                ))}
              </Animated.View>
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}
