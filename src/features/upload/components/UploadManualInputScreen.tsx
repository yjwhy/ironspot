import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { useBrands } from '@/features/map/hooks/useBrands';
import { useMachineTemplates } from '@/features/map/hooks/useMachineTemplates';
import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import type { BrandResponse, MachineTemplateResponse } from '@/shared/generated/model';
import { formatBrandLabel } from '@/shared/lib/format-brand-label';
import { pressedOpacity } from '@/shared/lib/pressable';
import { templateDisplayName } from '@/shared/lib/template-display-name';

import { SearchableList, type SearchableRow } from './SearchableList';
import { UPLOAD_MACHINE_PHOTO_PATHNAME } from '../constants';
import { filterByFuzzy } from '../lib/catalog-fuzzy';

// Phase 5 follow-up C — brand-first manual-input flow. Replaces the prior
// MachinePicker-driven screen (brand → category chips → template) with a
// 2-step picker (brand → template-of-that-brand) and a fallback free-form
// name step when either side is absent from the catalog. body_part lives on
// machine_templates.category_id, so a successful catalog-template pick
// inherits its category for free; the free-form branch leaves
// gym_machines.template_id NULL and stores the brand+name compound in
// free_form_name with pending_review=true (admin promotes later).
//
// MachinePicker is still mounted on the OCR-fail and "다른 기구로 등록"
// branches of UploadConfirmScreen; this screen owning a different picker is
// intentional — those branches already have a label photo and lean on the
// closed-list affordance, whereas this screen's user opened "직접 입력"
// because there is no label to OCR.

// ─── Picker selections ──────────────────────────────────────────────────────

type BrandPick = { kind: 'catalog'; brand: BrandResponse } | { kind: 'proposed'; query: string };

type TemplatePick =
  | { kind: 'catalog'; template: MachineTemplateResponse }
  | { kind: 'proposed'; query: string };

type Step = 'brand' | 'template' | 'name';

// ─── Brand step ─────────────────────────────────────────────────────────────

interface BrandStepProps {
  brands: readonly BrandResponse[];
  pick: BrandPick | null;
  onPick: (pick: BrandPick) => void;
}

function BrandStep({ brands, pick, onPick }: BrandStepProps) {
  const [query, setQuery] = useState(pick?.kind === 'proposed' ? pick.query : '');

  const matches = filterByFuzzy(brands, query, function getLabels(brand) {
    return { primary: brand.nameKo, secondary: brand.name };
  });
  const rows: SearchableRow[] = matches.map(function toRow(m) {
    return { id: m.item.id, label: formatBrandLabel(m.item) };
  });
  const selectedRowId = pick?.kind === 'catalog' ? pick.brand.id : null;
  const proposeQuery = query.trim();
  const proposeNew =
    proposeQuery !== '' && matches.length === 0
      ? {
          label: `"${proposeQuery}" 신규 브랜드로 등록 요청`,
          isSelected: pick?.kind === 'proposed',
          onSelect: function handlePropose() {
            onPick({ kind: 'proposed', query: proposeQuery });
          },
        }
      : null;

  return (
    <View className="gap-3">
      <AppText className="text-body font-semibold text-text-primary">어떤 브랜드인가요?</AppText>
      <SearchableList
        testIDPrefix="upload-manual-brand"
        searchPlaceholder="브랜드 검색 또는 직접 입력"
        query={query}
        onChangeQuery={setQuery}
        rows={rows}
        selectedRowId={selectedRowId}
        onSelectRow={function handleSelect(id) {
          const brand = brands.find((b) => b.id === id);
          if (brand !== undefined) onPick({ kind: 'catalog', brand });
        }}
        emptyMessage="검색 결과가 없어요"
        proposeNew={proposeNew}
      />
    </View>
  );
}

// ─── Template step ──────────────────────────────────────────────────────────

interface TemplateStepProps {
  brand: BrandResponse;
  pick: TemplatePick | null;
  onPick: (pick: TemplatePick) => void;
}

function TemplateStep({ brand, pick, onPick }: TemplateStepProps) {
  const [query, setQuery] = useState(pick?.kind === 'proposed' ? pick.query : '');
  // Hook only fires for a catalog brand; brand.id is sufficient as the filter
  // (category narrows in MachinePicker but is intentionally absent here).
  const { data: templates = [] } = useMachineTemplates({ brandId: brand.id });

  const matches = filterByFuzzy(templates, query, function getLabels(template) {
    return { primary: template.nameKo, secondary: template.nameEn };
  });
  const rows: SearchableRow[] = matches.map(function toRow(m) {
    return { id: m.item.id, label: templateDisplayName(m.item) };
  });
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
        emptyMessage="이 브랜드에는 등록된 기구가 없어요"
        proposeNew={proposeNew}
      />
    </View>
  );
}

// ─── Name step ──────────────────────────────────────────────────────────────

interface NameStepProps {
  brand: BrandPick;
  text: string;
  onChangeText: (text: string) => void;
}

function NameStep({ brand, text, onChangeText }: NameStepProps) {
  const brandLabel = brand.kind === 'catalog' ? formatBrandLabel(brand.brand) : brand.query;
  return (
    <View className="gap-3">
      <AppText className="text-body font-semibold text-text-primary">
        기구 이름을 입력해 주세요
      </AppText>
      <AppText className="text-body-sm text-text-secondary">
        {brandLabel} 의 기구 이름을 입력하면 관리자가 검토 후 카탈로그에 추가해요
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
  brand: BrandPick | null;
  template: TemplatePick | null;
  step: Step;
  onRevertBrand: () => void;
  onRevertTemplate: () => void;
}

function Crumbs({ brand, template, step, onRevertBrand, onRevertTemplate }: CrumbsProps) {
  const showBrand = brand !== null && step !== 'brand';
  const showTemplate = template !== null && step === 'name';
  if (!showBrand && !showTemplate) return null;

  const brandLabel =
    brand === null ? '' : brand.kind === 'catalog' ? formatBrandLabel(brand.brand) : brand.query;
  const templateLabel =
    template === null
      ? ''
      : template.kind === 'catalog'
        ? templateDisplayName(template.template)
        : template.query;

  return (
    <View className="gap-1">
      {showBrand ? (
        <Crumb
          testID="upload-manual-crumb-brand"
          label={`브랜드: ${brandLabel}`}
          onRevert={onRevertBrand}
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
}

function Crumb({ testID, label, onRevert }: CrumbProps) {
  return (
    <View className="flex-row items-center justify-between rounded-lg bg-bg-muted px-3 py-2">
      <AppText className="flex-1 text-body-sm text-text-secondary">{label}</AppText>
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

  const [step, setStep] = useState<Step>('brand');
  const [brand, setBrand] = useState<BrandPick | null>(null);
  const [template, setTemplate] = useState<TemplatePick | null>(null);
  const [freeFormName, setFreeFormName] = useState('');

  function handleBrandPick(next: BrandPick) {
    setBrand(next);
    // Catalog/proposed swap should clear any stale template selection on
    // the (rare) flow back-into-brand-step → re-pick path.
    setTemplate(null);
    setFreeFormName('');
  }

  function handleTemplatePick(next: TemplatePick) {
    setTemplate(next);
    setFreeFormName('');
  }

  function handleRevertBrand() {
    setBrand(null);
    setTemplate(null);
    setFreeFormName('');
    setStep('brand');
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

  function handleNext() {
    if (step === 'brand') {
      if (brand === null) return;
      setStep(brand.kind === 'catalog' ? 'template' : 'name');
      return;
    }
    if (step === 'template') {
      if (template === null) return;
      if (template.kind === 'catalog') {
        pushToMachinePhoto({ kind: 'template', templateId: template.template.id });
        return;
      }
      // Pre-fill the name input with whatever the user already typed into the
      // template search box — the common case is "they typed the model name
      // there to confirm it wasn't in the catalog", so typing it again on the
      // next step would be redundant.
      setFreeFormName(template.query);
      setStep('name');
      return;
    }
    // step === 'name'
    if (brand === null) return;
    const trimmedName = freeFormName.trim();
    if (trimmedName === '') return;
    const brandLabel = brand.kind === 'catalog' ? formatBrandLabel(brand.brand) : brand.query;
    pushToMachinePhoto({ kind: 'freeForm', text: `${brandLabel} ${trimmedName}` });
  }

  const canProceed = (() => {
    if (step === 'brand') return brand !== null;
    if (step === 'template') return template !== null;
    return freeFormName.trim() !== '';
  })();

  return (
    <ScrollView
      className="flex-1 bg-bg-base"
      contentContainerClassName="gap-4 p-4"
      keyboardShouldPersistTaps="handled"
    >
      <Crumbs
        brand={brand}
        template={template}
        step={step}
        onRevertBrand={handleRevertBrand}
        onRevertTemplate={handleRevertTemplate}
      />

      {step === 'brand' ? (
        <BrandStep brands={brands} pick={brand} onPick={handleBrandPick} />
      ) : null}

      {step === 'template' && brand !== null && brand.kind === 'catalog' ? (
        <TemplateStep brand={brand.brand} pick={template} onPick={handleTemplatePick} />
      ) : null}

      {step === 'name' && brand !== null ? (
        <NameStep brand={brand} text={freeFormName} onChangeText={setFreeFormName} />
      ) : null}

      <Button
        testID="upload-manual-next"
        label="다음"
        onPress={handleNext}
        disabled={!canProceed}
      />
    </ScrollView>
  );
}
