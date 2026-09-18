export const OPPORTUNITY_STAGES = [
  'new',
  'qualification',
  'viewing',
  'offer',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const

export const OPEN_OPPORTUNITY_STAGES = OPPORTUNITY_STAGES.filter(
  (s) => !['closed_won', 'closed_lost'].includes(s),
)

export const STAGE_STYLE: Record<string, { pill: string; header: string }> = {
  new: { pill: 'border-slate-200 bg-slate-50 text-slate-600', header: 'border-t-slate-300' },
  qualification: { pill: 'border-blue-200 bg-blue-50 text-blue-700', header: 'border-t-blue-400' },
  viewing: { pill: 'border-indigo-200 bg-indigo-50 text-indigo-700', header: 'border-t-indigo-400' },
  offer: { pill: 'border-amber-200 bg-amber-50 text-amber-700', header: 'border-t-amber-400' },
  negotiation: { pill: 'border-orange-200 bg-orange-50 text-orange-700', header: 'border-t-orange-400' },
  closed_won: { pill: 'border-green-200 bg-green-50 text-green-700', header: 'border-t-green-500' },
  closed_lost: { pill: 'border-red-200 bg-red-50 text-red-700', header: 'border-t-red-400' },
}

export function stageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export function opportunityStageIndex(stage: string): number {
  return (OPPORTUNITY_STAGES as readonly string[]).indexOf(stage)
}
