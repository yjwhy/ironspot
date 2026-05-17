import { act, renderHook } from '@testing-library/react-native';

import { INITIAL_FILTERS, useFilters } from '../useFilters';

describe('useFilters', () => {
  it('initialises with empty arrays and OR machine filter mode', () => {
    const { result } = renderHook(() => useFilters());

    expect(result.current.filters).toEqual(INITIAL_FILTERS);
    expect(result.current.filters).toEqual({
      brandIds: [],
      categoryIds: [],
      templateIds: [],
      machineFilterMode: 'or',
    });
  });

  it('toggleBrand adds id when absent', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.toggleBrand('b1');
    });

    expect(result.current.filters.brandIds).toEqual(['b1']);
  });

  it('toggleBrand removes id when already selected', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.toggleBrand('b1');
    });
    act(() => {
      result.current.toggleBrand('b1');
    });

    expect(result.current.filters.brandIds).toEqual([]);
  });

  it('toggleBrand keeps other brand ids when toggling a new one', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.toggleBrand('b1');
    });
    act(() => {
      result.current.toggleBrand('b2');
    });

    expect(result.current.filters.brandIds).toEqual(['b1', 'b2']);
  });

  it('toggleCategory adds and removes category ids independently', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.toggleCategory('c1');
      result.current.toggleCategory('c2');
    });

    expect(result.current.filters.categoryIds).toEqual(['c1', 'c2']);

    act(() => {
      result.current.toggleCategory('c1');
    });

    expect(result.current.filters.categoryIds).toEqual(['c2']);
  });

  it('toggleTemplate adds and removes template ids', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.toggleTemplate('t1');
      result.current.toggleTemplate('t2');
    });

    expect(result.current.filters.templateIds).toEqual(['t1', 't2']);

    act(() => {
      result.current.toggleTemplate('t1');
    });

    expect(result.current.filters.templateIds).toEqual(['t2']);
  });

  it('setMachineFilterMode toggles between or and and', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setMachineFilterMode('and');
    });

    expect(result.current.filters.machineFilterMode).toBe('and');

    act(() => {
      result.current.setMachineFilterMode('or');
    });

    expect(result.current.filters.machineFilterMode).toBe('or');
  });

  it('setAll replaces the entire filter state in one update', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setAll({
        brandIds: ['b1', 'b2'],
        categoryIds: ['c1'],
        templateIds: ['t1'],
        machineFilterMode: 'and',
      });
    });

    expect(result.current.filters).toEqual({
      brandIds: ['b1', 'b2'],
      categoryIds: ['c1'],
      templateIds: ['t1'],
      machineFilterMode: 'and',
    });
  });

  it('clear resets all fields back to INITIAL_FILTERS', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.toggleBrand('b1');
      result.current.toggleCategory('c1');
      result.current.toggleTemplate('t1');
      result.current.setMachineFilterMode('and');
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.filters).toEqual(INITIAL_FILTERS);
  });
});
