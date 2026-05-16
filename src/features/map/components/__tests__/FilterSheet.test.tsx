import { fireEvent, render } from '@testing-library/react-native';
import type * as ReactNative from 'react-native';

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

const emptyFilters: SearchFilters = {
  brandIds: [],
  categoryIds: [],
  loadingType: null,
};

interface RenderOptions {
  filters?: SearchFilters;
  onToggleBrand?: (id: string) => void;
  onToggleCategory?: (id: string) => void;
  onSetLoadingType?: (value: 'pin' | 'plate' | null) => void;
  onResetAll?: () => void;
}

function renderSheet(options: RenderOptions = {}) {
  const onToggleBrand = options.onToggleBrand ?? jest.fn();
  const onToggleCategory = options.onToggleCategory ?? jest.fn();
  const onSetLoadingType = options.onSetLoadingType ?? jest.fn();
  const onResetAll = options.onResetAll ?? jest.fn();
  return {
    onToggleBrand,
    onToggleCategory,
    onSetLoadingType,
    onResetAll,
    ...render(
      <FilterSheet
        brands={brands}
        categories={categories}
        filters={options.filters ?? emptyFilters}
        onToggleBrand={onToggleBrand}
        onToggleCategory={onToggleCategory}
        onSetLoadingType={onSetLoadingType}
        onResetAll={onResetAll}
      />,
    ),
  };
}

describe('FilterSheet', () => {
  it('renders the sheet title and section labels', () => {
    const { getByText } = renderSheet();
    expect(getByText('필터')).toBeTruthy();
    expect(getByText('로딩 방식')).toBeTruthy();
    expect(getByText('브랜드')).toBeTruthy();
    expect(getByText('머신 종류')).toBeTruthy();
  });

  it('renders all three loading type segments', () => {
    const { getByText } = renderSheet();
    expect(getByText('전체')).toBeTruthy();
    expect(getByText('핀로딩')).toBeTruthy();
    expect(getByText('플레이트')).toBeTruthy();
  });

  it('renders brand and category chips from props', () => {
    const { getByText } = renderSheet();
    expect(getByText('Panatta')).toBeTruthy();
    expect(getByText('Hammer Strength')).toBeTruthy();
    expect(getByText('등')).toBeTruthy();
    expect(getByText('가슴')).toBeTruthy();
  });

  it('hides the reset footer when no filter is active', () => {
    const { queryByText } = renderSheet();
    expect(queryByText('전체 해제')).toBeNull();
  });

  it('shows the reset footer with active count when filters exist', () => {
    const { getByText } = renderSheet({
      filters: { brandIds: ['b1'], categoryIds: ['c1'], loadingType: 'pin' },
    });
    expect(getByText('전체 해제')).toBeTruthy();
    expect(getByText('3개 활성')).toBeTruthy();
  });

  it('invokes onResetAll when 전체 해제 is pressed', () => {
    const onResetAll = jest.fn();
    const { getByText } = renderSheet({
      filters: { brandIds: ['b1'], categoryIds: [], loadingType: null },
      onResetAll,
    });
    fireEvent.press(getByText('전체 해제'));
    expect(onResetAll).toHaveBeenCalledTimes(1);
  });

  it('invokes onSetLoadingType when a non-active segment is tapped', () => {
    const onSetLoadingType = jest.fn();
    const { getByText } = renderSheet({ onSetLoadingType });
    fireEvent.press(getByText('핀로딩'));
    expect(onSetLoadingType).toHaveBeenCalledWith('pin');
  });

  it('invokes onToggleBrand with the brand id when chip is pressed', () => {
    const onToggleBrand = jest.fn();
    const { getByText } = renderSheet({ onToggleBrand });
    fireEvent.press(getByText('Panatta'));
    expect(onToggleBrand).toHaveBeenCalledWith('b1');
  });

  it('routes active filter chip removal to the matching toggle/setter', () => {
    const onToggleBrand = jest.fn();
    const onToggleCategory = jest.fn();
    const onSetLoadingType = jest.fn();
    const { getByLabelText } = renderSheet({
      filters: { brandIds: ['b1'], categoryIds: ['c1'], loadingType: 'pin' },
      onToggleBrand,
      onToggleCategory,
      onSetLoadingType,
    });
    fireEvent.press(getByLabelText('브랜드 Panatta 필터 제거'));
    expect(onToggleBrand).toHaveBeenCalledWith('b1');
    fireEvent.press(getByLabelText('머신 종류 등 필터 제거'));
    expect(onToggleCategory).toHaveBeenCalledWith('c1');
    fireEvent.press(getByLabelText('로딩 방식 핀로딩 필터 제거'));
    expect(onSetLoadingType).toHaveBeenCalledWith(null);
  });

  it('renders the close button with accessibility label', () => {
    const { getByLabelText } = renderSheet();
    expect(getByLabelText('필터 닫기')).toBeTruthy();
  });
});
