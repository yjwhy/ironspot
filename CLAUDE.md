# CLAUDE.md

IronSpot: a React Native (Expo) mobile app for finding gym equipment at nearby gyms, with map-based search, photo verification, and AI-powered features.

## Behavioral Guidelines

Adapted from Andrej Karpathy's coding-skills CLAUDE.md (via [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills)). Tradeoff: these bias toward caution over speed — for trivial tasks, use judgment.

### 1. Think Before Coding

State assumptions explicitly. If multiple interpretations exist, present them — don't pick silently. If a simpler approach exists, say so. If something is unclear, stop and ask.

### 2. Simplicity First

Minimum code that solves the problem. No features beyond what was asked. No abstractions for single-use code. No "flexibility" or "configurability" not requested. No error handling for impossible scenarios. Ask: "Would a senior engineer say this is overcomplicated?"

### 3. Surgical Changes

Touch only what you must. Don't "improve" adjacent code, comments, or formatting. Match existing style. Remove imports/variables/functions that YOUR changes orphaned — don't delete pre-existing dead code unless asked. Test: every changed line should trace to the user's request.

### 4. Goal-Driven Execution

Define verifiable success criteria. _"Add validation"_ → _"Write tests for invalid inputs, then make them pass."_ For multi-step tasks, state a brief plan with verify steps.

## Entry Protocol

When user says "Task N 시작" / "start Task N" / "continue Phase X":

1. Read in this order:
   - `docs/plans/phase-1/PROGRESS.md` — current state
   - `docs/plans/phase-1/implementation.md` — find the specified Task
   - `docs/harness/lessons.md` — known gotchas not caught by lint/types/tests
   - `docs/harness/frontend-guidelines.md` — **required when the Task touches `src/` or `app/`** (most Phase 1 Tasks). Loaded once at start so the full FF pattern set is in context; the always-loaded `src/CLAUDE.md` summary is the primer, this file is the reference.
2. Follow subagent-driven development (see Execution Workflow).
3. At Task completion: full `/verify` → `/commit-task <N>` → notify user with PR URL and stop.
4. Pause and ask user only when: manual step required (auth, downloads), ambiguous decision not in docs, prerequisite missing (e.g., Naver API key for Task 13), or code-review loop exceeds 5 iterations.

## Design Documents

| Document               | Path                                   |
| ---------------------- | -------------------------------------- |
| Architecture Design    | `docs/plans/architecture-design.md`    |
| UI Design              | `docs/plans/ui-design.md`              |
| Phase 1 Implementation | `docs/plans/phase-1/implementation.md` |
| Phase 2 (planned)      | `docs/plans/phase-2/README.md`         |
| Phase 3 (planned)      | `docs/plans/phase-3/README.md`         |
| ADR Index              | `docs/adrs/README.md`                  |
| Harness Setup          | `docs/harness/README.md`               |
| Session Lessons        | `docs/harness/lessons.md`              |
| Phase 1 Progress       | `docs/plans/phase-1/PROGRESS.md`       |

## Nested CLAUDE.md (loaded on demand)

| Directory                      | Scope                                                         |
| ------------------------------ | ------------------------------------------------------------- |
| `src/CLAUDE.md`                | Code conventions, immutability, TypeScript, performance, data |
| `app/CLAUDE.md`                | Expo Router routing conventions                               |
| `.maestro/CLAUDE.md`           | Maestro preconditions + selector lessons                      |
| `docs/plans/phase-2/CLAUDE.md` | Spring Boot 3 + Java 25 conventions (Phase 2+)                |

## Required Skills

When the relevant work appears, use the corresponding skill — do NOT inline the skill's content here.

| Skill                              | Use when                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `typescript-patterns`              | Writing TS types, interfaces, type-level code                               |
| `vercel-react-best-practices`      | React/RN performance work, React Compiler interaction                       |
| `vercel-react-native-skills`       | RN components, list virt., animations, native modules                       |
| `supabase-postgres-best-practices` | SQL queries, schema, RLS, RPC, performance                                  |
| `ff-review:review`                 | Frontend Fundamentals review (readability/predictability/cohesion/coupling) |

## Tech Stack (high-level)

- **App**: React Native (Expo SDK 54) with dev builds — TanStack Query, NativeWind, Expo Router, Naver Maps SDK, reanimated v4, MMKV, ky, dayjs, react-native-bottom-sheet, burnt
- **Backend**: Supabase (PostgreSQL + PostGIS + Storage + Auth)
- **API server (Phase 2+)**: Spring Boot 3 + Java 25 (LTS) — see `docs/plans/phase-2/CLAUDE.md`
- **Package manager**: `pnpm` (never npm/yarn)

## Execution Workflow (Subagent-Driven Development)

Main session orchestrates; sub-agents implement and review.

### Per-subtask cycle

1. Implement — RED → GREEN → REFACTOR (TDD enforced, target 80%+ coverage)
2. Auto-review — dispatch `code-reviewer` sub-agent
3. Fix feedback
4. Quick verify — `pnpm lint && pnpm exec tsc --noEmit && pnpm test`. Full `/verify` (with FF review) only at task boundary.
5. Commit on the feature branch

Max 5 review iterations per subtask — stop and report if exceeded.

### Per-task cycle (PR creation)

1. **`/verify` as a slash command** — required when the diff against `origin/main` touches frontend code (`app/`, `src/`, `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `app.json`, `app.config.{js,ts}`, `nativewind-env.d.ts`, `expo-env.d.ts`, `package.json`, `pnpm-lock.yaml`). Never substitute `pnpm jest && pnpm lint && pnpm tsc` — those skip step 4 (FF review). Docs/CI/Maestro-only diffs: pnpm trio is sufficient.
2. Check `docs/harness/e2e-strategy.md` and run mapped E2E flows.
3. `/commit-task <N>` to create PR targeting `main`.
4. Update `PROGRESS.md`.
5. Stop and notify user.

### User review checkpoints

| Checkpoint | After      | Reviews                        |
| ---------- | ---------- | ------------------------------ |
| 1          | Task 1~4   | Project foundation             |
| 2          | Task 5~7   | Data layer + shared components |
| 3          | Task 8~11  | UI screens (except map)        |
| 4          | Task 12~13 | Integration (incl. map)        |
| 5          | Task 14~15 | Final verification             |

### Rules

- Never ask user to review individual subtasks — dispatch code-reviewer instead
- Never merge PRs — user merges after review
- Never work on `main` — always feature branch (`task/<N>-<name>`)

## Critical Rules

**Always**: TDD (tests first), feature-based folder structure, immutable patterns, Zod at data boundaries, design docs read before implementing.

**Ask first**: Database schema changes, new dependencies, navigation structure changes, modifying shared components used by multiple features.

**Never**: `any` types, non-null assertions (`!`), mutating objects/arrays, `console.log` in production, hardcoded secrets/keys, component libraries (UI is custom), animation libraries other than reanimated, features beyond what was asked.

## Commands

```bash
pnpm expo start                    # Dev server
pnpm expo start --dev-client       # Dev client (for native modules)
pnpm expo start --clear            # Clear Metro cache
pnpm jest                          # All tests
pnpm jest --testPathPattern=<p>    # Specific tests
pnpm snap                          # Capture booted iOS simulator screen
pnpm e2e:smoke                     # Maestro smoke (every PR, ~30s)
pnpm e2e:flow .maestro/flows/X     # Single Maestro flow
pnpm e2e:all                       # Full Maestro suite (Phase 1 verification)
```

## AI workflow: visual verification

When verifying UI visually:

1. User performs interaction in simulator (deep link, tap, navigation).
2. Claude runs `pnpm snap` → captures booted sim to `.tmp/snaps/<HHMMSS>.png`.
3. Claude reads the path with the Read tool — image renders inline.
4. Claude reports findings.

`xcrun simctl` only captures — it cannot tap, swipe, or type. For automation, use Maestro (see `.maestro/CLAUDE.md`).
