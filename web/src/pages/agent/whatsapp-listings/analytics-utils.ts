import type { WhatsAppIntakeAnalytics } from '@/api/client'

export interface ActivityBucket {
  label: string
  drafts: number
  approved: number
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

export function bucketActivity(activity: WhatsAppIntakeAnalytics['activity'], maxBuckets = 12): ActivityBucket[] {
  if (!activity.length) return []
  const size = Math.max(1, Math.ceil(activity.length / maxBuckets))
  const buckets: ActivityBucket[] = []
  for (let index = 0; index < activity.length; index += size) {
    const slice = activity.slice(index, index + size)
    const first = slice[0]
    const last = slice[slice.length - 1] ?? first
    buckets.push({
      label: first.date === last.date ? shortDate(first.date) : `${shortDate(first.date)}–${shortDate(last.date)}`,
      drafts: slice.reduce((sum, point) => sum + point.drafts, 0),
      approved: slice.reduce((sum, point) => sum + point.approved, 0),
    })
  }
  return buckets
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function analyticsCsv(data: WhatsAppIntakeAnalytics) {
  const rows: Array<Array<string | number>> = [
    ['Metric', 'Value'],
    ['Period', `${data.range.days} days`],
    ['Drafts', data.summary.total_drafts],
    ['Approved', data.summary.approved],
    ['Approval rate', `${data.summary.approval_rate}%`],
    ['Average approval time (minutes)', data.summary.avg_approval_minutes ?? ''],
    ['Estimated AI cost (USD)', data.summary.ai_cost_estimate_usd],
    [],
    ['Field', 'Model confidence', 'Samples'],
    ...data.field_accuracy.map((field) => [field.label, `${field.accuracy}%`, field.sample_size]),
    [],
    ['Date', 'Drafts', 'Approved'],
    ...data.activity.map((point) => [point.date, point.drafts, point.approved]),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}
