import { useState } from 'react';

import { RECENT_HISTORY_MAX } from '../constants';
import { clearRecent, readRecent, type RecentEntry, writeRecent } from '../lib/recent-storage';

export function useRecentSearches() {
  const [entries, setEntries] = useState<readonly RecentEntry[]>(() => readRecent());

  function add(query: string) {
    const trimmed = query.trim();
    if (trimmed === '') return;
    setEntries((prev) => {
      const next: readonly RecentEntry[] = [
        { query: trimmed, at: Date.now() },
        ...prev.filter((e) => e.query !== trimmed),
      ].slice(0, RECENT_HISTORY_MAX);
      writeRecent(next);
      return next;
    });
  }

  function remove(query: string) {
    setEntries((prev) => {
      const next = prev.filter((e) => e.query !== query);
      writeRecent(next);
      return next;
    });
  }

  function clear() {
    setEntries([]);
    clearRecent();
  }

  return { entries, add, remove, clear };
}
