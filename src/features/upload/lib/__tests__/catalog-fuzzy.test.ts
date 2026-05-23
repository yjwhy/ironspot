import { filterByFuzzy } from '../catalog-fuzzy';

interface TestItem {
  id: string;
  primary: string;
  secondary: string;
}

const getLabels = function pickLabels(item: TestItem) {
  return { primary: item.primary, secondary: item.secondary };
};

const BRANDS: readonly TestItem[] = [
  { id: '1', primary: '해머 스트렝스', secondary: 'Hammer Strength' },
  { id: '2', primary: '라이프 피트니스', secondary: 'Life Fitness' },
  { id: '3', primary: '롬배크', secondary: 'Rom Back' },
];

describe('filterByFuzzy', () => {
  it('returns every item with score 1.0 when query is empty', () => {
    const result = filterByFuzzy(BRANDS, '', getLabels);
    expect(result).toHaveLength(BRANDS.length);
    expect(result.every((m) => m.score === 1.0)).toBe(true);
  });

  it('whitespace-only query is treated as empty', () => {
    const result = filterByFuzzy(BRANDS, '   ', getLabels);
    expect(result).toHaveLength(BRANDS.length);
  });

  it('substring matches against the Korean column', () => {
    const result = filterByFuzzy(BRANDS, '해머', getLabels);
    expect(result.map((m) => m.item.id)).toEqual(['1']);
    const [first] = result;
    expect(first?.score).toBe(1.0);
  });

  it('substring matches against the English column case-insensitively', () => {
    const result = filterByFuzzy(BRANDS, 'fitness', getLabels);
    expect(result.map((m) => m.item.id)).toEqual(['2']);
    const [first] = result;
    expect(first?.score).toBe(1.0);
  });

  it('whitespace-stripped substring catches missing-space queries', () => {
    // Query "해머스트렝스" has no space; catalog stores "해머 스트렝스".
    // Substring (lowercase) misses; stripped substring catches.
    const result = filterByFuzzy(BRANDS, '해머스트렝스', getLabels);
    expect(result.map((m) => m.item.id)).toEqual(['1']);
    const [first] = result;
    expect(first?.score).toBe(0.9);
  });

  it('Levenshtein catches typos within threshold', () => {
    // "해머스으" vs "해머스트렝스" — 3 edits on 6-char string = 0.5, BELOW
    // threshold. Use "해머스트렝" (one char dropped) which scores 5/6 ≈ 0.83.
    const result = filterByFuzzy(BRANDS, '해머스트렝', getLabels);
    expect(result.map((m) => m.item.id)).toEqual(['1']);
    const [first] = result;
    expect(first?.score).toBeGreaterThan(0.6);
    expect(first?.score).toBeLessThan(1.0);
  });

  it('returns empty when no match exceeds threshold', () => {
    const result = filterByFuzzy(BRANDS, 'Cybex', getLabels);
    expect(result).toEqual([]);
  });

  it('sorts results by score descending', () => {
    const items: readonly TestItem[] = [
      { id: 'a', primary: '가나다', secondary: 'Alpha' },
      { id: 'b', primary: '가나다라', secondary: 'Beta' },
    ];
    const result = filterByFuzzy(items, '가나다', getLabels);
    const [first, second] = result;
    expect(first?.score ?? 0).toBeGreaterThanOrEqual(second?.score ?? 0);
  });

  it('does not crash on empty catalog', () => {
    expect(filterByFuzzy([], 'anything', getLabels)).toEqual([]);
  });
});
