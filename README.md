# IronSpot

특정 운동 머신(파나타, 해머 스트렝스 등)을 찾는 사용자에게 헬스장의 실제 보유 현황과 신뢰도 높은 실물 사진을 제공하는 모바일 앱.

**상태:** 설계 완료, Phase 1 구현 준비 중

## 핵심 기능 (Phase 1 → 3)

- **Phase 1:** 지도 기반 헬스장/머신 검색, 필터링, 사진 갤러리 (읽기 전용)
- **Phase 2:** 소셜 로그인, 사진 업로드 + OCR 기반 머신 자동 인식
- **Phase 3:** 자연어 검색 ("현재 위치 1km 내 파나타 5개 이상")

## 기술 스택

### Frontend (Mobile App)

- React Native (Expo) + Expo Router
- TanStack Query + Query Key Factory 패턴
- NativeWind v4 (Tailwind CSS)
- react-native-reanimated (모든 애니메이션)
- Pretendard 폰트

### Backend

- Phase 1: Supabase (PostgreSQL + PostGIS + Auth + Storage) 직접 연결
- Phase 2+: Spring Boot 3 + Java 25 (LTS) API 서버

### AI 통합

- Google Vision API (OCR, Phase 2)
- LLM API (자연어 → 구조화 쿼리, Phase 3)

### DevOps

- Docker + docker-compose
- GitHub Actions CI/CD

---

## 🛠 Harness Engineering

이 프로젝트는 **AI 코딩 에이전트(Claude Code)와의 체계적 협업**을 위한 harness를 구축하여 개발:

- **17개의 ADR**로 모든 기술 결정의 근거 기록
- **계층적 문서 구조** (Architecture / UI / Phase별 구현 계획)
- **자동 품질 게이트** — Edit/Write 시 Prettier, TypeScript, Jest 자동 실행
- **슬래시 커맨드** — 반복 워크플로우 단축 (`/verify`, `/commit-task`)
- **진행 상황 추적** — `PROGRESS.md`로 Phase 진척 가시화

자세한 내용: [`docs/harness/README.md`](./docs/harness/README.md)

---

## 문서

| 문서                                                        | 설명                                  |
| ----------------------------------------------------------- | ------------------------------------- |
| [아키텍처 설계](./docs/plans/architecture-design.md)        | 시스템 구조, DB 설계, Phase 전략      |
| [UI 디자인](./docs/plans/ui-design.md)                      | 디자인 토큰, 와이어프레임, 애니메이션 |
| [Phase 1 구현 계획](./docs/plans/phase-1/implementation.md) | 15개 Task로 나눈 상세 구현 가이드     |
| [ADR 목록](./docs/adrs/README.md)                           | 기술 결정 기록 (17개)                 |

## 개발 환경

- **Node.js:** 20+
- **패키지 매니저:** pnpm (필수)
- **iOS/Android 빌드:** Expo EAS Build
- **DB:** Supabase (Seoul 리전)

## 명령어

```bash
pnpm install              # 의존성 설치
pnpm start                # 개발 서버
pnpm test                 # 테스트
pnpm lint                 # 린트
pnpm exec tsc --noEmit    # 타입 체크
```

## 라이선스

Private. 포트폴리오 + 실서비스 출시 목적.
