/**
 * Market registry — per-country (ISO alpha-2) config with TWO distinct
 * requirement sets, because they attach to different things:
 *
 *   - `agentLicence`      — the agent's OWN broker credentials, required at
 *                           onboarding only if they are BASED/licensed in that
 *                           market (UAE → RERA BRN + ORN; KSA → REGA). A foreign
 *                           agent selling here as a referral does NOT provide it.
 *   - `propertyVerification` — the per-property verification the local law
 *                           issues, required at LISTING time for any property
 *                           LOCATED in that market, whoever lists it and wherever
 *                           it's published (UAE → Trakheesi permit). This is the
 *                           anti-fraud control — it proves the property is real
 *                           and the lister is authorised.
 *
 * `marketplaces` are the portals that market offers. Data-driven on purpose:
 * add a country here without touching UI. Countries with no entry fall back to
 * DEFAULT_MARKET (no licence gate, owned channels only).
 */

export type CredentialField = {
  key: string
  label: string
  placeholder?: string
  help?: string
  required?: boolean
}

export type Marketplace = {
  id: string
  name: string
  /** Requires the property's local publishing permit to publish here. */
  permitGated?: boolean
}

export type MarketConfig = {
  /** Agent's own broker credentials — collected at onboarding if based here. */
  agentLicence: CredentialField[]
  /** Per-property verification required for properties located here (listing time). */
  propertyVerification: CredentialField[]
  marketplaces: Marketplace[]
}

const OWNED_CHANNELS: Marketplace[] = [
  { id: 'wingcaster_web', name: 'Your WingCaster site' },
  { id: 'bazaar', name: 'Real Estate Bazaar' },
]

export const DEFAULT_MARKET: MarketConfig = {
  agentLicence: [],
  propertyVerification: [],
  marketplaces: [...OWNED_CHANNELS],
}

export const MARKET_REGISTRY: Record<string, MarketConfig> = {
  AE: {
    agentLicence: [
      {
        key: 'rera_brn',
        label: 'RERA Broker Number (BRN)',
        placeholder: 'e.g. 12345',
        help: 'Required if you are a licensed UAE broker.',
        required: true,
      },
      {
        key: 'orn',
        label: 'Office Registration Number (ORN)',
        placeholder: 'e.g. 6789',
        help: "Your brokerage's DED/RERA office number.",
        required: true,
      },
    ],
    propertyVerification: [
      {
        key: 'trakheesi_permit',
        label: 'Trakheesi permit number',
        placeholder: 'e.g. 7145xxxxxx',
        help: 'Per-property DLD/RERA advertising permit — proof the listing is authorised and real.',
        required: true,
      },
    ],
    marketplaces: [
      { id: 'property_finder', name: 'Property Finder', permitGated: true },
      { id: 'bayut', name: 'Bayut', permitGated: true },
      { id: 'dubizzle', name: 'Dubizzle', permitGated: true },
      ...OWNED_CHANNELS,
    ],
  },
  SA: {
    agentLicence: [
      {
        key: 'rega_licence',
        label: 'REGA / FAL Licence Number',
        placeholder: 'e.g. 1100xxxxxx',
        help: 'Real Estate General Authority (REGA) broker licence.',
        required: true,
      },
    ],
    propertyVerification: [
      {
        key: 'rega_ad_licence',
        label: 'REGA advertising licence',
        placeholder: 'e.g. 7000xxxxxx',
        help: 'Per-property advertising licence issued by REGA.',
        required: true,
      },
    ],
    marketplaces: [
      { id: 'aqar', name: 'Aqar', permitGated: true },
      { id: 'bayut_ksa', name: 'Bayut KSA', permitGated: true },
      ...OWNED_CHANNELS,
    ],
  },
  EG: {
    agentLicence: [],
    propertyVerification: [],
    marketplaces: [
      { id: 'property_finder_eg', name: 'Property Finder Egypt' },
      { id: 'aqarmap', name: 'Aqarmap' },
      { id: 'olx_eg', name: 'OLX Egypt' },
      ...OWNED_CHANNELS,
    ],
  },
  LB: {
    agentLicence: [],
    propertyVerification: [],
    marketplaces: [{ id: 'olx_lb', name: 'OLX Lebanon' }, ...OWNED_CHANNELS],
  },
}

export function getMarketConfig(code: string): MarketConfig {
  return MARKET_REGISTRY[code] ?? DEFAULT_MARKET
}

/**
 * Agent licence fields to collect at onboarding for the markets the agent is
 * based/licensed in. De-duped by field key, annotated with the markets that ask.
 */
export function agentLicenceFor(
  basedMarkets: string[],
): Array<CredentialField & { markets: string[] }> {
  const byKey = new Map<string, CredentialField & { markets: string[] }>()
  for (const code of basedMarkets) {
    for (const field of getMarketConfig(code).agentLicence) {
      const existing = byKey.get(field.key)
      if (existing) existing.markets.push(code)
      else byKey.set(field.key, { ...field, markets: [code] })
    }
  }
  return [...byKey.values()]
}

/** Distinct marketplaces available across the given markets. */
export function marketplacesForMarkets(codes: string[]): Marketplace[] {
  const byId = new Map<string, Marketplace>()
  const source = codes.length ? codes.flatMap((c) => getMarketConfig(c).marketplaces) : DEFAULT_MARKET.marketplaces
  for (const m of source) if (!byId.has(m.id)) byId.set(m.id, m)
  return [...byId.values()]
}

/**
 * Per-property verification fields required for a property LOCATED in the given
 * country — used at listing time (anti-fraud). Empty when the jurisdiction has
 * no such requirement. Consumed by the listing/publish flow.
 */
export function propertyVerificationFor(propertyCountry: string): CredentialField[] {
  return getMarketConfig(propertyCountry).propertyVerification
}
