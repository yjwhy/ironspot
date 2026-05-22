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
  { id: 'b1', name: 'Panatta', nameKo: '파나타' },
  { id: 'b2', name: 'Hammer Strength', nameKo: '해머 스트렝스' },
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
    brandNameKo: '',
    categoryId: 'c1',
    nameEn: 'High Row',
    nameKo: '하이로우',
    loadingType: 'pin',
  },
  {
    id: 't2',
    brandId: 'b1',
    brandName: 'Panatta',
    brandNameKo: '',
    categoryId: 'c2',
    nameEn: 'Chest Press',
    nameKo: '체스트 프레스',
    loadingType: 'plate',
  },
  {
    id: 't3',
    brandId: 'b2',
    brandName: 'Hammer Strength',
    brandNameKo: '',
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
  onApply?: (next: SearchFilters) => void;
}

function renderSheet(options: RenderOptions = {}) {
  const onApply = options.onApply ?? jest.fn();
  return {
    onApply,
    ...render(
      <FilterSheet
        brands={brands}
        categories={categories}
        machineTemplates={machineTemplates}
        filters={options.filters ?? emptyFilters}
        onApply={onApply}
      />,
    ),
  };
}

describe('FilterSheet (ADR 0024 accordion + staged-apply)', () => {
  it('renders the sheet title plus the 운동 부위 chip row label', () => {
    const { getByText } = renderSheet();
    expect(getByText('필터')).toBeTruthy();
    expect(getByText('운동 부위')).toBeTruthy();
  });

  it('renders one brand row per brand with the bilingual "한글 (영문)" label', () => {
    const { getByText, getAllByText } = renderSheet();
    expect(getByText('파나타 (Panatta)')).toBeTruthy();
    expect(getByText('해머 스트렝스 (Hammer Strength)')).toBeTruthy();
    expect(getAllByText(/^\d+$/).length).toBeGreaterThanOrEqual(2);
  });

  it('starts with all brand accordions collapsed', () => {
    const { queryByText } = renderSheet();
    expect(queryByText(/하이로우/)).toBeNull();
  });

  it('expands a brand accordion to reveal its category sub-sections and machine rows', () => {
    const { getByText, queryByText } = renderSheet();
    fireEvent.press(getByText('파나타 (Panatta)'));
    expect(getByText('등 (1)')).toBeTruthy();
    expect(queryByText(/하이로우/)).not.toBeNull();
  });

  it('chip tap stages locally — onApply is not called until the apply CTA fires', () => {
    const onApply = jest.fn();
    const { getByText, getByLabelText } = renderSheet({ onApply });
    fireEvent.press(getByText('파나타 (Panatta)'));
    fireEvent.press(getByText(/하이로우/));
    // Machine staged → footer chip strip appears with the brand-prefixed label.
    expect(getByText(/^선택 \(1\)/)).toBeTruthy();
    // But the parent receiver hasn't been notified yet — staged-edit semantics.
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.press(getByLabelText('필터 적용하기'));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ templateIds: ['t1'] }));
  });

  it('reset CTA clears the staged state but does not commit until apply fires', () => {
    const onApply = jest.fn();
    const { getByText, getByLabelText, queryByText } = renderSheet({
      onApply,
      filters: { ...emptyFilters, templateIds: ['t1'] },
    });
    expect(getByText(/^선택 \(1\)/)).toBeTruthy();
    fireEvent.press(getByLabelText('필터 전체 해제'));
    expect(queryByText(/^선택 \(/)).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.press(getByLabelText('필터 적용하기'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ templateIds: [] }));
  });

  it('hides the AND/OR "전체 보유" toggle when fewer than 2 machines are staged', () => {
    const { queryByText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1'] },
    });
    expect(queryByText('전체 보유')).toBeNull();
  });

  it('shows the AND/OR "전체 보유" toggle once ≥2 machines are staged', () => {
    const { getByText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1', 't2'] },
    });
    expect(getByText('전체 보유')).toBeTruthy();
  });

  it('flipping the AND toggle stages the change — committed only on apply', () => {
    const onApply = jest.fn();
    const { getByLabelText } = renderSheet({
      filters: { ...emptyFilters, templateIds: ['t1', 't2'] },
      onApply,
    });
    fireEvent(getByLabelText('선택한 머신 전체를 보유한 헬스장만'), 'valueChange', true);
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.press(getByLabelText('필터 적용하기'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ machineFilterMode: 'and' }));
  });

  it('apply CTA is accessibility-disabled when no staged changes vs committed', () => {
    const { getByLabelText } = renderSheet({ filters: emptyFilters });
    const applyButton = getByLabelText('필터 적용하기') as unknown as {
      props: { accessibilityState?: { disabled?: boolean } };
    };
    expect(applyButton.props.accessibilityState).toEqual({ disabled: true });
  });

  it('renders the close button with accessibility label', () => {
    const { getByLabelText } = renderSheet();
    expect(getByLabelText('필터 닫기')).toBeTruthy();
  });

  it('narrows the accordion via active 운동 부위 filter — only brands with templates in selected categories appear', () => {
    const { getByText, queryByText } = renderSheet({
      filters: { ...emptyFilters, categoryIds: ['c1'] },
    });
    expect(getByText('파나타 (Panatta)')).toBeTruthy();
    expect(queryByText('해머 스트렝스 (Hammer Strength)')).toBeNull();
  });

  it('global search hides unmatched brands and surfaces matched templates', () => {
    const { getByLabelText, getByText, queryByText } = renderSheet();
    fireEvent.changeText(getByLabelText('머신 또는 브랜드 검색'), '하이로우');
    expect(getByText('파나타 (Panatta)')).toBeTruthy();
    expect(queryByText('해머 스트렝스 (Hammer Strength)')).toBeNull();
    expect(getByText(/하이로우/)).toBeTruthy();
  });

  it('matching the brand name keeps all of its templates', () => {
    const { getByLabelText, getByText } = renderSheet();
    fireEvent.changeText(getByLabelText('머신 또는 브랜드 검색'), 'Panatta');
    expect(getByText('파나타 (Panatta)')).toBeTruthy();
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
    expect(await findByText('등 (1)')).toBeTruthy();
  });
});
