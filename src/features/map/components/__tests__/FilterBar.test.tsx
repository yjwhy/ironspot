import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import type { Brand, Category, SearchFilters } from '@/shared/types/database';

import { FilterBar } from '../FilterBar';

const BRANDS: Brand[] = [
  { id: 'b1', name: 'Panatta' },
  { id: 'b2', name: 'Hammer Strength' },
];

const CATEGORIES: Category[] = [
  { id: 'c1', name: '등' },
  { id: 'c2', name: '가슴' },
];

const EMPTY_FILTERS: SearchFilters = { brandId: null, categoryId: null, loadingType: null };

describe('FilterBar', () => {
  it('renders brand chips', () => {
    const { getByText } = render(
      <FilterBar
        brands={BRANDS}
        categories={CATEGORIES}
        filters={EMPTY_FILTERS}
        onBrandChange={jest.fn()}
        onCategoryChange={jest.fn()}
      />,
    );
    expect(getByText('Panatta')).toBeTruthy();
    expect(getByText('Hammer Strength')).toBeTruthy();
  });

  it('renders category chips', () => {
    const { getByText } = render(
      <FilterBar
        brands={BRANDS}
        categories={CATEGORIES}
        filters={EMPTY_FILTERS}
        onBrandChange={jest.fn()}
        onCategoryChange={jest.fn()}
      />,
    );
    expect(getByText('등')).toBeTruthy();
    expect(getByText('가슴')).toBeTruthy();
  });

  it('calls onBrandChange with brand id when brand chip pressed', () => {
    const onBrandChange = jest.fn();
    const { getByText } = render(
      <FilterBar
        brands={BRANDS}
        categories={CATEGORIES}
        filters={EMPTY_FILTERS}
        onBrandChange={onBrandChange}
        onCategoryChange={jest.fn()}
      />,
    );
    fireEvent.press(getByText('Panatta'));
    expect(onBrandChange).toHaveBeenCalledWith('b1');
  });

  it('calls onBrandChange with null when selected brand chip re-pressed', () => {
    const onBrandChange = jest.fn();
    const { getByText } = render(
      <FilterBar
        brands={BRANDS}
        categories={CATEGORIES}
        filters={{ ...EMPTY_FILTERS, brandId: 'b1' }}
        onBrandChange={onBrandChange}
        onCategoryChange={jest.fn()}
      />,
    );
    fireEvent.press(getByText('Panatta'));
    expect(onBrandChange).toHaveBeenCalledWith(null);
  });

  it('calls onCategoryChange with category id when category chip pressed', () => {
    const onCategoryChange = jest.fn();
    const { getByText } = render(
      <FilterBar
        brands={BRANDS}
        categories={CATEGORIES}
        filters={EMPTY_FILTERS}
        onBrandChange={jest.fn()}
        onCategoryChange={onCategoryChange}
      />,
    );
    fireEvent.press(getByText('등'));
    expect(onCategoryChange).toHaveBeenCalledWith('c1');
  });

  it('renders nothing when both arrays are empty', () => {
    const { toJSON } = render(
      <FilterBar
        brands={[]}
        categories={[]}
        filters={EMPTY_FILTERS}
        onBrandChange={jest.fn()}
        onCategoryChange={jest.fn()}
      />,
    );
    expect(toJSON()).toBeNull();
  });
});
