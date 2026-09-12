/**
 * Feature flag `activation_wizard.enabled`.
 *
 * No shared flag helper exists yet — default enabled so the wizard is reachable.
 * Tests can stub this module; `VITE_ACTIVATION_WIZARD_ENABLED=false` disables.
 */
export function isActivationWizardEnabled(): boolean {
  const raw = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_ACTIVATION_WIZARD_ENABLED
  if (raw === 'false' || raw === '0') return false
  return true
}
