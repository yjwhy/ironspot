# Android release keystore (Security #15)

## Why this exists

Before Security #15 the `release` build type in `android/app/build.gradle` reused `signingConfigs.debug` — i.e. the publicly known Android debug key (`androiddebugkey` / password `android`). Any APK we shipped would have been signed with a key every developer on the planet has, which means:

- Play Store rejects the upload outright (debug key signature is on the public deny-list).
- An attacker can repackage and re-sign our APK with a matching debug certificate fingerprint, so anti-tamper / Trust-on-First-Use checks become meaningless.
- Future certificate rotation is impossible because we never owned a unique upload key.

The Expo managed workflow handles signing through EAS, not through the checked-in `android/` folder (it's gitignored and regenerated on `expo prebuild`). The fix lives entirely in `eas.json` plus the one-time `eas credentials` provisioning step below.

## How it's wired now

`eas.json` now has a `production` profile that pins:

- `android.buildType: "app-bundle"` so Play Store gets an `.aab`, not a debug `.apk`.
- `android.credentialsSource: "remote"` — EAS owns the upload keystore (generated server-side, never copied to a laptop).
- `ios.credentialsSource: "remote"` for symmetry once Apple Developer enrollment is finished.
- `channel: "production"` so EAS Update OTAs go through a separate channel from preview / dev-client.
- `autoIncrement: true` so `versionCode` bumps automatically per build.

`submit.production` is wired so a single `eas submit -p android` reads the right credentials. iOS submit stays empty until App Store Connect is set up.

## One-time provisioning (user action required)

1. Log in to EAS:
   ```sh
   eas login
   ```
2. Generate the Android upload keystore on EAS servers:

   ```sh
   eas credentials
   ```

   - Pick `android` → `production`.
   - Choose "Set up a new keystore" → "Generate new keystore".
   - EAS stores the `.jks` + passwords in its credential vault. Never download or commit the file.

3. Verify:
   ```sh
   eas credentials --platform android
   ```
   should print SHA1 / SHA256 fingerprints that are NOT the debug-key fingerprints.

## Building a real release

After provisioning:

```sh
eas build --profile production --platform android
```

EAS runs the build container, injects the upload keystore from its vault, and produces a signed `.aab`. The build artifact link in the EAS dashboard is what gets uploaded to Play Store (manually for the first submission; `eas submit -p android` for subsequent uploads).

## What about local `assembleRelease`?

Local Gradle release builds are intentionally not supported. `android/` is regenerated on every `expo prebuild`, so any signingConfig tweak applied locally is wiped on the next prebuild. If you need a signed local APK for a specific debug session, use:

```sh
eas build --profile production --platform android --local
```

which mirrors the EAS pipeline on your machine while still pulling credentials from the remote vault.

## Defense in depth

- `.gitignore` already excludes `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.mobileprovision`. Don't override these.
- EAS supports automatic keystore rotation via Play App Signing. The first time we upload to Play Store, opt into Play App Signing so Google holds the deployment key and our upload key only authorises new releases (it can be rotated without affecting installed users).
- Long-term, when the team grows, scope EAS credentials access by adding individual maintainers rather than sharing one EAS login.

## Related findings

- Security #19 (EAS production profile separation + OTA code signing) builds on this profile by adding code-signing for OTAs. Track that as a follow-up.
- Security #38 (Android `network_security_config` cleartext deny) is already merged and applies to this same release pipeline.
