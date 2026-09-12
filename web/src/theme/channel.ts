export const LC_CHANNELS = [
  'instagram',
  'whatsapp',
  'messenger',
  'facebook',
  'tiktok',
  'x',
  'linkedin',
  'olx',
] as const

export type LcChannel = (typeof LC_CHANNELS)[number]

const CHANNEL_ALIAS: Record<string, LcChannel> = {
  instagram: 'instagram',
  ig: 'instagram',
  instagram_dm: 'instagram',
  instagram_comment: 'instagram',
  ig_dm: 'instagram',
  whatsapp: 'whatsapp',
  wa: 'whatsapp',
  messenger: 'messenger',
  facebook_messenger: 'messenger',
  facebook: 'facebook',
  fb: 'facebook',
  facebook_comment: 'facebook',
  tiktok: 'tiktok',
  tiktok_dm: 'tiktok',
  tiktok_comment: 'tiktok',
  x: 'x',
  x_dm: 'x',
  x_mention: 'x',
  twitter: 'x',
  linkedin: 'linkedin',
  linkedin_comment: 'linkedin',
  olx: 'olx',
}

export function resolveLcChannel(value: string | null | undefined): LcChannel | null {
  if (!value) return null
  return CHANNEL_ALIAS[value.trim().toLowerCase()] ?? null
}

export function lcChannelStyle(channel: LcChannel): { background: string; color: string } {
  return {
    background: `var(--lc-channel-${channel})`,
    color: `var(--lc-channel-${channel}-on)`,
  }
}

export function lcChannelColor(channel: string | null | undefined): string {
  const resolved = resolveLcChannel(channel)
  return resolved ? `var(--lc-channel-${resolved})` : 'var(--lc-text-muted)'
}

export function lcChannelTextClass(channel: string | null | undefined): string {
  const resolved = resolveLcChannel(channel)
  return resolved ? `text-[color:var(--lc-channel-${resolved})]` : 'text-[var(--lc-text-muted)]'
}
