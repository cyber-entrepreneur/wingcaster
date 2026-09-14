export type UiMode = 'guided' | 'pro'

export function isUiMode(value: unknown): value is UiMode {
  return value === 'guided' || value === 'pro'
}

export function normalizeUiMode(value: unknown): UiMode {
  return value === 'pro' ? 'pro' : 'guided'
}
