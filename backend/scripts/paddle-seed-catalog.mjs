#!/usr/bin/env node
/**
 * Seed the Paddle catalog for WingCaster (sandbox-first).
 *
 * Creates one product + monthly/annual prices per paid tier, plus a single
 * "credit unit" price ($0.01) used for top-ups / consumption purchases, then
 * prints the price IDs and ready-to-run SQL to populate public.paddle_price_map.
 *
 * Usage:
 *   PADDLE_ENV=sandbox PADDLE_API_KEY=pdl_sdbx_... node backend/scripts/paddle-seed-catalog.mjs
 *
 * It never touches the WingCaster database — it only calls the Paddle API and
 * prints. Review the printed SQL, then run it against your DB to wire the map.
 * Amounts are the current PLACEHOLDER marketing prices; adjust before go-live.
 */

const ENV = String(process.env.PADDLE_ENV || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox'
const API_BASE = ENV === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com'
const API_KEY = process.env.PADDLE_API_KEY

if (!API_KEY) {
  console.error('PADDLE_API_KEY is required (use a sandbox key first).')
  process.exit(1)
}

// tax_category must be enabled on your Paddle account. "standard" is always
// available; switch subscriptions to "saas" if that category is enabled.
const SUBSCRIPTION_TAX_CATEGORY = process.env.PADDLE_TAX_CATEGORY || 'standard'
const CREDIT_TAX_CATEGORY = process.env.PADDLE_TAX_CATEGORY || 'standard'

// code → { name, monthlyMinor, annualMinor } (USD minor units = cents).
const TIERS = [
  { code: 'semsar', name: 'Semsar', monthly: 1500, annual: 15000 },
  { code: 'boutique', name: 'Boutique', monthly: 4000, annual: 40000 },
  { code: 'small_team', name: 'Small Team', monthly: 9900, annual: 99000 },
  { code: 'agency', name: 'Agency', monthly: 19000, annual: 190000 },
  { code: 'brokerage', name: 'Brokerage', monthly: 50000, annual: 500000 },
  { code: 'enterprise', name: 'Enterprise', monthly: 100000, annual: 1000000 },
]

async function paddle(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error(`Paddle ${method} ${path} -> ${res.status}: ${json?.error?.detail || text}`)
  }
  return json.data
}

async function createProduct(name, taxCategory) {
  return paddle('POST', '/products', { name, tax_category: taxCategory, type: 'standard' })
}

async function createPrice({ productId, description, amountMinor, interval }) {
  const body = {
    product_id: productId,
    description,
    unit_price: { amount: String(amountMinor), currency_code: 'USD' },
  }
  if (interval) body.billing_cycle = { interval, frequency: 1 }
  return paddle('POST', '/prices', body)
}

function sqlForSubscription(code, cadence, priceId, productId) {
  return `INSERT INTO public.paddle_price_map (kind, ref_id, billing_cadence, environment, paddle_price_id, paddle_product_id)
SELECT 'subscription', v.id::text, '${cadence}', '${ENV}', '${priceId}', '${productId}'
  FROM public.product_package_versions v
  JOIN public.product_packages p ON p.id = v.package_id
 WHERE p.code = '${code}' AND v.state = 'PUBLISHED'
 ORDER BY v.version_number DESC LIMIT 1
ON CONFLICT (kind, ref_id, billing_cadence, environment) DO UPDATE
   SET paddle_price_id = EXCLUDED.paddle_price_id, paddle_product_id = EXCLUDED.paddle_product_id, active = true, updated_at = NOW();`
}

async function main() {
  console.log(`# Seeding Paddle catalog (${ENV}) at ${API_BASE}\n`)
  const sql = []

  for (const tier of TIERS) {
    const product = await createProduct(`WingCaster — ${tier.name}`, SUBSCRIPTION_TAX_CATEGORY)
    const monthly = await createPrice({
      productId: product.id,
      description: `${tier.name} monthly`,
      amountMinor: tier.monthly,
      interval: 'month',
    })
    const annual = await createPrice({
      productId: product.id,
      description: `${tier.name} annual`,
      amountMinor: tier.annual,
      interval: 'year',
    })
    console.log(`${tier.code}: product=${product.id} monthly=${monthly.id} annual=${annual.id}`)
    sql.push(sqlForSubscription(tier.code, 'monthly', monthly.id, product.id))
    sql.push(sqlForSubscription(tier.code, 'annual', annual.id, product.id))
  }

  // Credit unit: $0.01 one-time. quantity == credit units at Paddle checkout.
  const creditProduct = await createProduct('WingCaster — Credits', CREDIT_TAX_CATEGORY)
  const creditPrice = await createPrice({
    productId: creditProduct.id,
    description: 'Credit unit ($0.01)',
    amountMinor: 1,
  })
  console.log(`credit_unit: product=${creditProduct.id} price=${creditPrice.id}`)
  sql.push(`INSERT INTO public.paddle_price_map (kind, ref_id, billing_cadence, environment, paddle_price_id, paddle_product_id)
VALUES ('credit_unit', 'credit_unit', NULL, '${ENV}', '${creditPrice.id}', '${creditProduct.id}')
ON CONFLICT (kind, ref_id, billing_cadence, environment) DO UPDATE
   SET paddle_price_id = EXCLUDED.paddle_price_id, paddle_product_id = EXCLUDED.paddle_product_id, active = true, updated_at = NOW();`)

  console.log('\n-- Review, then run against the WingCaster DB to wire the price map:\n')
  console.log(sql.join('\n\n'))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
