---
description: Run full verification suite (lint + typecheck + test + FF review)
---

Run the complete verification suite for IronSpot. Execute these in order and report results:

1. **Lint**: `pnpm lint`
2. **Type check**: `pnpm exec tsc --noEmit`
3. **Tests**: `pnpm test`
4. **Frontend Fundamentals review**: dispatch the four `ff-review:*-reviewer` subagents on the current diff (same scope as the `/ff-review:review` skill) and synthesise findings.

Report after Steps 1-3:

- ✅ / ❌ for each step
- Full error output if any step fails
- Summary: "All green" or list of failures

If Steps 1-3 fail, STOP and report. Do not proceed to Step 4 — user must fix first.

## Step 4 policy (FF review inside /verify)

This step runs the same review as `/ff-review:review`, but with **auto-apply enabled for 🔴 only**. The `/ff-review:review` skill itself is not allowed to auto-fix; the override applies only when invoked from `/verify`.

After collecting findings:

- **🔴 (must)** — auto-apply the suggested fix for each item. Re-run Steps 1-3 after applying. If the fix introduces a regression, revert that single fix and report it as 🔴-deferred.
- **🟡 (should)** — report only. Do not modify code. List each item with file:line and the proposed fix in the report.
- **🟢 (consider)** — report only, one line each in a "그 외" section.
- **Trade-off conflicts** — if 🔴 items contradict each other (e.g. cohesion vs coupling pulling in opposite directions), do not auto-apply. Surface both and ask the user.
- **High-blast-radius 🔴** — if a 🔴 fix touches more than 3 files or requires changing public API consumed outside the diff, downgrade to 🔴-deferred and report instead of auto-applying.

After auto-applying 🔴 fixes:

- Re-run Steps 1-3 to confirm green.
- Show a unified diff of what was auto-applied.
- Then list 🟡 / 🟢 / 🔴-deferred items for user review.

Final summary:

```
VERIFY: [PASS / FAIL]

Step 1 Lint:      [OK / X errors]
Step 2 Types:     [OK / X errors]
Step 3 Tests:     [X/Y passing, Z% coverage]
Step 4 FF review:
  🔴 auto-applied: [N items]
  🔴 deferred:     [N items — needs user input]
  🟡 reported:     [N items]
  🟢 reported:     [N items]
```

If any step fails, list specifics. Do not claim success on partial completion.
