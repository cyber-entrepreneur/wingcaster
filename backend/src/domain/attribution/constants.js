/**
 * Wave 2C — attribution constants (funnel stages + models).
 * Binds to docs/event-taxonomy-catalog.md §4A / §5 and canonical-object-model §H.
 */

export const FUNNEL_STAGES = Object.freeze([
  'impression',
  'click',
  'lead',
  'qualified',
  'viewing',
  'offer',
  'reservation',
  'transaction',
  'commission',
])

/** Business / engagement events that materialise a Conversion. */
export const CONVERSION_EVENT_MAP = Object.freeze({
  'link.clicked': { from_stage: 'impression', to_stage: 'click' },
  'lead.created': { from_stage: 'click', to_stage: 'lead' },
  'lead.qualified': { from_stage: 'lead', to_stage: 'qualified' },
  'viewing.booked': { from_stage: 'qualified', to_stage: 'viewing' },
  'offer.made': { from_stage: 'viewing', to_stage: 'offer' },
  'reservation.created': { from_stage: 'offer', to_stage: 'reservation' },
  'transaction.closed': { from_stage: 'reservation', to_stage: 'transaction' },
  'commission.earned': { from_stage: 'transaction', to_stage: 'commission' },
})

export const ATTRIBUTION_MODELS = Object.freeze([
  'last',
  'first',
  'linear',
  'position',
  'data_driven',
])

/** Launch models that produce credits. data_driven is NOT_CONFIGURED. */
export const LAUNCH_ATTRIBUTION_MODELS = Object.freeze([
  'last',
  'first',
  'linear',
  'position',
])

export const STAGE_TO_ROLLUP_KEY = Object.freeze({
  lead: 'leads',
  qualified: 'qualified',
  viewing: 'viewings',
  offer: 'offers',
  reservation: 'reservations',
  transaction: 'transactions',
  commission: 'commissions',
})

export const SPEND_METRIC_NAMES = Object.freeze(['spend', 'spend_micros', 'cost', 'ad_spend'])
