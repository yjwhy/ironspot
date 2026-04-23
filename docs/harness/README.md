# Harness Engineering Setup

This document describes the AI agent harness built for IronSpot development. See [ADR 0017](../adrs/0017-harness-engineering.md) for the decision rationale.

## What is Harness Engineering?

Building the environment where an AI coding agent can produce high-quality work reliably — through context, automation, and guardrails.

## Components

### Context Layer

| File                                   | Purpose                                       | Auto-loaded?          |
| -------------------------------------- | --------------------------------------------- | --------------------- |
| `CLAUDE.md`                            | Project conventions, tech stack, coding rules | ✅ Yes, every session |
| `docs/plans/architecture-design.md`    | System architecture                           | On reference          |
| `docs/plans/ui-design.md`              | Design tokens + wireframes                    | On reference          |
| `docs/plans/phase-1/implementation.md` | Task-by-task implementation                   | On reference          |
| `docs/plans/phase-1/PROGRESS.md`       | Live task completion state                    | On reference          |
| `docs/adrs/*.md`                       | Decision records (short, scannable)           | On reference          |

### Automation Layer (Hooks)

Configured in `.claude/settings.json`:

| Trigger                                           | Action                 | Purpose                       |
| ------------------------------------------------- | ---------------------- | ----------------------------- |
| `PostToolUse:Edit\|Write` → `*.ts\|tsx\|js\|json` | Run Prettier           | Consistent formatting         |
| `PostToolUse:Edit\|Write` → `*.ts\|tsx`           | Run `tsc --noEmit`     | Catch type errors immediately |
| `PostToolUse:Edit\|Write` → `src/**/*.ts\|tsx`    | Run matching Jest test | Regression detection          |
| `PreToolUse:Write` → `ios/\|android/`             | Block                  | Protect Expo managed workflow |
| `PreToolUse:Bash` → `npm\|yarn install`           | Block                  | Enforce pnpm                  |

### Command Layer (Slash Commands)

Located in `.claude/commands/`:

| Command                | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `/verify`              | Run lint + typecheck + test (project-agnostic)       |
| `/commit-task <n>`     | Commit current task + update PROGRESS.md + create PR |
| `/next-task`           | Show next task from implementation plan              |
| `/check-design-tokens` | Find hardcoded values violating design tokens        |

### E2E Strategy (project-specific)

See [`e2e-strategy.md`](./e2e-strategy.md) for Task-to-E2E mapping. Kept separate from `/verify` so the command stays reusable across projects.

### Required Skills (referenced in CLAUDE.md)

- `vercel-react-native-skills` — RN/Expo performance patterns
- `supabase-postgres-best-practices` — DB/query optimization
- `frontend-design` — UI implementation
- `ui-ux-pro-max` — design system guidance
- Frontend guidelines from footprint project

## Maintenance

When a new technical decision is made:

1. Create an ADR in `docs/adrs/` (numbered `00XX-*.md`)
2. Update ADR README index
3. If it changes coding standards → update `CLAUDE.md`
4. If it changes Phase 1 implementation → update `implementation.md`

When a task completes:

- `/commit-task <n>` updates `PROGRESS.md` automatically

## Execution Pattern: Subagent-Driven Development

The project uses a tiered review approach:

```
Micro (per subtask)  → Code-reviewer sub-agent (auto)
Meso  (per Task)     → /verify + PR creation (auto)
Macro (per group)    → User reviews PRs on GitHub (manual)
```

**User review checkpoints:**

- After Task 1~4: foundation
- After Task 5~7: data layer + components
- After Task 8~11: UI screens (sans map)
- After Task 12~13: integration (incl. map)
- After Task 14~15: final verification

User does NOT review each subtask — the agent dispatches a code-reviewer sub-agent instead. User only merges PRs at macro checkpoints.

## Philosophy

**Guardrails over gatekeeping.** Hooks prevent mistakes, not slow down work.

**Documented decisions, not rituals.** ADRs record why, not process.

**Automation proportional to payoff.** Only automate what repeats.

**Trust but verify.** Sub-agents handle micro reviews; user handles macro reviews via PRs.
