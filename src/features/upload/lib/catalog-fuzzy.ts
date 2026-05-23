// Phase 5 follow-up C: bilingual catalog fuzzy matcher. Brand and template
// pickers both surface ~24- to ~150-row catalogs with (primary KO, secondary
// EN) labels. FE port of BrandRepository.findIdByNameOrKoFuzzy's 3-stage
// logic so an offline / cold-Render device still gets instant suggestions:
//
//   1. case-insensitive substring on either column                (score 1.0)
//   2. whitespace-stripped substring on either column             (score 0.9)
//      catches "해머스트렝스" → "해머 스트렝스"
//   3. Levenshtein-normalised similarity ≥ FUZZY_THRESHOLD on the
//      stripped form of either column                            (score = sim)
//      catches typos like "해머스으" → "해머스트렝스"
//
// Backend keeps the authoritative resolver because NL search needs a
// server-side fuzzy. The 24-row catalog makes a network round-trip strictly
// worse here: debounce + Render cold-pool would cost 7-15s for a calculation
// that runs in microseconds locally.

const FUZZY_THRESHOLD = 0.6;

const SCORE_SUBSTRING = 1.0;
const SCORE_STRIPPED = 0.9;

export interface BilingualLabel {
  primary: string;
  secondary: string;
}

export interface FuzzyMatch<T> {
  item: T;
  /** [0, 1]. Empty query returns 1.0 for all items. */
  score: number;
}

export function filterByFuzzy<T>(
  items: readonly T[],
  query: string,
  getLabels: (item: T) => BilingualLabel,
): FuzzyMatch<T>[] {
  const trimmed = query.trim();
  if (trimmed === '') {
    return items.map(function asMatch(item) {
      return { item, score: SCORE_SUBSTRING };
    });
  }

  const lower = trimmed.toLowerCase();
  const stripped = lower.replace(/\s+/g, '');

  const matches: FuzzyMatch<T>[] = [];
  for (const item of items) {
    const { primary, secondary } = getLabels(item);
    const primaryLower = primary.toLowerCase();
    const secondaryLower = secondary.toLowerCase();

    if (primaryLower.includes(lower) || secondaryLower.includes(lower)) {
      matches.push({ item, score: SCORE_SUBSTRING });
      continue;
    }

    const primaryStripped = primaryLower.replace(/\s+/g, '');
    const secondaryStripped = secondaryLower.replace(/\s+/g, '');
    if (primaryStripped.includes(stripped) || secondaryStripped.includes(stripped)) {
      matches.push({ item, score: SCORE_STRIPPED });
      continue;
    }

    const sim = Math.max(
      similarity(stripped, primaryStripped),
      similarity(stripped, secondaryStripped),
    );
    if (sim >= FUZZY_THRESHOLD) {
      matches.push({ item, score: sim });
    }
  }

  return matches.sort(function byScoreDesc(a, b) {
    return b.score - a.score;
  });
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - levenshtein(a, b) / maxLen;
}

// Iterative two-row Levenshtein, O(n*m) time and O(min(n,m)) space. Inlined
// instead of pulling a fuzzy-match dependency for a single helper.
//
// `noUncheckedIndexedAccess: true` widens every read to `number | undefined`,
// so each load goes through `??` rather than non-null assertion (banned by
// project style). Indices are bounds-safe by construction (loop invariants),
// so the fallback is unreachable.
function levenshtein(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;

  let prev = new Int32Array(m + 1);
  let curr = new Int32Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const left = curr[j - 1] ?? 0;
      const up = prev[j] ?? 0;
      const diag = prev[j - 1] ?? 0;
      curr[j] = Math.min(left + 1, up + 1, diag + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[m] ?? 0;
}
