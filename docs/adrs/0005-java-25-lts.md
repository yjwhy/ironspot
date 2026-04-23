# ADR 0005: Spring Boot의 Java 버전은 25 LTS

**Status:** Accepted · 2026-04-17

## Context

Spring Boot 3에서 사용할 Java 버전 선택. 선택지는 Java 17 (이전 LTS)부터 Java 26 (2026년 3월 릴리즈, non-LTS)까지.

## Decision

**Java 25 (최신 LTS, 2025년 9월 릴리즈).**

## Alternatives

- **Java 17** — Spring Boot 3에서 여전히 지원되지만 LTS 2세대 뒤짐. 면접에서 "왜 최신을 안 썼나?" 질문 유발.
- **Java 21** — 직전 LTS, 하지만 구버전이 됨.
- **Java 26** — non-LTS. 프로덕션 부적합.

## Consequences

**긍정적:**

- 최신 LTS = 가장 긴 지원 기간
- Virtual Threads (Java 21+에서 안정화)가 I/O 집약 작업 (OCR API, LLM API 호출)에 적합
- Pattern matching, record patterns, sealed classes로 코드 품질 향상
- 명확한 면접 답변: "최신 LTS + I/O 동시성을 위한 Virtual Threads"

**부정적:**

- 오래된 튜토리얼/Stack Overflow 답변이 Java 17 문법 기준 — 적응 필요
- 호스팅 서비스가 Java 25 지원해야 함 (Railway/Fly.io 모두 지원)
