import { templateCounts } from '@/shared/generated/gyms/gyms';
import type { MapBounds } from '@/shared/types/database';

import { fetchTemplateCountsInBounds } from '../template-counts';

jest.mock('@/shared/generated/gyms/gyms', () => ({ templateCounts: jest.fn() }));

const mockTemplateCounts = templateCounts as jest.MockedFunction<typeof templateCounts>;

const bounds: MapBounds = { minLat: 37.49, minLng: 127.02, maxLat: 37.51, maxLng: 127.04 };

describe('fetchTemplateCountsInBounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the bbox to the API', async () => {
    mockTemplateCounts.mockResolvedValue([] as never);
    await fetchTemplateCountsInBounds(bounds);
    expect(mockTemplateCounts).toHaveBeenCalledWith({
      minLat: 37.49,
      maxLat: 37.51,
      minLng: 127.02,
      maxLng: 127.04,
    });
  });

  it('builds a templateId→count map and skips rows missing an id or count', async () => {
    mockTemplateCounts.mockResolvedValue([
      { templateId: 't1', gymCount: 3 },
      { templateId: 't2', gymCount: 0 },
      { gymCount: 5 },
      { templateId: 't3' },
    ] as never);

    const counts = await fetchTemplateCountsInBounds(bounds);

    expect(counts.get('t1')).toBe(3);
    expect(counts.get('t2')).toBe(0);
    expect(counts.has('t3')).toBe(false);
    expect(counts.size).toBe(2);
  });
});
