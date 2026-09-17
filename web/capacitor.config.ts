import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 6 config for the WingCaster hybrid app.
 *
 * The same React bundle in `dist/` is wrapped by native iOS + Android shells
 * generated under `web/ios/` and `web/android/`. The manifest at
 * `docs/mobile/mobile-fit-manifest.md` classifies which routes ship to the
 * native shell and which stay web-only.
 *
 * webDir      → Vite's default output. `npm run build` populates it, then
 *               `npx cap sync` copies it into each native project.
 * appId       → reverse-DNS bundle id used by both stores. DO NOT rename after
 *               first upload — App Store treats it as the app's identity.
 * appName     → what the OS shows under the icon.
 * scheme      → iOS URL scheme for deep links (`wingcaster://…`).
 */
const config: CapacitorConfig = {
  appId: 'com.wingcaster.app',
  appName: 'WingCaster',
  webDir: 'dist',

  server: {
    // Native shells serve the bundled `dist/` off `capacitor://localhost`
    // on iOS and `https://localhost` on Android by default. Point at the
    // hosted app during dev if VITE_CAP_LIVE_RELOAD_URL is set — the
    // wrapper then talks to a running `vite --port 7100` on the host.
    androidScheme: 'https',
    iosScheme: 'capacitor',
    // Left undefined at build time; a dev override lives in `capacitor.config.dev.ts`
    // that a developer copies over when they want live-reload against their laptop.
  },

  ios: {
    // Content inset auto lets the WKWebView tuck under the status bar the
    // way native apps do; `StatusBar.setOverlaysWebView({ overlay: true })`
    // then reclaims that space at runtime.
    contentInset: 'automatic',
    // Prevent WKWebView from swipe-back-navigating out of the app.
    limitsNavigationsToAppBoundDomains: true,
  },

  android: {
    // Sits behind the display cutout / notch by default; the app's shell
    // draws its own padding using safe-area-inset-*.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0a0a0a', // Broadcast surface-canvas fallback until CSS loads
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_wingcaster',
      iconColor: '#c9a24d', // Broadcast accent-primary hex fallback (real value: --lc-accent-primary)
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    App: {
      // Deep-link route allow-list — the native shell will only cold-open a
      // route whose path prefix appears in this list. See the manifest's
      // `Deep-link / URL scheme surface` section for the canonical list.
      // Enforcement happens in `src/lib/mobile/deep-links.ts`.
    },
  },
}

export default config
