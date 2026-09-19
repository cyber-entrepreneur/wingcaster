import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Send } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/api/client'
import type { MessageTemplateRow } from '@/lib/messageTemplates/shared'
import { DEFAULT_PREVIEW_VARIABLES, extractTemplateVariables } from '@/lib/messageTemplates/shared'

type Props = {
  template: MessageTemplateRow | null
  open: boolean
  onOpenChange: (next: boolean) => void
  callerEmail: string
}

export function AgentMessageTemplateSendTestDialog({ template, open, onOpenChange, callerEmail }: Props) {
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<
    | { kind: 'ok'; provider: string; provider_message_id: string | null }
    | { kind: 'error'; message: string; code?: string }
    | null
  >(null)

  useEffect(() => {
    if (!open || !template) return
    const names = extractTemplateVariables(template.body, template.subject)
    const seeded: Record<string, string> = {}
    for (const name of names) {
      seeded[name] = DEFAULT_PREVIEW_VARIABLES[name] || `<${name}>`
    }
    setVariables(seeded)
    setResult(null)
    setSending(false)
  }, [open, template])

  const isEmail = template?.channel === 'email'

  const handleSend = async () => {
    if (!template || sending) return
    setSending(true)
    setResult(null)
    try {
      const res = await api.testSendMessageTemplate(template.id, callerEmail, variables)
      setResult({ kind: 'ok', provider: res.provider, provider_message_id: res.provider_message_id })
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string }
      setResult({ kind: 'error', message: e.message || 'Test send failed', code: e.code })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !sending) onOpenChange(false) }}>
      <DialogContent aria-describedby="agent-send-test-desc">
        <DialogHeader>
          <DialogTitle>Send test message</DialogTitle>
          <DialogDescription id="agent-send-test-desc">
            Delivers a one-time test to your own email address so you can verify formatting.
          </DialogDescription>
        </DialogHeader>

        {!isEmail ? (
          <div className="flex items-start gap-2 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-3 text-sm text-[var(--lc-text-muted)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Test send is available for email templates only. Use Preview for WhatsApp and SMS.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="agent-send-test-to" className="text-sm">Recipient</Label>
              <Input id="agent-send-test-to" value={callerEmail} readOnly className="mt-1" />
              <p className="mt-1 text-xs text-[var(--lc-text-muted)]">Locked to your account email for safety.</p>
            </div>

            {Object.keys(variables).length > 0 ? (
              <section aria-labelledby="agent-send-test-vars" className="space-y-2 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-3">
                <h4 id="agent-send-test-vars" className="text-sm font-semibold">Variables</h4>
                {Object.keys(variables).sort().map((name) => (
                  <div key={name}>
                    <Label htmlFor={`agent-send-test-var-${name}`} className="font-mono text-xs">{name}</Label>
                    <Input
                      id={`agent-send-test-var-${name}`}
                      value={variables[name] || ''}
                      onChange={(e) => setVariables((prev) => ({ ...prev, [name]: e.target.value }))}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                ))}
              </section>
            ) : null}

            {result?.kind === 'ok' ? (
              <div className="flex items-center gap-2 text-sm text-[var(--lc-status-success-text)]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Sent via {result.provider}
              </div>
            ) : null}

            {result?.kind === 'error' ? (
              <div className="text-sm text-[var(--lc-status-error-text)]">{result.message}</div>
            ) : null}

            <Button type="button" className="min-h-tap w-full gap-2" disabled={sending} onClick={() => void handleSend()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {sending ? 'Sending…' : 'Send test email'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
