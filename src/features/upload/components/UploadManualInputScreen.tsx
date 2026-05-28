import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { useBrands } from '@/features/map/hooks/useBrands';
import { useCategories } from '@/features/map/hooks/useCategories';
import { useMachineTemplates } from '@/features/map/hooks/useMachineTemplates';
import { useSeries } from '@/features/map/hooks/useSeries';
import { AppText } from '@/shared/components/AppText';
import { BrandLogo } from '@/shared/components/BrandLogo';
import { Button } from '@/shared/components/Button';
import type {
  BrandResponse,
  MachineTemplateResponse,
  SeriesResponse,
} from '@/shared/generated/model';
import { formatBrandLabel } from '@/shared/lib/format-brand-label';
import { pressedOpacity } from '@/shared/lib/pressable';
import { templateDisplayName } from '@/shared/lib/template-display-name';

import { SearchableList, type SearchableRow } from './SearchableList';
import { UPLOAD_MACHINE_PHOTO_PATHNAME } from '../constants';
import { filterByFuzzy } from '../lib/catalog-fuzzy';

// Phase 5 follow-up C — brand-first manual-input flow. Replaces the prior
// MachinePicker-driven screen (brand → category chips → template) with a
// 2-step picker (brand → template-of-that-brand) and a fallback free-form
// name step when either side is absent from the catalog.
//
// V27 / machine_series: the first step now searches brands AND series in a
// single merged list. Users read the line name off the machine ("Master Pro")
// without knowing the brand (LEXCO); picking the series row anchors brand +
// series so the template step shows only that line's machines. brand-only
// picks keep the previous behaviour (all of that brand's templates).
//
// body_part lives on machine_templates.category_id, so a successful catalog-
// template pick inherits its category for free; the free-form branch leaves
// gym_machines.template_id NULL and stores the brand+name compound in
// free_form_name with pending_review=true (admin promotes later).
//
// MachinePicker is still mounted on the OCR-fail and "다른 기구로 등록"
// branches of UploadConfirmScreen; this screen owning a different picker is
// intentional — those branches already have a label photo and lean on the
// closed-list affordance, whereas this screen's user opened "직접 입력"
// because there is no label to OCR.

// ─── Picker selections ──────────────────────────────────────────────────────

type EntityPick =
  | { kind: 'brand'; brand: BrandResponse }
  | { kind: 'series'; series: SeriesResponse; brand: BrandResponse }
  | { kind: 'proposed'; query: string };

type TemplatePick =
  | { kind: 'catalog'; template: MachineTemplateResponse }
  | { kind: 'proposed'; query: string };

type Step = 'discovery' | 'template' | 'name';

// ─── Discovery step (brand OR series) ───────────────────────────────────────

interface DiscoveryStepProps {
  brands: readonly BrandResponse[];
  series: readonly SeriesResponse[];
  pick: EntityPick | null;
  onPick: (pick: EntityPick) => void;
}

interface DiscoveryItem {
  kind: 'brand' | 'series';
  id: string;
  primary: string;
  secondary: string;
  // For series rows the brand suffix is appended to the label so the user
  // sees "Master Pro · LEXCO" and the picker resolves to the right brand.
  brand: BrandResponse;
  series: SeriesResponse | null;
}

function buildDiscoveryItems(
  brands: readonly BrandResponse[],
  series: readonly SeriesResponse[],
): DiscoveryItem[] {
  const brandById = new Map(brands.map((b) => [b.id, b] as const));
  const brandItems: DiscoveryItem[] = brands.map(function toBrandItem(brand) {
    return {
      kind: 'brand',
      id: brand.id,
      primary: brand.nameKo,
      secondary: brand.name,
      brand,
      series: null,
    };
  });
  const seriesItems: DiscoveryItem[] = series.flatMap(function toSeriesItem(s) {
    const parent = brandById.get(s.brandId);
    if (parent === undefined) return [];
    return [
      {
        kind: 'series',
        id: s.id,
        primary: s.name,
        secondary: s.nameKo,
        brand: parent,
        series: s,
      },
    ];
  });
  return [...brandItems, ...seriesItems];
}

function DiscoveryStep({ brands, series, pick, onPick }: DiscoveryStepProps) {
  const [query, setQuery] = useState(pick?.kind === 'proposed' ? pick.query : '');

  const items = buildDiscoveryItems(brands, series);
  // Row id maps to either a brand or a series; UUIDs from the two tables
  // never collide so we can index by raw id and look the kind back up via
  // the discovery-item map below.
  const itemsByRowId = new Map(items.map((item) => [item.id, item] as const));
  const matches = filterByFuzzy(items, query, function getLabels(item) {
    return { primary: item.primary, secondary: item.secondary };
  });

  const rows: SearchableRow[] = matches.map(function toRow(m) {
    const item = m.item;
    if (item.kind === 'brand') {
      return { id: item.id, label: formatBrandLabel(item.brand) };
    }
    // Series row: "Master Pro · LEXCO" so the brand attribution is visible.
    const seriesLabel = item.series === null ? item.primary : item.series.name;
    return {
      id: item.id,
      label: `${seriesLabel} · ${formatBrandLabel(item.brand)}`,
    };
  });

  const selectedRowId =
    pick === null
      ? null
      : pick.kind === 'brand'
        ? pick.brand.id
        : pick.kind === 'series'
          ? pick.series.id
          : null;

  const proposeQuery = query.trim();
  const proposeNew =
    proposeQuery !== '' && matches.length === 0
      ? {
          label: `"${proposeQuery}" 신규 브랜드/시리즈로 등록 요청`,
          isSelected: pick?.kind === 'proposed',
          onSelect: function handlePropose() {
            onPick({ kind: 'proposed', query: proposeQuery });
          },
        }
      : null;

  return (
    <View className="gap-3">
      <AppText className="text-body font-semibold text-text-primary">
        어떤 브랜드 또는 시리즈인가요?
      </AppText>
      <SearchableList
        testIDPrefix="upload-manual-brand"
        searchPlaceholder="브랜드 또는 시리즈 검색 (예: Master Pro)"
        query={query}
        onChangeQuery={setQuery}
        rows={rows}
        selectedRowId={selectedRowId}
        onSelectRow={function handleSelect(rowId) {
          const item = itemsByRowId.get(rowId);
          if (item === undefined) return;
          if (item.kind === 'brand') {
            onPick({ kind: 'brand', brand: item.brand });
            return;
          }
          if (item.series !== null) {
            onPick({ kind: 'series', series: item.series, brand: item.brand });
          }
        }}
        emptyMessage="검색 결과가 없어요"
        proposeNew={proposeNew}
        renderLeading={function renderLeading(row) {
          // For both brand rows and series rows we surface the parent brand
          // logo — series rows still need the brand mark next to the series
          // name so the row reads "Master Pro · LEXCO" with Lexco's logo.
          const item = itemsByRowId.get(row.id);
          if (item === undefined) return null;
          return (
            <BrandLogo
              brandId={item.brand.id}
              brandName={item.brand.name}
              brandNameKo={item.brand.nameKo}
              size="md"
            />
          );
        }}
      />
    </View>
  );
}

// ─── Template step ──────────────────────────────────────────────────────────

interface TemplateStepProps {
  brand: BrandResponse;
  series: SeriesResponse | null;
  pick: TemplatePick | null;
  onPick: (pick: TemplatePick) => void;
}

// Templates with no resolvable category fall under this heading rather than
// being dropped — a missing body part shouldn't hide a registrable machine.
const UNCATEGORISED_BODY_PART = '기타';

// Group the brand's templates by body part (운동 부위) so the list reads as
// sections rather than one long flat list. Rows are ordered group-then-label
// because SearchableList renders a header whenever the group changes, so
// same-group rows must be consecutive.
function toBodyPartRows(
  templates: readonly MachineTemplateResponse[],
  bodyPartById: ReadonlyMap<string, string>,
): SearchableRow[] {
  return templates
    .map(function toRow(template): SearchableRow {
      return {
        id: template.id,
        label: templateDisplayName(template),
        group: bodyPartById.get(template.categoryId) ?? UNCATEGORISED_BODY_PART,
      };
    })
    .sort(function byBodyPartThenLabel(a, b) {
      if (a.group !== b.group) return (a.group ?? '').localeCompare(b.group ?? '', 'ko');
      return a.label.localeCompare(b.label, 'ko');
    });
}

function TemplateStep({ brand, series, pick, onPick }: TemplateStepProps) {
  const [query, setQuery] = useState(pick?.kind === 'proposed' ? pick.query : '');
  // V27: when a series was picked in the discovery step, narrow to that
  // product line server-side; otherwise fall back to the whole brand.
  const { data: templates = [] } = useMachineTemplates(
    series !== null ? { seriesId: series.id } : { brandId: brand.id },
  );
  const { data: categories = [] } = useCategories();
  const bodyPartById = new Map(categories.map((category) => [category.id, category.name]));

  const matches = filterByFuzzy(templates, query, function getLabels(template) {
    return { primary: template.nameKo, secondary: template.nameEn };
  });
  const rows: SearchableRow[] = toBodyPartRows(
    matches.map(function toItem(m) {
      return m.item;
    }),
    bodyPartById,
  );
  const selectedRowId = pick?.kind === 'catalog' ? pick.template.id : null;
  const proposeQuery = query.trim();
  const proposeNew =
    proposeQuery !== '' && matches.length === 0
      ? {
          label: `"${proposeQuery}" 신규 기구로 등록 요청`,
          isSelected: pick?.kind === 'proposed',
          onSelect: function handlePropose() {
            onPick({ kind: 'proposed', query: proposeQuery });
          },
        }
      : null;

  return (
    <View className="gap-3">
      <AppText className="text-body font-semibold text-text-primary">어떤 기구인가요?</AppText>
      <SearchableList
        testIDPrefix="upload-manual-template"
        searchPlaceholder="기구 검색 또는 직접 입력"
        query={query}
        onChangeQuery={setQuery}
        rows={rows}
        selectedRowId={selectedRowId}
        onSelectRow={function handleSelect(id) {
          const template = templates.find((t) => t.id === id);
          if (template !== undefined) onPick({ kind: 'catalog', template });
        }}
        emptyMessage={
          series !== null
            ? '이 시리즈에는 등록된 기구가 없어요'
            : '이 브랜드에는 등록된 기구가 없어요'
        }
        proposeNew={proposeNew}
      />
    </View>
  );
}

// ─── Name step ──────────────────────────────────────────────────────────────

interface NameStepProps {
  entity: EntityPick;
  text: string;
  onChangeText: (text: string) => void;
}

// Build the "owner" label shown above the free-form input. For a series pick
// we surface both brand and series so the admin queue gets the richest hint
// in the free-form text: "LEXCO Master Pro 레그익스텐션" rather than just
// "LEXCO 레그익스텐션".
function entityDisplayLabel(entity: EntityPick): string {
  if (entity.kind === 'brand') return formatBrandLabel(entity.brand);
  if (entity.kind === 'series') {
    return `${formatBrandLabel(entity.brand)} ${entity.series.name}`;
  }
  return entity.query;
}

function NameStep({ entity, text, onChangeText }: NameStepProps) {
  const label = entityDisplayLabel(entity);
  return (
    <View className="gap-3">
      <AppText className="text-body font-semibold text-text-primary">
        기구 이름을 입력해 주세요
      </AppText>
      <AppText className="text-body-sm text-text-secondary">
        {label} 의 기구 이름을 입력하면 관리자가 검토 후 카탈로그에 추가해요
      </AppText>
      <TextInput
        testID="upload-manual-name-input"
        className="rounded-xl border border-border bg-bg-muted px-4 py-3 text-body text-text-primary"
        placeholder="예: Lat Pulldown"
        value={text}
        onChangeText={onChangeText}
        autoFocus
      />
    </View>
  );
}

// ─── Crumbs ─────────────────────────────────────────────────────────────────

// Inline "변경" chips above the current step let the user revert without
// losing screen context. Tapping a chip clears the corresponding selection
// and snaps the active step back to that selection's stage.
interface CrumbsProps {
  entity: EntityPick | null;
  template: TemplatePick | null;
  step: Step;
  onRevertEntity: () => void;
  onRevertTemplate: () => void;
}

function entityCrumbLabel(entity: EntityPick): string {
  if (entity.kind === 'brand') return `브랜드: ${formatBrandLabel(entity.brand)}`;
  if (entity.kind === 'series') {
    return `시리즈: ${entity.series.name} (${formatBrandLabel(entity.brand)})`;
  }
  return `브랜드: ${entity.query}`;
}

function Crumbs({ entity, template, step, onRevertEntity, onRevertTemplate }: CrumbsProps) {
  const showEntity = entity !== null && step !== 'discovery';
  const showTemplate = template !== null && step === 'name';
  if (!showEntity && !showTemplate) return null;

  const templateLabel =
    template === null
      ? ''
      : template.kind === 'catalog'
        ? templateDisplayName(template.template)
        : template.query;

  // Catalog brand-or-series picks carry a brand logo; a proposed entry has
  // no id and falls back to text only.
  const entityBrand =
    entity !== null && (entity.kind === 'brand' || entity.kind === 'series') ? entity.brand : null;
  const entityLogo =
    entityBrand !== null ? (
      <BrandLogo
        testID="upload-manual-crumb-brand-logo"
        brandId={entityBrand.id}
        brandName={entityBrand.name}
        brandNameKo={entityBrand.nameKo}
        size="sm"
      />
    ) : null;

  return (
    <View className="gap-1">
      {showEntity ? (
        <Crumb
          testID="upload-manual-crumb-brand"
          label={entityCrumbLabel(entity)}
          leading={entityLogo}
          onRevert={onRevertEntity}
        />
      ) : null}
      {showTemplate ? (
        <Crumb
          testID="upload-manual-crumb-template"
          label={`기구: ${templateLabel}`}
          onRevert={onRevertTemplate}
        />
      ) : null}
    </View>
  );
}

interface CrumbProps {
  testID: string;
  label: string;
  onRevert: () => void;
  /** Optional element rendered before the label (e.g. the brand logo). */
  leading?: ReactNode;
}

function Crumb({ testID, label, onRevert, leading }: CrumbProps) {
  return (
    <View className="flex-row items-center justify-between rounded-lg bg-bg-muted px-3 py-2">
      <View className="flex-1 flex-row items-center gap-2">
        {leading}
        <AppText className="flex-1 text-body-sm text-text-secondary">{label}</AppText>
      </View>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel="이전 단계로 돌아가기"
        onPress={onRevert}
        style={pressedOpacity}
        className="px-2 py-1"
      >
        <AppText className="text-body-sm text-accent underline">변경</AppText>
      </Pressable>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export function UploadManualInputScreen() {
  const router = useRouter();
  const { gymId, naverPlace } = useLocalSearchParams<{
    gymId?: string;
    naverPlace?: string;
  }>();

  const { data: brands = [] } = useBrands();
  const { data: series = [] } = useSeries();

  const [step, setStep] = useState<Step>('discovery');
  const [entity, setEntity] = useState<EntityPick | null>(null);
  const [template, setTemplate] = useState<TemplatePick | null>(null);
  const [freeFormName, setFreeFormName] = useState('');

  function handleEntityPick(next: EntityPick) {
    setEntity(next);
    // Catalog/proposed swap should clear any stale template selection on
    // the (rare) flow back-into-discovery → re-pick path.
    setTemplate(null);
    setFreeFormName('');
    // Auto-advance on pick so the user never has to scroll past a long list
    // to reach a separate "다음" button: brand or series → its template
    // list (filtered by series when present), proposed → free-form name step.
    setStep(next.kind === 'proposed' ? 'name' : 'template');
  }

  function handleTemplatePick(next: TemplatePick) {
    setTemplate(next);
    // Catalog template is a terminal pick — go straight to the photo step,
    // no extra confirmation tap. Proposed template pre-fills the name input
    // with the typed query and advances to the name step.
    if (next.kind === 'catalog') {
      pushToMachinePhoto({ kind: 'template', templateId: next.template.id });
      return;
    }
    setFreeFormName(next.query);
    setStep('name');
  }

  function handleRevertEntity() {
    setEntity(null);
    setTemplate(null);
    setFreeFormName('');
    setStep('discovery');
  }

  function handleRevertTemplate() {
    setTemplate(null);
    setFreeFormName('');
    setStep('template');
  }

  function pushToMachinePhoto(
    selection: { kind: 'template'; templateId: string } | { kind: 'freeForm'; text: string },
  ) {
    router.push({
      pathname: UPLOAD_MACHINE_PHOTO_PATHNAME,
      params: {
        gymId,
        naverPlace,
        selection: JSON.stringify(selection),
      },
    });
  }

  // Discovery and template steps auto-advance on pick (see handleEntityPick /
  // handleTemplatePick), so only the free-form name step needs an explicit
  // submit button.
  function handleSubmitName() {
    if (entity === null) return;
    const trimmedName = freeFormName.trim();
    if (trimmedName === '') return;
    const owner = entityDisplayLabel(entity);
    pushToMachinePhoto({ kind: 'freeForm', text: `${owner} ${trimmedName}` });
  }

  // When a series pick is active, the parent brand is implicit; the template
  // step uses series filtering rather than brand filtering.
  const templateStepBrand =
    entity !== null && (entity.kind === 'brand' || entity.kind === 'series') ? entity.brand : null;
  const templateStepSeries = entity !== null && entity.kind === 'series' ? entity.series : null;

  return (
    <ScrollView
      className="flex-1 bg-bg-base"
      contentContainerClassName="gap-4 p-4"
      keyboardShouldPersistTaps="handled"
    >
      <Crumbs
        entity={entity}
        template={template}
        step={step}
        onRevertEntity={handleRevertEntity}
        onRevertTemplate={handleRevertTemplate}
      />

      {step === 'discovery' ? (
        <DiscoveryStep brands={brands} series={series} pick={entity} onPick={handleEntityPick} />
      ) : null}

      {step === 'template' && templateStepBrand !== null ? (
        <TemplateStep
          brand={templateStepBrand}
          series={templateStepSeries}
          pick={template}
          onPick={handleTemplatePick}
        />
      ) : null}

      {step === 'name' && entity !== null ? (
        <NameStep entity={entity} text={freeFormName} onChangeText={setFreeFormName} />
      ) : null}

      {step === 'name' ? (
        <Button
          testID="upload-manual-next"
          label="다음"
          onPress={handleSubmitName}
          disabled={freeFormName.trim() === ''}
        />
      ) : null}
    </ScrollView>
  );
}
