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

3. Run `/verify` (lint + typecheck + test). If it fails, STOP and report errors — do not commit.

4. Show user the changed files via `git status` — confirm they match the task scope.

5. Build commit message using conventional commits:
   - Task 1 → `chore: initialize expo project with full tooling`
   - Task 2 → `feat: add design tokens (colors, typography, spacing)`
   - Task 5.1 → `feat(button): add Button component with variants`
   - Task 7.2 → `feat(map): add gym search service and hook`

6. Stage only files scoped to this task (never `git add .`). Commit:

   ```bash
   git add <scoped-files>
   git commit -m "<message>"
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
