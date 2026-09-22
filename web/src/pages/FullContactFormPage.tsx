import { Link } from 'react-router-dom'
import { usePageTitle } from '@/lib/usePageTitle'
import { Button } from '@/components/ui/button'
import { CrmShell } from '@/components/layout/CrmShell'

const DRAFT_KEY = 'wc.addContactDraft.v1'

/**
 * Placeholder for the full CRM contact form (the "Go to full form" destination
 * from the shallow Add Contact dialog). The complete sectioned form — roles,
 * omnichannel phones/emails, address, social, family, qualification, financials,
 * property interests, voice notes — is a dedicated build (tracked separately).
 * Any shallow-form details are preserved in localStorage under DRAFT_KEY so the
 * real form can prefill from them.
 */
export function FullContactFormPage() {
  usePageTitle('New contact — full form')
  let draft: Record<string, unknown> | null = null
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    draft = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
  } catch {
    draft = null
  }

  return (
    <CrmShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-[var(--lc-space-lg)] py-[var(--lc-space-xl)]">
        <div className="flex flex-col gap-2">
          <h1
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
          >
            Full contact form
          </h1>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-lg)' }}>
            The complete CRM record — contact role, omnichannel details, address, social handles,
            personal &amp; family, contact preferences, qualification &amp; financials, and property
            interests — is being built. Your quick-capture details are saved and will carry over.
          </p>
        </div>

        {draft ? (
          <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]">
            <p className="mb-2 text-sm font-semibold text-[var(--lc-text-heading)]">
              Saved from quick capture
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {Object.entries(draft)
                .filter(([, v]) => v !== '' && v != null)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-[var(--lc-text-muted)]">{k.replace(/([A-Z])/g, ' $1')}</dt>
                    <dd className="text-[var(--lc-text-primary)]">{String(v)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        ) : (
          <p className="text-sm text-[var(--lc-text-muted)]">No quick-capture details carried over.</p>
        )}

        <div className="flex gap-2">
          <Link to="/contacts">
            <Button variant="outline">Back to contacts</Button>
          </Link>
          <Link to="/contacts?new=1">
            <Button>Use quick capture</Button>
          </Link>
        </div>
      </div>
    </CrmShell>
  )
}
