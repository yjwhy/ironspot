import { act, renderHook } from '@testing-library/react-native';

import { clearRecent } from '../../lib/recent-storage';
import { useRecentSearches } from '../useRecentSearches';

describe('useRecentSearches', () => {
  beforeEach(() => {
    clearRecent();
  });

  it('starts empty', () => {
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.entries).toEqual([]);
  });

  it('add prepends the query to the list', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.add('강남역 1km 안');
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.query).toBe('강남역 1km 안');
  });

  it('add deduplicates by query (LRU) — repeated query moves to top, length unchanged', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.add('q1');
      result.current.add('q2');
      result.current.add('q1');
    });

    expect(result.current.entries.map((e) => e.query)).toEqual(['q1', 'q2']);
  });

  it('add caps history at 10 entries — oldest dropped', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      for (let i = 0; i < 12; i += 1) {
        result.current.add(`q${String(i)}`);
      }
    });

    expect(result.current.entries).toHaveLength(10);
    expect(result.current.entries[0]?.query).toBe('q11');
    expect(result.current.entries[9]?.query).toBe('q2');
  });

  it('add ignores empty / whitespace-only queries', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.add('');
      result.current.add('   ');
    });

    expect(result.current.entries).toEqual([]);
  });

  it('remove deletes a specific entry by query string', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.add('keep');
      result.current.add('delete-me');
    });
    act(() => {
      result.current.remove('delete-me');
    });

    expect(result.current.entries.map((e) => e.query)).toEqual(['keep']);
  });

  it('clear empties the list', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.add('a');
      result.current.add('b');
    });
    act(() => {
      result.current.clear();
    });

    expect(result.current.entries).toEqual([]);
  });
});
