export const AUTH_REDIRECT_URL = 'ironspot://auth/callback';

// Naver "네이버 아이디로 로그인" app deep link. Distinct path from the Supabase
// AUTH_REDIRECT_URL so parseNaverCallback's origin check never overlaps with
// the Supabase parser. This is the in-app auth-session callback scheme that
// ASWebAuthenticationSession (iOS) intercepts — NOT the value registered at
// Naver (see NAVER_WEB_CALLBACK_URL).
export const NAVER_REDIRECT_URL = 'ironspot://auth/naver';

// The https Callback URL registered in the Naver Developers console. Naver's
// web login rejects custom URL schemes, so the OAuth redirect_uri must be this
// https bounce page (docs/legal/naver-callback.html on GitHub Pages); it
// immediately re-redirects to NAVER_REDIRECT_URL with the code+state, which the
// in-app auth session then intercepts. Register this EXACT value at Naver.
export const NAVER_WEB_CALLBACK_URL = 'https://yjwhy.github.io/ironspot/naver-callback.html';

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
