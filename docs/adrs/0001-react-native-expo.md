# ADR 0001: 모바일 앱은 React Native (Expo)로 개발

**Status:** Accepted · 2026-04-09

## Context

한국 시장 타겟의 크로스 플랫폼 모바일 앱 (iOS + Android) 개발이 필요함. 1인 개발, 2개월 이상 일정.

## Decision

**React Native + Expo (Development Builds).**

## Alternatives

- **Bare React Native** — Development Builds 도입 이후 Expo의 네이티브 모듈 제약이 거의 사라짐. Expo의 OTA 업데이트와 EAS Build 파이프라인이 실무에서 더 유리.
- **Flutter** — Dart 학습 필요. 기존 React 생태계 지식 활용 불가. 한국 시장에서 React Native 대비 수요가 적음.
- **네이티브 (Swift + Kotlin)** — 1인 개발에서 두 플랫폼 따로 작성하면 시간 2배. 이 앱에선 네이티브 퍼포먼스가 병목이 되는 수준이 아님.

## Consequences

**긍정적:**

- iOS + Android 단일 코드베이스
- Expo SDK에 카메라, 위치, 이미지 피커 등 필요 모듈 포함
- EAS Build로 Xcode/Android Studio 로컬 세팅 불필요
- React 지식 재사용

**부정적:**

- 일부 저수준 네이티브 API (Bluetooth, 커스텀 카메라 파이프라인)는 제약
- 네이티브 모듈 호환성 검증 필요 (예: 네이버 지도 SDK)
