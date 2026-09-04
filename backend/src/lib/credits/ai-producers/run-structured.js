import { AI_PRODUCER_ERROR, codedError, isParseFailure } from './errors.js'
import { parseWithSchema } from './schemas.js'
import { providerOrder } from './config.js'

/**
 * Try primary then fallback. JSON/schema failure on a provider does NOT retry
 * that provider — it fails over. Both parse-fail → AI_STRUCTURED_OUTPUT_FAILED.
 */
export async function runStructured({
  provider,
  schema,
  normalize,
  callers,
}) {
  const names = providerOrder({ provider })
  const errors = []
  let parseFailures = 0
  let attempts = 0

  for (const name of names) {
    const caller = callers[name]
    if (typeof caller !== 'function') {
      errors.push({ provider: name, error: 'No caller registered' })
      continue
    }
    attempts += 1
    try {
      const result = await caller()
      const parsed = parseWithSchema(schema, result.parsed, { normalize })
      if (!parsed.success) {
        parseFailures += 1
        errors.push({
          provider: name,
          error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          code: AI_PRODUCER_ERROR.AI_PROVIDER_PARSE_FAILED,
        })
        continue
      }
      return { ...result, parsed: parsed.data }
    } catch (err) {
      if (isParseFailure(err)) parseFailures += 1
      errors.push({ provider: name, error: err.message, code: err.code || null })
    }
  }

  const detail = errors.map((e) => `${e.provider} (${e.error})`).join(', ')
  if (attempts > 0 && parseFailures === attempts) {
    throw codedError(
      `Both providers failed to produce structured output: ${detail}`,
      AI_PRODUCER_ERROR.AI_STRUCTURED_OUTPUT_FAILED,
      { errors },
    )
  }
  throw codedError(
    `All AI providers failed: ${detail}`,
    AI_PRODUCER_ERROR.AI_PROVIDERS_UNAVAILABLE,
    { errors },
  )
}
