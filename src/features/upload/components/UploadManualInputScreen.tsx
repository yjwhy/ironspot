import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { useBrands } from '@/features/map/hooks/useBrands';
import { useCategories } from '@/features/map/hooks/useCategories';
import { useMachineTemplates } from '@/features/map/hooks/useMachineTemplates';
import { useSeries } from '@/features/map/hooks/useSeries';
import { TemplatePhotoSheet } from '@/features/photo/components/TemplatePhotoSheet';
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
import { seriesTaggedDisplayName, templateDisplayName } from '@/shared/lib/template-display-name';
import { colors } from '@/shared/theme/tokens';

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
// MachinePicker is still mounted on the OCR-fail and "다른 머신으로 등록"
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

type Step = 'discovery' | 'series' | 'template' | 'name';

// A brand only gets its own series-selection step when it actually markets
// more than one product line; single-series (or series-less) brands would
// just show a redundant one-item list, so they skip straight to templates.
const MIN_SERIES_FOR_STEP = 2;

// ─── Discovery step (brand OR series) ───────────────────────────────────────

interface DiscoveryStepProps {
  brands: readonly BrandResponse[];
  series: readonly SeriesResponse[];
  isLoading: boolean;
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

function DiscoveryStep({ brands, series, isLoading, pick, onPick }: DiscoveryStepProps) {
  const [query, setQuery] = useState(pick?.kind === 'proposed' ? pick.query : '');

  // V27 follow-up: series rows surface only while the user is actively
  // searching. The empty-state list shows brands alone so the 27-brand
  // catalog doesn't get buried under 74 series rows. Series stay
  // reachable for the "I only know the line name from the machine
  // body" path the moment the user types anything matching.
  const includeSeries = query.trim() !== '';
  const items = buildDiscoveryItems(brands, includeSeries ? series : []);
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
    // Series row: "렉스코 (LEXCO) — Master Pro". Brand leads so the natural
    // parent → child hierarchy reads first ("Toyota Camry" pattern) and the
    // row prefix matches the brand-only row format above for visual scan.
    // Em dash separates because the brand-pair already contains both parens
    // and Korean+English, so a thinner separator would crowd visually.
    const seriesLabel = item.series === null ? item.primary : item.series.name;
    return {
      id: item.id,
      label: `${formatBrandLabel(item.brand)} — ${seriesLabel}`,
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
        isLoading={isLoading}
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

// ─── Series step (only for multi-line brands) ────────────────────────────────

interface SeriesSelectStepProps {
  brand: BrandResponse;
  series: readonly SeriesResponse[];
  onPickSeries: (series: SeriesResponse) => void;
  onShowAll: () => void;
}

function SeriesSelectStep({ brand, series, onPickSeries, onShowAll }: SeriesSelectStepProps) {
  const [query, setQuery] = useState('');
  const matches = filterByFuzzy(series, query, function getLabels(s) {
    return { primary: s.name, secondary: s.nameKo };
  });
  const rows: SearchableRow[] = matches.map(function toRow(m) {
    return { id: m.item.id, label: m.item.name };
  });

  return (
    <View className="gap-3">
      <AppText className="text-body font-semibold text-text-primary">
        {`${formatBrandLabel(brand)} — 어떤 시리즈인가요?`}
      </AppText>
      <SearchableList
        testIDPrefix="upload-manual-series"
        searchPlaceholder="시리즈 검색"
        query={query}
        onChangeQuery={setQuery}
        rows={rows}
        selectedRowId={null}
        onSelectRow={function handleSelect(id) {
          const picked = series.find((s) => s.id === id);
          if (picked !== undefined) onPickSeries(picked);
        }}
        emptyMessage="시리즈가 없어요"
        proposeNew={null}
      />
      <Pressable
        testID="upload-manual-series-show-all"
        accessibilityRole="button"
        accessibilityLabel="시리즈를 모르겠어요, 전체 머신에서 찾기"
        onPress={onShowAll}
        style={pressedOpacity}
        className="self-start py-2"
      >
        <AppText className="text-body-sm text-accent underline">
          시리즈를 모르겠어요 · 전체 머신에서 찾기
        </AppText>
      </Pressable>
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
  // When the list spans a whole brand (no single series picked), tag each row
  // with its series so duplicate model names across product lines stay
  // distinct. When a series was already picked the tag is redundant, so the
  // caller passes an empty map and rows render the plain name.
  seriesNameById: ReadonlyMap<string, string>,
): SearchableRow[] {
  return templates
    .map(function toRow(template): SearchableRow {
      return {
        id: template.id,
        label: seriesTaggedDisplayName(template, seriesNameById),
        group: bodyPartById.get(template.categoryId) ?? UNCATEGORISED_BODY_PART,
      };
    })
    .sort(function byBodyPartThenLabel(a, b) {
      if (a.group !== b.group) return (a.group ?? '').localeCompare(b.group ?? '', 'ko');
      return a.label.localeCompare(b.label, 'ko');
    });
}

// Display name for the sheet title; falls back to an empty string if the
// template is no longer in the fetched list (e.g. query changed mid-preview).
// "find" prefix signals the not-found (empty) case at the call site.
function findTemplateLabelById(
  templates: readonly MachineTemplateResponse[],
  templateId: string,
): string {
  const template = templates.find((t) => t.id === templateId);
  return template === undefined ? '' : templateDisplayName(template);
}

// Web image-search query for a model: brand + English model name gives the
// cleanest gym-equipment results (e.g. "Hammer Strength Lat Pull Down"). Falls
// back to the Korean name, then the brand alone if the template isn't found.
function buildTemplateSearchQuery(
  templates: readonly MachineTemplateResponse[],
  brand: BrandResponse,
  templateId: string,
): string {
  const template = templates.find((t) => t.id === templateId);
  const modelName = template === undefined ? '' : template.nameEn || template.nameKo;
  return `${brand.name} ${modelName}`.trim();
}

// Trailing "사진" control on a template row. Opens the reference-photo sheet
// without selecting the row (it renders outside SearchableList's select Pressable).
const PHOTO_BUTTON_ICON_SIZE = 14;

interface TemplatePhotoButtonProps {
  label: string;
  templateId: string;
  onPress: (templateId: string) => void;
}

function TemplatePhotoButton({ label, templateId, onPress }: TemplatePhotoButtonProps) {
  return (
    <Pressable
      testID={`upload-manual-template-photo-${templateId}`}
      accessibilityRole="button"
      accessibilityLabel={`${label} 사진 보기`}
      onPress={function openPreview() {
        onPress(templateId);
      }}
      style={pressedOpacity}
      className="flex-row items-center gap-1 rounded-full border border-border px-3 py-1.5"
    >
      <MaterialIcons
        name="photo-camera"
        size={PHOTO_BUTTON_ICON_SIZE}
        color={colors.text.secondary}
      />
      <AppText className="text-caption text-text-secondary">사진</AppText>
    </Pressable>
  );
}

function TemplateStep({ brand, series, pick, onPick }: TemplateStepProps) {
  const [query, setQuery] = useState(pick?.kind === 'proposed' ? pick.query : '');
  // Template a user tapped "사진 보기" on — drives the reference-photo sheet.
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  // V27: when a series was picked in the discovery step, narrow to that
  // product line server-side; otherwise fall back to the whole brand.
  const { data: templates = [], isLoading } = useMachineTemplates(
    series !== null ? { seriesId: series.id } : { brandId: brand.id },
  );
  const { data: categories = [] } = useCategories();
  const bodyPartById = new Map(categories.map((category) => [category.id, category.name]));
  // Brand-wide list spans multiple series → tag rows so duplicate model names
  // stay distinct. A series-filtered list is already unambiguous, so the map
  // stays empty and rows render the plain name.
  const { data: allSeries = [] } = useSeries();
  const seriesNameById =
    series === null ? new Map(allSeries.map((s) => [s.id, s.name])) : new Map<string, string>();

  const matches = filterByFuzzy(templates, query, function getLabels(template) {
    return { primary: template.nameKo, secondary: template.nameEn };
  });
  const rows: SearchableRow[] = toBodyPartRows(
    matches.map(function toItem(m) {
      return m.item;
    }),
    bodyPartById,
    seriesNameById,
  );
  const selectedRowId = pick?.kind === 'catalog' ? pick.template.id : null;
  const proposeQuery = query.trim();
  const proposeNew =
    proposeQuery !== '' && matches.length === 0
      ? {
          label: `"${proposeQuery}" 신규 머신으로 등록 요청`,
          isSelected: pick?.kind === 'proposed',
          onSelect: function handlePropose() {
            onPick({ kind: 'proposed', query: proposeQuery });
          },
        }
      : null;

  return (
    <View className="gap-3">
      <AppText className="text-body font-semibold text-text-primary">어떤 머신인가요?</AppText>
      <SearchableList
        testIDPrefix="upload-manual-template"
        searchPlaceholder="머신 검색 또는 직접 입력"
        query={query}
        onChangeQuery={setQuery}
        rows={rows}
        selectedRowId={selectedRowId}
        onSelectRow={function handleSelect(id) {
          const template = templates.find((t) => t.id === id);
          if (template !== undefined) onPick({ kind: 'catalog', template });
        }}
        renderTrailing={function renderPhotoButton(row) {
          return (
            <TemplatePhotoButton
              label={row.label}
              templateId={row.id}
              onPress={setPreviewTemplateId}
            />
          );
        }}
        emptyMessage={
          series !== null
            ? '이 시리즈에는 등록된 머신이 없어요'
            : '이 브랜드에는 등록된 머신이 없어요'
        }
        proposeNew={proposeNew}
        isLoading={isLoading}
      />

      {previewTemplateId !== null ? (
        <TemplatePhotoSheet
          templateId={previewTemplateId}
          templateLabel={findTemplateLabelById(templates, previewTemplateId)}
          searchQuery={buildTemplateSearchQuery(templates, brand, previewTemplateId)}
          onClose={function closePreview() {
            setPreviewTemplateId(null);
          }}
        />
      ) : null}
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
        머신 이름을 입력해 주세요
      </AppText>
      <AppText className="text-body-sm text-text-secondary">
        {label} 의 머신 이름을 입력하면 관리자가 검토 후 카탈로그에 추가해요
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
          label={`머신: ${templateLabel}`}
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

  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const { data: series = [], isLoading: seriesLoading } = useSeries();

  const [step, setStep] = useState<Step>('discovery');
  const [entity, setEntity] = useState<EntityPick | null>(null);
  const [template, setTemplate] = useState<TemplatePick | null>(null);
  const [freeFormName, setFreeFormName] = useState('');

  function seriesForBrand(brandId: string): SeriesResponse[] {
    return series.filter((s) => s.brandId === brandId);
  }

  function handleEntityPick(next: EntityPick) {
    setEntity(next);
    // Catalog/proposed swap should clear any stale template selection on
    // the (rare) flow back-into-discovery → re-pick path.
    setTemplate(null);
    setFreeFormName('');
    // Auto-advance on pick. Proposed → free-form name. A series pick (from the
    // discovery search) jumps straight to that line's templates. A brand pick
    // goes to its series-selection step when the brand has multiple lines,
    // otherwise straight to the (single-line) template list.
    if (next.kind === 'proposed') {
      setStep('name');
      return;
    }
    if (next.kind === 'brand') {
      const lines = seriesForBrand(next.brand.id);
      setStep(lines.length >= MIN_SERIES_FOR_STEP ? 'series' : 'template');
      return;
    }
    setStep('template');
  }

  // Series-selection step: picking a line narrows the template list to it.
  function handleSeriesStepPick(next: SeriesResponse) {
    if (entity?.kind !== 'brand') return;
    setEntity({ kind: 'series', series: next, brand: entity.brand });
    setTemplate(null);
    setFreeFormName('');
    setStep('template');
  }

  // "I don't know the series" escape: keep the brand pick and show every line's
  // machines in one body-part-grouped list (rows carry their [Series] tag).
  function handleShowAllSeries() {
    setStep('template');
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
    setTemplate(null);
    setFreeFormName('');
    // From a series pick under a multi-line brand, step back to that brand's
    // series selection (not all the way to discovery) so the user can re-pick
    // a sibling line without re-finding the brand.
    if (
      entity !== null &&
      entity.kind === 'series' &&
      seriesForBrand(entity.brand.id).length >= MIN_SERIES_FOR_STEP
    ) {
      setEntity({ kind: 'brand', brand: entity.brand });
      setStep('series');
      return;
    }
    setEntity(null);
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
        <DiscoveryStep
          brands={brands}
          series={series}
          isLoading={brandsLoading || seriesLoading}
          pick={entity}
          onPick={handleEntityPick}
        />
      ) : null}

      {step === 'series' && entity !== null && entity.kind === 'brand' ? (
        <SeriesSelectStep
          brand={entity.brand}
          series={seriesForBrand(entity.brand.id)}
          onPickSeries={handleSeriesStepPick}
          onShowAll={handleShowAllSeries}
        />
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
