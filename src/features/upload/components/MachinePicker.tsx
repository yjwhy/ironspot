import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useBrands } from '@/features/map/hooks/useBrands';
import { useCategories } from '@/features/map/hooks/useCategories';
import { useMachineTemplates } from '@/features/map/hooks/useMachineTemplates';
import { AppText } from '@/shared/components/AppText';
import { Chip } from '@/shared/components/Chip';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

import { selectedRowClass } from './selectedRowClass';

// Phase 5 item 11 slice 3: closed-list autocomplete picker for the OCR-failure
// branch (and OcrSuccess "직접 입력" branch). Progressive disclosure: brand →
// category → template. Escape hatch link is always visible so a user whose
// machine is genuinely absent from the catalog can fall back to free-text
// (admin queue picks it up via pending_review=true on the backend).

export type MachinePickerSelection =
  | { kind: 'none' }
  | { kind: 'template'; templateId: string }
  | { kind: 'freeForm'; text: string };

interface MachinePickerProps {
  value: MachinePickerSelection;
  onChange: (selection: MachinePickerSelection) => void;
}

// NOTE on state lifecycle: the picker manages mount-local UI state
// (brandId, categoryId, queries, isEscapeHatchOpen). The `value` prop seeds
// `isEscapeHatchOpen` on mount only — subsequent parent-driven `value`
// changes do not re-sync it. Callers that need a hard reset (e.g.
// UploadConfirmScreen's "다시 시도" path) must unmount/remount the picker via
// a key change or by toggling the parent that owns the mount.
export function MachinePicker({ value, onChange }: MachinePickerProps) {
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandQuery, setBrandQuery] = useState('');
  const [templateQuery, setTemplateQuery] = useState('');
  const [isEscapeHatchOpen, setIsEscapeHatchOpen] = useState(value.kind === 'freeForm');

  const { data: brands } = useBrands();
  const { data: categories } = useCategories();
  const { data: templates } = useMachineTemplates();

  const isBrandPicked = brandId !== '';
  const isCategoryPicked = categoryId !== '';
  const selectedTemplateId = value.kind === 'template' ? value.templateId : '';
  const freeFormText = value.kind === 'freeForm' ? value.text : '';

  function handleSelectBrand(nextBrandId: string) {
    // Changing brand invalidates the prior template selection (filter changes
    // so the old templateId may no longer match brand+category). Reset
    // downstream UI state too. Tapping a brand while the escape hatch is
    // open is also the user signalling intent to return to the closed-list
    // path, so close the hatch and clear any in-progress freeform input.
    setBrandId(nextBrandId);
    setCategoryId('');
    setTemplateQuery('');
    setIsEscapeHatchOpen(false);
    if (value.kind !== 'none') onChange({ kind: 'none' });
  }

  function handleSelectCategory(nextCategoryId: string) {
    // No setIsEscapeHatchOpen(false) here on purpose: CategoryStep is only
    // rendered when `!isEscapeHatchOpen` (see line ~99), so this handler is
    // unreachable while the escape hatch is open.
    setCategoryId(nextCategoryId);
    setTemplateQuery('');
    if (value.kind === 'template') onChange({ kind: 'none' });
  }

  function handleSelectTemplate(templateId: string) {
    setIsEscapeHatchOpen(false);
    onChange({ kind: 'template', templateId });
  }

  function handleOpenEscapeHatch() {
    setIsEscapeHatchOpen(true);
    onChange({ kind: 'freeForm', text: '' });
  }

  function handleChangeFreeForm(text: string) {
    onChange({ kind: 'freeForm', text });
  }

  return (
    <View testID="machine-picker" className="gap-4">
      <BrandStep
        brands={brands ?? []}
        selectedBrandId={brandId}
        query={brandQuery}
        onChangeQuery={setBrandQuery}
        onSelect={handleSelectBrand}
        isDisabled={isEscapeHatchOpen}
      />

      {isBrandPicked && !isEscapeHatchOpen ? (
        <CategoryStep
          categories={categories ?? []}
          selectedCategoryId={categoryId}
          onSelect={handleSelectCategory}
        />
      ) : null}

      {isBrandPicked && isCategoryPicked && !isEscapeHatchOpen ? (
        <TemplateStep
          templates={(templates ?? []).filter(
            (t) => t.brandId === brandId && t.categoryId === categoryId,
          )}
          selectedTemplateId={selectedTemplateId}
          query={templateQuery}
          onChangeQuery={setTemplateQuery}
          onSelect={handleSelectTemplate}
        />
      ) : null}

      <EscapeHatch
        isOpen={isEscapeHatchOpen}
        text={freeFormText}
        onOpen={handleOpenEscapeHatch}
        onChangeText={handleChangeFreeForm}
      />
    </View>
  );
}

// ─── Brand step ─────────────────────────────────────────────────────────────

interface BrandStepProps {
  brands: readonly { id: string; name: string }[];
  selectedBrandId: string;
  query: string;
  onChangeQuery: (text: string) => void;
  onSelect: (brandId: string) => void;
  isDisabled: boolean;
}

function BrandStep({
  brands,
  selectedBrandId,
  query,
  onChangeQuery,
  onSelect,
  isDisabled,
}: BrandStepProps) {
  const filteredBrands = filterByName(brands, query);

  return (
    <View className="gap-2">
      <StepLabel index={1} label="브랜드" />
      <SearchInput
        testID="machine-picker-brand-search"
        placeholder="브랜드 검색"
        value={query}
        onChangeText={onChangeQuery}
      />
      <View className="gap-2">
        {filteredBrands.map(function renderBrand(brand) {
          const isSelected = !isDisabled && brand.id === selectedBrandId;
          return (
            <Pressable
              key={brand.id}
              testID={`machine-picker-brand-option-${brand.id}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={function handlePress() {
                onSelect(brand.id);
              }}
              style={pressedOpacity}
              className={selectedRowClass(isSelected)}
            >
              <AppText className="text-body text-text-primary">{brand.name}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Category step ──────────────────────────────────────────────────────────

interface CategoryStepProps {
  categories: readonly { id: string; name: string }[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
}

function CategoryStep({ categories, selectedCategoryId, onSelect }: CategoryStepProps) {
  return (
    <View className="gap-2">
      <StepLabel index={2} label="부위" />
      <View className="flex-row flex-wrap gap-2">
        {categories.map(function renderChip(category) {
          return (
            <Chip
              key={category.id}
              testID={`machine-picker-category-chip-${category.id}`}
              label={category.name}
              selected={category.id === selectedCategoryId}
              onPress={function handlePress() {
                onSelect(category.id);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Template step ──────────────────────────────────────────────────────────

interface TemplateStepProps {
  templates: readonly { id: string; brandName: string; name: string }[];
  selectedTemplateId: string;
  query: string;
  onChangeQuery: (text: string) => void;
  onSelect: (templateId: string) => void;
}

function TemplateStep({
  templates,
  selectedTemplateId,
  query,
  onChangeQuery,
  onSelect,
}: TemplateStepProps) {
  const filteredTemplates = filterByName(templates, query);

  return (
    <View className="gap-2">
      <StepLabel index={3} label="기구" />
      <SearchInput
        testID="machine-picker-template-search"
        placeholder="기구 검색"
        value={query}
        onChangeText={onChangeQuery}
      />
      <View className="gap-2">
        {filteredTemplates.length === 0 ? (
          <AppText className="text-body-sm text-text-secondary">
            해당 조합에 등록된 기구가 없어요
          </AppText>
        ) : (
          filteredTemplates.map(function renderTemplate(template) {
            const isSelected = template.id === selectedTemplateId;
            return (
              <Pressable
                key={template.id}
                testID={`machine-picker-template-option-${template.id}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                onPress={function handlePress() {
                  onSelect(template.id);
                }}
                style={pressedOpacity}
                className={selectedRowClass(isSelected)}
              >
                <AppText className="text-body text-text-primary">
                  {`${template.brandName} ${template.name}`}
                </AppText>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

// ─── Escape hatch ───────────────────────────────────────────────────────────

interface EscapeHatchProps {
  isOpen: boolean;
  text: string;
  onOpen: () => void;
  onChangeText: (text: string) => void;
}

function EscapeHatch({ isOpen, text, onOpen, onChangeText }: EscapeHatchProps) {
  if (!isOpen) {
    return (
      <Pressable
        testID="machine-picker-escape-link"
        accessibilityRole="link"
        onPress={onOpen}
        style={pressedOpacity}
        className="self-start py-2"
      >
        <AppText className="text-body-sm text-accent underline">
          리스트에 없어요? 직접 입력하기
        </AppText>
      </Pressable>
    );
  }

  return (
    <View className="gap-2">
      <AppText className="text-body-sm text-text-secondary">
        리스트에 없는 기구는 검토 후 등록돼요
      </AppText>
      <TextInput
        testID="machine-picker-freeform-input"
        className="rounded-xl border border-border bg-bg-muted px-4 py-3 text-body text-text-primary"
        placeholder="기구 이름을 입력하세요"
        value={text}
        onChangeText={onChangeText}
        autoFocus
      />
    </View>
  );
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

interface StepLabelProps {
  index: number;
  label: string;
}

function StepLabel({ index, label }: StepLabelProps) {
  return (
    <AppText className="text-body-sm font-semibold text-text-secondary">
      {`${String(index)}. ${label}`}
    </AppText>
  );
}

interface SearchInputProps {
  testID: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
}

function SearchInput({ testID, placeholder, value, onChangeText }: SearchInputProps) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-bg-muted px-3 py-2">
      <MaterialIcons name="search" size={16} color={colors.text.tertiary} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        accessibilityLabel={placeholder}
        className="flex-1 text-body-sm text-text-primary"
      />
    </View>
  );
}

function filterByName<T extends { name: string }>(items: readonly T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [...items];
  return items.filter((item) => item.name.toLowerCase().includes(needle));
}
