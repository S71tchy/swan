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
