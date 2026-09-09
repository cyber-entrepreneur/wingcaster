import type { ReactNode } from 'react'
import {
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Home,
  KeyRound,
  Lock,
  MessageCircle,
  BoxSelect,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import { inviteTeamDescription, inviteTeamTitle, STEP_COPY, stepLockHelper } from '../copy'
import { completedCaption } from '../format'
import type { ActivationStep, ActivationStepState, SignupPath } from '../types'

const STATE_GLYPH: Record<ActivationStepState, LucideIcon> = {
  not_started: Circle,
  in_progress: CircleDot,
  complete: CheckCircle2,
  deferred: BoxSelect,
  locked: Lock,
}

const STATE_LABEL: Record<ActivationStepState, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
  deferred: 'Skipped',
  locked: 'Locked',
}

const STEP_ICONS: Record<string, LucideIcon> = {
  whatsapp: MessageCircle,
  first_listing: Home,
  portal_credentials: KeyRound,
  working_hours: Clock,
  invite_team: Users,
}

export interface StepCardProps {
  step: ActivationStep
  signupPath: SignupPath
  variant?: 'welcome' | 'compact'
  onPrimary: () => void
  onDefer?: () => void
  onResume?: () => void
  disabled?: boolean
}

function chipStyle(state: ActivationStepState): { className: string } {
  switch (state) {
    case 'in_progress':
      return {
        className:
          'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]',
      }
    case 'complete':
      return {
        className:
          'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]',
      }
    case 'deferred':
      return {
        className: 'bg-transparent text-[var(--lc-text-muted)]',
      }
    case 'locked':
      return {
        className: 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]',
      }
    default:
      return {
        className: 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]',
      }
  }
}

function cardStyle(state: ActivationStepState): string {
  switch (state) {
    case 'in_progress':
      return 'border-2 border-[var(--lc-action-primary)]'
    case 'complete':
      return 'border border-[var(--lc-status-published-fg)]'
    case 'deferred':
      return 'border border-dashed border-[var(--lc-border-strong)]'
    case 'locked':
      return 'border border-dashed border-[var(--lc-border)] opacity-60'
    default:
      return 'border border-[var(--lc-border)]'
  }
}

export function StepCard({
  step,
  signupPath,
  variant = 'welcome',
  onPrimary,
  onDefer,
  onResume,
  disabled = false,
}: StepCardProps) {
  const state = step.state
  const Glyph = STATE_GLYPH[state]
  const copy = STEP_COPY[step.id] ?? {
    title: step.id,
    description: '',
    cta: 'Start',
    resumeCta: 'Resume',
  }

  const isInvite = step.id === 'invite_team'
  const title = isInvite ? inviteTeamTitle(signupPath) : copy.title
  const description = isInvite ? inviteTeamDescription(signupPath) : copy.description
  const StepIcon =
    isInvite && signupPath !== 'agency' ? Lock : STEP_ICONS[step.id] ?? Circle
  const iconClass =
    state === 'complete'
      ? 'text-[var(--lc-status-published-fg)]'
      : 'text-[var(--lc-text-heading)]'

  const lockHelper = stepLockHelper(step, signupPath)
  const captionId = `step-${step.order}-caption`
  const titleId = `step-${step.order}-title`

  let primaryLabel = copy.cta
  if (isInvite && signupPath !== 'agency') {
    primaryLabel = 'Learn about agencies'
  } else if (state === 'in_progress') {
    primaryLabel = `${copy.resumeCta} →`
  } else if (state === 'complete') {
    primaryLabel = 'Open'
  } else if (state === 'deferred') {
    primaryLabel = 'Skipped — resume'
  }

  const showPrimary = state !== 'deferred'
  const showDefer =
    Boolean(onDefer) &&
    (state === 'not_started' || state === 'in_progress') &&
    !(isInvite && signupPath !== 'agency')
  const showResumeLink = state === 'deferred' && Boolean(onResume)

  const caption: ReactNode =
    state === 'complete' ? (
      <p
        id={captionId}
        className="text-[var(--lc-text-muted)]"
        style={{ font: 'var(--lc-type-caption)' }}
      >
        <Numeric>{completedCaption(step.completed_via, step.completed_at)}</Numeric>
      </p>
    ) : lockHelper ? (
      <p
        id={captionId}
        className="text-[var(--lc-text-muted)]"
        style={{ font: 'var(--lc-type-caption)' }}
      >
        {lockHelper}
      </p>
    ) : null

  return (
    <div
      role="region"
      aria-labelledby={titleId}
      aria-describedby={caption ? captionId : undefined}
      data-step-id={step.id}
      data-step-state={state}
      className={cn(
        'flex h-full flex-col rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]',
        cardStyle(state),
        variant === 'compact' && 'p-[var(--lc-space-md)]',
      )}
    >
      <div className="mb-[var(--lc-space-md)] flex items-start justify-between">
        <Badge
          variant="outline"
          className={cn(
            'h-6 w-6 min-h-0 justify-center rounded-[var(--lc-radius-pill)] p-0 font-bold',
            chipStyle(state).className,
          )}
          style={{ font: 'var(--lc-type-caption)', fontWeight: 700 }}
        >
          <Numeric>{step.order}</Numeric>
        </Badge>
        <StepIcon className={cn('h-8 w-8', iconClass)} aria-hidden="true" />
      </div>

      <div className="mb-[var(--lc-space-xs)] flex items-center gap-[var(--lc-space-xs)]">
        <Glyph className="h-4 w-4 shrink-0 text-[var(--lc-text-muted)]" aria-hidden="true" />
        <span className="sr-only">{STATE_LABEL[state]}</span>
      </div>

      <h3
        id={titleId}
        className="mb-[var(--lc-space-xs)] text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-3)' }}
      >
        {title}
      </h3>
      <p
        className="mb-[var(--lc-space-md)] flex-1 text-[var(--lc-text-muted)]"
        style={{ font: 'var(--lc-type-body-sm)' }}
      >
        {description}
      </p>

      {caption}

      <div className="mt-[var(--lc-space-md)] flex flex-col gap-[var(--lc-space-xs)] md:flex-row md:items-center md:justify-end">
        {showPrimary ? (
          <Button
            type="button"
            variant={state === 'locked' || (isInvite && signupPath !== 'agency') ? 'ghost' : 'default'}
            className="w-full md:w-auto"
            disabled={disabled}
            onClick={onPrimary}
          >
            {primaryLabel}
          </Button>
        ) : null}
        {showResumeLink ? (
          <Button
            type="button"
            variant="link"
            className="w-full text-[var(--lc-text-brand)] md:w-auto"
            disabled={disabled}
            onClick={onResume}
          >
            Skipped — resume
          </Button>
        ) : null}
        {showDefer ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-[var(--lc-text-muted)] md:w-auto"
            disabled={disabled}
            onClick={onDefer}
          >
            I&apos;ll do this later
          </Button>
        ) : null}
      </div>
    </div>
  )
}
