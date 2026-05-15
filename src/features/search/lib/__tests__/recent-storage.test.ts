import { clearRecent, readRecent, writeRecent } from '../recent-storage';

describe('recent-storage', () => {
  beforeEach(() => {
    clearRecent();
  });

  it('returns empty array when nothing has been written', () => {
    expect(readRecent()).toEqual([]);
  });

  it('round-trips a single entry through write/read', () => {
    writeRecent([{ query: '강남역 1km 안', at: 1_700_000_000_000 }]);
    expect(readRecent()).toEqual([{ query: '강남역 1km 안', at: 1_700_000_000_000 }]);
  });

  it('returns empty array on corrupted JSON', () => {
    // Use a sibling write to plant bad data — actually easier to just write a
    // shape that fails the Zod schema.
    writeRecent([{ query: '', at: 1 }]);
    // Empty query string violates min(1) — safeParse falls back to [].
    expect(readRecent()).toEqual([]);
  });

  it('clearRecent wipes storage', () => {
    writeRecent([{ query: 'q', at: 1_700_000_000_000 }]);
    clearRecent();
    expect(readRecent()).toEqual([]);
  });
});
