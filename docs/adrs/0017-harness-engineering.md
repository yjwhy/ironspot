# ADR 0017: AI 에이전트 Harness Engineering 적용

**Status:** Accepted · 2026-04-18

## Context

이 프로젝트는 Claude Code (AI 코딩 에이전트)와 협업하여 구현. "AI에게 일 시키는 것"과 "AI가 품질 높게 일하도록 환경을 설계하는 것"은 다른 차원의 엔지니어링. 후자를 **Harness Engineering**이라 한다.

## Decision

프로젝트 전반에 Harness Engineering 요소를 구축하여 AI 에이전트의 작업 품질을 자동으로 보장.

## Components

### 1. 컨텍스트 문서 계층

```
CLAUDE.md                 ← 에이전트가 자동으로 읽는 프로젝트 룰
docs/adrs/                ← 의사결정 근거 (빠른 참조)
docs/plans/
├── architecture-design.md  ← 시스템 설계
├── ui-design.md            ← 디자인 토큰 + 와이어프레임
└── phase-1/
    ├── implementation.md   ← Task별 상세 구현 계획
    └── PROGRESS.md         ← 완료 상태 추적
```

### 2. 자동 품질 게이트 (Hooks)

`.claude/settings.json`에서:

- **PostToolUse:Edit|Write** → Prettier 자동 포맷
- **PostToolUse:Edit|Write (\*.ts/tsx)** → TypeScript 타입 체크
- **PostToolUse:Edit|Write (src/\*.ts)** → 해당 테스트 자동 실행
- **PreToolUse:Write (ios/, android/)** → 차단 (Expo managed 보호)
- **PreToolUse:Bash (npm/yarn)** → 차단 (pnpm 강제)

### 3. 반복 워크플로우 단축 (Slash Commands)

- `/verify` — lint + typecheck + test 일괄 실행
- `/commit-task` — 현재 Task에 맞는 커밋 + PROGRESS.md 업데이트
- `/next-task` — 다음 작업 표시
- `/check-design-tokens` — 하드코딩된 값 검출

### 4. 필수 참조 스킬

CLAUDE.md에 명시된 스킬을 에이전트가 매번 참조:

- `vercel-react-native-skills`
- `supabase-postgres-best-practices`
- `frontend-design`
- footprint 프로젝트의 frontend guidelines

## Consequences

**긍정적:**

- 구현 품질이 인간 리뷰 없이도 베이스라인 유지 (린트/타입/테스트 자동)
- 에이전트가 프로젝트 컨벤션을 어기기 어려운 구조 (hook 차단)
- 진행 상황 가시성 (PROGRESS.md)
- 포트폴리오 어필 포인트: "AI와 체계적으로 협업하는 엔지니어"

**부정적:**

- 초기 harness 세팅에 시간 투자 (~1시간)
- Hook 스크립트 디버깅 필요할 수 있음
- 새 의사결정 시 ADR 문서 작성 부담

## 참고

Harness Engineering은 2025-2026년 시점 업계에서 떠오르는 개념. Anthropic, Cognition (Devin), Cursor 등이 이 영역에 집중. 한국에서도 토스, 네이버 등에서 논의 시작.
