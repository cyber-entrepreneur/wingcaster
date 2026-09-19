import { z } from 'zod'

const uuid = z.string().uuid()

export const runReconciliationBodySchema = z.object({
  scope_kind: z.enum(['platform', 'tenant', 'check']),
  tenant_id: uuid.optional(),
  check_code: z.string().min(1).max(16).optional(),
  reason_code: z.string().min(1).max(64).optional(),
}).strict().superRefine((data, ctx) => {
  if (data.scope_kind === 'tenant' && !data.tenant_id) {
    ctx.addIssue({ code: 'custom', message: 'tenant_id required for tenant scope', path: ['tenant_id'] })
  }
  if (data.scope_kind === 'check' && !data.check_code) {
    ctx.addIssue({ code: 'custom', message: 'check_code required for check scope', path: ['check_code'] })
  }
})

export function scopeFromRunBody(body) {
  if (body.scope_kind === 'tenant') return `tenant:${body.tenant_id}`
  if (body.scope_kind === 'check') return `check:${body.check_code}`
  return 'platform'
}
