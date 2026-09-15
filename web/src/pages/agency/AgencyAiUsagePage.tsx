/**
 * Agency owner/admin dashboard for per-member AI suggestion caps.
 * Labels EN-only until copywriter pass.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, RefreshCw } from 'lucide-react'
import { api } from '@/api/client'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PIIMask } from '@/components/security/PIIMask'
import { HorizontalBarChart } from '@/components/dashboard/HorizontalBarChart'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'

type MemberUsage = {
  user_id: string
  name_masked: string
  daily_cap: number
  today_used: number
  month_used: number
  month_cap: number | null
}

export function AgencyAiUsagePage() {
  usePageTitle('AI usage')
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState<MemberUsage[]>([])
  const [agencyMonthTotal, setAgencyMonthTotal] = useState(0)
  const [editTarget, setEditTarget] = useState<MemberUsage | null>(null)
  const [dailyCapInput, setDailyCapInput] = useState('200')
  const [monthlyCapInput, setMonthlyCapInput] = useState('')
  const [monthlyEnabled, setMonthlyEnabled] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getAgencyAiUsage()
      setMembers(Array.isArray(res?.members) ? res.members : [])
      setAgencyMonthTotal(Number(res?.agency_month_total || 0))
    } catch (err) {
      addToast({
        title: 'Could not load AI usage',
        description: (err as Error)?.message || 'Try again',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    void load()
  }, [load])

  const chartItems = useMemo(
    () =>
      members.map((m) => ({
        id: m.user_id,
        label: m.name_masked || 'Member',
        value: m.month_used,
      })),
    [members],
  )

  const openEdit = (member: MemberUsage) => {
    setEditTarget(member)
    setDailyCapInput(String(member.daily_cap))
    setMonthlyEnabled(member.month_cap != null)
    setMonthlyCapInput(member.month_cap != null ? String(member.month_cap) : '')
  }

  const saveCaps = async () => {
    if (!editTarget) return
    const daily = Number(dailyCapInput)
    if (!Number.isInteger(daily) || daily < 10 || daily > 2000) {
      addToast({
        title: 'Invalid daily cap',
        description: 'Daily cap must be an integer between 10 and 2000.',
        variant: 'error',
      })
      return
    }
    let monthly: number | null = null
    if (monthlyEnabled) {
      monthly = Number(monthlyCapInput)
      if (!Number.isInteger(monthly) || monthly < 1) {
        addToast({
          title: 'Invalid monthly cap',
          description: 'Monthly cap must be a positive integer, or leave it off.',
          variant: 'error',
        })
        return
      }
    }

    setSaving(true)
    try {
      await api.patchAgencyAiCaps(editTarget.user_id, {
        daily_cap: daily,
        monthly_cap: monthly,
      })
      addToast({ title: 'Caps updated', variant: 'success' })
      setEditTarget(null)
      await load()
    } catch (err) {
      addToast({
        title: 'Could not save caps',
        description: (err as Error)?.message || 'Try again',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <CrmShell>
      <CmdPageHeader
        title="AI usage"
        subtitle="Per-member daily suggestion caps and month-to-date totals."
        actions={
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 gap-2"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6">
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--lc-text-muted)]">Agency month total</h2>
          <p className="text-3xl font-semibold tracking-tight">
            <Numeric>{agencyMonthTotal.toLocaleString()}</Numeric> suggestions
          </p>
          <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4">
            <HorizontalBarChart items={chartItems} emptyLabel="No member usage this month" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--lc-text-muted)]">Members</h2>
          {loading ? (
            <div className="flex min-h-11 items-center gap-2 text-sm text-[var(--lc-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading usage…
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]">
              <table className="w-full min-w-[40rem] text-start text-sm">
                <thead className="bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
                  <tr>
                    <th className="px-3 py-3 text-start font-medium">Member</th>
                    <th className="px-3 py-3 text-start font-medium">Daily cap</th>
                    <th className="px-3 py-3 text-start font-medium">Today</th>
                    <th className="px-3 py-3 text-start font-medium">Month to date</th>
                    <th className="px-3 py-3 text-start font-medium">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.user_id} className="border-t border-[var(--lc-border)]">
                      <td className="px-3 py-2">
                        <PIIMask
                          value={member.name_masked}
                          maskedValue={member.name_masked}
                          kind="name"
                          auditContext={{ caseId: member.user_id, field: 'name' }}
                          revealDurationMs={30_000}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Numeric>{member.daily_cap.toLocaleString()}</Numeric>
                      </td>
                      <td className="px-3 py-2">
                        <Numeric>{member.today_used.toLocaleString()}</Numeric>
                      </td>
                      <td className="px-3 py-2">
                        <Numeric>{member.month_used.toLocaleString()}</Numeric>
                        {member.month_cap != null ? (
                          <span className="ms-1 text-[var(--lc-text-muted)]">
                            / <Numeric>{member.month_cap.toLocaleString()}</Numeric>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-11 min-h-11 gap-2"
                          onClick={() => openEdit(member)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[var(--lc-text-muted)]">
                        No agency members yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit AI caps</DialogTitle>
            <DialogDescription>
              Daily caps apply per UTC day. Monthly caps are optional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="block space-y-1.5 text-sm">
              <span className="text-[var(--lc-text-muted)]">Daily cap (10–2000)</span>
              <Input
                type="number"
                min={10}
                max={2000}
                className="h-11 min-h-11"
                value={dailyCapInput}
                onChange={(e) => setDailyCapInput(e.target.value)}
              />
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={monthlyEnabled}
                onChange={(e) => setMonthlyEnabled(e.target.checked)}
              />
              <span>Set a monthly cap</span>
            </label>
            {monthlyEnabled ? (
              <label className="block space-y-1.5 text-sm">
                <span className="text-[var(--lc-text-muted)]">Monthly cap</span>
                <Input
                  type="number"
                  min={1}
                  className="h-11 min-h-11"
                  value={monthlyCapInput}
                  onChange={(e) => setMonthlyCapInput(e.target.value)}
                />
              </label>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              onClick={() => setEditTarget(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 min-h-11"
              onClick={() => void saveCaps()}
              disabled={saving}
            >
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CrmShell>
  )
}
