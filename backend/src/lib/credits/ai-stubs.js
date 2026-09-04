/**
 * Metered AI feature adapters.
 *
 * createAiPost + rateProperty are real producers (see ./ai-producers/).
 * activateLeadGen stays stubbed until its prompt + I/O schema are defined.
 *
 * Each export is wrapped with meterFeature so a missing wrap cannot silently
 * run at zero cost. The opts.work override must keep working for test injection.
 */
import { FEATURES } from './features.js'
import { meterFeature } from './meter.js'
import { produceAiPost } from './ai-producers/create-ai-post.js'
import { produceRateProperty } from './ai-producers/rate-property.js'

export async function rateProperty(opts = {}) {
  return meterFeature(FEATURES.AI_PROPERTY_RATING, opts, async () => {
    if (typeof opts.work === 'function') return opts.work()
    return produceRateProperty(opts)
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
    return produceAiPost(opts)
  })
}
