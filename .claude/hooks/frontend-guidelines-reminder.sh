#!/usr/bin/env bash
# PostToolUse hook: re-injects the Frontend Guidelines short reminder into
# Claude's context after every Edit/Write of frontend code (.ts/.tsx under
# app/ or src/). Defends against context drift over long sessions.
#
# Full guideline lives at docs/harness/frontend-guidelines.md. The reminder
# below is intentionally tight (~7 lines) — full content is too costly to
# inject per edit.

set -e

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

case "$FILE" in
  */app/*.ts | */app/*.tsx | */src/*.ts | */src/*.tsx)
    cat <<'EOF'
[Frontend Guidelines reminder]
1. Readability — name magic numbers, split conditional UI into components, simplify ternaries, colocate simple logic, name complex booleans.
2. Predictability — consistent return types for similar hooks/funcs, SRP (no hidden side effects), unique descriptive names.
3. Cohesion — feature-based folders, constants near related logic.
4. Coupling — composition over props drilling, narrow focused hooks (avoid 5+ return values), avoid premature abstraction.
Full guide: docs/harness/frontend-guidelines.md. ff-review:review runs at task boundary.
EOF
    ;;
esac
