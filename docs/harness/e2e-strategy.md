# E2E Testing Strategy

Maestro 기반 E2E 테스트를 3단계 빈도로 실행:

- **Smoke** — 매 Task 완료 시 (30초)
- **Relevant Flow** — 기능 수정 시 (1-2분)
- **Full Suite** — Phase 완료 시 (5-10분)

## Task → E2E 매핑

에이전트는 Task 완료 시점에 **아래 매핑 대로 E2E 실행**. `/verify` 통과 후 실행, 커밋 전.

| Task                                           | 실행할 E2E                               | 이유                                 |
| ---------------------------------------------- | ---------------------------------------- | ------------------------------------ |
| Task 1 (setup)                                 | 없음                                     | UI 없음                              |
| Task 2 (design tokens)                         | 없음                                     | 스타일만                             |
| Task 3 (font)                                  | 없음                                     | 에셋 로딩만                          |
| Task 4 (supabase + types)                      | 없음                                     | 데이터 레이어                        |
| Task 5 (seed photos)                           | 없음                                     | 수동 업로드                          |
| Task 6 (shared components)                     | 없음 (unit test 커버)                    | 격리된 컴포넌트                      |
| Task 7 (data services/hooks)                   | `smoke`                                  | 데이터 훅이 앱 크래시 유발할 수 있음 |
| Task 8 (location hooks)                        | `smoke`                                  | 위치 권한 플로우 영향                |
| Task 9 (expo router)                           | `smoke`                                  | 네비게이션 구조 영향                 |
| Task 9.5 (maestro setup)                       | `smoke`                                  | Maestro 자체 동작 검증               |
| Task 10 (gym bottom sheet)                     | `smoke`, `gym-search`, `gym-detail`      | UI + 상호작용                        |
| Task 11 (photo gallery + detail)               | `smoke`, `photo-gallery`, `photo-detail` | UI + 상호작용                        |
| Task 12 (empty/loading states)                 | 관련 flow                                | 조건부 렌더링                        |
| Task 13 (map + markers)                        | 전체 flow                                | 핵심 화면, 모든 플로우 진입점        |
| Task 14 (animations polish)                    | 전체 flow                                | 시각적 회귀 체크                     |
| Task 15 (final verification)                   | **`pnpm e2e:all`**                       | Phase 완료 최종 검증                 |
| Task 44 (FilterSheet, ADR 0021)                | `smoke`, `filter-sheet-flow`             | 필터 시트 진입 + segmented + reset   |
| Task 46 (gym_machine 신고, ADR 0022 follow-up) | `gym-machine-report-flow`                | 머신 신고 진입점 + 라벨 정정         |

## 실행 명령

```bash
# Smoke만
pnpm e2e:smoke

# 특정 flow
pnpm e2e:flow .maestro/flows/gym-detail.yaml

# 전체
pnpm e2e:all
```

## 에이전트 동작 규칙

1. Task 완료 시점 도달 (구현 + unit test 통과)
2. `/verify` 실행 (lint + typecheck + test)
3. 이 문서의 Task 매핑 확인
4. 해당 E2E 실행
5. 실패 시:
   - 실패 flow 로그 분석
   - 구현 수정 → `/verify` → E2E 재실행
   - 5회 루프 초과 시 유저에게 에스컬레이션
6. 성공 시 커밋 + PR 생성

## E2E 스킵 가능 조건

**시뮬레이터 미기동 시:**

- 에이전트가 자동 실행 가능한 경우만 실행
- 시뮬레이터/디바이스 연결 안 되면 유저에게 "시뮬레이터 켜주세요" 요청
- 유저 개입 필요함을 명시

**Task 내용상 불필요:**

- 위 매핑에서 "없음"인 Task는 skip
- "없음"이어도 앱 빌드 성공 여부는 확인 (`pnpm start`로 Metro 확인)

## 실패 대응

E2E가 불안정한 경우:

- 같은 flow 2회 재실행
- 2회 모두 실패 → 진짜 문제. 수정 시도
- 1회 성공/1회 실패 → flaky test. `docs/harness/failure-patterns.md`에 기록하고 유저에게 보고
