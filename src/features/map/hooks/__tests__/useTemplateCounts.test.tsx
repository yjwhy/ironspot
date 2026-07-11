import { renderHook, waitFor } from '@testing-library/react-native';

import type { MapBounds } from '@/shared/types/database';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { fetchTemplateCountsInBounds } from '../../services/template-counts';
import { useTemplateCounts } from '../useTemplateCounts';

jest.mock('../../services/template-counts', () => ({
  fetchTemplateCountsInBounds: jest.fn(),
}));

const mockFetch = fetchTemplateCountsInBounds as jest.MockedFunction<
  typeof fetchTemplateCountsInBounds
>;

const bounds: MapBounds = { minLat: 37.49, minLng: 127.02, maxLat: 37.51, maxLng: 127.04 };

describe('useTemplateCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is disabled when bounds is null and does not call the service', () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTemplateCounts(null), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns the count map when bounds are present', async () => {
    mockFetch.mockResolvedValue(new Map([['t1', 4]]));
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTemplateCounts(bounds), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mockFetch).toHaveBeenCalledWith(bounds);
    expect(result.current.data?.get('t1')).toBe(4);
  });
});
