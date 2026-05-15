import { fireEvent, render } from '@testing-library/react-native';

import type { Brand, Category } from '@/shared/types/database';

import { FilterPanel } from '../FilterPanel';

const brands: Brand[] = [
  { id: 'b-1', name: 'Hammer Strength' },
  { id: 'b-2', name: 'Panatta' },
];

const categories: Category[] = [
  { id: 'c-1', name: '등' },
  { id: 'c-2', name: '가슴' },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof FilterPanel>> = {}) {
  return render(
    <FilterPanel
      visible={true}
      brands={brands}
      categories={categories}
      brandsError={false}
      categoriesError={false}
      selectedBrandIds={[]}
      selectedCategoryIds={[]}
      onBrandToggle={() => undefined}
      onCategoryToggle={() => undefined}
      onClose={() => undefined}
      {...overrides}
    />,
  );
}

describe('FilterPanel', () => {
  it('renders brand chips', () => {
    const { getByText } = renderPanel();
    expect(getByText('Hammer Strength')).toBeTruthy();
    expect(getByText('Panatta')).toBeTruthy();
  });

  it('renders category chips', () => {
    const { getByText } = renderPanel();
    expect(getByText('등')).toBeTruthy();
    expect(getByText('가슴')).toBeTruthy();
  });

  it('calls onBrandToggle with brand id when brand chip pressed', () => {
    const onBrandToggle = jest.fn();
    const { getByText } = renderPanel({ onBrandToggle });
    fireEvent.press(getByText('Hammer Strength'));
    expect(onBrandToggle).toHaveBeenCalledWith('b-1');
  });

  it('calls onBrandToggle with the same id when selected brand is pressed again', () => {
    // Multi-select: caller resolves toggle semantics (add vs remove) using selectedBrandIds.
    // FilterPanel always emits the chip's id — never null.
    const onBrandToggle = jest.fn();
    const { getByText } = renderPanel({ selectedBrandIds: ['b-1'], onBrandToggle });
    fireEvent.press(getByText('Hammer Strength'));
    expect(onBrandToggle).toHaveBeenCalledWith('b-1');
  });

  it('shows multiple selected brand chips when selectedBrandIds has many', () => {
    const { getByText } = renderPanel({ selectedBrandIds: ['b-1', 'b-2'] });
    // Visual selection is owned by the Chip component; this test guards the prop plumbing.
    expect(getByText('Hammer Strength')).toBeTruthy();
    expect(getByText('Panatta')).toBeTruthy();
  });

  it('calls onCategoryToggle with category id when category chip pressed', () => {
    const onCategoryToggle = jest.fn();
    const { getByText } = renderPanel({ onCategoryToggle });
    fireEvent.press(getByText('등'));
    expect(onCategoryToggle).toHaveBeenCalledWith('c-1');
  });

  it('calls onClose when backdrop is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = renderPanel({ onClose });
    fireEvent.press(getByTestId('filter-panel-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders section labels', () => {
    const { getByText } = renderPanel();
    expect(getByText('브랜드')).toBeTruthy();
    expect(getByText('머신 종류')).toBeTruthy();
  });

  it('renders nothing when visible is false', () => {
    const { queryByText, queryByTestId } = renderPanel({ visible: false });
    expect(queryByText('브랜드')).toBeNull();
    expect(queryByTestId('filter-panel-backdrop')).toBeNull();
  });

  it('renders empty placeholder when brands list is empty', () => {
    const { queryAllByText, queryByText } = renderPanel({ brands: [] });
    // Brand section header still renders so layout stays stable; body shows the empty message.
    expect(queryByText('브랜드')).toBeTruthy();
    expect(queryAllByText('필터 항목이 없어요').length).toBeGreaterThan(0);
    expect(queryByText('Hammer Strength')).toBeNull();
  });

  it('renders empty placeholder when categories list is empty', () => {
    const { queryByText, queryAllByText } = renderPanel({ categories: [] });
    expect(queryByText('머신 종류')).toBeTruthy();
    expect(queryAllByText('필터 항목이 없어요').length).toBeGreaterThan(0);
    expect(queryByText('등')).toBeNull();
  });

  it('renders error placeholder when brandsError is true', () => {
    const { queryAllByText, queryByText } = renderPanel({ brands: [], brandsError: true });
    expect(queryByText('브랜드')).toBeTruthy();
    expect(queryAllByText('필터를 불러올 수 없어요').length).toBeGreaterThan(0);
  });

  it('renders error placeholder when categoriesError is true', () => {
    const { queryAllByText, queryByText } = renderPanel({ categories: [], categoriesError: true });
    expect(queryByText('머신 종류')).toBeTruthy();
    expect(queryAllByText('필터를 불러올 수 없어요').length).toBeGreaterThan(0);
  });

  it('prefers error placeholder over empty when both signal absence', () => {
    // brands is [] (empty) AND brandsError is true; error message should win.
    const { queryByText } = renderPanel({ brands: [], brandsError: true });
    expect(queryByText('필터를 불러올 수 없어요')).toBeTruthy();
    expect(queryByText('필터 항목이 없어요')).toBeNull();
  });
});
