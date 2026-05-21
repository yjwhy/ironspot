---
Status: Accepted (Phase 5 item 23, implemented 2026-05-21 across slices a-e)
Date: 2026-05-21
Supersedes: 0022-machine-template-filter.md
Implements: Phase 5 README item 23
---

# 0024 — Brand-first accordion filter UI (supersedes ADR 0022 3-section layout)

## Context

ADR 0022 (2026-05-17) shipped a 3-section orthogonal `FilterSheet` (운동 부위 → 브랜드 → 머신) with chip-per-template granularity and an always-on machine-section search box. The sheet was sized for 200-400 templates as the design envelope.

Phase 5 item 22 (PR #141) seeded the catalog with **24 brands × 281 templates**, landing inside that envelope mechanically. But user feedback during item 22 review surfaced a mental-model mismatch:

> 부위/브랜드/머신 종류 이렇게 나누는거 보단 브랜드로 쫙 나열하고, 브랜드를 탭하면 그 브랜드가 쫙 펼쳐져서 그 안에 모든 모델들이 나오고 순서를 부위별로 묶어서 보여주는건 어떻게 생각해?

Standing in a gym, the user thinks brand-first ("Hammer Strength 있는 곳"), not dimension-first. The 3-section layout surfaces brand as one of three equal-weight chip clusters, burying the natural hierarchy.

Item 22's ground-truth distribution amplifies the problem:

| Dimension | Cardinality at launch | Cognitive load when flat   |
| --------- | --------------------: | -------------------------- |
| 운동 부위 |                     6 | Manageable                 |
| 브랜드    |                    24 | Manageable when grouped    |
| 머신      |                   281 | Overwhelming as flat chips |

ADR 0022's machine-section search box absorbs the 281 mechanically, but the user can't browse the catalog — they can only search. The brand entry point (filter by 브랜드 chip + leave 머신 untouched) preserves the brand quick filter (ADR 0022 결정 6), but the path from "I'm at this brand" → "show me the brand's catalog" requires switching cognitive context (brand chip → all-machines list scoped by brand).

## Decision

**Refactor `FilterSheet` to a hybrid brand-first accordion** while preserving ADR 0022's core decisions (chip granularity, AND toggle, brand × category orthogonal filter intent).

Sheet structure top-to-bottom:

```
┌─ FilterSheet (BottomSheet 65/90%) ──────────────┐
│ [🔍 머신/브랜드 검색...]                          │  ← always-on global search
│                                                  │
│ 운동 부위                                         │
│ [등][가슴][어깨][팔][하체][코어]                  │  ← 6 chips, OR, optional
│                                                  │
│ ─── 브랜드 (24) ──── 머신 281 ────────────────── │
│                                                  │
│ ▸ Hammer Strength                          (18) │
│ ▸ Life Fitness                             (15) │
│ ▼ Technogym                                (18) │  ← expanded brand
│    등 (3)                                        │
│    ☐ Lat Machine · 핀                            │
│    ☐ Low Row · 핀                                │
│    ☐ Iso Row · 플레이트                          │
│    가슴 (4)                                      │
│    ☐ Chest Press · 핀                            │
│    ☐ Incline Chest Press · 핀                    │
│    ☐ Iso Chest Press · 플레이트                  │
│    …                                             │
│ ▸ Panatta                                  (10) │
│ …                                                │
│                                                  │
│ ─── 선택 (2) ─── [전체 보유 ✓] AND ─────────────│  ← bottom strip
│ • Panatta High Row · 핀                  ×       │
│ • Hammer Chest Press · 플레이트          ×       │
│                                                  │
│ [전체 초기화]                  [헬스장 보기 →]   │
└──────────────────────────────────────────────────┘
```

### Decision details

1. **Global search bar (always visible at top)** — searches across `nameKo` + `nameEn` + `brandName` tokens, identical to ADR 0022's per-section search. Behaviour: matching machines surface inline inside their parent brand accordion (auto-expand any brand with matching machines; collapse if no matches). Preserves cross-brand search for "랫 풀다운 있는 곳" style intent.

2. **운동 부위 chip row (always visible, second slot)** — 6 chips (등 / 가슴 / 어깨 / 팔 / 하체 / 코어), OR semantics, **cross-filters the accordion contents**: selecting `[하체]` narrows each brand's expanded view to only the 하체 group, hides empty brands, updates the brand-row counts (`Hammer Strength (8 leg)`). Preserves ADR 0022 결정 6 (brand-only quick filter) since 운동 부위 chip without expanding any brand still narrows the result set semantically.

3. **Brand accordion (body)** — 24 brand rows sorted alphabetically (locale-aware, matching `useBrands` pattern). Each row shows brand name + count badge (template count, optionally further narrowed by active 운동 부위 chips). **Multiple brands can expand simultaneously** — not single-accordion. Inside an expanded brand:
   - Machines grouped by 운동 부위 (sub-headers `등 (3)`, `가슴 (4)`, ...).
   - Each machine row: checkbox + brand-stripped chip label (`Iso Row · 플레이트`, not `Technogym Iso Row · 플레이트`, since the brand is implicit from the parent accordion).
   - Loading-type suffix (`· 핀` / `· 플레이트`) preserved per ADR 0022 결정 5 alternative-C rationale.

4. **Selection footer strip** — accumulates picked machines as removable chips with brand prefix restored (`Panatta High Row · 핀` — once outside the accordion context, brand must reappear for disambiguation). AND/OR toggle appears when 2+ machines selected, mapping to `scope: COMBINED | EACH` on the backend — **identical wire format to ADR 0022, no DTO change**.

5. **Brand sort + search interaction**:
   - Default sort: brand name asc (`useBrands` locale-aware).
   - Active search: matched brands rise to top; unmatched brands either hide (preferred) or grey out (alternative — ADR draft punts to implementation review).
   - Active 운동 부위 chip: brands with zero machines in selected categories hide entirely (preferred) — keeps the brand list scannable.

6. **Empty state per brand** — when a brand has zero matches under the active 운동 부위 + search filter, the brand row hides. When the user clears the filter, the row reappears. Empty global state (no brands left) shows a single message ("필터에 맞는 머신이 없어요").

### Preserved ADR 0022 decisions

| ADR 0022 결정                                        | Status in 0024                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 결정 1: 카테고리 라벨 = 운동 부위                    | **Kept** (still rendered as the second-row chip cluster)                                 |
| 결정 2: chip 단위 = per-template                     | **Kept** (one machine_template row = one selectable chip)                                |
| 결정 3: chip label = brand prefix + loading suffix   | **Kept in selection footer**; inside accordion the brand prefix is implicit (parent row) |
| 결정 4: OR default + AND toggle when 2+              | **Kept** (selection footer hosts the toggle)                                             |
| 결정 5: 글로벌 LoadingType segmented control removed | **Kept** (loading suffix still embedded in the chip)                                     |
| 결정 6: 브랜드 직교 필터 유지                        | **Kept** (브랜드 row + 운동 부위 chip + 머신 selection all AND-combine on the backend)   |
| 결정 7: NL Search → filter mapping lossless          | **Kept** (`parsedFilters.templateIds` opens the matching accordions + checks the boxes)  |

## Alternatives

**A. Status quo (ADR 0022 unchanged)**
Mechanically envelope-correct at N=281, but user mental-model mismatch is the actual launch-cohort risk. Reaffirming 0022 here loses the user feedback signal.

**B. Pure brand-first accordion without 운동 부위 chip row**
Removes the body-part quick filter ("다리 운동할거야"). User has to expand each brand to find leg machines. Reverses ADR 0022 결정 6 too aggressively. Rejected.

**C. Tabbed top-level (브랜드 별 / 머신 별 / 부위 별)**
Three modes side by side. Decision fatigue + three UIs to maintain. Rejected — `frontend-design` skill's `primary-action` rule says each screen has one primary CTA.

**D. Drawer-style brand list + selected brand fills the sheet**
Two-pane layout doesn't fit `BottomSheet` ergonomics. Native iOS pattern is single-pane accordion (Apple HIG `progressive-disclosure`). Rejected.

**E. Defer accordion to Phase 6**
Item 22 catalog of 281 is real now. ADR 0022's design envelope holds but mental-model mismatch is also real now. Shipping the UX fix as launch-cohort-targeted, not deferred, is the better cost/benefit since the refactor is contained to one component + this ADR.

## Consequences

### Data model (no change)

- `machine_templates`, `brands`, `categories` schema unchanged.
- `searchGymsInBounds` / `GymSearchRequest` DTO unchanged (`brandIds`, `categoryIds`, `templateIds`, `scope`).
- jOOQ + Orval regen not required.

### Backend (no change)

ADR 0022's `GymRepository.searchInBounds` already handles all the filter combinations this UI produces. Wire format identical.

### Frontend (significant)

- `src/features/map/components/FilterSheet.tsx` — refactor from 3 `FilterSheetSection` instances to global search input + `FilterSheetCategoryChips` + `FilterSheetBrandAccordion`. Expected delta ~242 LOC → ~450 LOC (rough estimate including helpers).
- New components:
  - `FilterSheetBrandAccordion` — virtualized brand list with sticky brand-row headers, body-part sub-sections inside expanded brand, machine checkboxes.
  - `FilterSheetSelectionStrip` — bottom chip strip + AND/OR toggle (extracted from current `ActiveFilterStrip`'s machine-chip path).
- `src/features/map/hooks/useFilters.ts` — state shape **unchanged** (filterIds in, chip render out). Only the UI layer changes.
- `src/features/map/lib/active-filters.ts` — `toActiveFilters` may need a new branch for accordion expand-state ↔ selected-chip reconciliation when NL search opens the sheet (Task 38b lossless mapping).

### Performance

- `FlashList` virtualization required for the 24-brand accordion. Sticky brand-row headers via `FlashList` v2 `stickyHeaderIndices` (verified available in `@shopify/flash-list@2.0.x` per package.json).
- Accordion expand/collapse: Reanimated `LayoutAnimation` with spring physics (`damping: 18, stiffness: 220` baseline — matches existing motion vocabulary in `src/shared/lib/animation.ts`).
- Empty brand rows hide via filter, not unmount/remount, to preserve scroll position across filter toggles.
- Selection footer strip rendered absolutely — keeps the accordion scroll independent.

### Accessibility

- Brand row tap target ≥48dp (Material), brand-row `accessibilityRole="button"` with `accessibilityState={{ expanded: isExpanded }}` so VoiceOver announces "expanded" / "collapsed".
- Machine checkbox row `accessibilityRole="checkbox"` with `accessibilityState={{ checked }}`.
- Accordion expand/collapse animation respects `prefers-reduced-motion` — instant snap when reduced-motion is on (Reanimated 4's `withSpring` reads the system preference).
- Focus management: opening an accordion moves focus to the brand row's first machine for screen reader users.

### Testing

- `FilterSheet.test.tsx`: existing tests assert 3-section structure (운동 부위 / 브랜드 / 머신). All rewrite to assert accordion + chip-row + global search.
- New cases:
  - Brand expand reveals body-part sub-headers.
  - Selecting 운동 부위 chip narrows visible machine rows inside expanded brands.
  - Search input "랫" auto-expands brands with matching machines + highlights matches.
  - AND/OR toggle appears only when 2+ machines selected.
  - Selection footer chip removal updates the accordion checkbox state.
- `useFilters.test.ts`: unchanged (state shape unchanged).
- Maestro flows: any flow referencing the old 3-section selectors needs updated selectors. See `.maestro/flows/` audit todo below.

### Migration

This refactor lands as a single PR (slice plan TBD during implementation):

1. **Slice a (skeleton)**: `FilterSheetBrandAccordion` + `FilterSheetSelectionStrip` components scaffolded with mock data; new `FilterSheet` parent wires them; old sections deleted. Tests rewritten.
2. **Slice b (cross-filter behaviour)**: 운동 부위 chip narrows accordion contents; search input auto-expands matching brands. Empty-state behaviour.
3. **Slice c (motion + a11y polish)**: Reanimated layout animation; accessibility audits; reduced-motion path.
4. **Slice d (Maestro update)**: `.maestro/flows/` flows touching the old selectors updated.
5. **Slice e (docs)**: Phase 5 README item 23 marked shipped; ADR 0024 status flipped from Draft to Accepted.

### Risks

- **Maestro flow churn** — every flow using `FilterSheet` selectors needs updating. Risk surfaces at PR review time, not at implementation time. Mitigation: audit `.maestro/flows/*.yaml` for `filter-` selector prefixes before starting Slice a.
- **`@shopify/flash-list` sticky header behaviour at N=24** — flash-list v2 stickyHeaderIndices is documented but the visual polish (border vs no-border on stuck row) needs sim verification. Mitigation: implement Slice a with a non-virtualized `ScrollView` first; switch to `FlashList` in Slice c after the layout is locked.
- **NL search → filter mapping** — opening the sheet from an NL search response should auto-expand the brands whose templates are in the response. `ActiveFilterStrip` logic transposes 1:1 in the selection footer, but the accordion expand-state restore is new. Mitigation: extend `active-filters.test.ts` with NL-result fixtures during Slice b.

## Implementation gates (separate from this ADR)

1. Audit Maestro flows touching `FilterSheet` selectors → list before Slice a.
2. Decide whether brand-row count badge shows total templates or templates-after-active-운동-부위-filter (recommend: after-filter for less confusion).
3. Decide whether to keep `FilterSheetSection`'s `SEARCH_THRESHOLD` constant (only the global search bar remains — drop the constant).

## Related documents

- `docs/adrs/0020-filter-panel-over-scrollbar.md` (original deferred wishlist that led to 0022)
- `docs/adrs/0021-filter-sheet-supersedes-panel.md` (BottomSheetModal upgrade)
- `docs/adrs/0022-machine-template-filter.md` (the ADR this one supersedes)
- `docs/plans/phase-5/README.md` item 23 section (high-level scope + to-do)
- `src/features/map/components/FilterSheet.tsx` (current 3-section impl)
- `src/features/map/hooks/useFilters.ts` (state hook, unchanged)
