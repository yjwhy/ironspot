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
      selectedBrandId={null}
      selectedCategoryId={null}
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

  it('calls onBrandToggle with null when selected brand is pressed again', () => {
    const onBrandToggle = jest.fn();
    const { getByText } = renderPanel({ selectedBrandId: 'b-1', onBrandToggle });
    fireEvent.press(getByText('Hammer Strength'));
    expect(onBrandToggle).toHaveBeenCalledWith(null);
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
});
