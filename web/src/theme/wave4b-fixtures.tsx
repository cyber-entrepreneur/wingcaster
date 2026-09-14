/**
 * Wave 4B MFA + Settings fixtures (SHR-MFA-001..005 / 004b, SHR-SET-001..005).
 *
 * Page modules land on Phase A branches. These compositions mount the
 * Shared Prep primitives those screens own, so a11y + visual coverage
 * is meaningful before (and after) the family PRs merge.
 */
import { useState, type ReactElement, type ReactNode } from 'react'
import {
  AlertTriangle,
  Bell,
  Copy,
  CreditCard,
  Download,
  KeySquare,
  Laptop,
  Monitor,
  Printer,
  ShieldCheck,
  Smartphone,
  User,
} from 'lucide-react'
import {
  BackupCodeGrid,
  BackupCodeInput,
  BackupCodesRow,
  EnrollmentStepper,
  MethodRow,
  OtpInput,
  PasswordGateCard,
  RateLimitBanner,
  RevealableSecret,
  StepUpModal,
  TrustFooter,
  TwoFactorStatusHero,
} from '@/components/mfa'
import {
  SettingsShell,
  type SettingsNavGroupData,
} from '@/components/settings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'

export const FIXED_NOW = new Date('2026-09-12T12:00:00.000Z').getTime()

export const SAMPLE_BACKUP_CODES = [
  'A7K9-M2P4-Q8R1',
  'B3N6-W1X5-Y9Z2',
  'C4D8-E2F7-G1H3',
  'J5K2-L9M8-N4P6',
  'Q1R7-S3T5-U8V0',
  'W2X4-Y6Z9-A1B3',
  'C8D1-E5F2-G7H4',
  'K3L6-M9N0-P2Q5',
  'R4S8-T1U7-V3W6',
  'X5Y2-Z8A4-B7C9',
] as const

const NOOP = () => {}

export const SAMPLE_SETTINGS_GROUPS: SettingsNavGroupData[] = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'profile', route: '/settings/account', icon: User, label: 'Profile' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    items: [
      {
        id: '2fa',
        route: '/settings/2fa',
        icon: ShieldCheck,
        label: 'Two-factor authentication',
        badge: { kind: 'status', tone: 'warning', label: '2FA off' },
      },
      {
        id: 'sessions',
        route: '/settings/security/sessions',
        icon: Laptop,
        label: 'Sessions & devices',
        badge: { kind: 'count', value: 3 },
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing & notifications',
    items: [
      { id: 'subscription', route: '/settings/billing/subscription', icon: CreditCard, label: 'Subscription' },
      { id: 'notifications', route: '/settings/notifications', icon: Bell, label: 'Notification preferences' },
    ],
  },
  {
    id: 'danger',
    label: 'Danger zone',
    items: [
      {
        id: 'delete',
        route: '/settings/danger/delete-account',
        icon: AlertTriangle,
        label: 'Delete account',
        danger: true,
      },
    ],
  },
]

function Pane({
  title,
  sub,
  children,
}: {
  title: string
  sub?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-[var(--lc-space-lg)]">
      <header>
        <h2
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-1)' }}
        >
          {title}
        </h2>
        {sub ? (
          <p className="mt-[var(--lc-space-xs)] text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
            {sub}
          </p>
        ) : null}
      </header>
      {children}
    </div>
  )
}

function Shell({
  path = '/settings',
  mobileView = 'list',
  children,
}: {
  path?: string
  mobileView?: 'list' | 'detail'
  children: ReactNode
}) {
  void path
  return (
    <SettingsShell groups={SAMPLE_SETTINGS_GROUPS} mobileView={mobileView} title="Settings">
      {children}
    </SettingsShell>
  )
}

/** SHR-MFA-001 — 2FA settings home. */
export function Mfa001SettingsSurface({ status = 'off' }: { status?: 'on' | 'off' }) {
  return (
    <div data-wave4b-surface="MFA-001" className="max-w-[640px] space-y-[var(--lc-space-lg)]">
      <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
        Two-factor authentication
      </h1>
      <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
        Extra protection for your account. When on, you&apos;ll enter a 6-digit code from your
        authenticator app after your password.
      </p>
      <TwoFactorStatusHero
        status={status}
        title={status === 'on' ? 'On' : 'Off'}
        subtitle={status === 'on' ? 'Authenticator app active' : 'Not set up'}
      />
      <div className="overflow-hidden rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
        <MethodRow
          icon={<Smartphone className="h-5 w-5" />}
          label="Authenticator app"
          meta={status === 'on' ? 'Enrolled' : 'Not set up'}
          actionLabel={status === 'on' ? 'Manage' : 'Set up'}
          onAction={NOOP}
        />
        <BackupCodesRow remaining={status === 'on' ? 8 : 0} onManage={NOOP} />
      </div>
      {status === 'on' ? (
        <Button
          type="button"
          variant="destructive"
          aria-label="Turn off two-factor authentication (reduces account security)"
        >
          Turn off
        </Button>
      ) : null}
    </div>
  )
}

/** SHR-MFA-002 — TOTP setup QR (password gate + secret). */
export function Mfa002SetupQrSurface({ stage = 'qr' }: { stage?: 'password' | 'qr' }) {
  return (
    <div data-wave4b-surface="MFA-002" className="max-w-[640px] space-y-[var(--lc-space-lg)]">
      <EnrollmentStepper activeIndex={0} />
      <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
        Set up your authenticator
      </h1>
      {stage === 'password' ? (
        <PasswordGateCard value="secret-password" onChange={NOOP} onSubmit={NOOP} />
      ) : (
        <>
          <p className="text-[var(--lc-text-secondary)]">
            Scan this QR code with your authenticator app, then continue to verify.
          </p>
          <div
            className="inline-block rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-5"
            data-totp-qr
          >
            {/* Placeholder — real QR PNG is client-rendered; jsdom has no canvas. */}
            <img
              alt="Authenticator QR code"
              width={220}
              height={220}
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Crect width='100%25' height='100%25' fill='white'/%3E%3C/svg%3E"
            />
          </div>
          <details>
            <summary>Can&apos;t scan?</summary>
            <RevealableSecret secret="JBSWY3DPEHPK3PXP" initiallyRevealed />
          </details>
        </>
      )}
    </div>
  )
}

/** SHR-MFA-003 — TOTP setup verify. */
export function Mfa003VerifySurface({
  value = '',
  error = false,
}: {
  value?: string
  error?: boolean
}) {
  return (
    <div data-wave4b-surface="MFA-003" className="max-w-[640px] space-y-[var(--lc-space-lg)]">
      <EnrollmentStepper activeIndex={1} />
      <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
        Enter the code from your app
      </h1>
      <p className="text-[var(--lc-text-secondary)]">
        Open your authenticator app and type the 6-digit code you see for WingCaster.
      </p>
      <OtpInput
        count={6}
        value={value}
        error={error}
        aria-label="6-digit verification code"
        onChange={NOOP}
      />
      {error ? (
        <p role="alert" className="text-[var(--lc-status-danger-fg)]">
          That code did not match. Check your device clock and try the next one.
        </p>
      ) : null}
      <Button type="button" size="lg" disabled={value.length < 6}>
        Verify and enable
      </Button>
    </div>
  )
}

/** SHR-MFA-004 — 2FA challenge at sign-in. */
export function Mfa004ChallengeSurface({
  value = '',
  remaining,
  rateLimited = false,
  error,
}: {
  value?: string
  remaining?: number
  rateLimited?: boolean
  error?: string
}) {
  return (
    <div data-wave4b-surface="MFA-004" className="mx-auto max-w-[400px] space-y-[var(--lc-space-lg)]">
      <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
        Verify it&apos;s you
      </h1>
      <p className="text-[var(--lc-text-secondary)]">Enter the 6-digit code from your authenticator app.</p>
      {rateLimited ? (
        <RateLimitBanner message="Too many attempts. For your security, try signing in again in 15 minutes." retryAfterMinutes={15} />
      ) : (
        <OtpInput
          count={6}
          value={value}
          error={Boolean(error)}
          aria-label="6-digit verification code"
          onChange={NOOP}
        />
      )}
      {error ? (
        <p role="alert" aria-live="assertive" className="text-[var(--lc-status-danger-fg)]">
          {error}
        </p>
      ) : null}
      {typeof remaining === 'number' ? (
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          {remaining} attempts remaining.
        </p>
      ) : null}
      <Button type="button" size="lg" className="w-full" disabled={rateLimited || value.length < 6}>
        Verify
      </Button>
      <div className="flex flex-wrap gap-[var(--lc-space-sm)]">
        <Button type="button" variant="link">
          Use a backup code instead
        </Button>
        <Button type="button" variant="link">
          Sign in as different user
        </Button>
      </div>
      <TrustFooter />
    </div>
  )
}

/** SHR-MFA-004b — backup-code sign-in. */
export function Mfa004bBackupSignInSurface({ value = '' }: { value?: string }) {
  return (
    <div data-wave4b-surface="MFA-004b" className="mx-auto max-w-[400px] space-y-[var(--lc-space-lg)]">
      <KeySquare className="h-8 w-8 text-[var(--lc-text-brand)]" aria-hidden />
      <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
        Enter a backup code
      </h1>
      <p className="text-[var(--lc-text-secondary)]">
        Type one of the 10 one-time codes you saved when you set up two-factor. Each code works only
        once.
      </p>
      <BackupCodeInput value={value} aria-label="Backup code" onChange={NOOP} />
      <Button type="button" size="lg" className="w-full" disabled={value.replace(/-/g, '').length < 8}>
        Verify
      </Button>
      <div className="flex flex-wrap gap-[var(--lc-space-sm)]">
        <Button type="button" variant="link">
          Try my authenticator code instead
        </Button>
        <Button type="button" variant="link">
          I&apos;ve lost my codes too — recover my account
        </Button>
      </div>
      <TrustFooter>Backup codes are one-time only. Once you use one, it&apos;s gone.</TrustFooter>
    </div>
  )
}

/** SHR-MFA-005 — backup-codes viewer (Mode A first-view). */
export function Mfa005BackupCodesSurface({
  confirmed = false,
}: {
  confirmed?: boolean
}) {
  const [checked, setChecked] = useState(confirmed)
  return (
    <div data-wave4b-surface="MFA-005" className="max-w-[640px] space-y-[var(--lc-space-lg)]">
      <div data-print-hide="" className="no-print space-y-[var(--lc-space-md)]">
        <EnrollmentStepper activeIndex={2} />
        <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
          Save your backup codes
        </h1>
        <p className="text-[var(--lc-text-secondary)]">
          These 10 codes let you sign in if you lose your authenticator. Each one works only once.
          Save them somewhere safe now — you won&apos;t see them again.
        </p>
        <div
          role="alert"
          aria-live="polite"
          className="flex gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-warning-fg)]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          You&apos;ll only see these codes once. Save them before continuing.
        </div>
      </div>

      <BackupCodeGrid codes={[...SAMPLE_BACKUP_CODES]} printTarget />

      <p data-backup-codes-print-meta="" className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
        Generated: 2026-09-12 · Account: sara@example.com
      </p>

      <div data-print-hide="" className="no-print flex flex-wrap gap-[var(--lc-space-sm)]">
        <Button type="button" variant="outline">
          <Copy className="h-4 w-4" aria-hidden />
          Copy all
        </Button>
        <Button type="button" variant="outline">
          <Download className="h-4 w-4" aria-hidden />
          Download .txt
        </Button>
        <Button type="button" variant="outline">
          <Printer className="h-4 w-4" aria-hidden />
          Print
        </Button>
      </div>

      <div data-print-hide="" className="no-print flex items-start gap-2">
        <input
          id="backup-codes-saved"
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <Label htmlFor="backup-codes-saved">I&apos;ve saved my backup codes somewhere safe.</Label>
      </div>
      <Button type="button" data-print-hide="" className="no-print" disabled={!checked}>
        Done — back to two-factor settings
      </Button>
    </div>
  )
}

/** SHR-SET-001 — Settings home (shell + anchor pane). */
export function Set001HomeSurface() {
  return (
    <div data-wave4b-surface="SET-001">
      <Shell path="/settings" mobileView="list">
        <Pane
          title="Settings"
          sub="Manage your account, security, billing, and devices."
        >
          <p className="text-[var(--lc-text-secondary)]">
            Signed in as <strong>sara@example.com</strong>
          </p>
        </Pane>
      </Shell>
    </div>
  )
}

/** SHR-SET-002 — Account / profile pane. */
export function Set002AccountSurface() {
  return (
    <div data-wave4b-surface="SET-002">
      <Shell path="/settings/account" mobileView="detail">
        <Pane title="Profile" sub="Your name and how people find you.">
          <div className="space-y-[var(--lc-space-md)]">
            <Label htmlFor="display-name">Display name</Label>
            <Input id="display-name" defaultValue="Sara Agent" />
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="sara@example.com" />
            <Button type="button">Save</Button>
          </div>
        </Pane>
      </Shell>
    </div>
  )
}

/** SHR-SET-003 — Billing / notification prefs pane. */
export function Set003BillingSurface() {
  return (
    <div data-wave4b-surface="SET-003">
      <Shell path="/settings/notifications" mobileView="detail">
        <Pane title="Notification preferences" sub="Choose how WingCaster reaches you.">
          <div className="flex items-center gap-2">
            <input id="email-notif" type="checkbox" defaultChecked className="h-4 w-4" />
            <Label htmlFor="email-notif">Email me about security events</Label>
          </div>
        </Pane>
      </Shell>
    </div>
  )
}

/** SHR-SET-004 — Sessions & devices (+ optional step-up). */
export function Set004SessionsSurface({ stepUpOpen = false }: { stepUpOpen?: boolean }) {
  const [open, setOpen] = useState(stepUpOpen)
  return (
    <div data-wave4b-surface="SET-004">
      <Shell path="/settings/security/sessions" mobileView="detail">
        <Pane title="Sessions & devices" sub="Review where you're signed in and revoke any session you don't recognize.">
          <div
            role="status"
            className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-underOffer-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-underOffer-fg)]"
          >
            You have <Numeric>3</Numeric> active sessions. Review anything you don&apos;t recognize.
          </div>
          <section aria-labelledby="active-sessions-heading" className="space-y-[var(--lc-space-sm)]">
            <div className="flex items-center justify-between">
              <h2 id="active-sessions-heading" style={{ font: 'var(--lc-type-heading-3)' }}>
                Active sessions
              </h2>
              <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                Sign out everywhere except this device
              </Button>
            </div>
            <ul className="divide-y divide-[var(--lc-border)]">
              <li className="flex items-center gap-[var(--lc-space-md)] py-[var(--lc-space-md)]">
                <Monitor className="h-6 w-6" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p>Chrome on macOS</p>
                  <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                    Dubai, UAE · Last active 2 minutes ago
                  </p>
                </div>
                <Badge variant="published">This device</Badge>
              </li>
              <li className="flex items-center gap-[var(--lc-space-md)] py-[var(--lc-space-md)]">
                <Smartphone className="h-6 w-6" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p>Safari on iPhone</p>
                  <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                    Abu Dhabi, UAE · Last active 1 day ago
                  </p>
                </div>
                <Button type="button" variant="outline">
                  Sign out
                </Button>
              </li>
            </ul>
          </section>
        </Pane>
      </Shell>
      <StepUpModal
        open={open}
        reason="Sign out everywhere except this device"
        onCancel={() => setOpen(false)}
        onVerify={() => setOpen(false)}
      />
    </div>
  )
}

/** SHR-SET-005 — Delete account / danger zone (if present). */
export function Set005DeleteSurface({ stepUpOpen = false }: { stepUpOpen?: boolean }) {
  const [open, setOpen] = useState(stepUpOpen)
  return (
    <div data-wave4b-surface="SET-005">
      <Shell path="/settings/danger/delete-account" mobileView="detail">
        <Pane title="Delete account" sub="This permanently removes your WingCaster account.">
          <div
            role="alert"
            className="flex gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-status-danger-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-danger-fg)]"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            This cannot be undone. Your listings and conversations will be removed.
          </div>
          <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
            Delete my account
          </Button>
        </Pane>
      </Shell>
      <StepUpModal
        open={open}
        reason="Delete your account"
        onCancel={() => setOpen(false)}
        onVerify={() => setOpen(false)}
      />
    </div>
  )
}

export type Wave4bSurface = {
  id: string
  path: string
  render: () => ReactElement
}

export const WAVE4B_SURFACES: Wave4bSurface[] = [
  { id: 'MFA-001', path: '/settings/2fa', render: () => <Mfa001SettingsSurface /> },
  { id: 'MFA-002', path: '/settings/2fa/enroll', render: () => <Mfa002SetupQrSurface /> },
  { id: 'MFA-003', path: '/settings/2fa/enroll?stage=verify', render: () => <Mfa003VerifySurface /> },
  { id: 'MFA-004', path: '/login?stage=2fa', render: () => <Mfa004ChallengeSurface /> },
  { id: 'MFA-004b', path: '/login?stage=backup', render: () => <Mfa004bBackupSignInSurface /> },
  { id: 'MFA-005', path: '/settings/2fa/backup-codes?first-view=1', render: () => <Mfa005BackupCodesSurface /> },
  { id: 'SET-001', path: '/settings', render: () => <Set001HomeSurface /> },
  { id: 'SET-002', path: '/settings/account', render: () => <Set002AccountSurface /> },
  { id: 'SET-003', path: '/settings/notifications', render: () => <Set003BillingSurface /> },
  { id: 'SET-004', path: '/settings/security/sessions', render: () => <Set004SessionsSurface /> },
  { id: 'SET-005', path: '/settings/danger/delete-account', render: () => <Set005DeleteSurface /> },
]
