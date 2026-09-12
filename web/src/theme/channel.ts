export const LC_CHANNELS = [
  'instagram',
  'whatsapp',
  'messenger',
  'facebook',
  'tiktok',
  'x',
  'linkedin',
  'olx',
  'bayut',
  'property_finder',
  'dubizzle',
  'aqar',
  'blue_door',
] as const

export type LcChannel = (typeof LC_CHANNELS)[number]

const CHANNEL_ALIAS: Record<string, LcChannel> = {
  instagram: 'instagram',
  ig: 'instagram',
  whatsapp: 'whatsapp',
  wa: 'whatsapp',
  messenger: 'messenger',
  facebook: 'facebook',
  fb: 'facebook',
  tiktok: 'tiktok',
  x: 'x',
  twitter: 'x',
  linkedin: 'linkedin',
  olx: 'olx',
  bayut: 'bayut',
  property_finder: 'property_finder',
  propertyfinder: 'property_finder',
  pf: 'property_finder',
  'property finder': 'property_finder',
  dubizzle: 'dubizzle',
  aqar: 'aqar',
  'aqar.fm': 'aqar',
  blue_door: 'blue_door',
  bluedoor: 'blue_door',
  'blue door': 'blue_door',
}

export const LC_CHANNEL_SHORT: Record<LcChannel, string> = {
  instagram: 'IG',
  whatsapp: 'WA',
  messenger: 'MS',
  facebook: 'FB',
  tiktok: 'TT',
  x: 'X',
  linkedin: 'IN',
  olx: 'OL',
  bayut: 'BY',
  property_finder: 'PF',
  dubizzle: 'DZ',
  aqar: 'AQ',
  blue_door: 'BD',
}

export function resolveLcChannel(value: string | null | undefined): LcChannel | null {
  if (!value) return null
  const key = value.trim().toLowerCase()
  return CHANNEL_ALIAS[key] ?? CHANNEL_ALIAS[key.replace(/[\s-]+/g, '_')] ?? null
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

/** Map portal display labels used in publish preview to LcChannel keys. */
export function portalLabelToChannel(portal: string): LcChannel | null {
  return resolveLcChannel(portal)
}
