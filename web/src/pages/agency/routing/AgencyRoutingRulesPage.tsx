/**
 * AGN-ROU-001 support surface — routing rules index (entry to AGN-ROU-002 editor).
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, GitBranch, Loader2, Plus } from 'lucide-react'
import { api, type AgencyRoutingRule } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

export function AgencyRoutingRulesPage() {
  const navigate = useNavigate()
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle('Routing rules')

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [rules, setRules] = useState<AgencyRoutingRule[]>([])

  const role = (agent?.affiliation as { role?: string } | undefined)?.role
  const isAdmin = role === 'owner' || role === 'admin'

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const res = await api.listAgencyRoutingRules()
      setRules(res.rules)
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        setLoadState('forbidden')
        return
      }
      setLoadState('error')
      addToast({ title: 'Could not load routing rules', description: (err as Error).message, variant: 'error' })
    }
  }, [addToast, isAdmin])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-screen="AGN-ROU-001" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" />
      </div>
    )
  }

  if (!agent || loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-screen="AGN-ROU-001" dir={dir}>
        <AlertTriangle className="mx-auto h-12 w-12 text-[var(--lc-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-[var(--lc-text-muted)]">Only agency owners and admins can manage routing rules.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)]" data-screen="AGN-ROU-001" dir={dir}>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link to="/agency" className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]">
              <ArrowLeft className="h-4 w-4" />
              Agency
            </Link>
            <h1 className="text-3xl font-bold text-[var(--lc-text-heading)]">Routing rules</h1>
            <p className="text-[var(--lc-text-muted)]">First matching rule wins. Default fallback applies when no rule matches.</p>
          </div>
          <Button className="gap-2" onClick={() => navigate('/agency/routing/rules/new')}>
            <Plus className="h-4 w-4" />
            Add rule
          </Button>
        </header>

        {loadState === 'error' && (
          <Card><CardContent className="py-8 text-center text-[var(--lc-text-muted)]">Could not load rules.</CardContent></Card>
        )}

        {loadState === 'ready' && rules.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <GitBranch className="h-10 w-10 text-[var(--lc-text-muted)]" />
              <p className="text-[var(--lc-text-muted)]">No routing rules yet. Add your first rule to assign leads automatically.</p>
              <Button onClick={() => navigate('/agency/routing/rules/new')}>Add rule</Button>
            </CardContent>
          </Card>
        )}

        {rules.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-[var(--lc-border)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">Priority</th>
                  <th className="px-4 py-3 text-start font-medium">Name</th>
                  <th className="px-4 py-3 text-start font-medium">Trigger</th>
                  <th className="px-4 py-3 text-start font-medium">Target</th>
                  <th className="px-4 py-3 text-start font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-t border-[var(--lc-border)] hover:bg-[var(--lc-surface-sunken)]">
                    <td className="px-4 py-3"><Numeric>{rule.priority}</Numeric></td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-medium text-[var(--lc-text-brand)] hover:underline"
                        onClick={() => navigate(`/agency/routing/rules/${rule.id}`)}
                      >
                        {rule.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 capitalize">{rule.trigger.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 capitalize">{rule.strategy.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">{rule.enabled ? 'Active' : 'Disabled'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
