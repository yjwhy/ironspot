# ADR 0004: API 서버는 NestJS 대신 Spring Boot 선택

**Status:** Accepted · 2026-04-17 (초기 NestJS 결정 대체)

## Context

Phase 2+ 백엔드 프레임워크 선정. 한국 개발자 채용 시장 타겟 (프론트엔드, 풀스택, 백엔드 포지션 모두 지원 가능하도록).

## Decision

**Spring Boot 3 + Java 25 (LTS).**

## Alternatives

- **NestJS (TypeScript)** — 프론트와 언어 통일 가능. 그러나 한국 백엔드 채용 시장은 80%+ Java/Spring 기반. NestJS는 아직 니치 (토스, 카카오, 네이버, 쿠팡, 라인 모두 Spring 중심).
- **Express** — 구조가 자유로워 아키텍처 역량이 드러나지 않음.
- **Supabase Edge Functions만** — 백엔드 포지션용 서버 설계 증명에 부족.

## Consequences

**긍정적:**

- 한국 백엔드 채용 기회 크게 확대
- 다언어 역량 증명 (프론트 TypeScript + 백엔드 Java)
- Spring의 DI, AOP, Security 패턴은 업계 표준
- 엔터프라이즈 패턴 (Controller/Service/Repository) 프레임워크에 내장

**부정적:**

- 프론트/백엔드 간 언어 컨텍스트 스위칭
- NestJS 대비 보일러플레이트 많음
- 초기 세팅 시간 약 1주 추가

## 참고사항

개발자가 Spring Boot 학습 경험 있음. Kotlin은 경험 없어 일정 리스크 방지 차원에서 Java로 결정.
