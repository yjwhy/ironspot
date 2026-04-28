import { act, renderHook } from '@testing-library/react-native';

import { INITIAL_FILTERS, useFilters } from '../useFilters';

describe('useFilters', () => {
  it('initialises with all filter fields set to null', () => {
    const { result } = renderHook(() => useFilters());

    expect(result.current.filters).toEqual(INITIAL_FILTERS);
    expect(result.current.filters).toEqual({
      brandId: null,
      categoryId: null,
      loadingType: null,
    });
  });

  it('setBrand updates only brandId', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setBrand('b1');
    });

    expect(result.current.filters).toEqual({
      brandId: 'b1',
      categoryId: null,
      loadingType: null,
    });
  });

  it('setCategory updates only categoryId', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setCategory('c1');
    });

    expect(result.current.filters).toEqual({
      brandId: null,
      categoryId: 'c1',
      loadingType: null,
    });
  });

  it('setLoadingType updates only loadingType', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setLoadingType('plate');
    });

    expect(result.current.filters).toEqual({
      brandId: null,
      categoryId: null,
      loadingType: 'plate',
    });
  });

  it('clear resets all three fields back to null', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setBrand('b1');
      result.current.setCategory('c1');
      result.current.setLoadingType('pin');
    });

    expect(result.current.filters).toEqual({
      brandId: 'b1',
      categoryId: 'c1',
      loadingType: 'pin',
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.filters).toEqual(INITIAL_FILTERS);
  });
});
