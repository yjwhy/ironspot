# App Store Pre-Submission Checklist

Self-audit against [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) mapped to current IronSpot state. Captures what is already done, what is in flight, and what is gated behind external action so that nothing falls through the gap between Phase 4 close and submission day.

Scope is iOS App Store only. Android Play Store is post-launch (see `docs/plans/phase-5/README.md`).

## Status legend

- [x] Done and verified
- [~] In flight (code complete or partial, blocked on an external dependency)
- [ ] Not started

## 0. Account and identifiers (gating)

The Apple Developer Program enrolment is deliberately deferred until everything else is submission-ready. See memory `project_apple_developer_deferral`. Tracking the items here for visibility only, none of them block the rest of the checklist.

- [ ] Apple Developer Program enrolment (USD 99 / year) for individual account under the user's personal email `yyou017@gmail.com`
- [ ] App ID created in Apple Developer portal (Bundle ID `com.ironspot.app`, already pinned in `app.json` `ios.bundleIdentifier`)
- [ ] Service ID for Sign in with Apple (gates Task 48)
- [ ] APNs key / certificate (not needed until Phase 5 push notifications work begins)
- [ ] App Store Connect app record created
- [ ] EAS Submit profile linked to the Apple ID (gates `EAS preview-simulator build` operational item)

## 1. Guideline 1: Safety

- [x] **1.1 Objectionable content**: face PII rejected at photo upload via Vision `FACE_DETECTION` (Task 42, `PhotoService.upload` short-circuits with 400 + Korean message before storage write). Threshold B3 (confidence 0.7 + 1 percent area).
- [x] **1.2 User-generated content moderation**: in-app reporting with admin disposition queue covers photo and `gym_machine` targets (Tasks 33, 34, 46). Auto-blind on `actioned_count >= 3` plus auto-ban on `dismissed_count >= 5` (Task 34). Per-target disposition cascade with re-template or delete (Task 46).
- [x] **1.2 Method to report objectionable content**: `ReportReasonSheet` from photo detail and machine list entry points.
- [x] **1.2 Method to block abusive users**: covered by reporter side via `reports_unique_reporter_target` constraint plus admin ban path. No user-facing block button (single-target moderation model, acceptable for Health and Fitness category at launch).
- [x] **1.2 Account deletion in-app** (Guideline 5.1.1(v) as well): `DELETE /api/users/me` ships (`UserController.deleteMe` → `UserService.deleteAccount` does anonymise photos plus delete votes plus soft delete `users.deleted_at`). `AccountSettingsScreen.tsx` exposes the 계정 삭제 entry point reached from Profile → 계정 설정, with destructive Alert confirmation plus post-delete `supabase.auth.signOut()` plus `router.replace(AUTH_ROUTES.login)`. Prod schema `users.deleted_at` column verified present via Task 40 live trace (see `docs/plans/phase-3/PROGRESS.md` carry-over note).
- [x] **1.5 Developer information**: support email `yyou017@gmail.com` (personal) ready for App Store Connect.

## 2. Guideline 2: Performance

- [x] **2.1 App Completeness**: no placeholder screens. Test data in prod (5 visible photos) gets manually deleted before submission per Task 42 grill decision O4.
- [x] **2.3 Accurate Metadata**: app description should reflect (a) Korean-only at launch, (b) gym discovery with machine search, (c) Naver Maps based, (d) user-contributed photo verification. Draft when filling App Store Connect.
- [x] **2.5.1 Software Requirements**: Expo SDK 54 dev build, all native modules public (Naver Map SDK, expo-camera, expo-speech-recognition, expo-apple-authentication). No private APIs.
- [x] **2.5.6 Public APIs only**: confirmed via `app.json` plugin list.
- [~] **2.5.10 Provide accurate information about your app**: review notes for the reviewer need a Seoul demo location (suggest 강남역 `37.4979, 127.0276`) plus an access plan. Full procedure now documented in Section 11 below (Guest mode for read-only browse + Apple Sign In with reviewer's own Apple ID for interactive features + optional admin demo account). At submission day, paste the Section 11 boilerplate into App Store Connect review notes verbatim.

## 3. Guideline 3: Business

- [x] **3.1 Payments**: no IAP, no subscriptions, no external payment links. Free app.
- [x] **3.2 Other Business Model Issues**: no advertising, no third-party SDK monetisation. NL Search quota of 100 per user per month is a cost ceiling (Groq free tier), not a paywall.

## 4. Guideline 4: Design

- [x] **4.0 Design**: custom UI throughout (no component libraries per CLAUDE.md). Bottom sheet, segmented control, filter chips all hand-rolled.
- [x] **4.1 Copycats**: no clone of an existing app.
- [x] **4.2 Minimum Functionality**: search plus filter plus photo plus report plus admin plus owner flows. Easily clears the "more than a website" bar.
- [x] **4.5.4 Push Notifications**: no push at launch. Phase 5 introduces APNs cert plus expo-server-sdk wiring.
- [~] **4.8 Sign in with Apple**: code shipped (Task 48 Draft PR #94, `expo-apple-authentication` plus web fallback). Blocked on the five external prerequisites listed in PROGRESS Status. Gate to flip closer to submission.

## 5. Guideline 5: Legal

- [x] **5.1.1 Privacy Policy**: hosted at `https://yjwhy.github.io/ironspot/privacy-policy.ko.html` and `/privacy-policy.en.html` via GitHub Pages workflow `.github/workflows/deploy-legal-pages.yml`. Wire URL into App Store Connect at submission time.
- [x] **5.1.1 Permission strings (purpose strings)**: all in `app.json` plugins. Location, camera, photo library, microphone (via expo-camera), speech recognition. Korean copy.
- [x] **5.1.1 Data Collection**: drafted in privacy policy. App Privacy questionnaire categories to declare:
  - Contact Info: email (auth)
  - User Content: photos (uploaded), text (NL search queries, reports)
  - Identifiers: user ID
  - Diagnostics: Sentry crash and performance (anonymised IDs)
  - Location: coarse and precise (search proximity)
- [x] **5.1.1(v) Account deletion in-app**: resolved under Section 1 above.
- [x] **5.1.2 Data Use and Sharing**: no third-party data sharing beyond Sentry (diagnostics), Supabase (storage and auth), Naver Maps (location for tile rendering), Groq plus Gemini (NL search query text only, no PII). Itemised in privacy policy.
- [ ] **5.1.5 Location Services**: confirm Info.plist `NSLocationWhenInUseUsageDescription` matches user-facing copy after EAS prebuild. App.json string in place but worth visual check post-build.
- [x] **5.2.3 Sweepstakes, Contests**: N/A.
- [x] **5.3 Gaming, Gambling**: N/A.
- [~] **5.4 VPN apps**: N/A.
- [x] **5.6 Developer Code of Conduct**: ToS hosted alongside privacy policy in both Korean and English.

## 6. Korean PIPA compliance

PIPA (개인정보보호법) overlaps with Guideline 5 but adds Korea-specific items.

- [x] Privacy Policy in Korean covers required PIPA disclosures (collection items, purpose, retention period, third-party recipients including overseas transfer for Supabase US plus Groq US plus Vision API).
- [x] Face PII rejection at upload (Task 42).
- [ ] Overseas transfer consent UI: privacy policy discloses but user-facing consent toggle is not present. PIPA Article 28-8 allows policy-only disclosure for "necessary to perform contract" path; document the legal basis in submission notes.
- [x] ToS in Korean covers IronSpot's reporting and ban flow (community-conduct article).

## 7. Operational readiness (backend uptime, observability)

- [x] **UptimeRobot keep-warm**: HTTP monitor on `/actuator/health` at 5-minute interval (live). Backup GH Actions cron at `.github/workflows/keep-warm.yml`. Render free instance never sleeps during user traffic windows.
- [x] **Sentry error reporting**: backend plus frontend wired. Slack routing `#ironspot-errors` (Task 43, `environment=production` plus new-issue-or-regression filter).
- [x] **Slack deploy notify**: `#ironspot-deploy` on every push to `main` via `.github/workflows/deploy-notify.yml`.
- [x] **Groq plus Gemini API keys**: prod Render env populated (fixed during Task 40 live verification).
- [x] **Supabase JWKS URL**: prod env corrected to ECC P-256 JWKS endpoint (Task 40 fix).
- [ ] **Sentry events token re-scoped**: current `SENTRY_AUTH_TOKEN` has `project:releases` only (sourcemap upload). Re-scope or add a read-only token with `event:read` if Phase 5 wants automated event verification (Task 40 follow-up note).

## 8. Build and submission pipeline

- [ ] **EAS production iOS build**: gated on Apple Developer enrolment. `eas.json` profile pre-defined; first build will surface any Expo native module signing issues.
- [ ] **EAS preview-simulator build**: separately gated. Once enrolment lands, this becomes the canonical preview-build path for Maestro flows that touch native sheets.
- [ ] **Transporter upload or EAS Submit**: pick one. EAS Submit is the lower friction path given the EAS project already exists (`projectId: 88649f92-d4e0-4318-8196-a5baaf75bc11`).
- [ ] **TestFlight internal test**: at minimum the user's personal Apple ID device. External testers optional.

## 9. App Store Connect content

- [ ] App name: `IronSpot`
- [ ] Subtitle (30 chars max): TBD, draft at submission
- [ ] Description (4000 chars): KR primary, EN secondary
- [ ] Promotional text (170 chars, editable post-launch)
- [ ] Keywords (100 chars, comma-separated): gym, fitness, equipment, machine, 헬스장, 머신, 운동기구
- [ ] Categories: Primary `Health & Fitness`, Secondary `Lifestyle`
- [ ] Age rating: questionnaire (user-generated content present, expect 12+)
- [ ] Content rights declaration
- [ ] Copyright: `(C) 2026 IronSpot`
- [ ] Support URL: `https://yjwhy.github.io/ironspot/`
- [ ] Marketing URL: same as support URL or skip
- [ ] App Review contact info: `yyou017@gmail.com`
- [ ] App Review demo credentials: see Section 11 procedure. At submission day, paste either (a) "Guest mode + Apple Sign In with your own Apple ID" instructions or (b) the optional admin demo Google account creds (created same day per Section 11.3 steps).
- [ ] App Review notes: paste Section 11 boilerplate (photo-based gym equipment search, Korean-only at launch, demo coordinates 강남역, access procedure, sample queries).
- [ ] Screenshots iPhone 6.7 inch (required, 3 to 10): map screen, gym detail, filter sheet, NL search result, photo upload flow
- [ ] Screenshots iPhone 6.5 inch (required if 6.7 not auto-generated)
- [ ] Screenshots iPhone 5.5 inch (optional in 2026, App Store Connect may relax this)
- [ ] iPad screenshots: not required, `ios.supportsTablet=false` in `app.json`
- [ ] App preview videos: optional, skip for v1
- [ ] App Icon 1024x1024 PNG (no alpha): currently `assets/icon.png`, verify dimensions at submission

## 10. Pre-submission smoke checklist

Run these the day before tapping Submit for Review.

- [ ] Fresh install on a real device, complete onboarding plus location grant plus camera grant plus speech grant.
- [ ] Map search returns gyms in Seoul.
- [ ] Filter sheet works in all three dimensions (운동 부위, 브랜드, 머신 with OR plus AND toggle).
- [ ] NL search burns one of 100 monthly quota and returns a result.
- [ ] Voice search via mic produces text (manual since Maestro cannot drive system mic).
- [ ] Upload a non-face gym photo, confirm storage success.
- [ ] Upload a face-containing photo, confirm 400 with Korean rejection copy.
- [ ] Report a photo, observe disposition in admin queue (admin role test account).
- [ ] Sign out, sign back in via Apple, observe session restoration.
- [ ] Account deletion (once shipped) actually removes `users` row plus cascades.
- [ ] Network offline: app degrades gracefully (cached map tiles or clear error).
- [ ] Crash-free across the smoke session (Sentry remains quiet).

## 11. App Review reviewer access procedure

IronSpot is OAuth-only (no email/password) plus has a Guest mode for read-only browsing. This section locks how Apple's reviewer should access each surface, so submission day reduces to copy-paste into App Store Connect notes.

### 11.1 Login paths inventory

`src/features/auth/components/LoginScreen.tsx` exposes:

- **Google OAuth** (always shown)
- **Kakao OAuth** (always shown, Korean market default)
- **Apple OAuth** (iOS only, via Supabase Web OAuth pattern in main; Task 48 Draft PR #94 upgrades this to native `expo-apple-authentication`)
- **Guest mode** ("로그인 없이 둘러보기") — bypasses auth, app proceeds with no `users` row

### 11.2 Recommended reviewer access (no admin demo)

The minimal-risk path. Use this as the default.

1. **Read-only review** (map, search, filter, photo browse, NL search interpretation): tap `로그인 없이 둘러보기` on the Login screen. No credentials needed.
2. **Interactive features** (photo upload, report submission, profile, my photos, my reports, my votes): tap `Apple로 계속하기` and complete Sign in with Apple using the reviewer's own Apple ID. The app creates a `users` row automatically on first sign-in.
3. **Admin-gated surfaces** (admin queue, gym_machine dispositions, photo restore/ban): skipped. Apple typically does not review admin-only flows for non-admin app types; these are operator tools, not user features. Document this in review notes so the reviewer knows not to look for them.

### 11.3 Optional admin demo procedure (only if reviewing moderation features)

Use this if Section 11.2 risks the reviewer flagging "moderation features not testable". Adds ~30 minutes of setup at submission day.

1. Create a Gmail account, e.g. `ironspot.review.<random4>@gmail.com`. Use a strong random password. Disable 2FA so the reviewer can sign in unaided.
2. Launch IronSpot on the simulator or a TestFlight build. Tap `Google로 계속하기` and sign in with the new account. The app creates a `users` row with `role='user'`.
3. In Supabase dashboard → SQL Editor, run:

   ```sql
   UPDATE public.users
     SET role = 'admin'
   WHERE email = 'ironspot.review.<random4>@gmail.com';
   ```

4. Verify by signing out and back in, then tap Profile → Admin shortcut. The admin queue should be reachable.
5. Paste the Gmail address + password into App Store Connect App Review notes.

Cleanup post-review: SQL-delete the `auth.users` row via Supabase Admin API or dashboard; the `public.users` row cascades. Delete the Gmail account too if it has no further use.

### 11.4 Boilerplate to paste into App Store Connect review notes

```
IronSpot — gym equipment finder, Korean only at launch.

Demo location: Gangnam Station (강남역), 37.4979, 127.0276.
The map opens to your current location; allow Location when prompted, or move
the simulator to the demo coordinates via Features > Location > Custom.

Sample interactions:
- Map: pinch to zoom, tap a gym marker, scroll the bottom sheet.
- Filter: tap the filter button, try selecting brand "Panatta" or category "가슴".
- NL search: tap the search bar, type "강남역 파나타 있는 헬스장", submit.
- Voice search: tap the mic icon, allow Speech Recognition, say "근처 파나타".
- Photo gallery: tap a machine row in a gym, browse the photo gallery.
- Upload (requires sign-in): tap a gym's "+" icon, take or pick a photo.
  Faces are auto-rejected by Vision API per Korean privacy law (PIPA);
  upload a no-face photo to succeed.

Sign in:
- Tap "로그인 없이 둘러보기" on the Login screen for read-only access (covers
  map, filter, NL search, voice, photo browse). This is the recommended path.
- For interactive features (upload, report, profile), tap "Apple로 계속하기"
  and use your own Apple ID. Account creation is automatic.

Admin features (moderation queue, report dispositions, owner workflow) are
operator tools and are intentionally not exposed to standard users.
[Optional addendum if Section 11.3 procedure is executed:
Demo admin account: <email> / <password>. After signing in via "Google로
계속하기", tap Profile > Admin to reach the moderation queue.]

Contact: yyou017@gmail.com
```

### 11.5 Open decisions for submission day

- Provide admin demo (Section 11.3) yes / no. Default: **no**, justify in review notes per Section 11.4 boilerplate. Flip to yes only if first submission gets bounced for "moderation features not testable".
- Apple Sign In: at submission day, confirm whether Task 48 native upgrade (PR #94) is merged. If yes, the boilerplate `Apple로 계속하기` works via native flow. If still on Web OAuth, the flow opens a WebBrowser which is acceptable but reviewer may comment.

## 12. Day-of submission

- [ ] Tag release in git (`v0.1.0`).
- [ ] EAS build production, submit via EAS Submit.
- [ ] Wait for App Store Connect processing.
- [ ] Fill metadata, attach build, set release type (manual vs automatic on approval).
- [ ] Submit for Review.
- [ ] Monitor Sentry plus Render dashboards during review period (typically 24 to 48 hours).

## Open items as of 2026-05-18

Items that are NOT yet resolved and need explicit decisions before submission:

1. **Apple Developer enrolment timing** (Section 0). User-controlled, deferred per memory.
2. **Test account credentials for App Review** (Section 9). Decide whether to create a dedicated `apple-review@ironspot.test` account with admin role pre-baked so the reviewer can exercise the admin queue, or keep reviewer as plain user.
3. **Re-scope `SENTRY_AUTH_TOKEN`** (Section 7) if Phase 5 wants automated Sentry event verification.

Items recently resolved during Phase 4 close audit:

- **Account deletion UI** plus **prod `users.deleted_at` hotfix** (Section 1, originally tracked as a blocker per 5.1.1(v)). Closed 2026-05-18 after verifying that backend, frontend, routing, tests, and prod schema were all already in place. Trail in `docs/plans/phase-3/PROGRESS.md` carry-over note.

## Related documents

- `docs/plans/phase-4/PROGRESS.md` for Task-level operational state
- `docs/plans/phase-4/implementation.md` for Phase 4 task entries (41 to 49)
- `docs/plans/phase-5/README.md` for post-launch backlog
- `docs/harness/operations.md` for env vars, Slack routing, UptimeRobot setup
- `docs/legal/privacy-policy.ko.md` plus `terms-of-service.ko.md` for canonical legal copy
