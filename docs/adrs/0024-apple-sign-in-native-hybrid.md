---
Status: Accepted
Date: 2026-05-18
Implements: Phase 4 Task 48 (Apple Sign In external wiring); Pre-Launch Backlog "Apple Sign In external wiring" item
---

# 0024 — Apple Sign In native + web OAuth hybrid

## Context

App Store Review Guideline 4.8 이 다른 third-party SSO (Google/Kakao) 를 제공하는 앱에 Apple Sign In 옵션 동등 제공을 강제한다. 본 앱은 iOS 출시를 Phase 4 종료 시점 목표로 잡고 있으므로, 출시 전 Apple Sign In 경로가 functional 해야 한다.

현 상태 (main branch, `src/features/auth/components/LoginScreen.tsx`):

- Google / Kakao / Apple 세 provider 가 모두 `supabase.auth.signInWithOAuth({ provider })` 기반 web flow 로 통합.
- iOS 에서는 `WebBrowser.openAuthSessionAsync` 가 ASWebAuthenticationSession 을 호출 → Safari-system browser 인증 → callback URL 로 복귀.
- 이 방식은 Apple Human Interface Guidelines (HIG) 의 "use the native Sign In with Apple sheet" 권고를 위반한다. Apple Review 가 reject 한 사례가 다수 보고됨.
- 또한 Phase 4 Task 49 (admin-flow Maestro) 가 in-app 인증 sheet 를 필요로 함 — system browser 는 Maestro 가 driveable 하지 않다.

본 ADR 는 native sheet (iOS only) 우선 + 비가용 환경에는 기존 web OAuth fallback 으로 hybrid 패턴을 잠근다. Code-only 로 PR 을 띄우고, 5 개 external 사전조건 (Apple Developer 등록 + Service ID + .p8 + Supabase provider) 은 user 가 별도로 처리한다.

## Decision

**iOS 에서 `AppleAuthentication.isAvailableAsync()` 가 true 일 때 native Sign In with Apple sheet 를 사용, false 면 기존 web OAuth flow 로 fallback. Android 는 Apple 버튼 자체를 렌더하지 않음 (현 동작 유지).**

핵심 구현 결정:

1. **Render gate** — mount 시 `useEffect` 가 `AppleAuthentication.isAvailableAsync()` 호출, state 에 저장. `Platform.OS === 'ios' && appleNativeAvailable === true` 일 때만 native 버튼 렌더. 그 외 iOS 케이스 (시뮬레이터에서 iCloud 미로그인 등) 는 web fallback 버튼. Android 는 둘 다 미렌더.

2. **Nonce 처리** — `expo-crypto.getRandomBytesAsync(16)` 으로 16 byte 랜덤 → hex (32자) raw nonce 생성. SHA-256 hash 를 Apple 에게 전달 (`AppleAuthentication.signInAsync({ nonce: hashedNonce })`). Supabase 에는 raw nonce 를 그대로 전달 (`supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce: rawNonce })`). Supabase 내부에서 sha256 으로 다시 hash 하여 Apple 의 id token 의 nonce claim 과 비교 → replay 방어.

3. **fullName 캡처** — Apple 은 fullName 을 **최초 1회만** credential 에 포함시킨다 (재로그인 시 null). 따라서 첫 응답에 `credential.fullName.givenName` 또는 `familyName` 이 있으면 `supabase.auth.updateUser({ data: { full_name: '${given} ${family}' } })` 로 `user_metadata.full_name` 에 즉시 저장. 다음 로그인에는 metadata 가 이미 존재하므로 updateUser 호출 안 함.

4. **Error handling 통일** — `AppleAuthentication.AppleAuthenticationError.CANCELED` (code `ERR_REQUEST_CANCELED`) 는 user-cancelled 로 간주하여 silent return (toast/Sentry/onAuthenticated 모두 미호출). 그 외 모든 에러는 기존 Google/Kakao 패턴 (`captureError` + `burnt.toast({ title: '로그인에 실패했습니다', preset: 'error' })`) 과 동일.

5. **Privacy Policy / ToS disclaimer** — Login 버튼 아래에 한 줄 disclaimer (`"계속하기로 진행하면 개인정보처리방침과 이용약관에 동의하게 돼요."`). Apple Review 가 SSO 화면에 명시적 동의 안내를 요구한다. URL hosting 은 Pre-Launch Backlog 의 별도 항목 (`docs/plans/phase-4/README.md` Pre-Launch Backlog) 이라 본 Task 는 disclaimer 텍스트만 추가, 링크는 추후 backlog 작업에서 추가.

## Alternatives

**A. Native-only (no fallback)** — `AppleAuthentication.signInAsync` 만 사용, web OAuth 경로 제거. 코드 1-path 로 단순. 그러나 (a) `isAvailableAsync()` false 케이스 (Android 시뮬레이터 with iCloud, iOS 12 이하 등 가능성 적지만 존재) 에서 Apple 로그인 자체가 불가능해진다. (b) 기존 web OAuth flow (다른 provider 와 공유) 와의 코드 통일성 무너짐. 거부.

**B. Web-only (continue with `signInWithOAuth({ provider: 'apple' })`)** — 현 상태 유지. 코드 변경 0. 그러나 (a) Apple Review 가 HIG 위반으로 reject 할 가능성 (실제 reject 사례 다수), (b) Task 49 Maestro 요구를 만족 못 함 (system browser 는 driveable 하지 않다). 거부.

**C. Hybrid (chosen)** — native primary + web fallback. 코드 2-path 지만 fallback path 는 기존 `handleOAuthLogin('apple')` 재사용이라 추가 코드 거의 없음. HIG 준수 + Maestro 가능 + 모든 iOS 디바이스 커버. 채택.

## Consequences

### 긍정

- **Apple Review 통과 가능성 ↑** — HIG 의 native Sign In with Apple 기대 충족.
- **Maestro driveable** — Task 49 admin-flow Maestro 가 in-app sheet 를 호출 가능. system browser dependency 제거.
- **Replay 공격 방어** — nonce sha256 round-trip 으로 Apple/Supabase 양측에서 같은 raw nonce 를 검증.
- **fullName 손실 방지** — Apple 의 first-call-only 동작에 대응하여 user_metadata 에 즉시 저장.
- **iOS only** — Android 사용자에게 Apple 버튼 미노출 → UI noise 회피.

### 부정

- **2 code path** — native + web fallback. 단, fallback 은 기존 `handleOAuthLogin` 재사용이라 실질 분기는 LoginScreen 의 render 부분 한 곳.
- **`isAvailableAsync` 가 시뮬레이터에서 false 가 자주 발생** — 시뮬레이터에 iCloud 미로그인 시 false 반환. 개발 환경에서 native sheet 테스트가 까다로움 → 실 디바이스 테스트 필수. 이는 본 PR 가 Draft 인 이유.
- **Dependency 추가** — `expo-apple-authentication` (Expo SDK 54 호환 버전). config plugin 자동 처리되므로 Xcode entitlement 수동 편집은 불필요.
- **Supabase 의존성** — Supabase Apple provider 가 client_id (=Service ID) / team_id / key_id / private_key (.p8) 4개를 받아 ID token 의 audience claim 을 검증한다. 5개 external 사전조건 중 4개가 이 4개 secret 으로 귀결.

## External prerequisites checklist (user 가 처리)

코드만으로는 native sheet 가 동작하지 않는다. 본 PR 머지 이후 user 가 다음 5단계를 외부에서 수행해야 functional.

- [ ] **Apple Developer Program enrollment** ($99/year, ~24h~48h 승인). developer.apple.com/programs → enroll. EAS 가 provisioning profile 발급 + Sign In with Apple entitlement 적용에 필요.
- [ ] **App ID with Sign In with Apple capability**. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → +. Bundle ID = `com.ironspot.app`. "Sign In with Apple" capability 체크.
- [ ] **Service ID**. 동 콘솔 → Identifiers → + → "Services IDs". Return URL = Supabase callback (`https://<project-ref>.supabase.co/auth/v1/callback`). Supabase Apple provider 의 client_id 가 이 Service ID.
- [ ] **Sign In with Apple Key (.p8) + Key ID + Team ID**. 동 콘솔 → Keys → + → "Sign In with Apple". .p8 다운로드 (1회만 가능 — 안전 보관). Key ID 기록. Team ID 는 Apple Developer 콘솔 우상단.
- [ ] **Supabase Dashboard → Authentication → Providers → Apple**. Toggle on. Service ID (Client IDs 필드), Team ID, Key ID, .p8 내용 (Secret Key 필드) 입력 후 저장.

5단계 완료 후: `eas build --profile preview --platform ios` 로 entitlement 가 포함된 빌드 산출 → 실 iPhone 에 설치 → "Apple로 계속하기" 탭 → native iOS sheet 가 떠야 정상.

### 비용

- Apple Developer Program: $99/year (user 결제).
- Supabase Apple provider: 무료 (Free tier 포함).
- Dependency: `expo-apple-authentication` MIT.

### Phase 4 Task 순서 영향

- Task 48 (본 Task) 가 Task 49 (admin-flow Maestro) 의 사전조건. Task 49 는 native sheet 를 Maestro 로 driveable 하다고 가정.
- Pre-Launch Backlog 의 "Apple Sign In external wiring" 항목을 본 Task 가 흡수 — README 의 Pre-Launch Backlog 에서 Task 48 in-progress 안내로 교체.
- Privacy Policy / ToS hosting 은 별도 Pre-Launch Backlog 항목으로 남음. 본 Task 는 disclaimer 텍스트만 추가.

### 보안

- Nonce sha256 round-trip 으로 Apple ID token replay 방어.
- .p8 secret 은 Supabase 가 보관, 앱에는 노출 안 됨.
- Apple credential 의 fullName 은 1회만 응답되므로 즉시 user_metadata 저장 → 추후 응답 누락에 대비.
- 시뮬레이터 fallback (web) 에서도 PKCE flow 가 유지되어 token interception 위험 동일하게 작음.
