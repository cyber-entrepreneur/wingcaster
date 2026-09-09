// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepCard } from './StepCard'
import { makeStep } from '../testFixtures'

describe('StepCard state variants', () => {
  it('renders not_started with circle glyph and Start CTA', () => {
    render(
      <StepCard
        step={makeStep({ id: 'whatsapp', order: 1, state: 'not_started', sub_route: '/activate/whatsapp' })}
        signupPath="solo"
        onPrimary={vi.fn()}
        onDefer={vi.fn()}
      />,
    )
    const card = screen.getByRole('region', { name: 'Connect WhatsApp' })
    expect(card).toHaveAttribute('data-step-state', 'not_started')
    expect(screen.getByText('Not started')).toHaveClass('sr-only')
    expect(screen.getByRole('button', { name: 'Start with WhatsApp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /I'll do this later/i })).toBeInTheDocument()
  })

  it('renders in_progress with Resume CTA and primary border treatment', () => {
    render(
      <StepCard
        step={makeStep({ id: 'portal_credentials', order: 3, state: 'in_progress', sub_route: '/activate/portal-credentials' })}
        signupPath="solo"
        onPrimary={vi.fn()}
        onDefer={vi.fn()}
      />,
    )
    expect(screen.getByRole('region', { name: 'Add your portal credentials' })).toHaveAttribute(
      'data-step-state',
      'in_progress',
    )
    expect(screen.getByText('In progress')).toHaveClass('sr-only')
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument()
  })

  it('renders complete with subdued Completed via caption (no surveillance banner)', () => {
    render(
      <StepCard
        step={makeStep({
          id: 'whatsapp',
          order: 1,
          state: 'complete',
          completed_via: 'onboarding',
          completed_at: '2026-09-01T14:22:00Z',
          sub_route: '/activate/whatsapp',
        })}
        signupPath="solo"
        onPrimary={vi.fn()}
      />,
    )
    expect(screen.getByRole('region', { name: 'Connect WhatsApp' })).toHaveAttribute('data-step-state', 'complete')
    expect(screen.getByText('Complete')).toHaveClass('sr-only')
    expect(screen.getByText(/Completed via onboarding/i)).toBeInTheDocument()
    expect(screen.queryByText(/we saw you already/i)).not.toBeInTheDocument()
  })

  it('renders skipped with resume link', async () => {
    const onResume = vi.fn()
    const user = userEvent.setup()
    render(
      <StepCard
        step={makeStep({ id: 'working_hours', order: 4, state: 'deferred', sub_route: '/activate/working-hours' })}
        signupPath="solo"
        onPrimary={vi.fn()}
        onResume={onResume}
      />,
    )
    expect(screen.getByRole('region', { name: /working hours/i })).toHaveAttribute('data-step-state', 'deferred')
    expect(screen.getByText('Skipped')).toHaveClass('sr-only')
    await user.click(screen.getByRole('button', { name: /Skipped — resume/i }))
    expect(onResume).toHaveBeenCalled()
  })

  it('renders locked with helper copy and does not use a primary Start CTA', () => {
    render(
      <StepCard
        step={makeStep({
          id: 'invite_team',
          order: 5,
          state: 'locked',
          lock_reason: 'solo_signup_path',
          sub_route: '/activate/invite-team',
        })}
        signupPath="solo"
        onPrimary={vi.fn()}
      />,
    )
    const card = screen.getByRole('region', { name: /Grow into an agency/i })
    expect(card).toHaveAttribute('data-step-state', 'locked')
    expect(screen.getByText('Locked')).toHaveClass('sr-only')
    expect(screen.getByText(/Available if you register an agency later/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Learn about agencies/i })).toBeInTheDocument()
  })
})
