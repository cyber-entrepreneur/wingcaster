import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { usePageTitle } from '@/lib/usePageTitle'
import { ActivationChrome } from './components/ActivationChrome'
import { completedCaption } from './format'
import { useActivationState } from './useActivationState'

export function ActivationWorkingHoursPage() {
  usePageTitle('Working hours')
  const navigate = useNavigate()
  const { state, isLoading, complete, defer, completedCount, totalCount } = useActivationState()
  const [weekdayStart, setWeekdayStart] = useState('09:00')
  const [weekdayEnd, setWeekdayEnd] = useState('18:00')
  const [weekendStart, setWeekendStart] = useState('10:00')
  const [weekendEnd, setWeekendEnd] = useState('14:00')
  const [responseMins, setResponseMins] = useState('15')
  const [saving, setSaving] = useState(false)

  const step = state?.steps.find((s) => s.id === 'working_hours')
  const alreadyComplete = step?.state === 'complete'

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
        breadcrumb={{ step: 4, title: 'Set your working hours' }}
        completed={0}
        total={0}
        progressSize="sm"
        maxWidthClass="max-w-[640px]"
      >
        <div className="h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
      </ActivationChrome>
    )
  }

  return (
    <ActivationChrome
      breadcrumb={{ step: 4, title: 'Set your working hours' }}
      completed={completedCount}
      total={totalCount}
      progressSize="sm"
      maxWidthClass="max-w-[640px]"
    >
      <h1
        className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-1)' }}
      >
        Set your working hours &amp; response time
      </h1>
      <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-lg)' }}>
        Tell leads when to expect a reply so auto-responders never overpromise.
      </p>

      {alreadyComplete ? (
        <>
          <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            <Numeric>{completedCaption(step?.completed_via, step?.completed_at)}</Numeric>. Nothing to do here.
          </p>
          <Button type="button" onClick={() => goBack()}>
            Return to activation wizard →
          </Button>
        </>
      ) : (
        <form
          className="space-y-[var(--lc-space-lg)]"
          onSubmit={async (event) => {
            event.preventDefault()
            setSaving(true)
            try {
              const next = await complete('working_hours', 'dashboard_action', {
                weekday_start: weekdayStart,
                weekday_end: weekdayEnd,
                weekend_start: weekendStart,
                weekend_end: weekendEnd,
                response_minutes: Number(responseMins),
              })
              goBack(next.steps.filter((s) => s.state === 'complete').length)
            } finally {
              setSaving(false)
            }
          }}
        >
          <div className="grid grid-cols-1 gap-[var(--lc-space-md)] sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="weekday-start">Weekdays from</Label>
              <Input
                id="weekday-start"
                type="time"
                value={weekdayStart}
                onChange={(e) => setWeekdayStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weekday-end">Weekdays until</Label>
              <Input id="weekday-end" type="time" value={weekdayEnd} onChange={(e) => setWeekdayEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weekend-start">Weekend from</Label>
              <Input
                id="weekend-start"
                type="time"
                value={weekendStart}
                onChange={(e) => setWeekendStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weekend-end">Weekend until</Label>
              <Input id="weekend-end" type="time" value={weekendEnd} onChange={(e) => setWeekendEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="response-mins">Typical first-reply time (minutes)</Label>
            <Input
              id="response-mins"
              type="number"
              inputMode="numeric"
              min={1}
              max={240}
              value={responseMins}
              onChange={(e) => setResponseMins(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-[var(--lc-space-sm)]">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Mark step complete →'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await defer('working_hours')
                navigate('/activate')
              }}
            >
              I&apos;ll do this later
            </Button>
          </div>
        </form>
      )}
    </ActivationChrome>
  )
}
