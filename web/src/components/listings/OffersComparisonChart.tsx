import { useMemo } from 'react'
import type { BuyerOffer } from '@/api/client'

/**
 * AGT-LST-010 — offers comparison chart.
 *
 * Horizontal bars (0-based — bar length honestly encodes the offer amount)
 * with vertical reference lines for asking price, benchmark (median of
 * similar SOLD comparables), average asking (mean of comparables), and the
 * property's last sale price when known. The reading is "where does each
 * offer's bar end relative to the reference lines" — instantly showing which
 * offers beat asking / benchmark.
 *
 * Single hue for the bars (Broadcast `--lc-action-primary`); the leading live
 * offer is emphasized, the rest recede. Reference lines are ink-toned and
 * separated by dash pattern + a direct label (never color-as-identity), so
 * the chart stays legible under CVD, print, and forced-colors.
 */

const LIVE = new Set(['received', 'countered', 'accepted'])
const MAX_BARS = 8

export interface OffersComparisonChartProps {
  offers: BuyerOffer[]
  currency: string
  asking?: number | null
  /** Benchmark = median of similar SOLD comparables. */
  benchmark?: number | null
  /** Average asking = mean of comparable listings. */
  avgAsking?: number | null
  /** This property's last recorded sale price, when known. */
  lastSale?: number | null
}

interface Ref {
  key: string
  label: string
  value: number
  dash: string
}

function compactMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`
  }
}

export function OffersComparisonChart({
  offers,
  currency,
  asking,
  benchmark,
  avgAsking,
  lastSale,
}: OffersComparisonChartProps) {
  const rows = useMemo(
    () =>
      offers
        .filter((o) => Number.isFinite(o.amount) && o.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, MAX_BARS),
    [offers],
  )

  const refs = useMemo<Ref[]>(() => {
    const out: Ref[] = []
    if (asking != null && asking > 0) out.push({ key: 'asking', label: 'Asking', value: asking, dash: '' })
    if (benchmark != null && benchmark > 0)
      out.push({ key: 'benchmark', label: 'Benchmark (sold)', value: benchmark, dash: '6 3' })
    if (avgAsking != null && avgAsking > 0)
      out.push({ key: 'avgAsking', label: 'Avg asking', value: avgAsking, dash: '2 3' })
    if (lastSale != null && lastSale > 0)
      out.push({ key: 'lastSale', label: 'Last sale', value: lastSale, dash: '8 3 2 3' })
    return out
  }, [asking, benchmark, avgAsking, lastSale])

  const leadingId = useMemo(() => rows.find((o) => LIVE.has(o.status))?.id ?? null, [rows])

  if (rows.length === 0) return null

  // Geometry (SVG user units; scales responsively via viewBox).
  const W = 720
  const padL = 132
  const padR = 20
  const padT = 26
  const rowH = 34
  const barH = 16
  const plotW = W - padL - padR
  const H = padT + rows.length * rowH + 30

  const maxVal = Math.max(...rows.map((o) => o.amount), ...refs.map((r) => r.value)) * 1.06
  const x = (v: number) => padL + (v / maxVal) * plotW

  return (
    <figure className="m-0" aria-label="Offers compared to asking, benchmark, and market prices">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        preserveAspectRatio="xMidYMid meet"
        className="font-[family-name:var(--lc-font-ui)]"
      >
        {/* Reference lines + top labels */}
        {refs.map((r, i) => {
          const rx = x(r.value)
          // Stagger labels vertically so adjacent lines don't collide.
          const labelY = 8 + (i % 2) * 10
          return (
            <g key={r.key}>
              <line
                x1={rx}
                x2={rx}
                y1={padT - 4}
                y2={H - 22}
                stroke="var(--lc-text-secondary)"
                strokeWidth={r.key === 'asking' ? 2 : 1.5}
                strokeDasharray={r.dash || undefined}
                opacity={r.key === 'asking' ? 0.9 : 0.55}
              />
              <text
                x={rx}
                y={labelY}
                textAnchor="middle"
                className="fill-[var(--lc-text-muted)]"
                style={{ font: 'var(--lc-type-caption)' }}
              >
                {r.label} · {compactMoney(r.value, currency)}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {rows.map((o, i) => {
          const y = padT + i * rowH
          const isLead = o.id === leadingId
          const dim = !LIVE.has(o.status)
          const bx = x(o.amount)
          return (
            <g key={o.id}>
              <text
                x={padL - 8}
                y={y + barH / 2 + 4}
                textAnchor="end"
                className="fill-[var(--lc-text-primary)]"
                style={{ font: 'var(--lc-type-body-sm)' }}
              >
                {o.offeror_name.length > 16 ? o.offeror_name.slice(0, 15) + '…' : o.offeror_name}
              </text>
              <rect
                x={padL}
                y={y}
                width={Math.max(2, bx - padL)}
                height={barH}
                rx={4}
                fill={
                  isLead
                    ? 'var(--lc-action-primary)'
                    : dim
                      ? 'var(--lc-surface-sunken)'
                      : 'var(--lc-action-secondary)'
                }
                stroke={dim ? 'var(--lc-border-strong)' : 'none'}
                strokeWidth={dim ? 1 : 0}
              />
              <text
                x={bx + 6}
                y={y + barH / 2 + 4}
                className="fill-[var(--lc-text-secondary)]"
                style={{ font: 'var(--lc-type-caption)' }}
              >
                {compactMoney(o.amount, currency)}
                {isLead ? ' · Leading' : ''}
              </text>
            </g>
          )
        })}

        {/* Baseline */}
        <line
          x1={padL}
          x2={padL}
          y1={padT - 4}
          y2={H - 22}
          stroke="var(--lc-border)"
          strokeWidth={1}
        />
      </svg>
      {offers.filter((o) => o.amount > 0).length > MAX_BARS ? (
        <figcaption className="mt-1 text-center text-xs text-[var(--lc-text-muted)]">
          Showing the top {MAX_BARS} of {offers.filter((o) => o.amount > 0).length} offers by amount.
        </figcaption>
      ) : null}
    </figure>
  )
}
