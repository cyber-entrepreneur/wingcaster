/**
 * PA-POR-002 — Portal detail (view / edit / create) + two-person activation flow.
 *
 * One component, three modes. Consumes the platform-admin portal routes
 * (BE-BLOCKER-35). Activation flips follow the PA-APR-003 two-person pattern:
 * submitter requests → a different admin approves (step-up gated) → history
 * (PA-POR-003) records the flip. Secrets never enter publisher/inbound JSONB.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Copy,
  Lock,
  Pencil,
  Plus,
  X,
} from 'lucide-react'
import { EnvBadge } from '@/components/nav/EnvBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { useStepUp } from '@/context/StepUpContext'
import { useEnv } from '@/hooks/useEnv'
import { useLocale } from '@/hooks/useLocale'
import {
  approveActivation,
  createPortal,
  deprecatePortal,
  getPortal,
  rejectActivation,
  requestActivation,
  requestDeactivation,
  updatePortal,
  withdrawActivation,
} from './api'
import { PRIMARY_LANGUAGE_OPTIONS, usePortalCopy } from './copy'
import {
  ToneBadge,
  activeStatusToken,
  adapterStatusToken,
  countryFlagEmoji,
  featureCode,
  useDesktopMin,
} from './shared'
import type { PortalActivationAction, PortalAdmin } from './types'

export type PortalDetailMode = 'view' | 'edit' | 'create'

const CODE_RE = /^[a-z][a-z0-9_]{2,63}$/

interface FormState {
  code: string
  display_name: string
  description: string
  logo_url: string
  country_codes: string[]
  primary_language: string
  adapter_class_name: string
  publisher_config: string
  inbound_config: string
  validator_ref: string
  sla_hours: string
}

function emptyForm(): FormState {
  return {
    code: '',
    display_name: '',
    description: '',
    logo_url: '',
    country_codes: [],
    primary_language: 'en',
    adapter_class_name: '',
    publisher_config: '{}',
    inbound_config: '{}',
    validator_ref: '',
    sla_hours: '8',
  }
}

function portalToForm(p: PortalAdmin): FormState {
  return {
    code: p.code,
    display_name: p.display_name ?? '',
    description: p.description ?? '',
    logo_url: p.logo_url ?? '',
    country_codes: p.country_codes ?? [],
    primary_language: p.primary_language ?? 'en',
    adapter_class_name: p.adapter_class_name ?? '',
    publisher_config: JSON.stringify(p.publisher_config ?? {}, null, 2),
    inbound_config: JSON.stringify(p.inbound_config ?? {}, null, 2),
    validator_ref: p.validator_ref ?? '',
    sla_hours: p.sla_hours == null ? '' : String(p.sla_hours),
  }
}

/** Mirrors backend findSecretInJsonb: string >32 chars with no `/` looks like a secret. */
function findSecretInJson(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.length > 32 && !value.includes('/')
  if (Array.isArray(value)) return value.some(findSecretInJson)
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(findSecretInJson)
  return false
}

function parseConfig(text: string): { ok: true; value: Record<string, unknown> } | { ok: false } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: true, value: {} }
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, value: parsed as Record<string, unknown> }
    }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

export function PortalDetailPage({ mode }: { mode: PortalDetailMode }) {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addToast } = useToast()
  const { agent } = useAuth()
  const { runElevated } = useStepUp()
  const { env, isTest } = useEnv()
  const { locale } = useLocale()
  const { t } = usePortalCopy()
  const isDesktop = useDesktopMin()

  const versionParam = searchParams.get('version')
  const version = versionParam != null && versionParam !== '' ? Number(versionParam) : null
  const returnTo = searchParams.get('return_to')
  const isSnapshot = mode === 'view' && version != null && !Number.isNaN(version)

  const [portal, setPortal] = useState<PortalAdmin | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(mode !== 'create')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [codeTaken, setCodeTaken] = useState(false)
  const [countryDraft, setCountryDraft] = useState('')
  const [deprecateOpen, setDeprecateOpen] = useState(false)
  const [submitterNotes, setSubmitterNotes] = useState('')
  const [approverNotes, setApproverNotes] = useState('')
  const initialRef = useRef<FormState>(emptyForm())

  const load = useCallback(async () => {
    if (mode === 'create') {
      const blank = emptyForm()
      initialRef.current = blank
      setForm(blank)
      setPortal(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getPortal(code, isSnapshot ? { version: version ?? undefined } : undefined)
      setPortal(data)
      const nextForm = portalToForm(data)
      initialRef.current = nextForm
      setForm(nextForm)
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('detail.loadError'))
    } finally {
      setLoading(false)
    }
  }, [mode, code, isSnapshot, version, t])

  useEffect(() => {
    void load()
  }, [load])

  const readOnly = mode === 'view'

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
    if (key === 'code') setCodeTaken(false)
  }

  const publisherParse = useMemo(() => parseConfig(form.publisher_config), [form.publisher_config])
  const inboundParse = useMemo(() => parseConfig(form.inbound_config), [form.inbound_config])
  const publisherSecret = publisherParse.ok && findSecretInJson(publisherParse.value)
  const inboundSecret = inboundParse.ok && findSecretInJson(inboundParse.value)

  const codeInvalid = mode === 'create' && form.code.length > 0 && !CODE_RE.test(form.code)
  const nameMissing = form.display_name.trim().length === 0
  const countryMissing = form.country_codes.length === 0

  const canSave =
    dirty &&
    !busy &&
    !nameMissing &&
    !countryMissing &&
    publisherParse.ok &&
    inboundParse.ok &&
    !publisherSecret &&
    !inboundSecret &&
    (mode !== 'create' || (form.code.length > 0 && !codeInvalid))

  const buildBody = () => {
    const publisher = publisherParse.ok ? publisherParse.value : {}
    const inbound = inboundParse.ok ? inboundParse.value : {}
    const slaNum = form.sla_hours.trim() === '' ? null : Number(form.sla_hours)
    return {
      display_name: form.display_name.trim(),
      description: form.description.trim() || null,
      logo_url: form.logo_url.trim() || null,
      country_codes: form.country_codes,
      primary_language: form.primary_language || null,
      adapter_class_name: form.adapter_class_name.trim() || undefined,
      publisher_config: publisher,
      inbound_config: inbound,
      validator_ref: form.validator_ref.trim() || null,
      sla_hours: slaNum,
    }
  }

  const handleSave = async () => {
    if (!canSave) return
    setBusy(true)
    try {
      if (mode === 'create') {
        const created = await createPortal({ code: form.code.trim(), ...buildBody() })
        addToast({ variant: 'success', title: t('detail.toast.created', { name: created.display_name }) })
        setDirty(false)
        navigate(`/admin/portals/${encodeURIComponent(created.code)}`)
      } else {
        const updated = await updatePortal(code, buildBody())
        addToast({
          variant: 'success',
          title: t('detail.toast.saved', { name: updated.display_name, n: updated.current_version }),
        })
        setDirty(false)
        navigate(`/admin/portals/${encodeURIComponent(code)}`)
      }
    } catch (err) {
      const e = err as { code?: string; status?: number; message?: string }
      if (e.code === 'PORTAL_CODE_TAKEN' || e.status === 409) {
        setCodeTaken(true)
      } else if (e.code === 'SECRET_IN_JSONB') {
        addToast({ variant: 'error', title: t('detail.secretInJsonb') })
      } else {
        addToast({ variant: 'error', title: e.message || t('detail.actionError') })
      }
    } finally {
      setBusy(false)
    }
  }

  const runActivationSubmit = async (action: PortalActivationAction) => {
    setBusy(true)
    try {
      const fn = action === 'activate' ? requestActivation : requestDeactivation
      const result = await runElevated(
        () => fn(code, { submitter_notes: submitterNotes.trim() || null }),
        action === 'activate' ? 'Request portal activation' : 'Request portal deactivation',
      )
      if (result === null) return
      addToast({
        variant: 'success',
        title:
          action === 'activate'
            ? t('detail.toast.activationRequested', { name: portal?.display_name || code })
            : t('detail.toast.deactivationRequested', { name: portal?.display_name || code }),
      })
      setSubmitterNotes('')
      await load()
    } catch (err) {
      addToast({ variant: 'error', title: (err as Error)?.message || t('detail.actionError') })
    } finally {
      setBusy(false)
    }
  }

  const runApprove = async (action: PortalActivationAction) => {
    setBusy(true)
    try {
      const result = await runElevated(
        () => approveActivation(code, action, { approver_notes: approverNotes.trim() || null }),
        'Approve portal activation change',
      )
      if (result === null) return
      const state = result.portal?.is_active ? t('list.active.active') : t('list.active.inactive')
      addToast({
        variant: 'success',
        title: t('detail.toast.approved', { name: result.portal?.display_name || code, state }),
      })
      setApproverNotes('')
      await load()
    } catch (err) {
      const e = err as { code?: string; message?: string }
      if (e.code === 'OWN_SUBMISSION') addToast({ variant: 'warning', title: t('detail.activation.ownBlock') })
      else addToast({ variant: 'error', title: e.message || t('detail.actionError') })
    } finally {
      setBusy(false)
    }
  }

  const runReject = async (action: PortalActivationAction) => {
    setBusy(true)
    try {
      await rejectActivation(code, action, { notes: approverNotes.trim() || null })
      addToast({ variant: 'success', title: t('detail.toast.rejected', { name: portal?.display_name || code }) })
      setApproverNotes('')
      await load()
    } catch (err) {
      addToast({ variant: 'error', title: (err as Error)?.message || t('detail.actionError') })
    } finally {
      setBusy(false)
    }
  }

  const runWithdraw = async (action: PortalActivationAction) => {
    setBusy(true)
    try {
      await withdrawActivation(code, action)
      addToast({ variant: 'success', title: t('detail.toast.withdrawn', { name: portal?.display_name || code }) })
      await load()
    } catch (err) {
      addToast({ variant: 'error', title: (err as Error)?.message || t('detail.actionError') })
    } finally {
      setBusy(false)
    }
  }

  const runDeprecate = async () => {
    setBusy(true)
    try {
      await deprecatePortal(code)
      addToast({ variant: 'success', title: t('detail.toast.deprecated', { name: portal?.display_name || code }) })
      setDeprecateOpen(false)
      await load()
    } catch (err) {
      addToast({ variant: 'error', title: (err as Error)?.message || t('detail.actionError') })
    } finally {
      setBusy(false)
    }
  }

  const addCountry = () => {
    const cc = countryDraft.trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(cc)) return
    if (!form.country_codes.includes(cc)) setField('country_codes', [...form.country_codes, cc])
    setCountryDraft('')
  }

  if (!isDesktop) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-[var(--lc-status-underOffer-fg)]" aria-hidden />
        <h1 style={{ font: 'var(--lc-type-heading-2)' }} className="text-[var(--lc-text-heading)]">
          {t('shell.desktopOnly.title')}
        </h1>
        <p className="text-[var(--lc-text-muted)]">{t('shell.desktopOnly.body')}</p>
        <Button type="button" variant="outline" asChild>
          <Link to="/dashboard">{t('shell.backHome')}</Link>
        </Button>
      </div>
    )
  }

  const pending = portal?.pending_activation ?? null
  const isPendingOwn = Boolean(pending && agent?.id && String(pending.submitter_user_id) === String(agent.id))
  const pageTitle =
    mode === 'create'
      ? t('detail.create.title')
      : mode === 'edit'
        ? t('detail.edit.title', { name: form.display_name || code })
        : form.display_name || code

  const sectionCls = 'mt-[var(--lc-space-xl)] border-t border-[var(--lc-border)] pt-[var(--lc-space-lg)] first:mt-0 first:border-t-0 first:pt-0'
  const labelCls = 'mb-1 block text-[length:var(--lc-type-body-sm)] font-semibold text-[var(--lc-text-primary)]'
  const helperCls = 'mt-1 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]'
  const errorCls = 'mt-1 text-[length:var(--lc-type-caption)] text-[var(--lc-status-unpublished-fg)]'

  const SectionHeader = ({ title, helper }: { title: string; helper: string }) => (
    <div className="mb-[var(--lc-space-md)]">
      <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
        {title}
      </h2>
      <p className={helperCls}>{helper}</p>
    </div>
  )

  const textareaCls =
    'w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] p-3 font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-data-sm,0.8125rem)] text-[var(--lc-text-primary)] focus-visible:outline-none disabled:opacity-70'

  const backHref = returnTo ? decodeURIComponent(returnTo) : '/admin/portals'

  return (
    <div
      className="mx-auto w-full max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-xl)]"
      data-testid="portal-detail"
      data-mode={mode}
      data-env={env}
    >
      <a
        href="#pa-por-detail-form"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-[var(--lc-radius-md)] focus:bg-[var(--lc-surface-raised)] focus:px-3 focus:py-2"
      >
        {t('detail.skipToForm')}
      </a>

      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-sm text-[var(--lc-text-muted)]">
        <Link to="/admin/portals" className="hover:underline">
          {t('detail.breadcrumb')}
        </Link>
        {mode !== 'create' ? (
          <>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span aria-current="page">{form.display_name || code}</span>
          </>
        ) : null}
      </nav>

      <header className="mb-[var(--lc-space-md)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
            {pageTitle}
          </h1>
          {mode === 'view' && portal ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className="font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-data-sm,0.75rem)] text-[var(--lc-text-muted)]"
                dir="ltr"
              >
                {portal.code}
              </span>
              {(() => {
                const a = adapterStatusToken(portal.adapter_status)
                const label =
                  portal.adapter_status === 'live'
                    ? t('list.adapter.live')
                    : portal.adapter_status === 'deprecated'
                      ? t('list.adapter.deprecated')
                      : t('list.adapter.stub')
                return <ToneBadge glyph={a.glyph} label={label} token={a.token} />
              })()}
              {(() => {
                const s = activeStatusToken(portal.is_active, Boolean(pending))
                const label = pending
                  ? t('list.active.pending')
                  : portal.is_active
                    ? t('list.active.active')
                    : t('list.active.inactive')
                return <ToneBadge glyph={s.glyph} label={label} token={s.token} />
              })()}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <EnvBadge env={env} locale={locale} tabIndex={-1} />
          {mode === 'view' && !isSnapshot && portal ? (
            <>
              <Button type="button" variant="outline" asChild>
                <Link to={`/admin/portals/${encodeURIComponent(code)}/history`}>
                  <Clock className="me-2 h-4 w-4" aria-hidden />
                  {t('detail.view.historyCta')}
                </Link>
              </Button>
              <Button type="button" asChild>
                <Link to={`/admin/portals/${encodeURIComponent(code)}/edit`}>
                  <Pencil className="me-2 h-4 w-4" aria-hidden />
                  {t('detail.view.editCta')}
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </header>

      {isTest ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] px-3 py-2 text-sm font-medium"
          style={{ background: 'var(--lc-status-underOffer-dot)', color: 'var(--lc-text-inverse)' }}
        >
          {t('shell.testStrip')}
        </div>
      ) : null}

      {isSnapshot ? (
        <div
          role="status"
          className="mb-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-sm"
        >
          {t('detail.version.banner', { n: version ?? 0 })}
        </div>
      ) : null}

      {mode === 'edit' ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-[var(--lc-space-sm)] flex items-center gap-2 rounded-[var(--lc-radius-md)] px-3 py-2 text-sm"
          style={{ background: 'var(--lc-status-underOffer-bg)', color: 'var(--lc-status-underOffer-fg)' }}
        >
          <Pencil className="h-4 w-4" aria-hidden />
          {t('detail.banner.edit', { name: form.display_name || code })}
        </div>
      ) : null}
      {mode === 'create' ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-[var(--lc-space-sm)] flex items-center gap-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-surface-raised)] px-3 py-2 text-sm text-[var(--lc-text-primary)]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('detail.banner.create')}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mb-[var(--lc-space-sm)] flex flex-wrap items-center justify-between gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-4 py-3"
          style={{ background: 'var(--lc-status-unpublished-bg)', color: 'var(--lc-status-unpublished-fg)' }}
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {error}
          </span>
          <Button type="button" variant="outline" onClick={() => void load()}>
            {t('shell.retry')}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div
          className="h-[400px] animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none"
          aria-label={t('detail.loadError')}
        />
      ) : (
        <div className="flex flex-col gap-[var(--lc-space-2xl)] lg:flex-row">
          <div className="flex-1 lg:max-w-[800px]">
            <form
              id="pa-por-detail-form"
              className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] shadow-[var(--lc-elevation-sm)]"
              onSubmit={(e) => {
                e.preventDefault()
                void handleSave()
              }}
            >
              {/* Identity */}
              <section className={sectionCls}>
                <SectionHeader
                  title={t('detail.section.identity')}
                  helper={t('detail.section.identity.helper')}
                />
                <div className="flex flex-col gap-[var(--lc-space-md)]">
                  <div>
                    <label htmlFor="por-code" className={labelCls}>
                      {t('detail.field.code')}
                    </label>
                    <div className="relative">
                      <Input
                        id="por-code"
                        dir="ltr"
                        value={form.code}
                        readOnly={mode !== 'create'}
                        aria-describedby="por-code-help"
                        className={mode !== 'create' ? 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]' : ''}
                        onChange={(e) => setField('code', e.target.value)}
                      />
                      {mode !== 'create' ? (
                        <Lock
                          className="pointer-events-none absolute inset-y-0 my-auto end-3 h-4 w-4 text-[var(--lc-text-muted)]"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <p id="por-code-help" className={helperCls}>
                      {mode === 'create' ? t('detail.field.code.helperCreate') : t('detail.field.code.helperEdit')}
                    </p>
                    {codeInvalid ? <p className={errorCls}>{t('detail.field.code.invalid')}</p> : null}
                    {codeTaken ? <p className={errorCls}>{t('detail.field.code.taken')}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="por-name" className={labelCls}>
                      {t('detail.field.displayName')}
                    </label>
                    <Input
                      id="por-name"
                      value={form.display_name}
                      readOnly={readOnly}
                      aria-describedby="por-name-help"
                      onChange={(e) => setField('display_name', e.target.value)}
                    />
                    <p id="por-name-help" className={helperCls}>
                      {t('detail.field.displayName.helper')}
                    </p>
                    {!readOnly && nameMissing ? (
                      <p className={errorCls}>{t('detail.field.displayName.required')}</p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="por-desc" className={labelCls}>
                      {t('detail.field.description')}
                    </label>
                    <textarea
                      id="por-desc"
                      value={form.description}
                      readOnly={readOnly}
                      maxLength={500}
                      rows={3}
                      aria-describedby="por-desc-help"
                      className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] p-3 text-sm text-[var(--lc-text-primary)] focus-visible:outline-none"
                      onChange={(e) => setField('description', e.target.value)}
                    />
                    <p id="por-desc-help" className={helperCls}>
                      {t('detail.field.description.helper')}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="por-logo" className={labelCls}>
                      {t('detail.field.logoUrl')}
                    </label>
                    <Input
                      id="por-logo"
                      dir="ltr"
                      value={form.logo_url}
                      readOnly={readOnly}
                      aria-describedby="por-logo-help"
                      onChange={(e) => setField('logo_url', e.target.value)}
                    />
                    <p id="por-logo-help" className={helperCls}>
                      {t('detail.field.logoUrl.helper')}
                    </p>
                  </div>
                </div>
              </section>

              {/* Coverage */}
              <section className={sectionCls}>
                <SectionHeader
                  title={t('detail.section.coverage')}
                  helper={t('detail.section.coverage.helper')}
                />
                <div className="flex flex-col gap-[var(--lc-space-md)]">
                  <div>
                    <span className={labelCls}>{t('detail.field.countryCodes')}</span>
                    <ul className="mb-2 flex flex-wrap gap-1">
                      {form.country_codes.map((c) => (
                        <li key={c}>
                          <span
                            className="inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] border border-[var(--lc-border)] px-2 py-0.5 text-[length:var(--lc-type-caption)] text-[var(--lc-text-secondary)]"
                            dir="ltr"
                          >
                            <span aria-hidden>{countryFlagEmoji(c)}</span> {c}
                            {!readOnly ? (
                              <button
                                type="button"
                                aria-label={t('detail.field.countryCodes.remove', { code: c })}
                                className="ms-1 text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
                                onClick={() =>
                                  setField(
                                    'country_codes',
                                    form.country_codes.filter((x) => x !== c),
                                  )
                                }
                              >
                                <X className="h-3 w-3" />
                              </button>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {!readOnly ? (
                      <div className="flex items-end gap-2">
                        <div className="w-40">
                          <label htmlFor="por-country-add" className="sr-only">
                            {t('detail.field.countryCodes.add')}
                          </label>
                          <Input
                            id="por-country-add"
                            dir="ltr"
                            maxLength={2}
                            value={countryDraft}
                            placeholder={t('detail.field.countryCodes.addPlaceholder')}
                            onChange={(e) => setCountryDraft(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addCountry()
                              }
                            }}
                          />
                        </div>
                        <Button type="button" variant="outline" onClick={addCountry}>
                          {t('detail.field.countryCodes.add')}
                        </Button>
                      </div>
                    ) : null}
                    <p className={helperCls}>{t('detail.field.countryCodes.helper')}</p>
                    {!readOnly && countryMissing ? (
                      <p className={errorCls}>{t('detail.field.countryCodes.required')}</p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="por-lang" className={labelCls}>
                      {t('detail.field.primaryLanguage')}
                    </label>
                    <select
                      id="por-lang"
                      value={form.primary_language}
                      disabled={readOnly}
                      className="min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)] focus-visible:outline-none disabled:opacity-70"
                      onChange={(e) => setField('primary_language', e.target.value)}
                    >
                      {PRIMARY_LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(opt.key)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {/* Adapter */}
              <section className={sectionCls}>
                <SectionHeader
                  title={t('detail.section.adapter')}
                  helper={t('detail.section.adapter.helper')}
                />
                <div className="flex flex-col gap-[var(--lc-space-md)]">
                  <div>
                    <label htmlFor="por-adapter" className={labelCls}>
                      {t('detail.field.adapterClass')}
                    </label>
                    <Input
                      id="por-adapter"
                      dir="ltr"
                      value={form.adapter_class_name}
                      readOnly={readOnly}
                      placeholder="portals/aqar.js"
                      aria-describedby="por-adapter-help"
                      onChange={(e) => setField('adapter_class_name', e.target.value)}
                    />
                    <p id="por-adapter-help" className={helperCls}>
                      {t('detail.field.adapterClass.helper')}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="por-pub" className={labelCls}>
                      {t('detail.field.publisherConfig')}
                    </label>
                    <textarea
                      id="por-pub"
                      dir="ltr"
                      rows={6}
                      value={form.publisher_config}
                      readOnly={readOnly}
                      aria-describedby="por-pub-help"
                      aria-invalid={!publisherParse.ok || Boolean(publisherSecret)}
                      className={textareaCls}
                      onChange={(e) => setField('publisher_config', e.target.value)}
                    />
                    <p id="por-pub-help" className={helperCls}>
                      {t('detail.field.publisherConfig.helper')}
                    </p>
                    {!publisherParse.ok ? <p className={errorCls}>{t('detail.jsonInvalid')}</p> : null}
                    {publisherSecret ? <p className={errorCls}>{t('detail.secretInJsonb')}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="por-inbound" className={labelCls}>
                      {t('detail.field.inboundConfig')}
                    </label>
                    <textarea
                      id="por-inbound"
                      dir="ltr"
                      rows={6}
                      value={form.inbound_config}
                      readOnly={readOnly}
                      aria-describedby="por-inbound-help"
                      aria-invalid={!inboundParse.ok || Boolean(inboundSecret)}
                      className={textareaCls}
                      onChange={(e) => setField('inbound_config', e.target.value)}
                    />
                    <p id="por-inbound-help" className={helperCls}>
                      {t('detail.field.inboundConfig.helper')}
                    </p>
                    {!inboundParse.ok ? <p className={errorCls}>{t('detail.jsonInvalid')}</p> : null}
                    {inboundSecret ? <p className={errorCls}>{t('detail.secretInJsonb')}</p> : null}
                  </div>
                </div>
              </section>

              {/* Validators */}
              <section className={sectionCls}>
                <SectionHeader
                  title={t('detail.section.validators')}
                  helper={t('detail.section.validators.helper')}
                />
                <div>
                  <label htmlFor="por-validator" className={labelCls}>
                    {t('detail.field.validatorRef')}
                  </label>
                  <Input
                    id="por-validator"
                    dir="ltr"
                    value={form.validator_ref}
                    readOnly={readOnly}
                    placeholder="backend/src/lib/portal-validators/aqar.js"
                    aria-describedby="por-validator-help"
                    onChange={(e) => setField('validator_ref', e.target.value)}
                  />
                  <p id="por-validator-help" className={helperCls}>
                    {t('detail.field.validatorRef.helper')}
                  </p>
                </div>
              </section>

              {/* Metering (read-only) */}
              <section className={sectionCls}>
                <SectionHeader
                  title={t('detail.section.metering')}
                  helper={t('detail.section.metering.helper')}
                />
                <div>
                  <span className={labelCls}>{t('detail.field.featureCode')}</span>
                  <div className="flex items-center gap-2">
                    <Numeric
                      as="span"
                      dir="ltr"
                      className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-2 py-1 text-[length:var(--lc-type-data-sm,0.8125rem)]"
                    >
                      {featureCode(form.code || 'code')}
                    </Numeric>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t('detail.field.featureCode.copy')}
                      onClick={() => {
                        try {
                          void navigator.clipboard?.writeText(featureCode(form.code || 'code'))
                          addToast({ title: t('detail.field.featureCode.copied') })
                        } catch {
                          /* clipboard unavailable */
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className={helperCls}>
                    {t('detail.field.featureCode.helper', { code: (form.code || 'code').toUpperCase() })}
                  </p>
                </div>
              </section>

              {/* SLA */}
              <section className={sectionCls}>
                <SectionHeader title={t('detail.section.sla')} helper={t('detail.section.sla.helper')} />
                <div className="max-w-[12rem]">
                  <label htmlFor="por-sla" className={labelCls}>
                    {t('detail.field.sla')}
                  </label>
                  <Input
                    id="por-sla"
                    type="number"
                    min={1}
                    max={72}
                    value={form.sla_hours}
                    readOnly={readOnly}
                    aria-describedby="por-sla-help"
                    onChange={(e) => setField('sla_hours', e.target.value)}
                  />
                  <p id="por-sla-help" className={helperCls}>
                    {t('detail.field.sla.helper')}
                  </p>
                </div>
              </section>

              {/* Activation */}
              {mode !== 'create' && portal && !isSnapshot ? (
                <section
                  className="mt-[var(--lc-space-xl)] rounded-[var(--lc-radius-md)] border p-[var(--lc-space-lg)]"
                  style={{
                    borderColor: 'var(--lc-status-underOffer-fg)',
                    background: 'var(--lc-status-underOffer-bg)',
                  }}
                  aria-label={t('detail.section.activation')}
                >
                  <SectionHeader
                    title={t('detail.section.activation')}
                    helper={t('detail.section.activation.helper')}
                  />
                  <div className="mb-3 flex items-center gap-2">
                    <span className={labelCls}>{t('detail.field.currentState')}:</span>
                    {(() => {
                      const s = activeStatusToken(portal.is_active, Boolean(pending))
                      const label = pending
                        ? t('list.active.pending')
                        : portal.is_active
                          ? t('list.active.active')
                          : t('list.active.inactive')
                      return <ToneBadge glyph={s.glyph} label={label} token={s.token} />
                    })()}
                  </div>

                  {pending ? (
                    isPendingOwn ? (
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-[var(--lc-text-primary)]">
                          {t('detail.activation.pendingOwn', {
                            date: pending.created_at
                              ? new Date(pending.created_at).toISOString().slice(0, 10)
                              : '—',
                          })}
                        </p>
                        <div>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void runWithdraw(pending.action)}
                          >
                            {t('detail.cta.withdraw')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-[var(--lc-text-primary)]">
                          {t('detail.activation.pendingApprover', {
                            name: pending.submitter_user_id || '—',
                            date: pending.created_at
                              ? new Date(pending.created_at).toISOString().slice(0, 10)
                              : '—',
                          })}
                        </p>
                        {pending.submitter_notes ? (
                          <blockquote className="border-s-2 border-[var(--lc-border-strong)] ps-3 text-sm text-[var(--lc-text-secondary)]">
                            {pending.submitter_notes}
                          </blockquote>
                        ) : null}
                        <div>
                          <label htmlFor="por-approver-notes" className={labelCls}>
                            {t('detail.field.approverNotes')}
                          </label>
                          <textarea
                            id="por-approver-notes"
                            rows={2}
                            value={approverNotes}
                            className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] p-3 text-sm text-[var(--lc-text-primary)] focus-visible:outline-none"
                            onChange={(e) => setApproverNotes(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" disabled={busy} onClick={() => void runApprove(pending.action)}>
                            {pending.action === 'activate'
                              ? t('detail.cta.approveActivation')
                              : t('detail.cta.approveDeactivation')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void runReject(pending.action)}
                          >
                            {t('detail.cta.reject')}
                          </Button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label htmlFor="por-submitter-notes" className={labelCls}>
                          {t('detail.field.submitterNotes')}
                        </label>
                        <textarea
                          id="por-submitter-notes"
                          rows={2}
                          value={submitterNotes}
                          placeholder={t('detail.field.submitterNotes.placeholder')}
                          className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] p-3 text-sm text-[var(--lc-text-primary)] focus-visible:outline-none"
                          onChange={(e) => setSubmitterNotes(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {portal.is_active ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void runActivationSubmit('deactivate')}
                          >
                            {t('detail.cta.requestDeactivation')}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            disabled={busy || portal.adapter_status === 'stub'}
                            title={portal.adapter_status === 'stub' ? t('detail.activation.stubBlocked') : undefined}
                            onClick={() => void runActivationSubmit('activate')}
                          >
                            {t('detail.cta.requestActivation')}
                          </Button>
                        )}
                        {!portal.is_active && !portal.deprecated_at ? (
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => setDeprecateOpen(true)}
                          >
                            {t('detail.cta.deprecate')}
                          </Button>
                        ) : null}
                      </div>
                      {portal.adapter_status === 'stub' ? (
                        <p className={helperCls}>{t('detail.activation.stubBlocked')}</p>
                      ) : null}
                    </div>
                  )}
                </section>
              ) : null}
            </form>

            {/* Save bar */}
            {mode !== 'view' ? (
              <div className="sticky bottom-0 mt-[var(--lc-space-md)] flex items-center justify-between gap-3 rounded-[var(--lc-radius-md)] border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-xl)] py-[var(--lc-space-md)] shadow-[var(--lc-elevation-sm)]">
                <div>
                  {dirty ? (
                    <Button type="button" variant="link" asChild>
                      <Link to={backHref}>{t('detail.discard')}</Link>
                    </Button>
                  ) : null}
                </div>
                <Button type="button" disabled={!canSave} onClick={() => void handleSave()}>
                  {busy
                    ? t('detail.save.saving')
                    : mode === 'create'
                      ? t('detail.save.create')
                      : t('detail.save.newVersion')}
                </Button>
              </div>
            ) : null}
          </div>

          {/* Preview panel */}
          <aside
            className="w-full lg:w-[380px] lg:shrink-0"
            role="complementary"
            aria-label={t('detail.preview.title')}
          >
            <div className="sticky top-[var(--lc-space-lg)] flex flex-col gap-[var(--lc-space-md)]">
              <PreviewCard title={t('detail.preview.chn')}>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] text-xs font-semibold">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="" className="h-8 w-8 object-contain" />
                    ) : (
                      (form.display_name || form.code || '?').charAt(0).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-[var(--lc-text-primary)]">
                      {form.display_name || '—'}
                    </div>
                    <div className="flex flex-wrap gap-1" dir="ltr">
                      {form.country_codes.slice(0, 4).map((c) => (
                        <span
                          key={c}
                          className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]"
                        >
                          {countryFlagEmoji(c)} {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {form.description ? (
                  <p className="mt-2 line-clamp-2 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                    {form.description.slice(0, 80)}
                  </p>
                ) : null}
              </PreviewCard>
              <PreviewCard title={t('detail.preview.inb')}>
                <span className="inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] border border-[var(--lc-border)] px-2 py-0.5 text-[length:var(--lc-type-caption)] text-[var(--lc-text-secondary)]">
                  {form.display_name || form.code || '—'}
                </span>
              </PreviewCard>
              <PreviewCard title={t('detail.preview.pub')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-[var(--lc-text-primary)]">
                    {t('detail.preview.publishingTo', { name: form.display_name || form.code || '—' })}
                  </span>
                  {form.sla_hours ? (
                    <ToneBadge glyph="○" label={t('detail.preview.slaChip', { n: form.sla_hours })} token="draft" />
                  ) : null}
                </div>
              </PreviewCard>
            </div>
          </aside>
        </div>
      )}

      <Dialog open={deprecateOpen} onOpenChange={setDeprecateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.deprecate.title', { name: portal?.display_name || code })}</DialogTitle>
            <DialogDescription>{t('detail.deprecate.body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeprecateOpen(false)}>
              {t('detail.deprecate.cancel')}
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void runDeprecate()}>
              {t('detail.deprecate.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PreviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-3">
      <p className="mb-2 text-[length:var(--lc-type-overline,0.6875rem)] uppercase tracking-[0.08em] text-[var(--lc-text-muted)]">
        {title}
      </p>
      {children}
    </div>
  )
}

export default PortalDetailPage
