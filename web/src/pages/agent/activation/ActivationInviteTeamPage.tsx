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
import { PIIMask } from '@/components/security'
import { useLocale } from '@/hooks/useLocale'
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
import { act, type ActivationLocale } from './copy'
import { completedCaption, parseEmails } from './format'
import type { AgencyInvitation, ShareLinkPayload } from './types'
import { useActivationState } from './useActivationState'

type InviteMethodTab = 'link' | 'code' | 'email'

const METHOD_USED: Record<InviteMethodTab, string> = {
  link: 'share_link',
  code: 'invitation_code',
  email: 'bulk_email',
}

export function ActivationInviteTeamPage() {
  const { locale: rawLocale } = useLocale()
  const locale = (rawLocale === 'ar' ? 'ar' : 'en') as ActivationLocale
  usePageTitle(act('invite.pageTitle', locale))
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
  const [activeTab, setActiveTab] = useState<InviteMethodTab>('link')
  const [methodsUsed, setMethodsUsed] = useState<Set<string>>(() => new Set(['share_link']))

  const step = state?.steps.find((s) => s.id === 'invite_team')
  const alreadyComplete = step?.state === 'complete'
  const agencyName = (agent?.agency_name as string | undefined) || (locale === 'ar' ? 'وكالتك' : 'your agency')
  const role = String(agent?.role || '').toLowerCase()
  const isOwner = role === 'owner' || role === 'agency_owner' || role === 'admin'
  const caseId = String(agent?.id || state?.user_id || 'activation-invite')

  useEffect(() => {
    if (!state || guarded) return
    if (state.signup_path !== 'agency' || !isOwner) {
      setGuarded(true)
      addToast({
        variant: 'warning',
        description:
          state.signup_path === 'solo' ? act('invite.guard.solo', locale) : act('invite.guard.join', locale),
      })
      navigate('/activate', { replace: true })
    }
  }, [addToast, guarded, isOwner, locale, navigate, state])

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

  const markMethod = (tab: InviteMethodTab) => {
    setActiveTab(tab)
    setMethodsUsed((prev) => new Set(prev).add(METHOD_USED[tab]))
  }

  if (isLoading || !state || guarded || state.signup_path !== 'agency') {
    return (
      <ActivationChrome
        breadcrumb={{ step: 5, title: act('invite.breadcrumb', locale) }}
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
      breadcrumb={{ step: 5, title: act('invite.breadcrumb', locale) }}
      completed={completedCount}
      total={totalCount}
      progressSize="sm"
      maxWidthClass="max-w-[720px]"
    >
      <h1
        className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-1)' }}
      >
        {act('invite.h1', locale)}
      </h1>
      <p className="mb-[var(--lc-space-sm)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-lg)' }}>
        {act('invite.sub', locale, { agency: agencyName })}
      </p>
      <span
        className="mb-[var(--lc-space-lg)] inline-flex rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-sm)] py-1 text-[var(--lc-text-muted)]"
        style={{ font: 'var(--lc-type-caption)' }}
      >
        {agencyName}
      </span>

      {alreadyComplete ? (
        <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          {act('invite.already', locale, {
            when: completedCaption(step?.completed_via, step?.completed_at, locale),
          })}
        </p>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => markMethod(value as InviteMethodTab)}
      >
        <TabsList className="w-full">
          <TabsTrigger value="link">{act('invite.tab.link', locale)}</TabsTrigger>
          <TabsTrigger value="code">{act('invite.tab.code', locale)}</TabsTrigger>
          <TabsTrigger value="email">{act('invite.tab.email', locale)}</TabsTrigger>
        </TabsList>

        <TabsContent value="link" className="space-y-[var(--lc-space-md)]">
          <h2 style={{ font: 'var(--lc-type-heading-2)' }}>{act('invite.link.h2', locale)}</h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            {act('invite.link.sub', locale, { agency: agencyName })}
          </p>
          <div className="flex gap-[var(--lc-space-sm)]">
            <Input readOnly value={share?.url || ''} aria-label={act('invite.link.aria', locale)} />
            <Button
              type="button"
              variant="outline"
              onClick={() => share?.url && navigator.clipboard.writeText(share.url)}
            >
              {act('invite.link.copy', locale)}
            </Button>
          </div>
          <Button type="button" variant="link" className="text-[var(--lc-text-brand)]" onClick={() => setRotateOpen('link')}>
            {act('invite.link.rotate', locale)}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setShowQr((v) => !v)}>
            {act('invite.link.qr', locale)}
          </Button>
          {showQr && qrUrl ? (
            <img src={qrUrl} alt={act('invite.link.qrAlt', locale)} className="h-[200px] w-[200px]" />
          ) : null}
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {act('invite.link.expiry', locale)}
          </p>
        </TabsContent>

        <TabsContent value="code" className="space-y-[var(--lc-space-md)]">
          <h2 style={{ font: 'var(--lc-type-heading-2)' }}>{act('invite.code.h2', locale)}</h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            {act('invite.code.sub', locale)}
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
              {act('invite.code.copy', locale)}
            </Button>
            <Button type="button" variant="link" className="text-[var(--lc-text-brand)]" onClick={() => setRotateOpen('code')}>
              {act('invite.code.rotate', locale)}
            </Button>
          </div>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {act('invite.code.expiry', locale)}
          </p>
        </TabsContent>

        <TabsContent value="email" className="space-y-[var(--lc-space-md)]">
          <h2 style={{ font: 'var(--lc-type-heading-2)' }}>{act('invite.email.h2', locale)}</h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            {act('invite.email.sub', locale, { n: 50, agency: agencyName })}
          </p>
          <div className="space-y-1">
            <Label htmlFor="bulk-emails">{act('invite.email.label', locale)}</Label>
            <textarea
              id="bulk-emails"
              className="min-h-24 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] p-[var(--lc-space-sm)] text-[var(--lc-text-primary)]"
              placeholder={act('invite.email.placeholder', locale)}
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
            />
          </div>
          {parsed.invalid.length ? (
            <p role="alert" className="text-[var(--lc-status-unpublished-fg)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              {act('invite.email.invalid', locale, { list: parsed.invalid.join(', ') })}
            </p>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="bulk-note">{act('invite.email.note', locale)}</Label>
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
              markMethod('email')
              try {
                const result = await sendBulkInvitations(parsed.valid, note)
                addToast({
                  variant: result.failed?.length ? 'warning' : 'success',
                  description: result.failed?.length
                    ? act('invite.email.partial', locale, {
                        sent: result.sent,
                        failed: result.failed.length,
                      })
                    : act('invite.email.success', locale, { n: result.sent }),
                })
                setEmails('')
                setInvites(await fetchAgencyInvitations())
              } catch (err) {
                const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0
                addToast({
                  variant: 'error',
                  description:
                    status === 429
                      ? act('invite.email.rate', locale)
                      : err instanceof Error
                        ? err.message
                        : act('invite.email.sendError', locale),
                })
              } finally {
                setSending(false)
              }
            }}
          >
            {locale === 'ar' ? (
              <>
                أرسل <Numeric>{parsed.valid.length}</Numeric> دعوات ←
              </>
            ) : (
              <>
                Send <Numeric>{parsed.valid.length}</Numeric> invitations →
              </>
            )}
          </Button>
          <p className="inline-flex items-center gap-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            <Lock className="h-3.5 w-3.5" aria-hidden="true" /> {act('invite.email.capability', locale)}
          </p>
        </TabsContent>
      </Tabs>

      <section className="mt-[var(--lc-space-xl)]">
        <h3 className="mb-[var(--lc-space-sm)] flex items-center gap-2" style={{ font: 'var(--lc-type-heading-3)' }}>
          {act('invite.pending.h3', locale)}{' '}
          <Badge variant="outline">
            <Numeric>{invites.length}</Numeric>
          </Badge>
        </h3>
        {invites.length === 0 ? (
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            {act('invite.pending.empty', locale)}
          </p>
        ) : (
          <table className="w-full text-start" style={{ font: 'var(--lc-type-body-sm)' }}>
            <thead>
              <tr className="border-b border-[var(--lc-border)] text-[var(--lc-text-muted)]">
                <th className="py-2 text-start">{act('invite.pending.email', locale)}</th>
                <th className="py-2 text-start">{act('invite.pending.sent', locale)}</th>
                <th className="py-2 text-start">{act('invite.pending.status', locale)}</th>
                <th className="py-2 text-start">{act('invite.pending.actions', locale)}</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--lc-border)]"
                  data-testid="pending-invite-row"
                >
                  <td className="py-2">
                    <PIIMask
                      kind="email"
                      value={row.email}
auditContext={{ caseId, field: 'invitee_email' }}
                      onReveal={async (ctx) => {
                        await recordOnboardingEvent({
                          event: 'pii_reveal',
                          step_id: 'invite_team',
                          metadata: { caseId: ctx.caseId, field: ctx.field, kind: ctx.kind },
                        })
                      }}
                    />
                  </td>
                  <td className="py-2">
                    <Numeric>{row.sent_at ? new Date(row.sent_at).toLocaleDateString() : '—'}</Numeric>
                  </td>
                  <td className="py-2 capitalize">{row.status}</td>
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        void resendInvitation(row.id).then(() =>
                          addToast({ description: act('invite.pending.resent', locale) }),
                        )
                      }
                    >
                      {act('invite.pending.resend', locale)}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setRevokeTarget(row)}>
                      {act('invite.pending.revoke', locale)}
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
            {act('common.returnWizard', locale)}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              disabled={!canComplete}
              onClick={async () => {
                const used = Array.from(methodsUsed)
                if (!used.includes(METHOD_USED[activeTab])) {
                  used.push(METHOD_USED[activeTab])
                }
                const celebrate = totalCount > 0 && completedCount === totalCount - 1
                await complete('invite_team', 'dashboard_action', {
                  invitations_sent: sentCount,
                  methods_used: used,
                })
                navigate(
                  celebrate
                    ? '/channels?source=activation&celebrate=1'
                    : '/channels?source=activation',
                )
              }}
            >
              {act('invite.completeCta', locale)}
            </Button>
            {!canComplete ? (
              <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                {act('invite.completeHelper', locale)}
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
              {act('common.later', locale)}
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
              {act('invite.tertiary', locale)}
            </Button>
          </>
        )}
      </div>

      <Dialog open={Boolean(rotateOpen)} onOpenChange={(open) => !open && setRotateOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rotateOpen === 'code'
                ? act('invite.rotateCodeTitle', locale)
                : act('invite.rotateLinkTitle', locale)}
            </DialogTitle>
            <DialogDescription>{act('invite.rotateBody', locale)}</DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-lg)] flex justify-end gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" onClick={() => setRotateOpen(null)}>
              {act('common.cancel', locale)}
            </Button>
            <Button
              type="button"
              autoFocus
              onClick={async () => {
                const next = rotateOpen === 'code' ? await rotateInvitationCode() : await rotateShareLink()
                if (next) setShare(next)
                setRotateOpen(null)
                addToast({ variant: 'success', description: act('invite.rotated', locale) })
              }}
            >
              {act('invite.rotateConfirm', locale)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{act('invite.revokeTitle', locale)}</DialogTitle>
            <DialogDescription>
              {act('invite.revokeBody', locale, { email: revokeTarget?.email || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-lg)] flex justify-end gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" onClick={() => setRevokeTarget(null)}>
              {act('common.cancel', locale)}
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
              {act('invite.pending.revoke', locale)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ActivationChrome>
  )
}
