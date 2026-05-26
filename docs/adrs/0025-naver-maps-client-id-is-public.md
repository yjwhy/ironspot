# ADR 0025 — Naver Maps `client_id` is a public identifier, not a secret

- **Status:** Accepted (2026-05-26)
- **Decision driver:** Security audit `audit-2026-05-medium-low.md` §K4
- **Related:** ADR 0017 (Harness engineering), `app.json`, `src/shared/lib/env.ts`

## Context

The security audit flagged the Naver Maps `client_id` (`ty0sd0ldl9`, currently hardcoded in `app.json` at the `@mj-studio/react-native-naver-map` plugin block) as a "secret committed to source". The recommended remediation was to move it to an EAS secret + `app.config.ts` so it could rotate per environment.

This contradicts Naver Cloud Platform's documented design for the Mobile Dynamic Map product:

1. The `client_id` for Naver Maps SDK is a **public application identifier**, analogous to a Google Maps API key for an iOS / Android app. Naver's docs use the term "Client ID" but it is _not_ a credential — it identifies the app to Naver's tile servers so they can attribute usage and enforce rate limits.
2. The corresponding **referrer / bundle-id restriction** is what actually gates abuse. The Naver Cloud Console binds each `client_id` to a fixed list of:
   - iOS bundle identifiers (we set `com.ironspot.app`)
   - Android package names (we set `com.ironspot.app`)
   - Web referrer domains (none for this app — mobile only)
3. A request from a bundle ID outside that list — even with the right `client_id` — is rejected at Naver's edge. Stealing `client_id` from the APK and pasting it into a different app yields a 403 from Naver tiles.
4. The `client_id` is unavoidably extractable from any installed app: an attacker can decompile the APK / IPA, inspect runtime memory, or sniff TLS-MITM'd tile requests. Treating it as a secret would offer no meaningful defence because every legitimate user's device already holds it.

This is the same security model as Google Maps Android API keys (where Google explicitly documents "API keys can be safely embedded in app source code"), Mapbox public access tokens, and Stripe publishable keys.

## Decision

**Naver Maps `client_id` stays hardcoded in `app.json`.** It is documented here as a public application identifier — not in the same risk class as the operational secrets we rotated under Security #7 (Supabase service-role key, Groq + Gemini API keys, Sentry DSN, Slack webhook, DB password).

We will **not** move it to:

- An EAS secret + `app.config.ts` indirection (adds build-time complexity for no defence-in-depth gain).
- An environment variable (same indirection, same lack of gain, plus risk that a misconfigured dev build silently boots with a wrong / missing `client_id`).

The audit's K4 finding is **closed as misclassified.**

## What we will keep tight

The bundle-ID restriction in the Naver Cloud Console is the actual defence and must not drift:

- iOS: `com.ironspot.app` (matches `app.json` → `ios.bundleIdentifier`).
- Android: `com.ironspot.app` (matches `app.json` → `android.package`).

If we ever ship under a different bundle id (e.g. a staging build with `.staging` suffix), the Naver Console restriction must be updated **before** the new build runs — otherwise it'll silently 403 every tile request.

A separate Naver Cloud sub-account / `client_id` for staging is a future improvement (tracked in `docs/plans/phase-2/README.md` as part of multi-env rollout) but not a security blocker.

## Consequences

- **Positive:** No build-time indirection complexity; new contributors see the `client_id` in `app.json` and can run `expo start` immediately. The K4 audit item is closed without code churn.
- **Negative:** Future audits that don't read this ADR may re-flag the same item. Mitigation: this ADR is linked from `docs/security/audit-2026-05-medium-low.md` §K4.
- **Neutral:** If Naver Cloud changes their security model (e.g. requires server-side proxy in the future), this decision must be revisited. No timeline.

## References

- Naver Cloud Platform docs: [Mobile Dynamic Map - SDK 사용](https://api.ncloud-docs.com/docs/ai-naver-mapsmobile) (Korean) — section "Client ID 발급 및 사용"
- `app.json` line 38-42 — current `client_id` declaration
- `audit-2026-05-medium-low.md` §K4 — original finding
