import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Keyboard, Lock } from 'lucide-react'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePageTitle } from '@/lib/usePageTitle'
import { ActivationChrome } from './components/ActivationChrome'
import { completedCaption } from './format'
import { useActivationState } from './useActivationState'

export function ActivationFirstListingPage() {
  usePageTitle('First listing')
  const navigate = useNavigate()
  const { state, isLoading, complete, defer, completedCount, totalCount } = useActivationState()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const listingStep = state?.steps.find((s) => s.id === 'first_listing')
  const whatsappStep = state?.steps.find((s) => s.id === 'whatsapp')
  const alreadyComplete = listingStep?.state === 'complete'
  const whatsappBound = whatsappStep?.state === 'complete'

  const goBack = (nextCompleted?: number) => {
    const total = totalCount
    const prev = completedCount
    const done = nextCompleted ?? completedCount
    const celebrate = total > 0 && prev === total - 1 && done === total
    navigate(celebrate ? '/activate?celebrate=1' : '/activate')
  }

  if (isLoading || !state) {
    return (
      <ActivationChrome
        breadcrumb={{ step: 2, title: 'Publish your first listing' }}
        completed={0}
        total={0}
        progressSize="sm"
        maxWidthClass="max-w-[720px]"
      >
        <div className="h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
      </ActivationChrome>
    )
  }

  return (
    <ActivationChrome
      breadcrumb={{ step: 2, title: 'Publish your first listing' }}
      completed={completedCount}
      total={totalCount}
      progressSize="sm"
      maxWidthClass="max-w-[720px]"
    >
      {alreadyComplete ? (
        <>
          <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            You already published your first listing on{' '}
            <Numeric>{completedCaption(listingStep?.completed_via, listingStep?.completed_at)}</Numeric>
            {listingStep?.completed_via ? (
              <>
                {' '}
                — via <Numeric>{String(listingStep.completed_via).replace(/_/g, ' ')}</Numeric>
              </>
            ) : null}
            . Nothing to do here.
          </p>
          <div className="flex flex-col gap-[var(--lc-space-sm)] sm:flex-row">
            <Button type="button" onClick={() => goBack()}>
              Return to activation wizard →
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link to="/listings">See your listings →</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <h1
            className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-1)' }}
          >
            How do you want to create your first listing?
          </h1>
          <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-lg)' }}>
            Either path counts. You can always use the other one later.
          </p>

          <div className="grid grid-cols-1 gap-[var(--lc-space-lg)] sm:grid-cols-2">
            <div className="flex flex-col rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]">
              <Keyboard className="mb-[var(--lc-space-md)] h-10 w-10 text-[var(--lc-text-heading)]" aria-hidden="true" />
              <h2 className="mb-[var(--lc-space-xs)] text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
                Type it out
              </h2>
              <p className="mb-[var(--lc-space-sm)] flex-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                Fill in the classic listing form — property type, price, beds, baths, photos. Best if you&apos;re at your
                desk.
              </p>
              <p className="mb-[var(--lc-space-md)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                ~<Numeric>5</Numeric> minutes
              </p>
              <Button type="button" onClick={() => navigate('/listings/new?source=activation')}>
                Open the composer →
              </Button>
            </div>

            <div
              className={
                whatsappBound
                  ? 'flex flex-col rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]'
                  : 'flex flex-col rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] opacity-60 shadow-[var(--lc-elevation-sm)]'
              }
              data-voice-locked={!whatsappBound ? 'true' : undefined}
            >
              {whatsappBound ? (
                <ChannelMark channel="whatsapp" className="mb-[var(--lc-space-md)] h-10 w-10" />
              ) : (
                <Lock className="mb-[var(--lc-space-md)] h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
              )}
              <h2 className="mb-[var(--lc-space-xs)] text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
                Dictate it via WhatsApp
              </h2>
              <p className="mb-[var(--lc-space-sm)] flex-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                Send a voice note to your bound WhatsApp — WingCaster transcribes and drafts the listing. Best if
                you&apos;re on-site or in the car.
              </p>
              <p className="mb-[var(--lc-space-md)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                ~<Numeric>90</Numeric> seconds
              </p>
              {whatsappBound ? (
                <Button
                  type="button"
                  onClick={() => navigate('/whatsapp/onboarding/voice-intake?source=activation')}
                >
                  Send a voice note →
                </Button>
              ) : (
                <p style={{ font: 'var(--lc-type-caption)' }} className="text-[var(--lc-text-muted)]">
                  Connect WhatsApp first —{' '}
                  <Link to="/activate/whatsapp" className="text-[var(--lc-text-brand)] hover:underline">
                    go to Step 1 →
                  </Link>
                </p>
              )}
            </div>
          </div>

          <div className="mt-[var(--lc-space-xl)] space-y-[var(--lc-space-sm)]">
            <button
              type="button"
              className="min-h-tap text-start text-[var(--lc-text-muted)] hover:text-[var(--lc-text-brand)]"
              style={{ font: 'var(--lc-type-caption)' }}
              onClick={() => setConfirmOpen(true)}
            >
              Already published a listing elsewhere?{' '}
              <span className="text-[var(--lc-text-brand)]">Mark this step complete →</span>
            </button>
            <div>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await defer('first_listing')
                  navigate('/activate')
                }}
              >
                I&apos;ll do this later
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark first listing as complete?</DialogTitle>
            <DialogDescription>
              You&apos;re telling us your first listing already exists. This will mark Step 2 complete.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-lg)] flex flex-col-reverse gap-[var(--lc-space-sm)] sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              autoFocus
              onClick={async () => {
                const next = await complete('first_listing', 'direct')
                const done = next.steps.filter((s) => s.state === 'complete').length
                setConfirmOpen(false)
                goBack(done)
              }}
            >
              Yes, mark complete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ActivationChrome>
  )
}
