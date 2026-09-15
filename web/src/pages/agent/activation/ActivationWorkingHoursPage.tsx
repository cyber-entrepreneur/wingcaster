import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { ActivationChrome } from './components/ActivationChrome'
import { act, type ActivationLocale } from './copy'
import { completedCaption } from './format'
import { useActivationState } from './useActivationState'

export function ActivationWorkingHoursPage() {
  const { locale: rawLocale } = useLocale()
  const locale = (rawLocale === 'ar' ? 'ar' : 'en') as ActivationLocale
  usePageTitle(act('hours.pageTitle', locale))
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
        breadcrumb={{ step: 4, title: act('hours.breadcrumb', locale) }}
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
      breadcrumb={{ step: 4, title: act('hours.breadcrumb', locale) }}
      completed={completedCount}
      total={totalCount}
      progressSize="sm"
      maxWidthClass="max-w-[640px]"
    >
      <h1
        className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-1)' }}
      >
        {act('hours.h1', locale)}
      </h1>
      <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-lg)' }}>
        {act('hours.sub', locale)}
      </p>

      {alreadyComplete ? (
        <>
          <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            <Numeric>{completedCaption(step?.completed_via, step?.completed_at, locale)}</Numeric>.{' '}
            {act('common.nothingTodo', locale)}
          </p>
          <Button type="button" onClick={() => goBack()}>
            {act('common.returnWizard', locale)}
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
              <Label htmlFor="weekday-start">{act('hours.weekdayFrom', locale)}</Label>
              <Input
                id="weekday-start"
                type="time"
                value={weekdayStart}
                onChange={(e) => setWeekdayStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weekday-end">{act('hours.weekdayUntil', locale)}</Label>
              <Input id="weekday-end" type="time" value={weekdayEnd} onChange={(e) => setWeekdayEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weekend-start">{act('hours.weekendFrom', locale)}</Label>
              <Input
                id="weekend-start"
                type="time"
                value={weekendStart}
                onChange={(e) => setWeekendStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weekend-end">{act('hours.weekendUntil', locale)}</Label>
              <Input id="weekend-end" type="time" value={weekendEnd} onChange={(e) => setWeekendEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="response-mins">{act('hours.response', locale)}</Label>
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
              {saving ? act('common.saving', locale) : act('common.markComplete', locale)}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await defer('working_hours')
                navigate('/activate')
              }}
            >
              {act('common.later', locale)}
            </Button>
          </div>
        </form>
      )}
    </ActivationChrome>
  )
}
