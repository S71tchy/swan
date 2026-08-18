import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, API_BASE } from '../api'
import { useAuth } from '../auth'
import { TopBar } from '../components/TopBar'
import { LeftRail } from '../components/LeftRail'
import { MapBackdrop } from '../components/MapBackdrop'
import { CountryFlag } from '../components/CountryFlag'
import { SectionLabel } from '../components/ui'
import { SegmentedControl, SelectMenu } from '../components/filters'
import { Legend, RankedBars, StackedBars, StatTile } from '../components/charts'
import { SEVERITY_HEX, SEVERITY_LABEL, fmtDate } from '../lib/format'
import type { AnalyticsRow, AnalyticsSummary, Severity, Taxonomy } from '../types'

// --------------------------------------------------------------------------- //
// Analytics
//
// Statistics across the whole alert corpus, not just what is live on the map —
// which is why this is its own destination rather than another panel on the
// Dashboard (the map). Note the naming: "Dashboard" means the map everywhere in
// this codebase and in the design handoff, so this section is Analytics.
//
// Visibility is split server-side, deliberately: everyone gets the corpus
// (published / closed / expired — what the feed already shows them), Rights
// Managers additionally get the pipeline (drafts, submissions, rejections,
// approval latency, per-author throughput). `summary.pipeline` is simply absent
// for everyone else, so there is no client-side gate here to forget — the
// section renders if the data arrived.
//
// Filter state lives in the URL, as on the feed, so a filtered report is a
// shareable link rather than a screenshot.
// --------------------------------------------------------------------------- //

const RANGES: { value: string; label: string; days: number }[] = [
  { value: '30d', label: '30 days', days: 30 },
  { value: '90d', label: '90 days', days: 90 },
  { value: '12m', label: '12 months', days: 365 },
  { value: 'all', label: 'All time', days: 3650 },
]

const panel: React.CSSProperties = {
  borderRadius: 16,
  background: 'var(--glass-90)',
  border: '1px solid var(--border-mid)',
  backdropFilter: 'blur(18px)',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  minWidth: 0,
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function pctDelta(now: number, prev: number): number | null {
  if (!prev) return null // no baseline — showing "+100%" against zero says nothing
  return Math.round(((now - prev) / prev) * 100)
}

export default function Analytics() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [rows, setRows] = useState<{ total: number; rows: AnalyticsRow[] } | null>(null)
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const range = params.get('range') ?? '12m'
  const country = params.get('country') ?? ''
  const category = params.get('category') ?? ''
  const severity = params.get('sev') ?? ''

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  const query = useMemo(() => {
    const days = RANGES.find((r) => r.value === range)?.days ?? 365
    const q = new URLSearchParams({ from: isoDaysAgo(days) })
    if (country) q.set('country', country)
    if (category) q.set('category', category)
    if (severity) q.set('severity', severity)
    return q.toString()
  }, [range, country, category, severity])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([api.analyticsSummary(query), api.analyticsRows(query)])
      .then(([s, r]) => {
        if (cancelled) return
        setSummary(s)
        setRows(r)
        setError(null)
      })
      .catch(() => !cancelled && setError('Could not load analytics.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query])

  useEffect(() => {
    void api.taxonomy().then(setTaxonomy).catch(() => setTaxonomy(null))
  }, [])

  if (!user) return null

  const t = summary?.totals
  const bucket = summary?.range.bucket ?? 'month'
  const formatBucket = (iso: string) => {
    const d = new Date(iso + 'T00:00:00')
    if (bucket === 'month') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    if (bucket === 'week') return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.4} blur={2} overlay="rgba(8,14,26,.55)" />
      <TopBar breadcrumb="Analytics" />
      <LeftRail />

      <div
        className="scroll-y"
        style={{
          position: 'absolute',
          left: 100,
          right: 24,
          top: 92,
          bottom: 24,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* ---- header + filters ---- */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: '700 22px var(--font-display)', color: '#fff' }}>Analytics</div>
            <div style={{ font: '400 12px var(--font-body)', color: 'var(--t-50)' }}>
              Every alert in the system, not just the ones live on the map
              {summary?.pipeline ? ' — including the approval pipeline.' : '.'}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <SegmentedControl
              value={range}
              options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
              onChange={(v) => setParam('range', v)}
            />
            <SelectMenu
              label="Severity"
              value={severity}
              onChange={(v) => setParam('sev', v)}
              options={[
                { value: '', label: 'All severities' },
                ...(['critical', 'warning', 'watch', 'info'] as Severity[]).map((s) => ({
                  value: s,
                  label: SEVERITY_LABEL[s],
                })),
              ]}
            />
            <SelectMenu
              label="Category"
              value={category}
              onChange={(v) => setParam('category', v)}
              options={[
                { value: '', label: 'All categories' },
                ...Object.keys(taxonomy?.categories ?? {}).map((c) => ({ value: c, label: c })),
              ]}
            />
            <a
              href={`${API_BASE}/analytics/export.csv?${query}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                height: 34,
                padding: '0 14px',
                borderRadius: 10,
                textDecoration: 'none',
                border: '1px solid var(--border-soft)',
                background: 'rgba(255,255,255,.05)',
                color: 'var(--t-70)',
                font: '600 12px var(--font-display)',
              }}
            >
              Export CSV
            </a>
          </div>
        </div>

        {(country || category || severity) && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>Filtered by</span>
            {[
              country && { k: 'country', v: country },
              category && { k: 'category', v: category },
              severity && { k: 'sev', v: SEVERITY_LABEL[severity as Severity] },
            ]
              .filter(Boolean)
              .map((f) => {
                const item = f as { k: string; v: string }
                return (
                  <button
                    key={item.k}
                    onClick={() => setParam(item.k, '')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      font: '500 11px var(--font-body)',
                      color: 'var(--agl-yellow)',
                      background: 'var(--yellow-tint)',
                      border: '1px solid var(--yellow-border-strong)',
                    }}
                  >
                    {item.v} ✕
                  </button>
                )
              })}
          </div>
        )}

        {error && (
          <div style={{ ...panel, borderColor: 'rgba(207,69,39,.5)', color: 'var(--sev-critical-text)' }}>
            {error}
          </div>
        )}

        {loading && !summary && (
          <div style={{ ...panel, color: 'var(--t-45)', font: '400 12px var(--font-body)' }}>
            Loading analytics…
          </div>
        )}

        {summary && t && (
          <>
            {/* ---- headline numbers ---- */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              <StatTile
                label="Alerts in period"
                value={t.alerts}
                delta={pctDelta(t.alerts, t.previous_alerts)}
                hint={
                  t.previous_alerts
                    ? `vs ${t.previous_alerts} in the previous ${summary.range.days} days`
                    : 'No preceding period to compare'
                }
              />
              <StatTile
                label="Live right now"
                value={t.live_now}
                accent="var(--agl-yellow)"
                hint="Published and inside its validity window today"
              />
              <StatTile label="Countries affected" value={t.countries} hint={`${t.authors} contributors`} />
              <StatTile
                label="Median days live"
                value={t.median_days_live ?? '—'}
                hint={
                  t.open_ended
                    ? `${t.open_ended} open-ended (until further notice)`
                    : 'Measured on alerts that have been closed'
                }
              />
            </div>

            {/* ---- lead chart: volume over time by severity ---- */}
            <div style={panel}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <SectionLabel>Volume over time</SectionLabel>
                <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>
                  by {bucket}, stacked by severity · {fmtDate(summary.range.start)} → {fmtDate(summary.range.end)}
                </span>
                <span style={{ flex: 1 }} />
                <Legend />
              </div>
              <StackedBars points={summary.series} formatBucket={formatBucket} />
            </div>

            {/* ---- breakdowns ---- */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              <div style={panel}>
                <SectionLabel>Where</SectionLabel>
                <RankedBars
                  total={t.alerts}
                  selected={country || null}
                  onSelect={(r) => setParam('country', r.key === country ? '' : (r.key ?? ''))}
                  rows={summary.by_country.map((c) => ({ name: c.name, count: c.count, key: c.code }))}
                  renderLabel={(r) => (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <CountryFlag code={r.key ?? ''} size={13} />
                      {r.name}
                    </span>
                  )}
                />
              </div>

              <div style={panel}>
                <SectionLabel>What</SectionLabel>
                <RankedBars
                  total={t.alerts}
                  selected={category || null}
                  onSelect={(r) => setParam('category', r.name === category ? '' : r.name)}
                  rows={summary.by_category}
                />
              </div>

              <div style={panel}>
                <SectionLabel>Severity mix</SectionLabel>
                <RankedBars
                  total={t.alerts}
                  rows={(['critical', 'warning', 'watch', 'info'] as Severity[]).map((s) => ({
                    name: SEVERITY_LABEL[s],
                    count: summary.severity[s],
                    key: s,
                  }))}
                  renderLabel={(r) => (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 3,
                          background: SEVERITY_HEX[(r.key ?? 'info') as Severity],
                        }}
                      />
                      {r.name}
                    </span>
                  )}
                />
              </div>

              <div style={panel}>
                <SectionLabel>Transport modes</SectionLabel>
                <RankedBars
                  rows={summary.by_mode.map((m) => ({
                    ...m,
                    name: m.name.charAt(0).toUpperCase() + m.name.slice(1),
                  }))}
                  emptyLabel="No modes recorded in this range."
                />
              </div>

              <div style={panel}>
                <SectionLabel>Sub-categories</SectionLabel>
                <RankedBars rows={summary.by_sub_category} />
              </div>

              <div style={panel}>
                <SectionLabel>Industries</SectionLabel>
                <RankedBars rows={summary.by_industry} emptyLabel="No industry set on these alerts." />
              </div>
            </div>

            {/* ---- pipeline (Rights Managers only — absent from the payload otherwise) ---- */}
            {summary.pipeline && (
              <div style={panel}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <SectionLabel>Approval pipeline</SectionLabel>
                  <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>
                    Rights Managers only · includes drafts and rejections
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                  <StatTile label="Drafts" value={summary.pipeline.draft} hint="Not yet submitted" />
                  <StatTile
                    label="Awaiting approval"
                    value={summary.pipeline.submitted}
                    accent={summary.pipeline.submitted ? 'var(--agl-yellow)' : undefined}
                  />
                  <StatTile
                    label="Median approval time"
                    value={
                      summary.pipeline.median_approval_hours == null
                        ? '—'
                        : `${summary.pipeline.median_approval_hours.toFixed(1)}h`
                    }
                    hint="Submitted → published"
                  />
                  <StatTile
                    label="Returned for changes"
                    value={
                      summary.pipeline.rejection_rate == null
                        ? '—'
                        : `${Math.round(summary.pipeline.rejection_rate * 100)}%`
                    }
                    hint={`${summary.pipeline.rejected} currently rejected`}
                  />
                  <StatTile
                    label="Routed vs direct"
                    value={`${summary.pipeline.via_approval} / ${summary.pipeline.direct_publish}`}
                    hint="Published via approval / published directly"
                  />
                </div>
                <div style={{ marginTop: 4 }}>
                  <SectionLabel>Top contributors</SectionLabel>
                  <div style={{ marginTop: 10 }}>
                    <RankedBars rows={summary.pipeline.top_authors} />
                  </div>
                </div>
              </div>
            )}

            {/* ---- the rows behind the numbers ---- */}
            {rows && (
              <div style={panel}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <SectionLabel>Alerts in this selection</SectionLabel>
                  <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>
                    {rows.total} total
                    {rows.total > rows.rows.length ? ` · showing the ${rows.rows.length} most recent` : ''}
                    {rows.total > rows.rows.length ? ' — export the CSV for all of them' : ''}
                  </span>
                </div>
                <div className="scroll-y" style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                    <thead>
                      <tr>
                        {['Date', 'Alert', 'Severity', 'Category', 'Status', 'Countries'].map((h) => (
                          <th
                            key={h}
                            style={{
                              position: 'sticky',
                              top: 0,
                              textAlign: 'left',
                              padding: '9px 10px',
                              background: 'rgba(15,27,46,.95)',
                              backdropFilter: 'blur(10px)',
                              borderBottom: '1px solid rgba(255,255,255,.09)',
                              font: '600 9.5px var(--font-display)',
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              color: 'var(--t-45)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.rows.map((r) => (
                        <tr key={r.id}>
                          <td style={cell}>
                            {r.effective_at ? fmtDate(r.effective_at.slice(0, 10)) : '—'}
                          </td>
                          <td style={{ ...cell, color: '#fff', maxWidth: 360 }}>
                            <span
                              style={{
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {r.title}
                            </span>
                          </td>
                          <td style={cell}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 2,
                                  background: SEVERITY_HEX[r.severity as Severity],
                                }}
                              />
                              {SEVERITY_LABEL[r.severity as Severity]}
                            </span>
                          </td>
                          <td style={cell}>{r.category}</td>
                          <td style={{ ...cell, textTransform: 'capitalize' }}>{r.status}</td>
                          <td style={cell}>
                            <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
                              {r.countries.slice(0, 4).map((c) => (
                                <CountryFlag key={c} code={c} size={13} title={c} />
                              ))}
                              {r.countries.length > 4 && (
                                <span style={{ color: 'var(--t-40)' }}>+{r.countries.length - 4}</span>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {rows.rows.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ ...cell, color: 'var(--t-40)' }}>
                            No alerts match this selection.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ font: '400 10.5px/1.6 var(--font-body)', color: 'var(--t-35)', paddingBottom: 4 }}>
              An alert is counted in the period it became real — when it was published, or when it was
              created if it never was. “Live right now” counts published alerts inside their validity
              window today, which is why it can be lower than the total published.
              {!summary.pipeline && ' Drafts and submissions are not included.'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const cell: React.CSSProperties = {
  padding: '9px 10px',
  borderBottom: '1px solid rgba(255,255,255,.05)',
  font: '400 12px var(--font-body)',
  color: 'var(--t-70)',
  whiteSpace: 'nowrap',
}
