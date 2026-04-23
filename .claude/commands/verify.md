---
description: Run full verification suite (lint + typecheck + test)
---

Run the complete verification suite for IronSpot. Execute these in order and report results:

1. **Lint**: `pnpm lint`
2. **Type check**: `pnpm exec tsc --noEmit`
3. **Tests**: `pnpm test`

Report:

- ✅ / ❌ for each step
- Full error output if any step fails
- Summary: "All green" or list of failures

If any step fails, STOP and report. Do not proceed to next step automatically — user must fix first.
