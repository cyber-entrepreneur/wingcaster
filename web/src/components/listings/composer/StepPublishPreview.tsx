import { useState } from 'react'
import { ChannelMark } from '@/components/ui/channel-mark'
import { ListingPreviewCard } from '@/components/onboarding/whatsapp/ListingPreviewCard'
import { Numeric } from '@/components/ui/numeric'
import { resolveLcChannel } from '@/theme/channel'
import { cn } from '@/lib/utils'
import {
  runPortalValidators,
  type ComposerFormState,
  type ComposerStep,
  type PortalValidatorIssue,
} from './types'

const SURFACES = [
  'Agent profile',
  'Agency profile',
  'White-label',
  'Bazaar',
  'Bayut',
  'Property Finder',
  'Dubizzle',
  'OLX',
  'Aqar',
  'Blue Door',
] as const

export interface StepPublishPreviewProps {
  form: ComposerFormState
  isAgency?: boolean
  onJumpToStep: (step: ComposerStep) => void
}

export function StepPublishPreview({
  form,
  isAgency = false,
  onJumpToStep,
}: StepPublishPreviewProps) {
  const surfaces = isAgency
    ? SURFACES
    : SURFACES.filter((s) => s !== 'Agency profile' && s !== 'White-label')
  const [surface, setSurface] = useState<(typeof SURFACES)[number]>('Agent profile')
  const issues = runPortalValidators(form)
  const blockers = issues.filter((i) => i.severity === 'block')
  const warnings = issues.filter((i) => i.severity === 'warn')

  const byPortal = new Map<string, PortalValidatorIssue[]>()
  for (const issue of issues) {
    const list = byPortal.get(issue.portal) || []
    list.push(issue)
    byPortal.set(issue.portal, list)
  }

  const price = Number(form.price) || 0

  return (
    <div className="space-y-[var(--lc-space-xl)]">
      {blockers.length > 0 && (
        <div
          role="alert"
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-status-unpublished-fg)] bg-[var(--lc-status-unpublished-bg)] px-3 py-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-unpublished-fg)]"
        >
          Fix <Numeric>{blockers.length}</Numeric> blocking issue
          {blockers.length === 1 ? '' : 's'} to publish.
        </div>
      )}
      {blockers.length === 0 && warnings.length > 0 && (
        <div
          role="status"
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-status-underOffer-fg)] bg-[var(--lc-status-underOffer-bg)] px-3 py-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-underOffer-fg)]"
        >
          This will publish with <Numeric>{warnings.length}</Numeric> warning
          {warnings.length === 1 ? '' : 's'}. Buyers on some portals may not see it.
        </div>
      )}

      <div>
        <p className="mb-2 text-[length:var(--lc-type-overline)] tracking-[0.08em] text-[var(--lc-text-muted)]">
          Preview as
        </p>
        <div
          role="group"
          aria-label="Preview surface"
          className="flex flex-wrap gap-1.5"
        >
          {surfaces.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={surface === s}
              onClick={() => setSurface(s)}
              className={cn(
                'min-h-10 rounded-[var(--lc-radius-pill)] px-3 text-[length:var(--lc-type-caption)]',
                surface === s
                  ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                  : 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <ListingPreviewCard
        variant="preview"
        listing={{
          id: 'preview',
          address:
            [form.address, form.location || form.neighborhood, form.country]
              .filter(Boolean)
              .join(', ') || 'Add address',
          photos: form.photos.map((p) => p.url).filter(Boolean),
          bedrooms: Number(form.bedrooms) || 0,
          bathrooms: Number(form.bathrooms) || 0,
          area: Number(form.area) || undefined,
          areaUnit: form.area_unit,
          price: price || undefined,
          currency: form.currency,
          description: form.description,
          status: 'draft',
        }}
      />

      <div>
        <h3 className="mb-3 font-semibold text-[var(--lc-text-heading)]">Portal checks</h3>
        <ul className="space-y-2">
          {['Bayut', 'Property Finder', 'Dubizzle', 'OLX', 'Aqar'].map((portal) => {
            const portalIssues = byPortal.get(portal) || []
            const channelKey = portal.toLowerCase().replace(/\s+/g, '_')
            const resolved = resolveLcChannel(
              channelKey === 'olx' ? 'olx' : channelKey === 'bayut' ? '' : '',
            )
            const ok = portalIssues.length === 0
            return (
              <li
                key={portal}
                className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]"
              >
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3">
                    {resolved ? (
                      <ChannelMark channel={resolved} />
                    ) : (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--lc-radius-sm)] bg-[var(--lc-surface-sunken)] text-[10px] font-semibold uppercase text-[var(--lc-text-muted)]">
                        {portal.slice(0, 2)}
                      </span>
                    )}
                    <span className="flex-1 font-medium">{portal}</span>
                    <span
                      className={cn(
                        'text-[length:var(--lc-type-caption)]',
                        ok
                          ? 'text-[var(--lc-status-published-fg)]'
                          : 'text-[var(--lc-status-underOffer-fg)]',
                      )}
                    >
                      {ok
                        ? `All checks passed for ${portal}.`
                        : `${portalIssues.length} issue${portalIssues.length === 1 ? '' : 's'}`}
                    </span>
                  </summary>
                  {portalIssues.length > 0 && (
                    <ul className="space-y-2 border-t border-[var(--lc-border)] px-3 py-3">
                      {portalIssues.map((issue, i) => (
                        <li key={`${issue.message}-${i}`} className="text-[length:var(--lc-type-body-sm)]">
                          <p
                            className={
                              issue.severity === 'block'
                                ? 'text-[var(--lc-status-unpublished-fg)]'
                                : 'text-[var(--lc-status-underOffer-fg)]'
                            }
                          >
                            {portal} may reject or hide this listing — {issue.message}
                          </p>
                          <button
                            type="button"
                            className="mt-1 text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
                            onClick={() => onJumpToStep(issue.fixStep)}
                          >
                            Fix in Step {issue.fixStep} →
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export function hasBlockingIssues(form: ComposerFormState): boolean {
  return runPortalValidators(form).some((i) => i.severity === 'block')
}
