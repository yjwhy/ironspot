---
description: Commit current task progress, push feature branch, create PR
argument-hint: <task-number> [optional: <sub-task>]
---

Complete the current task's Git workflow: feature branch → commit → push → PR.

**Arguments:** $ARGUMENTS (e.g., "6.2" for Task 6.2, or "4" for Task 4)

**Steps:**

1. Read `docs/plans/phase-1/implementation.md` to find Task $ARGUMENTS.

2. Verify current branch is a feature branch for this task:

   ```bash
   git branch --show-current
   ```

   Expected: `task/<N>-<short-name>`. If user is on `main`, STOP and tell them to create a feature branch first.

3. **Verify** — branch out by whether **frontend code** changed since `origin/main`:

   ```bash
   git diff --name-only origin/main...HEAD -- \
     'app/' 'src/' 'tailwind.config.js' 'babel.config.js' 'metro.config.js' \
     'app.json' 'app.config.js' 'app.config.ts' \
     'nativewind-env.d.ts' 'expo-env.d.ts' \
     'package.json' 'pnpm-lock.yaml'
   ```

   - **If the command prints any path** (frontend change): invoke `/verify` as a **slash command** — NOT `pnpm jest && pnpm lint && pnpm tsc --noEmit`. The slash command runs four steps; the pnpm trio only covers steps 1–3 and silently skips step 4 (FF review). That bug bit Task 12 PR #17.
   - **If the output is empty** (docs / CI / Maestro / backend only): run `pnpm lint && pnpm exec tsc --noEmit && pnpm test` directly. FF review is N/A for non-FE diffs.

   If verify fails, STOP and report errors — do not commit.

4. Show user the changed files via `git status` — confirm they match the task scope.

5. Group changed files by area of concern, then create one commit per group.
   Use conventional commit format per group. Examples of natural groupings:

   | Group                      | Scope                   | Example files                                     |
   | -------------------------- | ----------------------- | ------------------------------------------------- |
   | Build / config             | `chore`                 | `build.gradle.kts`, `package.json`, `*.config.ts` |
   | Generated / codegen output | `chore`                 | `src/main/generated/`, `src/shared/generated/`    |
   | Shared / util              | `feat` or `refactor`    | `src/shared/`, `src/lib/`                         |
   | Feature A (one domain)     | `feat`/`refactor`/`fix` | `src/features/auth/**`                            |
   | Feature B (another domain) | `feat`/`refactor`/`fix` | `src/features/gym/**`                             |
   | Tests                      | `test`                  | `**/__tests__/**`                                 |
   | Docs / progress            | `docs`                  | `docs/**`, `CLAUDE.md`                            |

   Rules:
   - Never `git add .` — always stage files explicitly per group.
   - If a task touches only one logical unit, a single commit is fine.
   - The final `docs(phase-N): mark Task N complete` is always its own commit.

6. For each group, stage and commit in sequence:

   ```bash
   git add <group-files>
   git commit -m "<type>(<scope>): <description>"
   ```

7. Push branch:

   ```bash
   git push -u origin <branch-name>
   ```

8. Create PR:
   ```bash
   gh pr create --title "Task <N>: <name>" --body "$(cat <<EOF
   ```

## Task <N>: <name>

<brief description of what was implemented>

## Changes

- <list of changes>

## Verification

- [x] Lint passing
- [x] TypeScript passing
- [x] Tests passing

## Progress

See \`docs/plans/phase-1/PROGRESS.md\`
EOF
)" --base main

```

9. Update `docs/plans/phase-1/PROGRESS.md`:
- Check the task box `[x]`
- Add entry to Completed Tasks Log with commit SHA and PR number

10. Report:
 - Commit SHA
 - PR URL
 - Next task (from implementation plan)

**Never:**
- Commit if /verify fails
- Use `git add .` blindly
- Skip PROGRESS.md update
- Merge the PR (user decides when to merge, typically after review)
- Work directly on main branch
```
