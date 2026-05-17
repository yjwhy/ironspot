import type { OwnerQueueItem } from '@/shared/generated/model';

export interface OwnedGym {
  gymId: string;
  gymName: string;
  pendingCount: number;
}

/**
 * Derive the list of gyms this owner manages from their pending queue. Since the
 * backend does not expose a "my owned gyms" endpoint (Task 47 scope-cut), we
 * infer the list from queue.gymId + queue.gymName.
 *
 * Owners with no pending reports won't appear here — but they don't need an
 * owner home gym list either (queue is the entry point). When an owner needs
 * to act on an idle gym (e.g. add a machine), the gym detail screen "owner 도구"
 * button (slice 47l) handles entry.
 */
export function groupQueueByGym(items: readonly OwnerQueueItem[]): OwnedGym[] {
  const byGym = new Map<string, OwnedGym>();
  for (const item of items) {
    const existing = byGym.get(item.gymId);
    if (existing) {
      existing.pendingCount += 1;
    } else {
      byGym.set(item.gymId, { gymId: item.gymId, gymName: item.gymName, pendingCount: 1 });
    }
  }
  return Array.from(byGym.values()).sort((a, b) => a.gymName.localeCompare(b.gymName, 'ko'));
}
