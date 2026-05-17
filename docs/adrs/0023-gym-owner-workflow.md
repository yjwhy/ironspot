---
Status: Accepted
Date: 2026-05-17
Implements: Phase 4 README scope item 13 (Gym owner workflow); Phase 2 carry-over gap #4 (users.role CHECK divergence)
---

# 0023 — Gym owner workflow (사업자등록증 OCR 인증 + 모더레이션 분산 + trust signal)

## Context

Phase 3 이 admin 단일 모더레이션 큐 (Task 33-34) + 신고 시스템 (Task 46 까지 photo + gym_machine 확장) 을 구축했지만, 출시 후 모더레이션 부담이 admin 한 명 (현재 사용자 본인) 에게 집중되는 구조. Phase 4 README scope item 13 이 명시한 두 가지 가치를 제공해야 함:

1. **Moderation load 분산** — owner 가 자기 gym 신고를 first-look 처리하여 admin 큐 가벼움 유지.
2. **Trust signal 추가** — owner-verified 사진/매장이 일반 사용자 컨텐츠보다 신뢰도 ↑ 표시.

Phase 2 Task 30 (PR #45) 이 `users.role = 'owner'` enum value 를 프로덕션 CHECK constraint 에 사전 추가했으나 ( `('admin','user','owner')` ), 워크플로우는 디자인하지 않은 채 보류된 상태 (Phase 2 carry-over gap #4). `init-test-db.sql` 은 `('user', 'admin')` 만 허용하여 schema drift 존재.

본 ADR 는 Phase 4 Task 47 에서 6 design branch (Q1-Q6) 를 grill 라운드로 잠그고 정식 워크플로우를 구축한다. Pre-launch 시점이라 abuse 데이터 부재 + owner 모집단 작음 (0~50 명) 가정.

## Decision

**사업자등록증 사진 OCR + 국세청 진위확인 API 자동 검증으로 owner role 즉시 grant, `gym_owners` 조인 테이블 기반 N:N cardinality, P3 권한 범위 (사진 verify + 머신 인벤토리 CRUD + 자기 gym 신고 first-look), 별도 `/api/owner/**`+`app/owner/` 트리.\*\*

핵심 결정 6개 (Q1-Q6):

1. **Q1 Owner 인증 경로 = U (사업자등록증 OCR + 국세청 진위확인 자동 검증)** — Owner 가 사업자등록증 사진 업로드 → Vision API OCR 로 사업자번호 + 상호 + 대표자 추출 → 국세청 공공데이터포털 진위확인 API 호출 → 추출 상호 ≈ Naver Place gym 이름 매칭 → 즉시 `gym_owners` row + `users.role = 'owner'`. OCR 매칭 실패 (~5% 추정) 만 admin 큐 fallback. 사진은 `OcrService.analyzeImage(byte[])` 인메모리 처리 (Task 42 OcrService 패턴 재사용) → 디스크에 한 번도 닿지 않음 → 자동 폐기. 사업자번호는 SHA-256 hash 만 저장 (원본 평문 X). 비용 거의 0원/년 (국세청 API 무료, Vision API Task 42 free tier 공유).

2. **Q2 Cardinality + 스키마 = B (`gym_owners` 조인 테이블, 공동 owner 자동 허용, soft delete)** — 1:1 / N:1 (체인) / 1:N (공동 owner) 모두 지원. 같은 사업자번호 hash 로 같은 gym 에 인증 시도 시 공동 owner 자동 허용 (법적 동일 사업체 = 자연 신뢰). 다른 사업자번호로 같은 gym 인증 시도 → admin escalation 분쟁. `revoked_at TIMESTAMPTZ` soft delete 컬럼으로 audit trail 보존. `init-test-db.sql` CHECK 제약 `('user', 'admin')` → `('user', 'admin', 'owner')` 정렬 (Phase 2 carry-over gap #4 closeout).

3. **Q3 권한 범위 = P3 (사진 verify + 머신 인벤토리 CRUD + 자기 gym 신고 first-look)** — owner 의 verification 강함 (U) 위에서 P3 도입. 자기 gym 한정. 다른 gym 에 대한 권한 0. P3 의 self-interest risk (자기 gym 신고 self-dismiss 등) 는 Q4 audit log + Q5 W1 의 audit Slack 알림으로 사후 detect. owner 의 P3 도입이 README scope item 13 의 "moderation 분산" 가치 제공의 본질.

4. **Q4 모더레이션 큐 재설계** — 5개 sub-decision:
   - **A2 별도 endpoint** `/api/owner/queue` vs `/api/admin/queue` — Spring Security `@PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")` + service-layer `gym_owners` 매칭 검증.
   - **B3 Sequential 24h 타임아웃 + 긴급 fast-track** — 일반 신고는 owner queue first → 24h 후 admin escalation. SafeSearch suspect / auto-blind 등 긴급은 owner 큐 우회 즉시 admin (Task 34 `AdminNotificationService.notifyUrgent` 패턴 재사용). cron job 1개 추가 + `reports.owner_timeout_at TIMESTAMPTZ` 컬럼.
   - **C2 + C3 DB audit_log + Slack 알림** — `moderation_audit_log` 테이블 (id, user_id, action, target_type, target_id, metadata JSONB, created_at) + 기존 `AdminNotificationService` 로 owner action 실시간 Slack 알림. 사후 분석 + 실시간 인지 둘 다.
   - **D2 Reporter 수동 이의제기** — `MyReportsScreen` 신규 → reporter 가 자기 신고 결과 (actioned/dismissed) 확인 → dismiss 된 항목에 "admin 이의제기" 버튼 → `POST /api/reports/{id}/escalate`. Push 알림 미구현 ( Phase 5 backlog) 이라 manual escalation 으로 보완.
   - **E3 머신 즉시 반영 + soft delete** — owner 머신 CRUD 는 즉시 commit. `gym_machines.deleted_at TIMESTAMPTZ` soft delete 컬럼으로 admin 복구 가능.

5. **Q5 Trust signal propagation** — T1+T2+T3+W1+경고+가시화:
   - **T1 Photo manual verify 뱃지** — owner 가 명시적 verify 한 photo 에 뱃지. `machine_photos.verified_by_owner_at TIMESTAMPTZ`.
   - **T2 Auto-verified on upload** — uploader 가 그 gym 의 owner 면 업로드 시점 `verified_by_owner_at = NOW()`.
   - **T3 Gym 카드 owner-claimed 뱃지** — `gym_owners` 조회로 즉시 계산 (별도 컬럼 X). GymCard 컴포넌트에 small `BadgeCheck` + "owner" 뱃지 (gym 이름 우측).
   - **W1 자기 gym 신고 auto-action** — owner 가 자기 gym 의 photo/gym_machine 신고 시 `status='actioned'` 즉시. admin/owner 큐 거치지 않음. 다른 gym 신고는 일반 사용자 동일 처리.
   - **신고 시 owner-verified 경고** — ReportReasonSheet 상단 amber inline banner ("이 사진은 매장 owner 가 검증했어요"). 신고 비활성화 X.
   - **검색 가시화** — GymCard 의 owner 뱃지 (T3 와 동일 컴포넌트).

6. **Q6 UI 배치** — U1 + E1+E3+E4+E5 + R3:
   - **U1 별도 `app/owner/` 트리** — `_layout.tsx` (OwnerGuard) + `index.tsx` (gym 선택, N:1 체인 대응) + `queue.tsx` + `machines/[id].tsx` + `machines/new.tsx` + `photos.tsx`. AdminGuard 패턴 미러.
   - **E1 Profile 메뉴 "내 매장 관리"** — `ProfileScreen` 에 메뉴 항목 (owner role 한정).
   - **E3 Gym detail "owner 도구" 버튼** — contextual 진입.
   - **E4 Profile 위젯** (신규) — `ProfileScreen` 상단에 "내 매장 — 처리 대기 신고 N건" 카드. Push 알림 미구현 fallback 의 핵심 — owner 가 매일 활동 인지하는 channel.
   - **E5 Bottom tab dot badge** (신규) — Profile 탭 아이콘에 빨간 점 (count X) — 미처리 신고 존재 신호. 일반 사용자 UI 영향 X.
   - **R3 등록 진입점 두 곳** — Gym detail "내 매장이에요" (primary, contextual) + Profile 메뉴 "내 매장 등록" (secondary, always-accessible).

추가 UX 결정:

- 사업자등록증 업로드 = 카메라 + 갤러리 둘 다 (사용자 명시 — 평소 등록증 사진 갤러리 보관 케이스 지원).
- PIPA 동의 체크박스 = 사진 업로드 _전_ (한국 PIPA 컴플라이언스, 수집 시점 동의).
- Loading state = Skeleton + "검증 중... 10초 정도 걸려요" 텍스트 + 30초 타임아웃 → 재시도 버튼.
- 머신 삭제 confirmation = Action Sheet (한국 친숙 패턴) + soft delete 메시지 ("30일 이내엔 admin 이 복구할 수 있어요").

## Alternatives

**A. B (Admin grant only)** — admin 이 SQL 또는 UI 로 직접 owner 부여. funnel 0, 사용자 자기 신청 UI 없음 → ROI 마이너스. Pre-launch 라도 partner gym 신청 funnel 필요 → 거부.

**B. E (Naver Place self-claim + 분쟁 escalation)** — "내 매장 등록" → Naver Place 검색 → gym 선택 → 즉시 grant. friction 최소지만 first-come wins 모델로 가짜가 먼저 claim 가능. 사용자가 "랜덤한 사람이 와서 먼저 클레임할 우려" 명시적 거부 → 채택 불가.

**C. F (Phone OTP `gyms.phone` 활용)** — 매장 등록번호 SMS OTP 인증. friction 매우 낮고 검증 강함. 그러나 SMS 비용 발생 (NHN Toast ~1만원/년) + KISA 발신번호 사전등록 부담. 사용자가 "비용 발생 회피" 명시적 요청 → 거부.

**D. H (매장 사진 + admin 1-step 승인)** — 매장 내부 사진 + 손글씨 인증코드 → admin 1초 확인. 비용 0 이지만 즉시성 잃음 (admin 대기). 사용자 요구한 즉시성과 충돌 → 거부.

**E. Q (Self-claim + 30일 dispute window + 권한 좁게)** — 즉시 grant + 30일 dispute window. 비용 0, 즉시성 유지, 권한 좁게 잡으면 first-claimer abuse 피해 작음. 그러나 검증력 약함 + 30일 window 동안 abuse 가능 → U 보다 열등. 거부.

**F. Q2 단일 컬럼 `gyms.owner_id`** — 마이그레이션 1줄. 1:1 + N:1 (체인) 자연 지원하지만 1:N (공동 owner) 미지원. 출시 후 1~2년 내 공동 owner 케이스 출현 시 schema migration + 코드 변경 큼 → 처음부터 join 테이블이 옳음.

**G. Q3 P1 (사진 승인만)** — 자기 gym photo verify 만. 안전하지만 owner 가치 제안 약함 → 신청 동기 작음 → moderation 분산 효과 미미.

**H. Q3 P2 (P1 + 머신 인벤토리)** — 사진 verify + 머신 CRUD. 가치 제안 강하지만 README scope item 13 의 "moderation 분산" 핵심 가치 (신고 first-look) 빠짐. owner 가 자기 gym 신고를 admin 거쳐 처리해야 → 분산 효과 부재.

**I. Q4 B1 (Dual queue, owner + admin 동시)** — 분산 효과 약함. admin 부담 거의 안 줄어듦. README 의도 위배.

**J. Q4 B2 (Sequential without 긴급 fast-track)** — 일반 신고는 owner first 24h. 그러나 SafeSearch suspect / auto-blind 등 긴급 케이스도 owner 거치면 대응 늦음. B3 의 긴급 fast-track 이 필수.

**K. Q4 E2 (Admin pre-approval for 머신 변경)** — owner 의 머신 CRUD 가 admin 큐 거침. 분산 효과 정면 무력화 + owner 가치 제안 약화.

**L. Q5 W2 (Threshold 낮은 weighting)** — owner 신고도 admin 거치되 일반 사용자 3번 vs owner 1번 등 threshold 낮춤. Phase 3 reporter trust scoring 미구현이라 threshold 자체가 없음 → W1 (자기 gym 신고 auto-action) 이 더 직설적.

**M. Q6 U2 (admin 트리에 role gate 확장)** — `app/admin/*` 에 owner 도 허용. 코드 boundary 흐려짐 + "admin" 이름이 owner 에게 어색. AdminGuard 와 OwnerGuard 분리가 review-time 발견성 ↑.

**N. Q6 E2 (별도 Bottom Tab)** — owner 전용 탭 추가. 일반 사용자 UI 변경 거부감 + 출시 시점 owner 비율 작아 ROI 부족. E4 Profile 위젯 + E5 dot badge 가 같은 awareness 제공.

## Consequences

### 데이터 모델

신규 테이블 + 컬럼:

```sql
-- users.role CHECK 정렬 (Phase 2 carry-over gap #4 closeout)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'owner'));

-- gym_owners 조인 테이블
CREATE TABLE gym_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_number_hash TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gym_id, user_id)
);
CREATE INDEX idx_gym_owners_user_active ON gym_owners(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_gym_owners_gym_active ON gym_owners(gym_id) WHERE revoked_at IS NULL;

-- 모더레이션 audit log
CREATE TABLE moderation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_user_action ON moderation_audit_log(user_id, action, created_at DESC);

-- reports.owner_timeout_at 추가 (Q4 B3)
ALTER TABLE reports ADD COLUMN owner_timeout_at TIMESTAMPTZ;

-- machine_photos.verified_by_owner_at 추가 (Q5 T1/T2)
ALTER TABLE machine_photos ADD COLUMN verified_by_owner_at TIMESTAMPTZ;

-- gym_machines.deleted_at 추가 (Q4 E3)
ALTER TABLE gym_machines ADD COLUMN deleted_at TIMESTAMPTZ;
```

프로덕션 마이그레이션 + `init-test-db.sql` 동기. JOOQ regen 1회.

### 백엔드

- **신규 패키지** `com.ironspot.owner` — `OwnerController`, `OwnerService`, `GymOwnerRepository`, `BusinessRegistrationVerifier` (사업자등록증 OCR + 국세청 API), `OwnerClaimController`.
- **신규 endpoint**:
  - `POST /api/owner/claim` (사업자등록증 사진 multipart + 동의 flag → 즉시 grant 또는 admin queue fallback)
  - `GET /api/owner/queue` (자기 gym 신고 + verify 대기 photo)
  - `POST /api/owner/reports/{id}/disposition` (owner first-look 처리)
  - `POST /api/owner/photos/{id}/verify` (수동 verify 마킹)
  - `POST /api/gym-machines` / `PUT /api/gym-machines/{id}` / `DELETE /api/gym-machines/{id}` (owner 권한 추가)
  - `POST /api/reports/{id}/escalate` (reporter 수동 이의제기, Q4 D2)
- **기존 service 확장**:
  - `OcrService.analyzeBusinessRegistration(byte[])` 신규 메서드 (TEXT_DETECTION + DOCUMENT_TEXT_DETECTION feature)
  - `ReportService` 분기: reporter 가 target gym 의 active owner → `status='actioned'` 즉시 (Q5 W1)
  - `AdminNotificationService.notifyOwnerAction` 신규 (Q4 C3 Slack 알림)
- **국세청 진위확인 API client** 신규 — `BusinessRegistryClient` (WebClient, 공공데이터포털 키 환경변수 `NTS_BUSINESS_API_KEY`).
- **`@PreAuthorize` 패턴**:
  - `@PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")` + service-layer `gym_owners(gym_id, user_id, revoked_at IS NULL)` 매칭 검증
- **Cron job** (Spring Scheduler) — `OwnerTimeoutEscalationJob` (`@Scheduled(fixedDelayString = "PT5M")`) — `owner_timeout_at < NOW() AND status='pending'` 신고를 admin queue 로 노출.
- **테스트** — `OwnerClaimIT` (OCR 매칭 / 진위확인 fail / 공동 owner / 분쟁), `OwnerQueueIT`, `OwnerTimeoutEscalationJobTest`, `ReportServiceOwnerAutoActionTest`. 예상 +18 IT.

### 프론트엔드

- **신규 디렉토리** `src/features/owner/`:
  - `components/OwnerGuard.tsx` (AdminGuard 패턴)
  - `components/OwnerClaimScreen.tsx` (Naver Place 검색 + 사업자등록증 사진 + 동의 + 결과)
  - `components/OwnerQueueScreen.tsx`
  - `components/OwnerMachinesScreen.tsx`
  - `components/OwnerPhotosScreen.tsx`
  - `hooks/useOwnerStatus.ts`, `hooks/useOwnerClaim.ts`, `hooks/useOwnerQueue.ts`, `hooks/useOwnedGyms.ts`
- **신규 라우트** `app/owner/_layout.tsx` + `app/owner/index.tsx` + `app/owner/claim.tsx` + `app/owner/queue.tsx` + `app/owner/machines/[gym].tsx` + `app/owner/machines/[gym]/[id].tsx` + `app/owner/machines/[gym]/new.tsx` + `app/owner/photos/[gym].tsx`.
- **신규 화면** `app/my-reports.tsx` (Q4 D2 reporter 이의제기 진입점).
- **확장**:
  - `ProfileScreen` — owner 위젯 (E4) + 메뉴 항목 "내 매장 관리" / "내 매장 등록" (E1, R1).
  - `(tabs)/_layout.tsx` — Profile 탭 아이콘 dot badge (E5, `useOwnerStatus` 조회).
  - `GymDetailScreen` (또는 GymBottomSheet 카드) — "owner 도구" / "내 매장이에요" 버튼 (E3, R2).
  - `GymCard` — owner-claimed 뱃지 (`BadgeCheck` 아이콘 + "owner" 라벨, success color).
  - `ReportReasonSheet` — owner-verified 사진 신고 시 amber inline banner.
- **신규 codegen** — `openapi.json` regen + Orval client regen (신규 endpoint + DTO).
- **테스트** — `OwnerGuardTest`, `OwnerClaimScreenTest`, `OwnerQueueScreenTest`, `OwnerMachinesScreenTest`, `useOwnerStatusTest`, `MyReportsScreenTest`. 예상 +35 Jest.

### Maestro

- `.maestro/flows/owner-claim-flow.yaml` 신규 — owner 등록 흐름 (사업자등록증 fixture 사진 + 동의 + Mock OCR 결과).
- `.maestro/flows/owner-moderation-flow.yaml` 신규 — owner queue 처리 흐름.
- `docs/harness/e2e-strategy.md` Task 47 행 추가.

### Cost

- LLM: 0 (no NL calls)
- Vision API: 추정 +100 units/월 (owner 인증 50건 × 2 features), Task 42 free tier 1000 units/월 공유 — 초과분 ~200원/월 max.
- 국세청 진위확인 API: 0원 (공공데이터포털 무료).
- SMS: 0원 (F 거부).
- 사진 storage: 0원 (인메모리 처리, 디스크 X).

### Phase 4 Task 순서 영향

- Task 47 의 사용자 가시 동의 문구 + Privacy Policy 갱신 → Pre-Launch Backlog 의 Privacy Policy + ToS 작성에 1줄 추가.
- Task 48 (Apple Sign In) + Task 49 (admin-flow Maestro) 는 본 Task 와 독립 (의존 X).

### 보안

- 사업자등록증 사진 인메모리 처리 (디스크 저장 X) — Task 42 OcrService 패턴 재사용.
- 사업자번호는 SHA-256 hash 만 저장 — 원본 평문 X.
- PIPA 동의 = 수집 시점 명시 체크박스 + Privacy Policy 페이지 링크.
- owner 권한 BE 검증 = 모든 `/api/owner/**` 에서 `@PreAuthorize` + service-layer `gym_owners` 매칭 (filter chain 한 곳에서 안 됨 — gym_id 별 검증 필요).
- owner action 전수 `moderation_audit_log` + Slack 실시간 알림 → abuse 사후 detect.
