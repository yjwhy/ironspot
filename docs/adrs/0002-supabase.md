# ADR 0002: Supabase를 BaaS로 사용

**Status:** Accepted · 2026-04-09

## Context

DB, Auth, 이미지 스토리지를 위한 백엔드 필요. 1인 개발자. 위치 기반 쿼리를 위한 PostGIS 지원과 실서비스 확장 가능성 필수.

## Decision

**Supabase** (PostgreSQL + PostGIS + Auth + Storage).

## Alternatives

- **Firebase** — NoSQL (Firestore) 기반. 관계형 데이터 (Users → Gyms → Machines → Photos)에 부적합. PostGIS 대체 기능 없음.
- **자체 호스팅 PostgreSQL + 커스텀 Auth** — 1인 개발자에게 인프라 부담 과중. MVP 지연.
- **AWS Amplify** — 설정 복잡. 학습 곡선 가파름. 이 규모에 오버엔지니어링.

## Consequences

**긍정적:**

- PostgreSQL 관계형 모델이 우리 스키마에 완벽하게 맞음
- PostGIS 네이티브 지원 → 공간 쿼리(`ST_DWithin`) 핵심 기능
- Auth (소셜 SSO), Storage, DB 통합
- 무료 티어로 MVP 가능 ($0)
- Pro 티어 ($25/월)로 약 10k MAU 까지 대응 가능
- DB 레이어 vendor lock-in 없음 — SQL/PostGIS는 어느 Postgres 호스팅으로도 이전 가능

**부정적:**

- Storage 대역폭/용량 한계로 추후 CDN 전환 필요 (Cloudflare R2)
- 무료 티어는 공유 인프라
