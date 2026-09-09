import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePageTitle } from '@/lib/usePageTitle'
import {
  fetchAgencyInvitations,
  fetchShareLink,
  recordOnboardingEvent,
  resendInvitation,
  revokeInvitation,
  rotateInvitationCode,
  rotateShareLink,
  sendBulkInvitations,
} from './api'
import { ActivationChrome } from './components/ActivationChrome'
import { completedCaption, parseEmails } from './format'
import type { AgencyInvitation, ShareLinkPayload } from './types'
import { useActivationState } from './useActivationState'

export function ActivationInviteTeamPage() {
  usePageTitle('Invite your team')
  const navigate = useNavigate()
  const { agent } = useAuth()
  const { addToast } = useToast()
  const { state, isLoading, complete, defer, completedCount, totalCount } = useActivationState()
  const [share, setShare] = useState<ShareLinkPayload | null>(null)
  const [invites, setInvites] = useState<AgencyInvitation[]>([])
  const [emails, setEmails] = useState('')
  const [note, setNote] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [rotateOpen, setRotateOpen] = useState<'link' | 'code' | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<AgencyInvitation | null>(null)
  const [sending, setSending] = useState(false)
  const [guarded, setGuarded] = useState(false)

  const step = state?.steps.find((s) => s.id === 'invite_team')
  const alreadyComplete = step?.state === 'complete'
  const agencyName = (agent?.agency_name as string | undefined) || 'your agency'
  const role = String(agent?.role || '').toLowerCase()
  const isOwner = role === 'owner' || role === 'agency_owner' || role === 'admin'

  useEffect(() => {
    if (!state || guarded) return
    if (state.signup_path !== 'agency' || !isOwner) {
      setGuarded(true)
      addToast({
        variant: 'warning',
        description:
          state.signup_path === 'solo'
            ? "You're on a solo workspace. Register an agency to invite a team."
            : 'Team invitations are managed by the agency owner. Ask your agency to add you.',
      })
      navigate('/activate', { replace: true })
    }
  }, [addToast, guarded, isOwner, navigate, state])

  useEffect(() => {
    if (!state || state.signup_path !== 'agency') return
    void fetchShareLink().then(setShare)
    void fetchAgencyInvitations().then(setInvites)
  }, [state])

  useEffect(() => {
    if (!showQr || !share?.url) return
    void QRCode.toDataURL(share.url, { margin: 1, width: 200 }).then(setQrUrl).catch(() => setQrUrl(''))
  }, [share?.url, showQr])

  const parsed = useMemo(() => parseEmails(emails), [emails])
  const sentCount = invites.length
  const canComplete = sentCount > 0 || alreadyComplete

  if (isLoading || !state || guarded || state.signup_path !== 'agency') {
    return (
      <ActivationChrome
        breadcrumb={{ step: 5, title: 'Invite your team' }}
        completed={completedCount}
        total={totalCount}
        progressSize="sm"
        maxWidthClass="max-w-[720px]"
      >
        <div className="h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
      </ActivationChrome>
    )
  }

  return (
    <ActivationChrome
      breadcrumb={{ step: 5, title: 'Invite your team' }}
      completed={completedCount}
      total={totalCount}
      progressSize="sm"
      maxWidthClass="max-w-[720px]"
    >
      <h1
        className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-1)' }}
      >
        Invite your team
      </h1>
      <p className="mb-[var(--lc-space-sm)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-lg)' }}>
        Bring your agents into <strong>{agencyName}</strong>. Pick the fastest method for how your team works.
      </p>
      <span
        className="mb-[var(--lc-space-lg)] inline-flex rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-sm)] py-1 text-[var(--lc-text-muted)]"
        style={{ font: 'var(--lc-type-caption)' }}
      >
        {agencyName}
      </span>

      {alreadyComplete ? (
        <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          You already sent invitations on <Numeric>{completedCaption(step?.completed_via, step?.completed_at)}</Numeric>.
          Nothing to do here.
        </p>
      ) : null}

      <Tabs defaultValue="link">
        <TabsList className="w-full">
          <TabsTrigger value="link">Share link</TabsTrigger>
          <TabsTrigger value="code">Invitation code</TabsTrigger>
          <TabsTrigger value="email">Bulk email</TabsTrigger>
        </TabsList>

        <TabsContent value="link" className="space-y-[var(--lc-space-md)]">
          <h2 style={{ font: 'var(--lc-type-heading-2)' }}>One link, unlimited agents</h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            Share this link anywhere — WhatsApp, email, printed onto onboarding paperwork. Every agent who follows it
            applies to join <strong>{agencyName}</strong>.
          </p>
          <div className="flex gap-[var(--lc-space-sm)]">
            <Input readOnly value={share?.url || ''} aria-label="Share link" />
            <Button
              type="button"
              variant="outline"
              onClick={() => share?.url && navigator.clipboard.writeText(share.url)}
            >
              Copy link
            </Button>
          </div>
          <Button type="button" variant="link" className="text-[var(--lc-text-brand)]" onClick={() => setRotateOpen('link')}>
            Rotate this link
          </Button>
          <Button type="button" variant="ghost" onClick={() => setShowQr((v) => !v)}>
            Show QR code
          </Button>
          {showQr && qrUrl ? (
            <img src={qrUrl} alt="Invitation QR code" className="h-[200px] w-[200px]" />
          ) : null}
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            Link is active until you rotate it or disable it in Settings → Team.
          </p>
        </TabsContent>

        <TabsContent value="code" className="space-y-[var(--lc-space-md)]">
          <h2 style={{ font: 'var(--lc-type-heading-2)' }}>A short code for phone or in-person</h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            Share this code verbally or over a call. Agents enter it during signup.
          </p>
          <Numeric
            as="p"
            className="select-all text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-display)', fontFamily: 'var(--lc-font-mono)', letterSpacing: '0.12em' }}
          >
            {share?.code || '————'}
          </Numeric>
          <div className="flex gap-[var(--lc-space-sm)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => share?.code && navigator.clipboard.writeText(share.code)}
            >
              Copy code
            </Button>
            <Button type="button" variant="link" className="text-[var(--lc-text-brand)]" onClick={() => setRotateOpen('code')}>
              Rotate code
            </Button>
          </div>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            Code is active until you rotate it or disable it in Settings → Team.
          </p>
        </TabsContent>

        <TabsContent value="email" className="space-y-[var(--lc-space-md)]">
          <h2 style={{ font: 'var(--lc-type-heading-2)' }}>Send email invitations</h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            Paste up to <Numeric>50</Numeric> email addresses. Each gets a personalized invitation to join{' '}
            <strong>{agencyName}</strong>.
          </p>
          <div className="space-y-1">
            <Label htmlFor="bulk-emails">Email addresses</Label>
            <textarea
              id="bulk-emails"
              className="min-h-24 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] p-[var(--lc-space-sm)] text-[var(--lc-text-primary)]"
              placeholder="sara@example.com, ali@example.com, layla@example.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
            />
          </div>
          {parsed.invalid.length ? (
            <p role="alert" className="text-[var(--lc-status-unpublished-fg)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Invalid: {parsed.invalid.join(', ')}
            </p>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="bulk-note">Add a personal note (optional)</Label>
            <textarea
              id="bulk-note"
              maxLength={280}
              className="min-h-16 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] p-[var(--lc-space-sm)] text-[var(--lc-text-primary)]"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
            />
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
              <Numeric>{note.length}</Numeric> / <Numeric>280</Numeric>
            </p>
          </div>
          <Button
            type="button"
            disabled={parsed.valid.length === 0 || sending}
            onClick={async () => {
              setSending(true)
              try {
                const result = await sendBulkInvitations(parsed.valid, note)
                addToast({
                  variant: result.failed?.length ? 'warning' : 'success',
                  description: result.failed?.length
                    ? `${result.sent} sent, ${result.failed.length} couldn't be delivered. See details below.`
                    : `${result.sent} invitations sent.`,
                })
                setEmails('')
                setInvites(await fetchAgencyInvitations())
              } catch (err) {
                const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0
                addToast({
                  variant: 'error',
                  description:
                    status === 429
                      ? "You've sent a lot of invitations quickly — please wait a few minutes."
                      : err instanceof Error
                        ? err.message
                        : 'Could not send invitations.',
                })
              } finally {
                setSending(false)
              }
            }}
          >
            Send <Numeric>{parsed.valid.length}</Numeric> invitations →
          </Button>
          <p className="inline-flex items-center gap-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Capability-locked methods stay visible when gated.
          </p>
        </TabsContent>
      </Tabs>

      <section className="mt-[var(--lc-space-xl)]">
        <h3 className="mb-[var(--lc-space-sm)] flex items-center gap-2" style={{ font: 'var(--lc-type-heading-3)' }}>
          Pending invitations{' '}
          <Badge variant="outline">
            <Numeric>{invites.length}</Numeric>
          </Badge>
        </h3>
        {invites.length === 0 ? (
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            No pending invitations yet.
          </p>
        ) : (
          <table className="w-full text-start" style={{ font: 'var(--lc-type-body-sm)' }}>
            <thead>
              <tr className="border-b border-[var(--lc-border)] text-[var(--lc-text-muted)]">
                <th className="py-2 text-start">Email</th>
                <th className="py-2 text-start">Sent</th>
                <th className="py-2 text-start">Status</th>
                <th className="py-2 text-start">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((row) => (
                <tr key={row.id} className="border-b border-[var(--lc-border)]">
                  <td className="py-2">{row.email}</td>
                  <td className="py-2">
                    <Numeric>{row.sent_at ? new Date(row.sent_at).toLocaleDateString() : '—'}</Numeric>
                  </td>
                  <td className="py-2 capitalize">{row.status}</td>
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void resendInvitation(row.id).then(() => addToast({ description: 'Invitation resent.' }))}
                    >
                      Resend
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setRevokeTarget(row)}>
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="mt-[var(--lc-space-xl)] flex flex-col gap-[var(--lc-space-sm)]">
        {alreadyComplete ? (
          <Button type="button" onClick={() => navigate('/activate')}>
            Return to activation wizard →
          </Button>
        ) : (
          <>
            <Button
              type="button"
              disabled={!canComplete}
              onClick={async () => {
                await complete('invite_team', 'dashboard_action', {
                  invitations_sent: sentCount,
                  methods_used: ['share_link'],
                })
                navigate('/channels?source=activation')
              }}
            >
              Mark step complete → Connect channels
            </Button>
            {!canComplete ? (
              <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                Send an invitation first, or defer
              </p>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await defer('invite_team')
                navigate('/activate')
              }}
            >
              I&apos;ll do this later
            </Button>
            <Button
              type="button"
              variant="link"
              className="text-[var(--lc-text-muted)]"
              onClick={async () => {
                await defer('invite_team')
                await recordOnboardingEvent({
                  event: 'activation_defer',
                  family: 'activation',
                  step_id: 'invite_team',
                  reason: 'solo_operation_for_now',
                })
                navigate('/activate')
              }}
            >
              It&apos;s just me for now
            </Button>
          </>
        )}
      </div>

      <Dialog open={Boolean(rotateOpen)} onOpenChange={(open) => !open && setRotateOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rotateOpen === 'code' ? 'Rotate the invitation code?' : 'Rotate the share link?'}</DialogTitle>
            <DialogDescription>
              The previous link stops working. Agents mid-application can still complete.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-lg)] flex justify-end gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" onClick={() => setRotateOpen(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              autoFocus
              onClick={async () => {
                const next = rotateOpen === 'code' ? await rotateInvitationCode() : await rotateShareLink()
                if (next) setShare(next)
                setRotateOpen(null)
                addToast({ variant: 'success', description: 'Rotated.' })
              }}
            >
              Rotate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this invitation?</DialogTitle>
            <DialogDescription>
              {revokeTarget?.email} won&apos;t be able to join with this invitation. You can invite them again later.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-lg)] flex justify-end gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              autoFocus
              onClick={async () => {
                if (!revokeTarget) return
                await revokeInvitation(revokeTarget.id)
                setInvites(await fetchAgencyInvitations())
                setRevokeTarget(null)
              }}
            >
              Revoke
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ActivationChrome>
  )
}
