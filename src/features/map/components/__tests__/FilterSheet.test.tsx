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
    name: 'High Row',
    loadingType: 'pin',
  },
  {
    id: 't2',
    brandId: 'b2',
    brandName: 'Hammer Strength',
    categoryId: 'c2',
    name: 'Chest Press',
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

describe('FilterSheet', () => {
  it('renders the sheet title and three section labels (운동 부위 / 브랜드 / 머신)', () => {
    const { getByText } = renderSheet();
    expect(getByText('필터')).toBeTruthy();
    expect(getByText('운동 부위')).toBeTruthy();
    expect(getByText('브랜드')).toBeTruthy();
    expect(getByText('머신')).toBeTruthy();
  });

  it('does NOT render the legacy 로딩 방식 segmented control', () => {
    const { queryByText } = renderSheet();
    expect(queryByText('로딩 방식')).toBeNull();
    expect(queryByText('핀로딩')).toBeNull();
    expect(queryByText('플레이트')).toBeNull();
  });

  it('renders machine chips with brand prefix and loading suffix', () => {
    const { getByText } = renderSheet();
    expect(getByText('Panatta High Row · 핀')).toBeTruthy();
    expect(getByText('Hammer Strength Chest Press · 플레이트')).toBeTruthy();
  });

  it('invokes onToggleTemplate with the template id when chip is pressed', () => {
    const onToggleTemplate = jest.fn();
    const { getByText } = renderSheet({ onToggleTemplate });
    fireEvent.press(getByText('Panatta High Row · 핀'));
    expect(onToggleTemplate).toHaveBeenCalledWith('t1');
  });

  it('hides the AND toggle when fewer than 2 templates are selected', () => {
    const { queryByLabelText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1'] },
    });
    expect(queryByLabelText('선택한 머신 모두 보유한 헬스장만')).toBeNull();
  });

  it('shows the AND toggle when 2 or more templates are selected', () => {
    const { getByLabelText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1', 't2'] },
    });
    expect(getByLabelText('선택한 머신 모두 보유한 헬스장만')).toBeTruthy();
  });

  it('invokes onSetMachineFilterMode when AND toggle is switched on', () => {
    const onSetMachineFilterMode = jest.fn();
    const { getByLabelText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1', 't2'] },
      onSetMachineFilterMode,
    });
    fireEvent(getByLabelText('선택한 머신 모두 보유한 헬스장만'), 'valueChange', true);
    expect(onSetMachineFilterMode).toHaveBeenCalledWith('and');
  });

  it('shows the reset footer with active count when filters exist', () => {
    const { getByText } = renderSheet({
      filters: { ...emptyFilters, brandIds: ['b1'], categoryIds: ['c1'], templateIds: ['t1'] },
    });
    expect(getByText('전체 해제')).toBeTruthy();
    expect(getByText('3개 활성')).toBeTruthy();
  });

  it('invokes onResetAll when 전체 해제 is pressed', () => {
    const onResetAll = jest.fn();
    const { getByText } = renderSheet({
      filters: { ...emptyFilters, brandIds: ['b1'] },
      onResetAll,
    });
    fireEvent.press(getByText('전체 해제'));
    expect(onResetAll).toHaveBeenCalledTimes(1);
  });

  it('routes active filter chip removal to the matching toggle', () => {
    const onToggleBrand = jest.fn();
    const onToggleCategory = jest.fn();
    const onToggleTemplate = jest.fn();
    const { getByLabelText } = renderSheet({
      filters: { ...emptyFilters, brandIds: ['b1'], categoryIds: ['c1'], templateIds: ['t1'] },
      onToggleBrand,
      onToggleCategory,
      onToggleTemplate,
    });
    fireEvent.press(getByLabelText('브랜드 Panatta 필터 제거'));
    expect(onToggleBrand).toHaveBeenCalledWith('b1');
    fireEvent.press(getByLabelText('운동 부위 등 필터 제거'));
    expect(onToggleCategory).toHaveBeenCalledWith('c1');
    fireEvent.press(getByLabelText('머신 Panatta High Row · 핀 필터 제거'));
    expect(onToggleTemplate).toHaveBeenCalledWith('t1');
  });

  it('renders the close button with accessibility label', () => {
    const { getByLabelText } = renderSheet();
    expect(getByLabelText('필터 닫기')).toBeTruthy();
  });
});
