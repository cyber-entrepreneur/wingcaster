# WingCaster mobile — Capacitor scaffold

This is the developer README for the hybrid iOS + Android app. The **spec** for which routes ship on the phone lives in [mobile-fit-manifest.md](mobile-fit-manifest.md); this file is the **how-to-run-it** side.

The Capacitor project is rooted at `web/`. The same `dist/` bundle that Vite produces for the browser is wrapped by native iOS and Android shells:

```
web/
├── src/                      ← React app (shared across all three surfaces)
├── dist/                     ← Vite build output (also fed to iOS + Android via `cap sync`)
├── capacitor.config.ts       ← Bundle id, app name, plugin config
├── android/                  ← Native Android project (committed)
└── ios/                      ← Native iOS project (generated on macOS, committed)
```

## Quick reference — npm scripts

Run from `web/`:

| Script | Does |
|---|---|
| `npm run build` | Build the React app to `dist/` |
| `npm run mobile:build` | Build + `cap sync` (both platforms) |
| `npm run mobile:sync` | Copy the current `dist/` into both native projects |
| `npm run mobile:sync:android` | Sync Android only |
| `npm run mobile:sync:ios` | Sync iOS only (macOS) |
| `npm run mobile:open:android` | Open Android Studio |
| `npm run mobile:open:ios` | Open Xcode (macOS) |
| `npm run mobile:run:android` | Build + install on a running emulator / device |
| `npm run mobile:run:ios` | Build + install (macOS) |
| `npm run mobile:doctor` | Report toolchain issues |

## Prerequisites

**Every platform:**
- Node ≥ 22
- The web build must run cleanly (`npm run build` in `web/`).

**Android (any host OS):**
- JDK 17 (Microsoft OpenJDK or Temurin)
- Android Studio Koala or newer, with Android SDK 34, build-tools 34, and platform-tools installed via SDK Manager
- `ANDROID_HOME` env var pointing at the SDK root (e.g. `C:\Users\<you>\AppData\Local\Android\Sdk` or `~/Library/Android/sdk`)
- An emulator (created via AVD Manager) OR a physical device with USB debugging enabled

**iOS (macOS only):**
- Xcode 15+ with the iOS 17 SDK
- Xcode Command Line Tools (`xcode-select --install`)
- CocoaPods (`brew install cocoapods` or `sudo gem install cocoapods`)
- An Apple Developer account for on-device testing / TestFlight

## First-time setup

### From a fresh clone

```bash
cd web
npm install
npm run build             # populate dist/
npx cap sync android      # copy dist/ into the checked-in android/ project
```

### Adding the iOS platform (macOS, one-time)

The iOS project is generated per-machine because it references paths and identities specific to the developer's Apple account. Run once on a Mac:

```bash
cd web
npx cap add ios
cd ios/App && pod install && cd ../..
```

Then check the generated `ios/` in on that machine so the rest of the team can `cap sync ios` without repeating this step.

## Day-to-day workflow

The mental model: the web app is authoritative. You edit React, run the web dev server for hot reload, and every time you want to see the change on a device you re-sync.

```bash
# 1. Iterate on the React app with fast refresh
cd web && npm run dev

# 2. When you want to see it on device
npm run mobile:build           # build + sync

# 3. Open the native project
npm run mobile:open:android    # or :ios on a Mac
#    then hit Run in Android Studio / Xcode
```

For a tighter loop, use live-reload: point the native shell at your running Vite dev server on the LAN. Create `capacitor.config.dev.ts` from the sample below, then rename it over `capacitor.config.ts` before `cap sync`. Revert before committing.

```typescript
// capacitor.config.dev.ts — DEV ONLY, do not commit
server: {
  url: 'http://192.168.1.42:7100', // your laptop's LAN IP
  cleartext: true,
},
```

## Native plugins installed

All 15 plugins registered in this scaffold — the manifest lists which screens use each:

- `@capacitor/app` — deep-link intents, app-state events
- `@capacitor/browser` — external `Browser.open()` for portal OAuth
- `@capacitor/camera` — listing photo capture
- `@capacitor/device` — device signals for risk scoring
- `@capacitor/filesystem` — save data-export ZIP, receipt PDF
- `@capacitor/geolocation` — listing address auto-fill
- `@capacitor/haptics` — confirmation taps
- `@capacitor/keyboard` — keyboard resize behaviour
- `@capacitor/local-notifications` — task and deal reminders
- `@capacitor/network` — offline banner + queue trigger
- `@capacitor/preferences` — auth token cache, feature flags
- `@capacitor/push-notifications` — inquiry alerts, MFA nudges
- `@capacitor/share` — native share sheet
- `@capacitor/status-bar` — theming
- `@capacitor-community/speech-recognition` — pre-existing, voice notes

Biometrics is queued (`capacitor-native-biometric`) but not installed in the scaffold — added in the next PR alongside the LoginPage biometric-unlock wiring.

## Platform branching

Use `web/src/lib/mobile/platform.ts`. Do not sprinkle `Capacitor.isNativePlatform()` at random through the codebase — every call goes through one of the helpers so the branches stay easy to find:

```typescript
import { isNativePlatform, onPlatform } from '@/lib/mobile/platform'
import { Camera, CameraResultType } from '@capacitor/camera'

async function pickPhoto() {
  return onPlatform({
    native: async () => {
      const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64 })
      return photo.base64String
    },
    web: async () => {
      // <input type="file" capture="environment"> fallback
      return await openWebFilePicker()
    },
  })
}
```

## Configuration deep-dive

The generated `capacitor.config.ts` is documented inline. The load-bearing values:

- `appId` — reverse-DNS bundle id, **never change** after first store upload
- `appName` — display name under the icon
- `webDir` — where `cap sync` reads from, matches Vite's `dist/`
- `server.androidScheme` — `https` to satisfy secure-context APIs (WebAuthn, Service Workers)
- `server.iosScheme` — `capacitor://` because iOS otherwise disallows local WKWebView origins
- `ios.limitsNavigationsToAppBoundDomains` — locks the WKWebView to the domains declared in `Info.plist WKAppBoundDomains`; every backend origin needs to be listed there

Runtime plugin config (splash, keyboard, push presentation) lives under `plugins:` in the same file.

## Store-upload checklist

Copied here from the manifest so it lives with the build docs. Before the first TestFlight / internal-track upload:

- [ ] Bundled Privacy + Terms pages (App Store 5.1.1)
- [ ] Account deletion visible from Settings
- [ ] iOS Info.plist: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSFaceIDUsageDescription`, `WKAppBoundDomains`
- [ ] Android manifest: `POST_NOTIFICATIONS`, `CAMERA`, `ACCESS_FINE_LOCATION`, `USE_BIOMETRIC`
- [ ] App Tracking Transparency prompt or documented waiver
- [ ] Push opt-in non-blocking
- [ ] Sign-in-with-Apple (waived — no social sign-in)
- [ ] Data-export ZIP saves via Files app / SAF, not silent background write

## Troubleshooting

**`ERR_MODULE_NOT_FOUND` on `capacitor.config.ts`** — `@capacitor/cli` needs `tsx` on the path. Add via `npm i -D tsx` if the CLI can't parse the TS config, or fall back to a JS export by copying to `capacitor.config.json`.

**Android build fails with `SDK location not found`** — set `ANDROID_HOME`, then `cd web/android && ./gradlew --stop` and re-open Android Studio so it rewrites `local.properties`.

**iOS build fails with `No signing certificate`** — normal for a fresh clone. Open `web/ios/App/App.xcworkspace`, select the App target → Signing & Capabilities → choose your team.

**`cap sync` copies nothing** — you skipped `npm run build`. `dist/` was empty.

**Live-reload can't reach the laptop** — Windows Firewall on port 7100. Allow inbound TCP 7100 for private networks.

## What this scaffold does NOT do yet

- iOS platform generation (macOS step, one-time — see above)
- Biometric-auth plugin install
- Push-notification credentials wiring (APNs auth key + FCM Server Key)
- App icon + splash asset generation via `@capacitor/assets` (installed but not run — needs the source asset)
- Sentry native SDK — the web Sentry already ships in the bundle; native crash reports need the native Sentry SDKs added per platform
- Deep-link allow-list enforcement — `App.addListener('appUrlOpen', …)` scaffolding is next PR
- Store metadata (App Store Connect + Play Console listings)
- CI pipeline for `.aab` + `.ipa` — GitHub Actions or Codemagic

Each of the above ships as its own PR against `main`.
