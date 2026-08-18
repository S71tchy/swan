import { useState } from 'react'
import { SEVERITY_HEX, SEVERITY_LABEL } from '../lib/format'
import type { Severity } from '../types'

// --------------------------------------------------------------------------- //
// Inline SVG charts for the Analytics screen.
//
// Hand-rolled rather than a charting dependency: the bundle is already 1.2 MB,
// and the only palette these need is the severity ramp, which is fixed by the
// brand charter and must stay identical to the map's (`SEVERITY_HEX`, mirrored
// from the `--sev-*` tokens). A library would bring its own colour opinions to
// override on every mark.
//
// On that ramp: it is a **status** palette, not a categorical one — grey → yellow
// → orange → dark-orange is an ordered severity scale, and it is mandated, not
// chosen here. Run through the palette validator on the dark surface it gets the
// three checks that govern legibility (CVD separation ΔE 14.2, normal-vision
// 15.2, contrast ≥ 3:1 — all pass) and fails the two that only apply to
// categorical palettes: the lightness band and the chroma floor, both of which a
// deliberate grey "Info" step is *supposed* to fail. The remedy required for a
// reserved status ramp is secondary encoding, so severity is never carried by
// colour alone here: the legend is always present, the stack order is fixed and
// meaningful, and every value is reachable as text in the tooltip and the table.
// --------------------------------------------------------------------------- //

export const SEVERITY_ORDER: Severity[] = ['info', 'watch', 'warning', 'critical']

const AXIS = 'rgba(255,255,255,.30)'
const GRID = 'rgba(255,255,255,.07)'

export interface StackPoint {
  bucket: string
  info: number
  watch: number
  warning: number
  critical: number
  total: number
}

function Tooltip({ x, y, lines }: { x: string; y: number; lines: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'none',
        zIndex: 5,
        padding: '9px 11px',
        borderRadius: 10,
        background: 'rgba(10,18,32,.97)',
        border: '1px solid var(--border-mid)',
        boxShadow: '0 8px 24px rgba(0,0,0,.45)',
        font: '400 11px/1.6 var(--font-body)',
        color: 'var(--t-80)',
        whiteSpace: 'nowrap',
      }}
    >
      {lines}
    </div>
  )
}

export function Legend({ severities = SEVERITY_ORDER }: { severities?: Severity[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
      {severities.map((s) => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 3,
              background: SEVERITY_HEX[s],
              flex: 'none',
            }}
          />
          <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-60)' }}>
            {SEVERITY_LABEL[s]}
          </span>
        </span>
      ))}
    </div>
  )
}

/**
 * Volume over time, stacked by severity — the lead chart.
 *
 * Empty buckets are drawn, not dropped: a quiet fortnight is a fact about the
 * period, and skipping it would compress the axis and invent a trend.
 */
export function StackedBars({
  points,
  height = 240,
  formatBucket,
}: {
  points: StackPoint[]
  height?: number
  formatBucket: (iso: string) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...points.map((p) => p.total))
  const n = Math.max(1, points.length)
  const slot = 100 / n
  const every = Math.ceil(n / 8)

  // Built from HTML boxes rather than SVG: a percentage-width viewBox with
  // preserveAspectRatio="none" stretches the x axis by ~10×, which turns a
  // rounded bar end into a flattened ellipse and a 2px gap into a 2px-tall,
  // 20px-wide one. In HTML the radius and the gap are what they say they are,
  // and the chart is fluid for free.
  const ticks = [1, 0.5, 0]

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative', height }}>
        {/* recessive grid + value axis */}
        {ticks.map((f) => (
          <div
            key={f}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${(1 - f) * 100}%`,
              borderTop: `1px ${f === 0 ? 'solid' : 'solid'} ${f === 0 ? AXIS : GRID}`,
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: -14,
                font: '400 9.5px var(--font-body)',
                color: 'var(--t-30)',
              }}
            >
              {Math.round(max * f)}
            </span>
          </div>
        ))}

        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}>
          {points.map((p, i) => {
            const on = hover === i
            // Tallest segment first from the top of the stack downwards: critical
            // sits on top, so the eye reads worst-case at the tip of every bar.
            const stack = [...SEVERITY_ORDER].reverse().filter((s) => p[s] > 0)
            return (
              <div
                key={p.bucket}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                style={{
                  width: `${slot}%`,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  cursor: 'default',
                  background: on ? 'rgba(255,255,255,.035)' : 'transparent',
                }}
              >
                <div
                  style={{
                    width: `min(62%, 26px)`,
                    height: `${(p.total / max) * 100}%`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    opacity: hover === null || on ? 1 : 0.45,
                    transition: 'opacity .12s',
                  }}
                >
                  {stack.map((sev, j) => (
                    <div
                      key={sev}
                      style={{
                        height: `${(p[sev] / p.total) * 100}%`,
                        background: SEVERITY_HEX[sev],
                        borderRadius: j === 0 ? '4px 4px 0 0' : 0,
                        marginBottom: j === stack.length - 1 ? 0 : 2, // 2px surface gap
                        minHeight: 2,
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* x labels — thinned so they never collide */}
      <div style={{ display: 'flex', marginTop: 6 }}>
        {points.map((p, i) => (
          <div
            key={p.bucket}
            style={{
              width: `${slot}%`,
              textAlign: 'center',
              font: '400 9.5px var(--font-body)',
              color: hover === i ? 'var(--t-70)' : 'var(--t-35)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {i % every === 0 || hover === i ? formatBucket(p.bucket) : ''}
          </div>
        ))}
      </div>

      {hover !== null && points[hover] && (
        <Tooltip
          /* percentage, because the plot geometry is percentage-based */
          x={`${slot * hover + slot / 2}%`}
          y={12}
          lines={
            <>
              <div style={{ color: '#fff', font: '600 11.5px var(--font-body)', marginBottom: 3 }}>
                {formatBucket(points[hover].bucket)} — {points[hover].total} alert
                {points[hover].total === 1 ? '' : 's'}
              </div>
              {SEVERITY_ORDER.filter((s) => points[hover]![s] > 0)
                .reverse()
                .map((s) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: SEVERITY_HEX[s] }} />
                    {SEVERITY_LABEL[s]}: {points[hover]![s]}
                  </div>
                ))}
            </>
          }
        />
      )}
    </div>
  )
}

/**
 * Ranked horizontal bars for a single measure (alerts per country, per category…).
 *
 * One colour on purpose: the bars encode *magnitude*, and identity is already
 * carried by the row label. Giving each row its own hue would imply a category
 * palette that means nothing and would repaint rows whenever a filter changes
 * the ordering.
 */
export function RankedBars({
  rows,
  total,
  emptyLabel = 'Nothing in this range.',
  renderLabel,
  onSelect,
  selected,
}: {
  rows: { name: string; count: number; key?: string }[]
  total?: number
  emptyLabel?: string
  renderLabel?: (row: { name: string; count: number; key?: string }) => React.ReactNode
  onSelect?: (row: { name: string; count: number; key?: string }) => void
  selected?: string | null
}) {
  if (rows.length === 0) {
    return <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>{emptyLabel}</div>
  }
  const max = Math.max(...rows.map((r) => r.count), 1)
  const denom = total || rows.reduce((a, r) => a + r.count, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r) => {
        const key = r.key ?? r.name
        const on = selected === key
        return (
          <div
            key={key}
            onClick={onSelect ? () => onSelect(r) : undefined}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 46px',
              alignItems: 'center',
              gap: 10,
              cursor: onSelect ? 'pointer' : 'default',
              opacity: selected && !on ? 0.55 : 1,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  font: '400 11.5px var(--font-body)',
                  color: on ? 'var(--agl-yellow)' : 'var(--t-75)',
                  marginBottom: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {renderLabel ? renderLabel(r) : r.name}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)' }}>
                <div
                  style={{
                    width: `${(r.count / max) * 100}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: on ? 'var(--agl-yellow)' : 'rgba(238,213,142,.62)',
                    transition: 'width .2s',
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '600 12px var(--font-display)', color: '#fff' }}>{r.count}</div>
              {denom > 0 && (
                <div style={{ font: '400 9.5px var(--font-body)', color: 'var(--t-35)' }}>
                  {Math.round((r.count / denom) * 100)}%
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** A headline number. Not a chart — one value, read at a glance. */
export function StatTile({
  label,
  value,
  hint,
  delta,
  accent,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  /** Period-on-period change, already computed. Null when there's nothing to compare. */
  delta?: number | null
  accent?: string
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        background: 'var(--glass-90)',
        border: '1px solid var(--border-mid)',
        backdropFilter: 'blur(18px)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div
        style={{
          font: '600 9.5px var(--font-display)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: 'var(--t-45)',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ font: '700 26px var(--font-display)', color: accent ?? '#fff', lineHeight: 1.1 }}>
          {value}
        </span>
        {delta !== undefined && delta !== null && (
          <span
            style={{
              font: '600 11px var(--font-display)',
              color: delta > 0 ? 'var(--sev-critical-text)' : delta < 0 ? 'var(--agl-yellow)' : 'var(--t-45)',
            }}
          >
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {hint && (
        <div style={{ font: '400 10.5px/1.45 var(--font-body)', color: 'var(--t-45)' }}>{hint}</div>
      )}
    </div>
  )
}
