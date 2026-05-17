import type { OwnerQueueItem } from '@/shared/generated/model';

import { groupQueueByGym } from '../queue-grouping';

function buildItem(overrides: Partial<OwnerQueueItem>): OwnerQueueItem {
  return {
    targetType: 'photo',
    reportId: 'r1',
    targetId: 't1',
    label: 'item',
    reason: 'OTHER',
    reporterId: 'u1',
    createdAt: '2026-05-18T00:00:00Z',
    ownerTimeoutAt: '2026-05-19T00:00:00Z',
    gymId: 'gym-a',
    gymName: '체육관 A',
    ...overrides,
  };
}

describe('groupQueueByGym', () => {
  it('returns an empty list for an empty queue', () => {
    expect(groupQueueByGym([])).toEqual([]);
  });

  it('groups items by gymId and counts pending', () => {
    const items = [
      buildItem({ reportId: 'r1', gymId: 'gym-a', gymName: '체육관 A' }),
      buildItem({ reportId: 'r2', gymId: 'gym-a', gymName: '체육관 A' }),
      buildItem({ reportId: 'r3', gymId: 'gym-b', gymName: '체육관 B' }),
    ];
    expect(groupQueueByGym(items)).toEqual([
      { gymId: 'gym-a', gymName: '체육관 A', pendingCount: 2 },
      { gymId: 'gym-b', gymName: '체육관 B', pendingCount: 1 },
    ]);
  });

  it('sorts gyms by name in Korean locale', () => {
    const items = [
      buildItem({ reportId: 'r1', gymId: 'gym-z', gymName: '하늘짐' }),
      buildItem({ reportId: 'r2', gymId: 'gym-a', gymName: '가나짐' }),
      buildItem({ reportId: 'r3', gymId: 'gym-m', gymName: '나라짐' }),
    ];
    expect(groupQueueByGym(items).map((g) => g.gymName)).toEqual(['가나짐', '나라짐', '하늘짐']);
  });
});
