export const AI_PRODUCER_ERROR = {
  LANGUAGE_NOT_YET_SUPPORTED: 'LANGUAGE_NOT_YET_SUPPORTED',
  AI_STRUCTURED_OUTPUT_FAILED: 'AI_STRUCTURED_OUTPUT_FAILED',
  AI_PROVIDERS_UNAVAILABLE: 'AI_PROVIDERS_UNAVAILABLE',
  AI_PROVIDER_PARSE_FAILED: 'AI_PROVIDER_PARSE_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  PROPERTY_NOT_FOUND: 'PROPERTY_NOT_FOUND',
}

export function codedError(message, code, extra = {}) {
  const err = new Error(message)
  err.code = code
  for (const [key, value] of Object.entries(extra)) {
    err[key] = value
  }
  return err
}

export function isParseFailure(error) {
  return error?.code === AI_PRODUCER_ERROR.AI_PROVIDER_PARSE_FAILED
}
