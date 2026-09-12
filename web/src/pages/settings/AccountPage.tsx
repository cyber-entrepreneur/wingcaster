import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Upload } from 'lucide-react'
import { api } from '@/api/client'
import { SavedPill, SettingsPaneHeader } from '@/components/settings'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { persistPreferredLocale, type AppLocale } from '@/hooks/useLocale'
import { initialsFromName } from '@/lib/relative-time'
import { usePageTitle } from '@/lib/usePageTitle'

const TIMEZONES = [
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Qatar',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Asia/Muscat',
  'Africa/Cairo',
  'Asia/Beirut',
  'Europe/London',
  'UTC',
]

function timezoneOptions(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
      'timeZone',
    )
    if (supported?.length) return supported
  } catch {
    /* ignore */
  }
  return TIMEZONES
}

export function AccountPage({ section }: { section?: 'locale' | 'timezone' } = {}) {
  const { agent, updateProfile, refreshAgent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('Account')

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [savedUsername, setSavedUsername] = useState('')
  const [localePref, setLocalePref] = useState<AppLocale>('en')
  const [timezone, setTimezone] = useState('Asia/Dubai')
  const [savingName, setSavingName] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [savedPill, setSavedPill] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!agent) return
    setName(String(agent.name || ''))
    const handle = String(agent.slug || agent.username || '')
    setUsername(handle)
    setSavedUsername(handle)
    const loc = agent.preferred_locale === 'ar' ? 'ar' : 'en'
    setLocalePref(loc)
    setTimezone(String(agent.preferred_timezone || 'Asia/Dubai'))
    setLoading(false)
  }, [agent?.id, agent?.name, agent?.slug, agent?.username, agent?.preferred_locale, agent?.preferred_timezone])

  useEffect(() => {
    if (!savedPill) return
    const id = window.setTimeout(() => setSavedPill(null), 1500)
    return () => window.clearTimeout(id)
  }, [savedPill])

  async function autosaveName() {
    if (!agent || name.trim() === agent.name) return
    setSavingName(true)
    try {
      await updateProfile({ name: name.trim() })
      setSavedPill('name')
    } catch (err: unknown) {
      addToast({
        title: 'Could not save name',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setSavingName(false)
    }
  }

  async function autosaveLocale(next: AppLocale) {
    setLocalePref(next)
    try {
      await persistPreferredLocale(next)
      setSavedPill('locale')
    } catch (err: unknown) {
      addToast({
        title: 'Could not save language',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'error',
      })
    }
  }

  async function autosaveTimezone(next: string) {
    setTimezone(next)
    try {
      await api.patchMe({ preferred_timezone: next })
      setSavedPill('timezone')
    } catch {
      try {
        await updateProfile({ preferred_timezone: next })
        setSavedPill('timezone')
      } catch (err: unknown) {
        addToast({
          title: 'Could not save timezone',
          description: err instanceof Error ? err.message : 'Try again.',
          variant: 'error',
        })
      }
    }
  }

  async function saveUsername() {
    if (!username.trim() || username.trim() === savedUsername) return
    setSavingUser(true)
    setUsernameError(null)
    try {
      await updateProfile({ slug: username.trim() })
      setSavedUsername(username.trim())
      addToast({ title: 'Username saved', variant: 'success' })
      await refreshAgent()
    } catch (err: unknown) {
      const status = err && typeof err === 'object' ? (err as { status?: number }).status : undefined
      const code = err && typeof err === 'object' ? (err as { code?: string }).code : undefined
      if (status === 409 || code === 'USERNAME_TAKEN') {
        setUsernameError('That username is taken.')
      } else {
        addToast({
          title: 'Could not save username',
          description: err instanceof Error ? err.message : 'Try again.',
          variant: 'error',
        })
      }
    } finally {
      setSavingUser(false)
    }
  }

  const email = typeof agent?.email === 'string' ? agent.email : ''
  const phone = typeof agent?.phone === 'string' ? agent.phone : ''
  const emailVerified = Boolean(agent?.email_verified_at || agent?.verified)
  const phoneVerified = Boolean(agent?.phone_verified_at)
  const usernameDirty = username.trim() !== savedUsername
  const zones = timezoneOptions()

  if (loading) {
    return (
      <div className="space-y-[var(--lc-space-lg)]" aria-busy="true">
        <div className="h-10 w-48 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <SettingsPaneHeader title="Account" sub="Your personal identity across WingCaster." />

      <section className="mb-[var(--lc-space-xl)] flex flex-col gap-[var(--lc-space-md)] sm:flex-row sm:items-center">
        <Avatar className="h-24 w-24 rounded-[var(--lc-radius-pill)] shadow-[var(--lc-elevation-sm)]">
          {typeof agent?.photo === 'string' ? <AvatarImage src={agent.photo} alt="" /> : null}
          <AvatarFallback>{initialsFromName(name)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
            Profile photo
          </h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            JPG or PNG, square, at least 200×200. Max 2 MB.
          </p>
          <div className="mt-[var(--lc-space-sm)] flex gap-[var(--lc-space-sm)]">
            <Button variant="outline" type="button" disabled>
              <Upload className="me-2 h-4 w-4" aria-hidden="true" />
              Upload photo
            </Button>
            <Button variant="ghost" type="button" className="text-[var(--lc-status-unpublished-fg)]" disabled>
              Remove
            </Button>
          </div>
        </div>
      </section>

      <section className="divide-y divide-[var(--lc-border)]">
        <h2 className="pb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
          Personal details
        </h2>
        <FieldRow label="Full name" helper="Shown to your teammates and inside conversations." htmlFor="account-name">
          <div className="flex items-center gap-[var(--lc-space-sm)]">
            <Input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void autosaveName()}
            />
            {savingName ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" /> : null}
            <SavedPill visible={savedPill === 'name'} />
          </div>
        </FieldRow>
        <FieldRow
          label="Username"
          helper="Your public handle. Changing it breaks old links."
          htmlFor="account-username"
        >
          <div className="flex flex-col gap-[var(--lc-space-xs)]">
            <div className="flex flex-col gap-[var(--lc-space-sm)] sm:flex-row">
              <Input
                id="account-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveUsername()
                }}
                aria-invalid={Boolean(usernameError)}
              />
              <Button
                type="button"
                onClick={() => void saveUsername()}
                disabled={!usernameDirty || savingUser}
                aria-disabled={!usernameDirty || savingUser}
              >
                {savingUser ? 'Saving…' : 'Save username'}
              </Button>
            </div>
            {usernameError ? (
              <p className="text-[var(--lc-status-unpublished-fg)]" style={{ font: 'var(--lc-type-caption)' }}>
                {usernameError}
              </p>
            ) : null}
          </div>
        </FieldRow>
        <FieldRow
          label="Preferred display language"
          helper="Used across email and in-app copy for you."
          htmlFor="account-locale"
        >
          <div className="flex flex-col gap-[var(--lc-space-sm)] sm:flex-row sm:items-center">
            <select
              id="account-locale"
              value={localePref}
              onChange={(e) => void autosaveLocale(e.target.value as AppLocale)}
              className="min-h-[var(--lc-tap-target-min)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3"
            >
              <option value="en">English (US)</option>
              <option value="ar">العربية</option>
            </select>
            <Link to="/settings/account" className="text-[var(--lc-text-brand)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Change display language →
            </Link>
            <SavedPill visible={savedPill === 'locale'} />
          </div>
        </FieldRow>
        <FieldRow
          label="Preferred timezone"
          helper="Used for reminders, timestamps, and reports."
          htmlFor="account-timezone"
        >
          <div className="flex items-center gap-[var(--lc-space-sm)]">
            <select
              id="account-timezone"
              value={timezone}
              onChange={(e) => void autosaveTimezone(e.target.value)}
              className="min-h-[var(--lc-tap-target-min)] max-w-md rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3"
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <SavedPill visible={savedPill === 'timezone'} />
          </div>
        </FieldRow>
      </section>

      <section className="mt-[var(--lc-space-xl)] divide-y divide-[var(--lc-border)]">
        <h2 className="pb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
          Sign-in identifiers
        </h2>
        <FieldRow label="Email" helper="Changing your email starts a one-time verification." htmlFor="account-email">
          <div className="flex flex-col gap-[var(--lc-space-sm)] sm:flex-row sm:items-center">
            <Input id="account-email" value={email} readOnly dir="ltr" className="bg-[var(--lc-surface-sunken)]" />
            <Badge variant={emailVerified ? 'published' : 'draft'} status={emailVerified ? 'published' : 'draft'}>
              {emailVerified ? 'Verified' : 'Not verified'}
            </Badge>
            <Button variant="outline" type="button" aria-label="Change email — starts a one-time verification">
              Change email
            </Button>
          </div>
        </FieldRow>
        <FieldRow label="Phone" helper="Changing your phone starts an SMS verification." htmlFor="account-phone">
          <div className="flex flex-col gap-[var(--lc-space-sm)] sm:flex-row sm:items-center">
            <Input id="account-phone" value={phone} readOnly dir="ltr" className="bg-[var(--lc-surface-sunken)]" />
            <Badge variant={phoneVerified ? 'published' : 'draft'} status={phoneVerified ? 'published' : 'draft'}>
              {phoneVerified ? 'Verified' : 'Not verified'}
            </Badge>
            <Button variant="outline" type="button" aria-label="Change phone — starts a one-time verification">
              Change phone
            </Button>
          </div>
        </FieldRow>
      </section>

      <p className="mt-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
        You sign in with <strong>email + password</strong>. Manage sign-in methods on the Security page.{' '}
        <Link to="/settings/2fa" className="text-[var(--lc-text-brand)]">
          Go to security →
        </Link>
      </p>

      <div className="mt-[var(--lc-space-lg)] flex items-center justify-end gap-[var(--lc-space-sm)]">
        {usernameDirty ? null : (
          <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            All changes saved.
          </span>
        )}
        <Button type="button" onClick={() => void saveUsername()} disabled={!usernameDirty || savingUser}>
          Save changes
        </Button>
      </div>

      <section className="mt-[var(--lc-space-2xl)] border-t border-[var(--lc-border-strong)] pt-[var(--lc-space-lg)]">
        <h2 className="text-[var(--lc-status-underOffer-fg)]" style={{ font: 'var(--lc-type-heading-3)' }}>
          Danger zone
        </h2>
        <p className="mb-[var(--lc-space-sm)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          Permanently delete your WingCaster account. This starts a 30-day cool-down.
        </p>
        <Button variant="outline" asChild className="text-[var(--lc-status-unpublished-fg)]">
          <Link to="/settings/delete-account" aria-label="Delete account — destructive">
            Delete account
          </Link>
        </Button>
      </section>
      {section ? <span className="sr-only">Focused section: {section}</span> : null}
    </div>
  )
}

function FieldRow({
  label,
  helper,
  htmlFor,
  children,
}: {
  label: string
  helper?: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-[var(--lc-space-sm)] py-[var(--lc-space-lg)] md:grid-cols-[200px_minmax(0,480px)]">
      <div>
        <Label htmlFor={htmlFor}>{label}</Label>
        {helper ? (
          <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {helper}
          </p>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  )
}
