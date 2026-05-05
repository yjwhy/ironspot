# 아키텍처 의사결정 기록 (ADR)

프로젝트의 주요 기술 결정과 트레이드오프를 간결하게 기록한 문서입니다. 각 ADR은 의도적으로 짧게 작성되었으며, 전체 맥락은 `docs/plans/`에 있습니다.

## 목록

| #                                             | 결정                                                            | 상태     |
| --------------------------------------------- | --------------------------------------------------------------- | -------- |
| [0001](./0001-react-native-expo.md)           | 모바일 앱은 React Native (Expo)로 개발                          | Accepted |
| [0002](./0002-supabase.md)                    | Supabase를 BaaS로 사용 (DB + Auth + Storage)                    | Accepted |
| [0003](./0003-supabase-direct-phase1.md)      | Phase 1은 Supabase 직접 연결, Phase 2+ 부터 API 서버 도입       | Accepted |
| [0004](./0004-spring-boot-over-nestjs.md)     | API 서버는 NestJS 대신 Spring Boot 선택                         | Accepted |
| [0005](./0005-java-25-lts.md)                 | Spring Boot의 Java 버전은 25 LTS                                | Accepted |
| [0006](./0006-feature-based-structure.md)     | 폴더 구조는 Feature 기반으로 구성                               | Accepted |
| [0007](./0007-custom-components.md)           | 컴포넌트 라이브러리 대신 커스텀 컴포넌트 직접 구현              | Accepted |
| [0008](./0008-pretendard-font.md)             | 한글 + 영문 타이포그래피에 Pretendard 사용                      | Accepted |
| [0009](./0009-amber-accent.md)                | 포인트 컬러는 앰버 (#F59E0B)                                    | Accepted |
| [0010](./0010-google-vision-ocr.md)           | OCR은 Tesseract 대신 Google Vision API                          | Accepted |
| [0011](./0011-text-to-query-over-rag.md)      | 자연어 검색은 RAG 대신 text-to-query 방식                       | Accepted |
| [0012](./0012-orval-api-client.md)            | API 클라이언트 자동 생성에 Orval 사용                           | Accepted |
| [0013](./0013-reanimated-only.md)             | 애니메이션은 react-native-reanimated만 사용                     | Accepted |
| [0014](./0014-pnpm.md)                        | 패키지 매니저는 pnpm                                            | Accepted |
| [0015](./0015-naver-maps.md)                  | 한국 시장 타겟이므로 네이버 지도 SDK 사용                       | Accepted |
| [0016](./0016-expo-router.md)                 | 네비게이션은 React Navigation 대신 Expo Router                  | Accepted |
| [0017](./0017-harness-engineering.md)         | AI 에이전트 Harness Engineering 적용                            | Accepted |
| [0018](./0018-react-compiler.md)              | React Compiler를 Phase 1 도중 활성화                            | Accepted |
| [0019](./0019-sharedtransition-deferred.md)   | Phase 1 SharedTransition 보류 (reanimated v4 API 제거)          | Accepted |
| [0020](./0020-filter-panel-over-scrollbar.md) | 필터 UI: 가로 스크롤 → 버튼 + 패널, 머신 멀티셀렉트는 Phase 2로 | Accepted |

## 포맷

각 ADR은 다음 구조를 따릅니다:

- **Status** — Accepted / Superseded / Deprecated
- **Context** — 해결하려는 문제
- **Decision** — 선택한 방안
- **Alternatives** — 고려했지만 제외한 대안들과 그 이유
- **Consequences** — 긍정적/부정적 트레이드오프
