import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
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
import {
  NO_SERIES_KEY,
  type AccordionSeriesGroup,
  type BrandGroup,
} from '../lib/group-templates-by-brand';

interface FilterSheetBrandAccordionProps {
  groups: readonly BrandGroup[];
  expandedBrandIds: ReadonlySet<string>;
  selectedTemplateIds: readonly string[];
  /**
   * True once a searched bbox exists and the nearby-count overlay is live.
   * Drives the zero-count "전체 보기" tuck — when counts are unknown (no search
   * yet) every row would read 0, so hiding them would empty the filter; we keep
   * all rows visible in that case.
   */
  countsActive: boolean;
  onToggleExpand: (brandId: string) => void;
  onToggleTemplate: (templateId: string) => void;
}

const NO_SERIES_LABEL = '기타';

function nonZeroSeriesGroups(
  seriesGroups: readonly AccordionSeriesGroup[],
): readonly AccordionSeriesGroup[] {
  const result: AccordionSeriesGroup[] = [];
  for (const seriesGroup of seriesGroups) {
    const sections = seriesGroup.sections
      .map((section) => ({
        ...section,
        templates: section.templates.filter((t) => t.gymCount > 0),
      }))
      .filter((section) => section.templates.length > 0);
    if (sections.length > 0) result.push({ ...seriesGroup, sections });
  }
  return result;
}

function countRows(seriesGroups: readonly AccordionSeriesGroup[]): number {
  return seriesGroups.reduce(
    (sum, sg) => sum + sg.sections.reduce((s, sec) => s + sec.templates.length, 0),
    0,
  );
}

interface BrandAccordionBodyProps {
  seriesGroups: readonly AccordionSeriesGroup[];
  selectedTemplateIds: readonly string[];
  countsActive: boolean;
  onToggleTemplate: (templateId: string) => void;
}

/**
 * Expanded body for one brand: Series → 운동 부위 → machine rows. When the
 * nearby-count overlay is live, zero-count rows are tucked behind a 전체 보기
 * toggle so the area's actually-available machines surface first.
 */
function BrandAccordionBody({
  seriesGroups,
  selectedTemplateIds,
  countsActive,
  onToggleTemplate,
}: BrandAccordionBodyProps) {
  const [showAll, setShowAll] = useState(false);
  const hideZero = countsActive && !showAll;
  const totalRows = hideZero ? countRows(seriesGroups) : 0;
  const visibleGroups = hideZero ? nonZeroSeriesGroups(seriesGroups) : seriesGroups;
  const hiddenCount = hideZero ? totalRows - countRows(visibleGroups) : 0;

  return (
    <View>
      {visibleGroups.map((seriesGroup) => (
        <View key={seriesGroup.seriesId ?? NO_SERIES_KEY} className="pb-1">
          <AppText className="px-4 pt-3 text-body-sm font-semibold text-text-secondary">
            {seriesGroup.seriesName ?? NO_SERIES_LABEL}
          </AppText>
          {seriesGroup.sections.map((section) => (
            <View key={section.category.id} className="pb-1">
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
        </View>
      ))}
      {hiddenCount > 0 ? (
        <Pressable
          onPress={() => {
            setShowAll(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`전체 보기 (${String(hiddenCount)})`}
          style={pressedOpacity}
          className="flex-row items-center gap-1 px-4 py-3"
        >
          <MaterialIcons name="more-horiz" size={18} color={colors.text.secondary} />
          <AppText className="text-body-sm text-text-secondary">
            {`주변에 없는 머신 ${String(hiddenCount)}개 전체 보기`}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Phase 5 item 23 (slice a, polished 2026-05-22): the brand accordion body.
 *
 * Renders the precomputed `BrandGroup[]` — each row a tappable brand header
 * that expands into Series → 운동 부위 sub-sections of machine rows. ScrollView
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
  countsActive,
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
                <BrandAccordionBody
                  seriesGroups={group.seriesGroups}
                  selectedTemplateIds={selectedTemplateIds}
                  countsActive={countsActive}
                  onToggleTemplate={onToggleTemplate}
                />
              </Animated.View>
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}
