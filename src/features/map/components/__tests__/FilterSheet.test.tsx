import { fireEvent, render } from '@testing-library/react-native';
import type * as ReactNative from 'react-native';

import type { MachineTemplateResponse } from '@/shared/generated/model';
import type { Brand, Category, SearchFilters } from '@/shared/types/database';
import type * as BottomSheetMockModule from '@/test/utils/bottom-sheet-mock';

import { FilterSheet } from '../FilterSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('@/test/utils/bottom-sheet-mock') as typeof BottomSheetMockModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native') as typeof ReactNative;
  return {
    __esModule: true,
    default: mock.BottomSheetPassthrough,
    BottomSheetModal: mock.BottomSheetModalPassthrough,
    BottomSheetModalProvider: mock.BottomSheetPassthrough,
    BottomSheetView: mock.BottomSheetPassthrough,
    BottomSheetScrollView: mock.BottomSheetPassthrough,
    BottomSheetTextInput: RN.TextInput,
    BottomSheetBackdrop: () => null,
  };
});

const brands: Brand[] = [
  { id: 'b1', name: 'Panatta' },
  { id: 'b2', name: 'Hammer Strength' },
];

const categories: Category[] = [
  { id: 'c1', name: '등' },
  { id: 'c2', name: '가슴' },
];

const machineTemplates: MachineTemplateResponse[] = [
  {
    id: 't1',
    brandId: 'b1',
    brandName: 'Panatta',
    categoryId: 'c1',
    nameEn: 'High Row',
    nameKo: '하이로우',
    loadingType: 'pin',
  },
  {
    id: 't2',
    brandId: 'b1',
    brandName: 'Panatta',
    categoryId: 'c2',
    nameEn: 'Chest Press',
    nameKo: '체스트 프레스',
    loadingType: 'plate',
  },
  {
    id: 't3',
    brandId: 'b2',
    brandName: 'Hammer Strength',
    categoryId: 'c2',
    nameEn: 'Iso Chest Press',
    nameKo: '아이소 체스트 프레스',
    loadingType: 'plate',
  },
];

const emptyFilters: SearchFilters = {
  brandIds: [],
  categoryIds: [],
  templateIds: [],
  machineFilterMode: 'or',
};

interface RenderOptions {
  filters?: SearchFilters;
  onToggleBrand?: (id: string) => void;
  onToggleCategory?: (id: string) => void;
  onToggleTemplate?: (id: string) => void;
  onSetMachineFilterMode?: (mode: 'or' | 'and') => void;
  onResetAll?: () => void;
}

function renderSheet(options: RenderOptions = {}) {
  const onToggleBrand = options.onToggleBrand ?? jest.fn();
  const onToggleCategory = options.onToggleCategory ?? jest.fn();
  const onToggleTemplate = options.onToggleTemplate ?? jest.fn();
  const onSetMachineFilterMode = options.onSetMachineFilterMode ?? jest.fn();
  const onResetAll = options.onResetAll ?? jest.fn();
  return {
    onToggleBrand,
    onToggleCategory,
    onToggleTemplate,
    onSetMachineFilterMode,
    onResetAll,
    ...render(
      <FilterSheet
        brands={brands}
        categories={categories}
        machineTemplates={machineTemplates}
        filters={options.filters ?? emptyFilters}
        onToggleBrand={onToggleBrand}
        onToggleCategory={onToggleCategory}
        onToggleTemplate={onToggleTemplate}
        onSetMachineFilterMode={onSetMachineFilterMode}
        onResetAll={onResetAll}
      />,
    ),
  };
}

describe('FilterSheet (ADR 0024 accordion layout)', () => {
  it('renders the sheet title plus the 운동 부위 chip row label', () => {
    const { getByText } = renderSheet();
    expect(getByText('필터')).toBeTruthy();
    expect(getByText('운동 부위')).toBeTruthy();
  });

  it('renders one brand row per brand with its template count', () => {
    const { getByText, getAllByText } = renderSheet();
    expect(getByText('Panatta')).toBeTruthy();
    expect(getByText('Hammer Strength')).toBeTruthy();
    // Both rows are collapsed by default — the chevron count reads "2" + "1".
    expect(getAllByText(/^\d+$/).length).toBeGreaterThanOrEqual(2);
  });

  it('starts with all brand accordions collapsed (slice a default)', () => {
    const { queryByText } = renderSheet();
    // High Row sits inside the Panatta accordion; collapsed = not rendered.
    expect(queryByText(/하이로우/)).toBeNull();
  });

  it('expands a brand accordion to reveal its category sub-sections and machine rows', () => {
    const { getByText, queryByText } = renderSheet();
    fireEvent.press(getByText('Panatta'));
    // Sub-section header "등 (1)" + machine label "하이로우 · 핀".
    expect(getByText('등 (1)')).toBeTruthy();
    expect(queryByText(/하이로우/)).not.toBeNull();
  });

  it('routes machine row tap to onToggleTemplate', () => {
    const onToggleTemplate = jest.fn();
    const { getByText } = renderSheet({ onToggleTemplate });
    fireEvent.press(getByText('Panatta'));
    fireEvent.press(getByText(/하이로우/));
    expect(onToggleTemplate).toHaveBeenCalledWith('t1');
  });

  it('renders the selection strip only when at least one machine is selected', () => {
    const { queryByText } = renderSheet();
    expect(queryByText(/^선택 \(/)).toBeNull();
  });

  it('shows the selection strip with the selected machine chip when filters.templateIds is set', () => {
    const { getByText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1'] },
    });
    expect(getByText(/^선택 \(1\)/)).toBeTruthy();
    // The footer chip restores the brand prefix per ADR 0024 결정 3.
    expect(getByText(/^Panatta .* · 핀$/)).toBeTruthy();
  });

  it('hides the AND/OR "전체 보유" toggle when fewer than 2 machines are selected', () => {
    const { queryByText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1'] },
    });
    expect(queryByText('전체 보유')).toBeNull();
  });

  it('shows the AND/OR "전체 보유" toggle once ≥2 machines are selected', () => {
    const { getByText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1', 't2'] },
    });
    expect(getByText('전체 보유')).toBeTruthy();
  });

  it('invokes onSetMachineFilterMode("and") when the toggle flips on', () => {
    const onSetMachineFilterMode = jest.fn();
    const { getByLabelText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1', 't2'] },
      onSetMachineFilterMode,
    });
    fireEvent(getByLabelText('선택한 머신 전체를 보유한 헬스장만'), 'valueChange', true);
    expect(onSetMachineFilterMode).toHaveBeenCalledWith('and');
  });

  it('invokes onResetAll when the 전체 초기화 footer button is pressed', () => {
    const onResetAll = jest.fn();
    const { getByLabelText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1'] },
      onResetAll,
    });
    fireEvent.press(getByLabelText('필터 전체 해제'));
    expect(onResetAll).toHaveBeenCalled();
  });

  it('renders the close button with accessibility label', () => {
    const { getByLabelText } = renderSheet();
    expect(getByLabelText('필터 닫기')).toBeTruthy();
  });

  it('narrows the accordion via active 운동 부위 filter — only brands with templates in selected categories appear', () => {
    const { getByText, queryByText } = renderSheet({
      filters: { ...emptyFilters, categoryIds: ['c1'] },
    });
    // Only Panatta has a template in 등 (c1). Hammer should disappear.
    expect(getByText('Panatta')).toBeTruthy();
    expect(queryByText('Hammer Strength')).toBeNull();
  });

  it('global search hides unmatched brands and surfaces matched templates', () => {
    const { getByLabelText, getByText, queryByText } = renderSheet();
    fireEvent.changeText(getByLabelText('머신 또는 브랜드 검색'), '하이로우');
    // Panatta has 하이로우 → still visible. Hammer doesn't → hidden.
    expect(getByText('Panatta')).toBeTruthy();
    expect(queryByText('Hammer Strength')).toBeNull();
    // While searching, matching brand auto-expands so the user sees the hit
    // without an extra tap (slice b behaviour, ADR 0024 결정 5).
    expect(getByText(/하이로우/)).toBeTruthy();
  });

  it('matching the brand name keeps all of its templates', () => {
    const { getByLabelText, getByText } = renderSheet();
    fireEvent.changeText(getByLabelText('머신 또는 브랜드 검색'), 'Panatta');
    expect(getByText('Panatta')).toBeTruthy();
    // Panatta has two templates in fixtures; both should be visible.
    expect(getByText(/하이로우/)).toBeTruthy();
    expect(getByText(/체스트 프레스 · 플레이트/)).toBeTruthy();
  });

  it('renders the empty-state copy when global search has no matches', () => {
    const { getByLabelText, getByText } = renderSheet();
    fireEvent.changeText(getByLabelText('머신 또는 브랜드 검색'), '존재하지않는머신ABCXYZ');
    expect(getByText(/필터에 맞는 머신이 없어요/)).toBeTruthy();
  });

  it('auto-expands the brand of an externally-selected template (NL search path)', async () => {
    const { findByText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1'] },
    });
    // t1 belongs to Panatta. The autoExpandFromSelectedTemplates effect
    // runs after the initial render, so this assertion is async — findByText
    // waits for the post-effect re-render where Panatta's accordion body
    // (the 등 sub-section header) is visible. The 하이로우 row label
    // appears twice (accordion + footer chip with brand prefix), so we
    // anchor on the sub-section header which only renders inside an
    // expanded accordion.
    expect(await findByText('등 (1)')).toBeTruthy();
  });
});
