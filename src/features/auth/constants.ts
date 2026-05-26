export const AUTH_REDIRECT_URL = 'ironspot://auth/callback';

// Naver "네이버 아이디로 로그인" deep link. Distinct path from the Supabase
// AUTH_REDIRECT_URL so parseNaverCallback's origin check never overlaps with
// the Supabase parser. This exact value must be registered as the Callback URL
// in the Naver Developers console.
export const NAVER_REDIRECT_URL = 'ironspot://auth/naver';

// Legal policy URLs hosted via GitHub Pages (docs/legal/ → Pages workflow).
// Pinned here for reuse by LoginScreen consent disclosure + any future surface
// (Settings, sign-up flow follow-ups) that needs to deep-link the operator
// to the canonical Korean privacy + ToS pages.
export const PRIVACY_POLICY_URL = 'https://yjwhy.github.io/ironspot/privacy-policy.ko.html';
export const TERMS_OF_SERVICE_URL = 'https://yjwhy.github.io/ironspot/terms-of-service.ko.html';

/**
 * Security task #17 — current PIPA policy bundle version. Bumped only when
 * the legal text in docs/legal/{privacy-policy,terms-of-service}.ko.md
 * changes materially (definitions of "material" intentionally aligned with
 * PIPA Article 22: collection scope, retention period, third-party sharing,
 * marketing use). Sent to /api/users/me/consent so an audit can prove which
 * version each user accepted at signup.
 */
export const CONSENT_VERSION = 'v1';
