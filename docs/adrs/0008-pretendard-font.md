# ADR 0008: 한글 + 영문 타이포그래피에 Pretendard 사용

**Status:** Accepted · 2026-04-18

## Context

한국 유저 타겟 앱. 한글 + 영문을 깔끔하게 처리하며 현대적 느낌의 폰트 필요. 다양한 웨이트 (400, 500, 600, 700) 지원 필수.

## Decision

**Pretendard**를 모든 텍스트에 사용.

## Alternatives

- **Noto Sans KR** — Google 호스팅, 안정적. 하지만 다소 밋밋하고 개성 부족.
- **Apple SD Gothic Neo + Roboto** — 시스템 폰트. iOS (Apple SD)와 Android (Roboto)가 달라 플랫폼 간 일관성 부족.
- **Spoqa Han Sans Neo** — 대안으로 인기지만, Pretendard가 현대 한국 앱에서 더 널리 채택됨.

## Consequences

**긍정적:**

- 현대 한국 앱의 사실상 표준 (토스, 당근, 오늘의집 전부 사용)
- 한글 + 영문 시각적 조화 우수 (스크립트 간 비율 유사)
- Variable font 사용 가능 (4개 TTF 대비 번들 작음, 선택사항)
- 오픈소스, 상업적 사용 무료

**부정적:**

- 앱에 4개 폰트 파일 번들 필수 (~2MB, 수용 가능한 수준)
- 시스템 폰트 대비 초기 앱 크기 약간 증가
- 폰트 로딩 상태 처리 필요 (스플래시 스크린에서 커버)
