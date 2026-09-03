export class CreditEngineError extends Error {
  constructor(code, message, extra = {}) {
    super(message || code)
    this.name = 'CreditEngineError'
    this.code = code
    this.extra = extra
  }
}

export const CREDIT_ERROR = {
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  SPEND_CAP_EXCEEDED: 'SPEND_CAP_EXCEEDED',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  CREDIT_GRANT_APPROVAL_REQUIRED: 'CREDIT_GRANT_APPROVAL_REQUIRED',
  APPROVAL_SELF_APPROVAL_FORBIDDEN: 'APPROVAL_SELF_APPROVAL_FORBIDDEN',
  RESERVATION_NOT_HELD: 'RESERVATION_NOT_HELD',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_SOURCE: 'INVALID_SOURCE',
  FEATURE_NOT_REGISTERED: 'FEATURE_NOT_REGISTERED',
  CREDIT_ENGINE_UNAVAILABLE: 'CREDIT_ENGINE_UNAVAILABLE',
  FREE_TIER_PACKAGE_MISSING: 'FREE_TIER_PACKAGE_MISSING',
}

export function creditErrorHttpStatus(error) {
  switch (error?.code) {
    case CREDIT_ERROR.INSUFFICIENT_CREDITS:
    case CREDIT_ERROR.SPEND_CAP_EXCEEDED:
      return 402
    case CREDIT_ERROR.CREDIT_ENGINE_UNAVAILABLE:
      return 503
    case CREDIT_ERROR.FEATURE_NOT_REGISTERED:
    case CREDIT_ERROR.FREE_TIER_PACKAGE_MISSING:
      return 500
    case CREDIT_ERROR.RESERVATION_NOT_HELD:
      return 409
    case CREDIT_ERROR.CREDIT_GRANT_APPROVAL_REQUIRED:
      return 409
    default:
      return 400
  }
}

export function sendCreditError(res, error) {
  if (error instanceof CreditEngineError) {
    const status = creditErrorHttpStatus(error)
    return res.status(status).json({
      error: error.message,
      code: error.code,
      extra: error.extra || undefined,
    })
  }
  return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
}
