/**
 * PA-INS-001 — Inspector queue.
 *
 * Field inspectors (or a PA acting on their behalf) manage their on-site
 * assignments. Starting or opening an assignment routes to the dedicated
 * submit form (PA-INS-002) at `/inspector/:id/submit`.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardList, Loader2, Play } from 'lucide-react'
import { api } from '@/api/client'
import type { InspectorArea, InspectorAssignment } from '@/api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'

export function InspectorPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  usePageTitle('Field inspector')

  const [assignments, setAssignments] = useState<InspectorAssignment[]>([])
  const [areas, setAreas] = useState<Record<string, InspectorArea>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startingId, setStartingId] = useState('')

  const loadAssignments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getInspectorAssignments({ limit: '200' })
      const items = (data as { items?: InspectorAssignment[] }).items || []
      setAssignments(items)

      const areaIds = [...new Set(items.map((a) => a.area_id))]
      const areaMap: Record<string, InspectorArea> = {}
      await Promise.all(
        areaIds.map(async (aid) => {
          try {
            const area = (await api.getAdminArea(aid)) as InspectorArea
            areaMap[aid] = area
          } catch {
            areaMap[aid] = { id: aid, name: 'Unknown area' }
          }
        }),
      )
      setAreas(areaMap)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load assignments'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!agent) return
    void loadAssignments()
  }, [agent, loadAssignments])

  async function startAssignment(id: string) {
    setStartingId(id)
    try {
      await api.startInspectorAssignment(id)
      navigate(`/inspector/${id}/submit`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start assignment'
      addToast({ title: 'Error', description: msg, variant: 'error' })
    } finally {
      setStartingId('')
    }
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center text-sm text-[var(--lc-text-muted)]">
        Please sign in as an inspector to see your assignments.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6" data-testid="inspector-queue-page">
      <div>
        <h1 className="text-xl font-semibold text-[var(--lc-text-primary)]">Field inspector</h1>
        <p className="mt-0.5 text-sm text-[var(--lc-text-muted)]">
          Your on-site assignments. Start one to file findings from the field.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-[var(--lc-action-primary)]" />
            My assignments
          </CardTitle>
          <CardDescription>Assignments are ordered with the most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10" data-testid="inspector-queue-loading">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" />
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-md border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-danger-bg)] px-3 py-2 text-sm text-[var(--lc-status-danger-fg)]"
            >
              {error}
              <Button variant="outline" size="sm" className="ms-3" onClick={() => void loadAssignments()}>
                Try again
              </Button>
            </div>
          ) : assignments.length === 0 ? (
            <p
              className="rounded-md border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-6 text-center text-sm text-[var(--lc-text-muted)]"
              data-testid="inspector-queue-empty"
            >
              You have no inspection assignments yet.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="inspector-queue-list">
              {assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--lc-border)] p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--lc-text-primary)]">
                      {areas[assignment.area_id]?.name || assignment.area_id}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--lc-text-muted)]">
                      <Badge variant="outline" className="capitalize">
                        {assignment.status.replace('_', ' ')}
                      </Badge>
                      <span>Assigned {new Date(assignment.assigned_at).toLocaleDateString()}</span>
                      {assignment.due_at && <span>· Due {new Date(assignment.due_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {assignment.status === 'pending' ? (
                      <Button
                        size="sm"
                        onClick={() => void startAssignment(assignment.id)}
                        disabled={startingId === assignment.id}
                        className="gap-1.5 bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
                      >
                        {startingId === assignment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Start
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild className="gap-1.5">
                        <Link to={`/inspector/${assignment.id}/submit`}>
                          Open
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default InspectorPage
