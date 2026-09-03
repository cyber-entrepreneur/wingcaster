/**
 * Stubs for metered AI features that have no production producer yet.
 * Each export is wrapped with withCredits so a missing wrap cannot silently
 * run at zero cost once a caller is added.
 */
import { FEATURES } from './features.js'
import { meterFeature } from './meter.js'

export async function rateProperty(opts = {}) {
  return meterFeature(FEATURES.AI_PROPERTY_RATING, opts, async () => {
    if (typeof opts.work === 'function') return opts.work()
    const err = new Error('Property rating adapter is not implemented')
    err.code = 'NOT_IMPLEMENTED'
    throw err
  })
}

export async function activateLeadGen(opts = {}) {
  return meterFeature(FEATURES.AI_LEAD_GEN_ACTIVATION, opts, async () => {
    if (typeof opts.work === 'function') return opts.work()
    const err = new Error('Lead-gen activation adapter is not implemented')
    err.code = 'NOT_IMPLEMENTED'
    throw err
  })
}

export async function createAiPost(opts = {}) {
  return meterFeature(FEATURES.AI_POST_CREATION, opts, async () => {
    if (typeof opts.work === 'function') return opts.work()
    const err = new Error('AI post creation adapter is not implemented')
    err.code = 'NOT_IMPLEMENTED'
    throw err
  })
}
