# CLAUDE.md

IronSpot: A React Native (Expo) mobile app for finding gym equipment at nearby gyms, with map-based search, photo verification, and AI-powered features.

## Entry Protocol

**When user says "Task N 시작" / "start Task N" / "continue Phase X":**

1. **Read in this order:**
   - `docs/plans/phase-1/PROGRESS.md` — current state
   - `docs/plans/phase-1/implementation.md` — find the specified Task
   - `docs/harness/lessons.md` — known gotchas not caught by lint/types/tests
   - This CLAUDE.md's "Execution Workflow" section below

2. **Follow subagent-driven development:**
   - Each subtask/Step: implement → dispatch `code-reviewer` sub-agent for review → address feedback → `/verify` → commit
   - Never ask user to review individual subtasks
   - Max 5 review iterations per subtask (stop and report if exceeded)

3. **At Task completion:**
   - Run full `/verify`
   - Execute `/commit-task <N>` → creates PR targeting `main`
   - Update `PROGRESS.md`
   - **Notify user with PR URL and stop**

4. **Pause and ask user only when:**
   - Manual step required (e.g., `gh auth login`, file downloads)
   - Ambiguous decision not covered in docs
   - Prerequisite missing (e.g., Naver API key for Task 13)
   - Code review loop exceeds 5 iterations

## Design Documents

All architectural and UI decisions are documented. Read these before making changes:

| Document               | Path                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| Architecture Design    | `docs/plans/architecture-design.md`                                           |
| UI Design              | `docs/plans/ui-design.md`                                                     |
| Phase 1 Implementation | `docs/plans/phase-1/implementation.md`                                        |
| Phase 2 (planned)      | `docs/plans/phase-2/README.md`                                                |
| Phase 3 (planned)      | `docs/plans/phase-3/README.md`                                                |
| ADR Index              | `docs/adrs/README.md` (short decision records, portfolio/interview reference) |
| Harness Setup          | `docs/harness/README.md` (hooks, commands, context layers)                    |
| Session Lessons        | `docs/harness/lessons.md` (gotchas not caught by lint/types/tests)            |
| Phase 1 Progress       | `docs/plans/phase-1/PROGRESS.md` (live task completion state)                 |

## Tech Stack

- **App:** React Native (Expo) with Development Builds
- **State:** TanStack Query (React Query)
- **Styling:** NativeWind (Tailwind CSS)
- **Components:** Custom (no component library)
- **Navigation:** Expo Router (file-based, type-safe)
- **Map:** Naver Maps SDK
- **Animation:** react-native-reanimated + react-native-gesture-handler
- **Forms:** React Hook Form + Zod
- **HTTP:** ky
- **Storage:** react-native-mmkv
- **Date:** dayjs
- **Icons:** @expo/vector-icons + custom SVG
- **Toast:** burnt
- **Bottom Sheet:** react-native-bottom-sheet
- **Backend:** Supabase (PostgreSQL + PostGIS + Storage + Auth)
- **API Server:** Spring Boot 3 + Java 25 (LTS) (Phase 2+)

## Project Structure

Feature-based organization. Related code stays together.

```
app/                     (Expo Router - file-based routes)
├── _layout.tsx          (root layout, providers)
├── (tabs)/              (tab group)
│   ├── _layout.tsx      (tab layout)
│   ├── index.tsx        (Map tab)
│   └── me.tsx           (My Page tab)
├── gym/[id]/machine/[machineId].tsx  (photo gallery)
└── photo/[id].tsx       (photo detail, modal)

src/
├── features/
│   ├── map/          (MapView, markers, filters, search)
│   ├── gym/          (GymCard, GymDetail, MachineList, BottomSheet)
│   ├── photo/        (Gallery, PhotoCard, UploadFlow)
│   ├── auth/         (Phase 2: login)
│   └── search/       (Phase 3: NL search)
├── shared/
│   ├── components/   (Button, Chip, Card — custom built)
│   ├── hooks/        (useLocation, etc.)
│   ├── lib/          (supabase client, query keys)
│   ├── theme/        (tokens, fonts)
│   └── types/        (database types, shared interfaces)

Path aliases: @/* → src/*
```

## Development Methodology

- **TDD enforced:** RED -> GREEN -> REFACTOR. Write tests first. Verify test fails before implementing.
- **Target 80%+ test coverage**
- **Immutability:** Always create new objects, never mutate
- **Feature-based commits:** Each logical unit gets its own commit

## Execution Workflow (Subagent-Driven Development)

This project uses **subagent-driven development** — the main session orchestrates; sub-agents implement and review.

### Per-subtask cycle (automatic, no user intervention)

1. **Implement** — main agent writes test (RED), verifies failure, implements (GREEN), verifies pass
2. **Auto-review** — dispatch `code-reviewer` sub-agent (or `superpowers:requesting-code-review` skill)
3. **Fix feedback** — address any issues the reviewer surfaces
4. **Verify** — run `/verify` (lint + typecheck + test). Must pass.
5. **Commit** — small, focused commit on the feature branch

### Per-task cycle (PR creation)

When all sub-tasks of a Task are complete:

1. Run full `/verify`
2. **Check `docs/harness/e2e-strategy.md`** — run the E2E flows mapped to this task
3. Use `/commit-task <N>` to create PR targeting `main`
4. Update `PROGRESS.md`
5. **Stop and notify user** — user reviews the PR on GitHub

### User review checkpoints (macro level)

User does NOT review each subtask. User reviews in these batches:

| Checkpoint | After      | What user reviews                            |
| ---------- | ---------- | -------------------------------------------- |
| 1          | Task 1~4   | Project foundation (setup, tokens, supabase) |
| 2          | Task 5~7   | Data layer + shared components               |
| 3          | Task 8~11  | All UI screens (except map)                  |
| 4          | Task 12~13 | Integration (incl. map)                      |
| 5          | Task 14~15 | Final verification                           |

Review happens via GitHub PRs created by `/commit-task`. User merges PRs when satisfied.

### Rules for the agent

- **Never ask user to review each subtask** — dispatch code-reviewer sub-agent instead
- **Never skip /verify** — if it fails, fix before moving on
- **Never merge PRs** — user merges after review
- **Never work on main branch** — always feature branch (`task/<N>-<name>`)
- **Auto-loop max 5 iterations** — if code review keeps finding issues after 5 cycles, stop and report to user

## Coding Standards

### Required Skills to Reference

These skills contain patterns and best practices that MUST be followed:

1. **`/vercel-react-best-practices`** — React/Next.js performance optimization patterns. Apply to React Native where applicable (component composition, memoization, state management).

2. **Frontend Guidelines** — Read and follow the frontend design principles from:
   `~/Desktop/work/development/footprint/.cursor/rules/front-end-guidelines.mdc`
   Key principles: Readability, Predictability, Cohesion, Coupling.

3. **`/vercel-react-native-skills`** — React Native and Expo best practices. MUST reference when building components, optimizing list performance, implementing animations, or working with native modules. Covers: list virtualization, animation GPU properties, navigation patterns, UI patterns, state management, rendering optimization.

4. **`supabase-postgres-best-practices`** — Follow when writing SQL queries, designing schemas, configuring RLS, or optimizing database performance. Skill located at:
   `.agents/skills/supabase-postgres-best-practices/SKILL.md`

5. **`typescript-patterns`** — MUST reference when writing TypeScript types, interfaces, assertions, or any type-level code. Covers: interface vs type, branded types, discriminated unions, generic constraints, narrowing patterns, type-only imports.

### Code Quality

- Functions under 50 lines, files under 800 lines
- No `any` type — use `unknown` and narrow
- No `console.log` in production code
- No hardcoded secrets — use environment variables
- No magic numbers — use named constants
- No deep nesting (>4 levels)
- Prefer function declarations over const arrow functions
- Name complex boolean conditions descriptively
- Organize code by feature/domain, not by type
- Abstract complex logic into dedicated components
- Separate significantly different conditional UI into distinct components
- Use composition over prop drilling

### Performance First (CRITICAL)

Performance is the highest priority. Every implementation decision should optimize for the best possible UX. Slow = broken.

**Rendering:**

- React Compiler is enabled (see ADR 0018). Do not hand-roll `useCallback` / `useMemo` for stable references — RC auto-memoises function/object/array literals and component bodies. Lint rule `react-compiler/react-compiler` flags patterns RC has to bail out on.
- Still use `React.memo` on heavy list-item components — RC memoises hooks and bodies, not component identities across renders.
- Avoid inline objects/arrays in JSX **only when** RC has bailed out (`'use no memo'` directive or impure code). In RC-compiled code, inline literals are auto-cached and free.
- Reanimated worklets, Bottom Sheet `useAnimatedStyle`, and similar hot paths must stay annotated with `'worklet'` and may need `'use no memo'` if RC interferes — verify with the lint rule.
- Extract heavy or impure functions outside render — RC will not memoise impure code paths.

**Lists:**

- Use FlashList over FlatList for large lists (>50 items)
- Set `estimatedItemSize` on all lists
- Implement `getItemType` for heterogeneous lists
- Avoid re-renders: stable `keyExtractor`, memoized `renderItem`

**Images:**

- Always resize/compress before display
- Use `cachePolicy: 'memory-disk'` for frequently shown images
- Implement progressive loading (placeholder -> full image)

**Navigation:**

- Minimize screen mount cost — lazy load heavy screens
- Use `react-native-screens` (enabled by default in Expo)
- Avoid deep navigation stacks

**Data:**

- TanStack Query `staleTime` tuned per query (static data = Infinity)
- Prefetch data on hover/focus before navigation
- Pagination over loading all data

**Animations:**

- Run on UI thread only — never use `useAnimatedStyle` with JS thread callbacks
- Animate only `transform` and `opacity` (GPU-accelerated properties)
- Use `useDerivedValue` for computed animations
- Cancel animations on unmount to prevent memory leaks

### TypeScript Conventions

- **No `any`** — use `unknown` and narrow
- **Type-only imports** — use `import type { ... }` (enforced by ESLint)
- **interface vs type:**
  - `interface` for object shapes that may be extended
  - `type` for unions, intersections, mapped/conditional types
- **Branded types for IDs** — prevent mixing IDs:
  ```ts
  type Brand<K, T> = K & { __brand: T };
  export type GymId = Brand<string, 'GymId'>;
  export type UserId = Brand<string, 'UserId'>;
  ```
- **Discriminated unions for state/status:**
  ```ts
  type LoadState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: Error };
  ```
- **Readonly when possible** — use `readonly` for immutable arrays/objects, `as const` for literal values
- **Prefer `null` over `undefined`** for intentional absence (DB nullable columns); reserve `undefined` for "not yet set"
- **Non-null assertions (`!`) forbidden** — narrow with type guards instead

### React Native Specific

- Use TanStack Query for all server state
- Keep client state minimal (react-native-mmkv for persistence)
- Use react-native-reanimated for ALL animations (no Lottie, no Moti)
- Spring physics over linear timing for animations
- Stagger delays: 50-80ms between items

### Supabase Specific

- Use PostGIS geography type for location data
- Use RPC functions for complex queries
- Denormalize counts (upvote_count) for query performance
- Use RLS policies for data access control
- Validate with Zod at data boundaries

### Spring Boot Specific (Phase 2+)

- Layered architecture: Controller / Service / Repository
- Spring Security filter chain for Supabase JWT validation
- Jakarta Validation (@Valid) for DTO validation
- SpringDoc OpenAPI for API documentation
- Orval: OpenAPI spec → TypeScript client + TanStack Query hooks (auto-generated, never hand-write API calls)
- application.yml for configuration (not .properties)
- Package by feature: com.ironspot.{auth, gym, machine, photo, search}
- JUnit 5 + Mockito + MockMvc for testing

## Package Manager

**pnpm** — always use pnpm, never npm or yarn.

## Commands

```bash
pnpm expo start                    # Start dev server
pnpm jest                          # Run all tests
pnpm jest --testPathPattern=<path> # Run specific tests
pnpm expo start --clear            # Clear cache and start
pnpm install                       # Install dependencies
```

## Boundaries

### Always Do

- Read design documents before implementing
- Write tests FIRST (TDD)
- Follow feature-based folder structure
- Use immutable patterns
- Validate input at boundaries with Zod
- Reference the three required skills listed above

### Ask First

- Database schema changes
- Adding new dependencies
- Changing navigation structure
- Modifying shared components used by multiple features

### Never Do

- Skip TDD cycle
- Use `any` type
- Mutate objects/arrays
- Leave `console.log` in code
- Hardcode secrets or API keys
- Add features beyond what was asked
- Use component libraries (all UI is custom)
- Use Lottie, Moti, or animation libraries other than reanimated

## Self-Check

Before completing any task:

- [ ] Tests written first and passing
- [ ] No `any` types
- [ ] No non-null assertions (`!`)
- [ ] Type-only imports used (`import type { ... }`)
- [ ] Branded types used for IDs
- [ ] No `console.log` statements
- [ ] No hardcoded values
- [ ] Immutable patterns used
- [ ] Code follows feature-based organization
- [ ] Frontend guidelines principles applied (readability, predictability, cohesion, coupling)
- [ ] Supabase best practices followed for any DB work
