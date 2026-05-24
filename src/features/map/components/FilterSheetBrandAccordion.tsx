import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import { AppText } from '@/shared/components/AppText';
import { BrandLogo } from '@/shared/components/BrandLogo';
import { formatBrandLabel } from '@/shared/lib/format-brand-label';
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
 * Phase 5 item 23 (slice a, polished 2026-05-22): the brand accordion body.
 *
 * Renders the precomputed `BrandGroup[]` — each row a tappable brand header
 * that expands into per-운동 부위 sub-sections of machine rows. ScrollView
 * is the canonical container per Q7 — N=24 brand rows fit comfortably, and
 * only the expanded brands render their machine rows.
 *
 * Motion (slice c + 2026-05-22 fix):
 *   - Outer brand rows fade in/out when they appear/disappear from the
 *     active 운동 부위 + search narrowing. We removed the previous
 *     `LinearTransition.springify()` on the outer row because the spring's
 *     overshoot caused the whole list to bounce up-and-down on every
 *     category toggle (user-reported bug). A simple `FadeIn`/`FadeOut`
 *     is calm and matches the implicit "this row disappeared because the
 *     filter removed it" mental model.
 *   - Inner expanded body keeps the spring `LinearTransition` so the
 *     reveal animates smoothly as the user expands/collapses a brand.
 *   - `useReducedMotion()` snaps everything instantly when the system
 *     accessibility flag is on.
 */
export function FilterSheetBrandAccordion({
  groups,
  expandedBrandIds,
  selectedTemplateIds,
  onToggleExpand,
  onToggleTemplate,
}: FilterSheetBrandAccordionProps) {
  const reduceMotion = useReducedMotion();
  const bodyLayoutTransition = reduceMotion ? undefined : LinearTransition.springify().damping(18);
  const rowEntering = reduceMotion ? undefined : FadeIn.duration(160);
  const rowExiting = reduceMotion ? undefined : FadeOut.duration(120);

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
            entering={rowEntering}
            exiting={rowExiting}
            className="border-b border-border"
          >
            <Pressable
              onPress={() => {
                onToggleExpand(group.brand.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={formatBrandLabel(group.brand)}
              accessibilityState={{ expanded: isExpanded }}
              style={pressedOpacity}
              className="flex-row items-center gap-2 px-4 py-3.5"
            >
              <MaterialIcons
                name={isExpanded ? 'expand-more' : 'chevron-right'}
                size={20}
                color={colors.text.secondary}
              />
              <BrandLogo
                brandId={group.brand.id}
                brandName={group.brand.name}
                brandNameKo={group.brand.nameKo}
                size="md"
              />
              <AppText className="flex-1 text-body-md font-medium text-text-primary">
                {formatBrandLabel(group.brand)}
              </AppText>
              <AppText className="text-caption text-text-tertiary">
                {String(group.totalCount)}
              </AppText>
            </Pressable>
            {isExpanded ? (
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(180)}
                exiting={reduceMotion ? undefined : FadeOut.duration(140)}
                layout={bodyLayoutTransition}
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
