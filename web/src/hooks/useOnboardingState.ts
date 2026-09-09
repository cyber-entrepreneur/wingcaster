import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE } from '@/api/client'

/** Onboarding tour step machine (GET/PATCH `/api/user/onboarding-state`). */
export type OnboardingStep =
  | 'welcome'
  | 'welcome_skipped'
  | 'whatsapp_intake_pending'
  | 'manual_wizard'
  | 'import_pending'
  | 'draft_review'
  | 'first_published'
  | 'complete'

export type OnboardingPath = 'whatsapp' | 'manual' | 'import' | null

/** Checklist flags from `agent_onboarding_state.checklist` JSONB. */
export interface OnboardingChecklistFlags {
  welcome_seen: boolean
  first_listing_drafted: boolean
  first_listing_published: boolean
  channels_connected: boolean
  notifications_enabled: boolean
  profile_completed: boolean
  subscription_active: boolean
}

/** Full onboarding progress document returned by GET/PATCH. */
export interface OnboardingState {
  user_id: string
  step: OnboardingStep
  path: OnboardingPath
  started_at: string
  updated_at: string
  completed_at: string | null
  checklist: OnboardingChecklistFlags
  /** Soft-dismiss from AGT-ONB-005; reversible in settings. */
  dismissed_forever?: boolean
}

/** Partial write body for PATCH `/api/user/onboarding-state`. */
export interface OnboardingStatePatch {
  step?: OnboardingStep
  path?: OnboardingPath
  checklist_delta?: Partial<OnboardingChecklistFlags>
  dismissed_forever?: boolean
}

export type ActivationStepState = 'complete' | 'in_progress' | 'not_started' | 'deferred' | 'locked'

/** Caption sources for subdued `Completed via {source}` — never a surveillance banner. */
export type ActivationCompletedVia = 'onboarding' | 'whatsapp_intake' | 'dashboard_action' | 'direct' | 'bulk_import'

export interface ActivationStep {
  id: string
  order: number
  state: ActivationStepState
  completed_at: string | null
  completed_via: string | null
  sub_route?: string
  lock_reason?: string
}

export interface ActivationState {
  user_id: string
  tenant_id: string
  signup_path: 'solo' | 'join' | 'agency' | string
  country_code: string | null
  steps: ActivationStep[]
  completed_count: number
  total_count: number
}

/**
 * SWR-shaped return surface (fetch-backed; no `swr` dependency).
 * Extra cross-family fields are required by Wave 4A ONB/WLB/ACT screens.
 */
export interface UseOnboardingStateResult {
  /** Current progress document (merged with activation auto-complete). */
  state: OnboardingState
  /** Alias for SWR `data` consumers. */
  data: OnboardingState
  /** PATCH `/api/user/onboarding-state` — optimistic checklist_delta merge, then revalidate. */
  patch: (body: OnboardingStatePatch) => Promise<OnboardingState>
  /** True while the first onboarding GET is in flight. */
  isLoading: boolean
  /** True when onboarding GET failed with a non-404/non-empty error. */
  isError: boolean
  error: Error | undefined
  /** Revalidate both onboarding-state and activation_state. */
  mutate: () => Promise<OnboardingState>
  /** Activation wizard document; null if that fetch failed (onboarding still works). */
  activation: ActivationState | null
  completeActivation: (stepId: string, completedVia?: string) => Promise<ActivationState>
  deferActivation: (stepId: string) => Promise<ActivationState>
  isStepComplete: (stepId: string) => boolean
  completedVia: (stepId: string) => string | null
}

export const EMPTY_CHECKLIST: OnboardingChecklistFlags = {
  welcome_seen: false,
  first_listing_drafted: false,
  first_listing_published: false,
  channels_connected: false,
  notifications_enabled: false,
  profile_completed: false,
  subscription_active: false,
}

const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'welcome',
  'welcome_skipped',
  'whatsapp_intake_pending',
  'manual_wizard',
  'import_pending',
  'draft_review',
  'first_published',
  'complete',
]

const ONBOARDING_PATHS: readonly Exclude<OnboardingPath, null>[] = ['whatsapp', 'manual', 'import']

/** Steps that mean the WhatsApp intake tour already produced a draft (or more). */
const WHATSAPP_INTAKE_DONE_STEPS: readonly OnboardingStep[] = ['draft_review', 'first_published', 'complete']

const FIRST_LISTING_DONE_STEPS: readonly OnboardingStep[] = ['first_published', 'complete']

export function createDefaultOnboardingState(overrides?: Partial<OnboardingState>): OnboardingState {
  const { checklist, ...rest } = overrides ?? {}
  return {
    user_id: '',
    step: 'welcome',
    path: null,
    started_at: '',
    updated_at: '',
    completed_at: null,
    dismissed_forever: false,
    ...rest,
    checklist: {
      ...EMPTY_CHECKLIST,
      ...checklist,
    },
  }
}

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && (ONBOARDING_STEPS as readonly string[]).includes(value)
}

function isOnboardingPath(value: unknown): value is Exclude<OnboardingPath, null> {
  return typeof value === 'string' && (ONBOARDING_PATHS as readonly string[]).includes(value)
}

function asBool(value: unknown): boolean {
  return value === true
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('fi_token') || localStorage.getItem('sa_token')
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

type ParsedBody = {
  status: number
  ok: boolean
  json: unknown
  text: string
}

async function authFetch(path: string, options?: RequestInit): Promise<ParsedBody> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers || {}) },
  })
  const text = await res.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }
  return { status: res.status, ok: res.ok, json, text }
}

function errorMessage(json: unknown, status: number): string {
  if (json && typeof json === 'object' && 'error' in json) {
    return String((json as { error: unknown }).error)
  }
  return `Request failed (${status})`
}

function isEmptyOnboardingPayload(raw: unknown): boolean {
  if (raw == null) return true
  if (typeof raw !== 'object' || Array.isArray(raw)) return true
  const o = raw as Record<string, unknown>
  if (Object.keys(o).length === 0) return true
  const hasStep = typeof o.step === 'string' && o.step.length > 0
  const hasPath = o.path != null && o.path !== ''
  const checklist = o.checklist
  const hasChecklist =
    checklist != null && typeof checklist === 'object' && !Array.isArray(checklist) && Object.keys(checklist).length > 0
  const hasDismissed = typeof o.dismissed_forever === 'boolean'
  const hasUser = typeof o.user_id === 'string' && o.user_id.length > 0
  return !hasStep && !hasPath && !hasChecklist && !hasDismissed && !hasUser
}

function normalizeChecklist(raw: unknown): OnboardingChecklistFlags {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    welcome_seen: asBool(src.welcome_seen),
    first_listing_drafted: asBool(src.first_listing_drafted),
    first_listing_published: asBool(src.first_listing_published),
    channels_connected: asBool(src.channels_connected),
    notifications_enabled: asBool(src.notifications_enabled),
    profile_completed: asBool(src.profile_completed),
    subscription_active: asBool(src.subscription_active),
  }
}

export function normalizeOnboardingPayload(raw: unknown): OnboardingState {
  if (isEmptyOnboardingPayload(raw)) return createDefaultOnboardingState()
  const o = raw as Record<string, unknown>
  const step = isOnboardingStep(o.step)
    ? o.step
    : typeof o.step === 'string' && o.step
      ? (o.step as OnboardingStep)
      : 'welcome'
  const path = o.path === null || o.path === undefined ? null : isOnboardingPath(o.path) ? o.path : null
  return createDefaultOnboardingState({
    user_id: typeof o.user_id === 'string' ? o.user_id : '',
    step,
    path,
    started_at: typeof o.started_at === 'string' ? o.started_at : '',
    updated_at: typeof o.updated_at === 'string' ? o.updated_at : '',
    completed_at: typeof o.completed_at === 'string' ? o.completed_at : null,
    dismissed_forever: asBool(o.dismissed_forever),
    checklist: normalizeChecklist(o.checklist),
  })
}

function normalizeActivationStep(raw: unknown, index: number): ActivationStep | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return null
  const state = typeof o.state === 'string' ? (o.state as ActivationStepState) : 'not_started'
  return {
    id: o.id,
    order: typeof o.order === 'number' ? o.order : index + 1,
    state,
    completed_at: typeof o.completed_at === 'string' ? o.completed_at : null,
    completed_via: typeof o.completed_via === 'string' ? o.completed_via : null,
    sub_route: typeof o.sub_route === 'string' ? o.sub_route : undefined,
    lock_reason: typeof o.lock_reason === 'string' ? o.lock_reason : undefined,
  }
}

export function normalizeActivationPayload(raw: unknown): ActivationState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const steps = Array.isArray(o.steps)
    ? o.steps.map((step, i) => normalizeActivationStep(step, i)).filter((s): s is ActivationStep => s != null)
    : []
  return {
    user_id: typeof o.user_id === 'string' ? o.user_id : '',
    tenant_id: typeof o.tenant_id === 'string' ? o.tenant_id : '',
    signup_path: typeof o.signup_path === 'string' ? o.signup_path : 'solo',
    country_code: typeof o.country_code === 'string' ? o.country_code : null,
    steps,
    completed_count:
      typeof o.completed_count === 'number' ? o.completed_count : steps.filter((s) => s.state === 'complete').length,
    total_count: typeof o.total_count === 'number' ? o.total_count : steps.length,
  }
}

function findActivationStep(activation: ActivationState | null, stepId: string): ActivationStep | undefined {
  return activation?.steps.find((s) => s.id === stepId)
}

/** Map UI / checklist / tour ids onto activation_state.steps[].id */
export function canonicalActivationStepId(stepId: string): string {
  switch (stepId) {
    case 'whatsapp':
    case 'whatsapp_intake':
    case 'whatsapp_intake_pending':
      return 'whatsapp'
    case 'first_listing':
    case 'first_listing_published':
    case 'first_listing_drafted':
      return 'first_listing'
    case 'portal_credentials':
    case 'channels_connected':
      return 'portal_credentials'
    default:
      return stepId
  }
}

function onboardingImpliesWhatsappComplete(state: OnboardingState): boolean {
  return state.path === 'whatsapp' && WHATSAPP_INTAKE_DONE_STEPS.includes(state.step)
}

function onboardingImpliesFirstListingComplete(state: OnboardingState): boolean {
  return state.checklist.first_listing_published || FIRST_LISTING_DONE_STEPS.includes(state.step)
}

function onboardingImpliesFirstListingDrafted(state: OnboardingState): boolean {
  return (
    state.checklist.first_listing_drafted ||
    state.checklist.first_listing_published ||
    state.step === 'draft_review' ||
    onboardingImpliesFirstListingComplete(state)
  )
}

function activationComplete(activation: ActivationState | null, id: string): boolean {
  return findActivationStep(activation, id)?.state === 'complete'
}

/**
 * OR-resolver: a step is complete if EITHER onboarding-state OR activation_state says so.
 * Never XOR — completing via WhatsApp intake must light up ONB/WLB/ACT Complete.
 */
export function resolveIsStepComplete(
  stepId: string,
  onboarding: OnboardingState,
  activation: ActivationState | null,
): boolean {
  const canonical = canonicalActivationStepId(stepId)
  const actDone = activationComplete(activation, stepId) || activationComplete(activation, canonical)

  switch (stepId) {
    case 'whatsapp':
    case 'whatsapp_intake':
    case 'whatsapp_intake_pending':
      return actDone || onboardingImpliesWhatsappComplete(onboarding)
    case 'first_listing':
    case 'first_listing_published':
      return actDone || onboardingImpliesFirstListingComplete(onboarding)
    case 'first_listing_drafted':
      return actDone || onboardingImpliesFirstListingDrafted(onboarding)
    case 'portal_credentials':
    case 'channels_connected':
      return activationComplete(activation, 'portal_credentials') || onboarding.checklist.channels_connected
    case 'working_hours':
    case 'invite_team':
      return actDone
    case 'welcome_seen':
      return onboarding.checklist.welcome_seen || onboarding.step !== 'welcome'
    case 'notifications_enabled':
      return onboarding.checklist.notifications_enabled
    case 'profile_completed':
      return onboarding.checklist.profile_completed
    case 'subscription_active':
      return onboarding.checklist.subscription_active
    default: {
      if (actDone) return true
      if (stepId in onboarding.checklist) {
        return Boolean(onboarding.checklist[stepId as keyof OnboardingChecklistFlags])
      }
      return false
    }
  }
}

/**
 * Source caption for Complete-via-other-surface. Returns null when incomplete.
 * UIs may render subdued `Completed via {source}` only — never a surveillance banner.
 */
export function resolveCompletedVia(
  stepId: string,
  onboarding: OnboardingState,
  activation: ActivationState | null,
): string | null {
  const canonical = canonicalActivationStepId(stepId)
  const act = findActivationStep(activation, stepId) ?? findActivationStep(activation, canonical)
  if (act?.state === 'complete') {
    return act.completed_via || 'direct'
  }
  if (!resolveIsStepComplete(stepId, onboarding, activation)) return null
  if (canonical === 'whatsapp' && onboardingImpliesWhatsappComplete(onboarding)) {
    return 'whatsapp_intake'
  }
  return 'onboarding'
}

/** Derive checklist flags from EITHER surface so OnboardingChecklistCard auto-completes. */
export function mergeOnboardingWithActivation(
  onboarding: OnboardingState,
  activation: ActivationState | null,
): OnboardingState {
  const listingPublished = resolveIsStepComplete('first_listing', onboarding, activation)
  const listingDrafted = resolveIsStepComplete('first_listing_drafted', onboarding, activation)
  const channels =
    resolveIsStepComplete('channels_connected', onboarding, activation) ||
    resolveIsStepComplete('portal_credentials', onboarding, activation)
  return {
    ...onboarding,
    user_id: onboarding.user_id || activation?.user_id || '',
    checklist: {
      ...onboarding.checklist,
      welcome_seen: onboarding.checklist.welcome_seen || onboarding.step !== 'welcome',
      first_listing_drafted: listingDrafted || listingPublished,
      first_listing_published: listingPublished,
      channels_connected: channels,
    },
  }
}

export function applyOnboardingPatchLocally(prev: OnboardingState, body: OnboardingStatePatch): OnboardingState {
  const now = new Date().toISOString()
  return {
    ...prev,
    step: body.step ?? prev.step,
    path: body.path !== undefined ? body.path : prev.path,
    dismissed_forever: body.dismissed_forever ?? prev.dismissed_forever,
    checklist: {
      ...prev.checklist,
      ...body.checklist_delta,
    },
    updated_at: now,
    completed_at: body.step === 'complete' ? now : prev.completed_at,
  }
}

type OnboardingRead = { state: OnboardingState; error?: Error }

async function readOnboardingState(): Promise<OnboardingRead> {
  try {
    const res = await authFetch('/user/onboarding-state')
    if (res.status === 404 || isEmptyOnboardingPayload(res.json)) {
      return { state: createDefaultOnboardingState() }
    }
    if (!res.ok) {
      return { state: createDefaultOnboardingState(), error: new Error(errorMessage(res.json, res.status)) }
    }
    return { state: normalizeOnboardingPayload(res.json) }
  } catch (err) {
    return {
      state: createDefaultOnboardingState(),
      error: err instanceof Error ? err : new Error('Failed to load onboarding state'),
    }
  }
}

async function readActivationState(): Promise<ActivationState | null> {
  try {
    const res = await authFetch('/agent/activation_state')
    if (!res.ok) return null
    return normalizeActivationPayload(res.json)
  } catch {
    return null
  }
}

function markActivationStep(
  current: ActivationState | null,
  stepId: string,
  patch: Partial<ActivationStep>,
): ActivationState {
  const base: ActivationState = current ?? {
    user_id: '',
    tenant_id: '',
    signup_path: 'solo',
    country_code: null,
    steps: [],
    completed_count: 0,
    total_count: 0,
  }
  const steps = [...base.steps]
  const idx = steps.findIndex((s) => s.id === stepId)
  const nextStep: ActivationStep = {
    id: stepId,
    order: idx >= 0 ? steps[idx].order : steps.length + 1,
    state: 'not_started',
    completed_at: null,
    completed_via: null,
    ...(idx >= 0 ? steps[idx] : {}),
    ...patch,
  }
  if (idx >= 0) steps[idx] = nextStep
  else steps.push(nextStep)
  const completed_count = steps.filter((s) => s.state === 'complete').length
  return { ...base, steps, completed_count, total_count: base.total_count || steps.length }
}

/**
 * Cross-family onboarding + activation state.
 *
 * Loads GET `/api/user/onboarding-state` and GET `/api/agent/activation_state`.
 * Activation failure degrades to `activation: null` and never blocks onboarding.
 * 404 / empty onboarding → `step: 'welcome'` (first-visit, do not throw).
 */
export function useOnboardingState(): UseOnboardingStateResult {
  const [onboarding, setOnboarding] = useState<OnboardingState>(() => createDefaultOnboardingState())
  const [activation, setActivation] = useState<ActivationState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>(undefined)

  const onboardingRef = useRef(onboarding)
  const activationRef = useRef(activation)
  onboardingRef.current = onboarding
  activationRef.current = activation

  const applyRead = useCallback((read: OnboardingRead, nextActivation: ActivationState | null) => {
    setOnboarding(read.state)
    setActivation(nextActivation)
    setError(read.error)
  }, [])

  const revalidate = useCallback(async (): Promise<OnboardingState> => {
    const [onb, act] = await Promise.all([readOnboardingState(), readActivationState()])
    applyRead(onb, act)
    return mergeOnboardingWithActivation(onb.state, act)
  }, [applyRead])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    Promise.all([readOnboardingState(), readActivationState()])
      .then(([onb, act]) => {
        if (cancelled) return
        applyRead(onb, act)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applyRead])

  const state = useMemo(() => mergeOnboardingWithActivation(onboarding, activation), [onboarding, activation])

  const patch = useCallback(
    async (body: OnboardingStatePatch): Promise<OnboardingState> => {
      const snapshot = onboardingRef.current
      const optimistic = applyOnboardingPatchLocally(snapshot, body)
      setOnboarding(optimistic)

      try {
        const res = await authFetch('/user/onboarding-state', {
          method: 'PATCH',
          body: JSON.stringify(body),
        })

        if (res.status === 409) {
          // Illegal transition: drop the write, treat the user as already past that step.
          const payload = res.json && typeof res.json === 'object' ? (res.json as Record<string, unknown>) : {}
          const currentStep = isOnboardingStep(payload.current_step) ? payload.current_step : 'complete'
          const fallback = applyOnboardingPatchLocally(snapshot, {
            step: currentStep,
            ...(currentStep === 'complete' ? { checklist_delta: { first_listing_published: true } } : {}),
          })
          setOnboarding(fallback)
          try {
            return await revalidate()
          } catch {
            return mergeOnboardingWithActivation(fallback, activationRef.current)
          }
        }

        if (!res.ok) {
          setOnboarding(snapshot)
          throw new Error(errorMessage(res.json, res.status))
        }

        setOnboarding(normalizeOnboardingPayload(res.json))
        return await revalidate()
      } catch (err) {
        setOnboarding(snapshot)
        throw err
      }
    },
    [revalidate],
  )

  const mutate = useCallback(async () => revalidate(), [revalidate])

  const refreshAfterActivationWrite = useCallback(
    async (written: ActivationState): Promise<ActivationState> => {
      setActivation(written)
      const [onb, act] = await Promise.all([readOnboardingState(), readActivationState()])
      applyRead(onb, act ?? written)
      return act ?? written
    },
    [applyRead],
  )

  const completeActivation = useCallback(
    async (stepId: string, completedVia?: string): Promise<ActivationState> => {
      const via = completedVia ?? 'direct'
      const res = await authFetch('/agent/activation_state/complete', {
        method: 'POST',
        body: JSON.stringify({ step_id: stepId, completed_via: via }),
      })

      const localFallback = markActivationStep(activationRef.current, stepId, {
        state: 'complete',
        completed_via: via,
        completed_at: new Date().toISOString(),
      })

      if (res.status === 409) {
        return refreshAfterActivationWrite(localFallback)
      }

      if (!res.ok) throw new Error(errorMessage(res.json, res.status))

      return refreshAfterActivationWrite(normalizeActivationPayload(res.json) ?? localFallback)
    },
    [refreshAfterActivationWrite],
  )

  const deferActivation = useCallback(
    async (stepId: string): Promise<ActivationState> => {
      const res = await authFetch('/agent/activation_state/defer', {
        method: 'POST',
        body: JSON.stringify({ step_id: stepId }),
      })

      const localFallback = markActivationStep(activationRef.current, stepId, { state: 'deferred' })

      if (res.status === 409) {
        return refreshAfterActivationWrite(localFallback)
      }

      if (!res.ok) throw new Error(errorMessage(res.json, res.status))

      return refreshAfterActivationWrite(normalizeActivationPayload(res.json) ?? localFallback)
    },
    [refreshAfterActivationWrite],
  )

  const isStepComplete = useCallback(
    (stepId: string) => resolveIsStepComplete(stepId, onboarding, activation),
    [onboarding, activation],
  )

  const completedViaFn = useCallback(
    (stepId: string) => resolveCompletedVia(stepId, onboarding, activation),
    [onboarding, activation],
  )

  return {
    state,
    data: state,
    patch,
    isLoading,
    isError: Boolean(error),
    error,
    mutate,
    activation,
    completeActivation,
    deferActivation,
    isStepComplete,
    completedVia: completedViaFn,
  }
}
