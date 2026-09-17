/**
 * Platform detection + native-branch helpers for the WingCaster hybrid app.
 *
 * The same React bundle serves three surfaces: the browser web app, the iOS
 * Capacitor wrapper, and the Android Capacitor wrapper. Screens that touch
 * device hardware (camera, filesystem, biometrics, push) use these helpers
 * at the leaf — one branch calls the native plugin, the other falls back to
 * a browser primitive (or a no-op).
 *
 * DO NOT branch above the leaf. Route maps, page components, hooks, and
 * state stay platform-agnostic. Only the specific action that touches
 * hardware gets a branch — usually 3–8 lines inside a `use…` hook.
 *
 * Example:
 *
 *   import { Capacitor } from '@capacitor/core'
 *   import { Camera, CameraResultType } from '@capacitor/camera'
 *   import { isNativePlatform } from '@/lib/mobile/platform'
 *
 *   async function pickPhoto() {
 *     if (isNativePlatform()) {
 *       const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64 })
 *       return photo.base64String
 *     }
 *     // Web fallback: <input type="file" accept="image/*" capture="environment">
 *     return await openFilePicker()
 *   }
 */
import { Capacitor } from '@capacitor/core'

/** True when running inside the iOS or Android Capacitor shell. */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

/** True when running inside a browser (web app, not the Capacitor shell). */
export function isWebPlatform(): boolean {
  return !Capacitor.isNativePlatform()
}

/** `'ios'`, `'android'`, or `'web'`. */
export function getPlatform(): 'ios' | 'android' | 'web' {
  const p = Capacitor.getPlatform()
  return p === 'ios' || p === 'android' ? p : 'web'
}

/** True when running inside the iOS Capacitor shell specifically. */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

/** True when running inside the Android Capacitor shell specifically. */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android'
}

/**
 * Ask Capacitor whether a plugin is available in this build. Useful when a
 * plugin was omitted from a specific platform (e.g. push not registered on
 * an Android build variant) and the caller wants to soft-fall-back instead
 * of throwing on `plugin.method()`.
 */
export function isPluginAvailable(pluginName: string): boolean {
  return Capacitor.isPluginAvailable(pluginName)
}

/**
 * Branch helper for the common case: one native implementation, one web
 * fallback, same return type. Keeps the branch expression short at the call
 * site and forces the caller to think about the web path.
 *
 *   const location = await onPlatform({
 *     native: () => Geolocation.getCurrentPosition(),
 *     web: () => new Promise((resolve) =>
 *       navigator.geolocation.getCurrentPosition(resolve),
 *     ),
 *   })
 */
export async function onPlatform<T>(handlers: {
  native: () => Promise<T> | T
  web: () => Promise<T> | T
}): Promise<T> {
  return isNativePlatform() ? handlers.native() : handlers.web()
}
