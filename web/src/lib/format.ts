import type { Flow, Severity, TransportMode } from '../types'

export const SEVERITY_COLOR: Record<Severity, string> = {
  info: 'var(--sev-info)',
  watch: 'var(--sev-watch)',
  warning: 'var(--sev-warning)',
  critical: 'var(--sev-critical)',
}

// Feed badges use a light critical variant so the red text stays legible.
export const SEVERITY_TEXT: Record<Severity, string> = {
  info: 'var(--sev-info)',
  watch: 'var(--sev-watch)',
  warning: 'var(--sev-warning)',
  critical: 'var(--sev-critical-text)',
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  info: 'INFO',
  watch: 'WATCH',
  warning: 'WARNING',
  critical: 'CRITICAL',
}

// Marker size + text colour by severity (dashboard). Navy text on light dots.
export const MARKER_SPEC: Record<Severity, { size: number; text: string; border: string }> = {
  critical: { size: 32, text: '#fff', border: 'rgba(255,255,255,1)' },
  warning: { size: 26, text: '#fff', border: 'rgba(255,255,255,.85)' },
  watch: { size: 24, text: '#1B365F', border: 'rgba(255,255,255,.7)' },
  info: { size: 22, text: '#1B365F', border: 'rgba(255,255,255,.6)' },
}

const SEVERITY_RANK: Record<Severity, number> = { info: 0, watch: 1, warning: 2, critical: 3 }
export const maxSeverity = (a: Severity, b: Severity): Severity =>
  SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b

export const MODE_GLYPH: Record<TransportMode, string> = {
  sea: '⚓',
  road: '🚛',
  air: '✈',
  rail: '🚆',
  warehouse: '🏭',
}

export const MODE_LABEL: Record<TransportMode, string> = {
  sea: 'Sea',
  road: 'Road',
  air: 'Air',
  rail: 'Rail',
  warehouse: 'WH',
}

export const FLOW_LABEL: Record<Flow, string> = {
  import: 'Import',
  export: 'Export',
  both: 'Both',
}

export function modesLabel(modes: TransportMode[]): string {
  return modes.map((m) => MODE_LABEL[m]).join(' + ')
}

export function flowLabel(flow: Flow): string {
  return flow === 'both' ? 'Import + Export' : FLOW_LABEL[flow]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(iso: string | null): string {
  if (!iso) return 'until further notice'
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDateShort(iso: string | null): string {
  if (!iso) return 'open'
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// "08:42" for today, "11 Jul" for older — matches the feed's time column.
export function fmtFeedTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function fmtAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Day-group key for the live feed (Today / Yesterday / Earlier this week / older).
export function dayGroup(iso: string | null): string {
  if (!iso) return 'Earlier'
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days <= 7) return 'Earlier this week'
  return 'Earlier'
}

/** Normalise a user-typed source URL into something safe to put in an href.
 *
 * Authors type bare hosts ("reuters.com/article") far more often than full
 * URLs, and a bare host in an href resolves *relative to the app* — which is
 * why the source link used to do nothing. Assume https when no scheme is
 * given, and refuse anything that isn't http(s) so `javascript:` can't ride
 * in through an alert field.
 */
export function externalUrl(raw: string): string | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(candidate)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/** Short, human label for a source link — hostname without "www.". */
export function urlLabel(raw: string): string {
  const href = externalUrl(raw)
  if (!href) return raw
  return new URL(href).hostname.replace(/^www\./, '')
}

/** An alert's source URLs as openable links.
 *
 * Drops anything that isn't a usable http(s) link rather than render a dead
 * affordance — a source the reader can't open is worse than no source line.
 */
export function alertSources(urls: string[]): { href: string; label: string }[] {
  return urls.flatMap((raw) => {
    const href = externalUrl(raw)
    return href ? [{ href, label: urlLabel(raw) }] : []
  })
}

/** Display name for a location block.
 *
 * Stored names carry disambiguators the UI doesn't need next to a country
 * chip — a " — " suffix and/or a bracketed LOCODE ("Beira (MZBEW)"). Strip
 * both so a chip reads "Beira, MZ" rather than "Beira (MZBEW), MZ".
 */
export function placeLabel(name: string): string {
  return name.split(' — ')[0].replace(/\s*\([^)]*\)\s*$/, '').trim()
}
