import type { Alert, Flow, Severity, TransportMode } from '../types'

// --------------------------------------------------------------------------- //
// Alert search
//
// The map search used to be a single `includes()` over title + category +
// place + country, which meant most of what an alert actually captures —
// transport mode, flow, severity, nationwide scope, impacts, action plan,
// author — was unsearchable from the map.
//
// Two things make this more than a wider haystack:
//
//  1. The query is AND-ed token by token, not matched as one substring. A blob
//     `includes('rail nigeria')` can only ever hit if those words are adjacent
//     in that order, so every multi-word query was silently near-useless.
//     Per-token means "rail nigeria" reads as "rail, in Nigeria".
//  2. Matching is by WORD PREFIX, not raw substring. Substring is what people
//     reach for, but on this vocabulary it is mostly noise: "port" hits
//     transport and reports, "air" hits Cairo and repair, "rail" hits trail.
//     Prefix keeps as-you-type behaviour ("moz" → Mozambique) while a query
//     for a mode returns that mode. Enumerated fields match the same way
//     against a controlled vocabulary, so "rail" reaches rail-mode alerts that
//     never write the word "rail" in their prose.
// --------------------------------------------------------------------------- //

/** A token shorter than this is only matched against free text — two letters
 *  prefix-match far too much of the vocabulary to be useful. */
const MIN_ENUM_TOKEN = 3

const MODE_TERMS: Record<TransportMode, string[]> = {
  sea: ['sea', 'ocean', 'maritime', 'vessel', 'shipping'],
  road: ['road', 'truck', 'trucking', 'haulage'],
  air: ['air', 'airfreight', 'aviation', 'flight'],
  rail: ['rail', 'train', 'railway'],
  warehouse: ['warehouse', 'depot', 'storage'],
}

const FLOW_TERMS: Record<Flow, string[]> = {
  import: ['import', 'inbound'],
  export: ['export', 'outbound'],
  both: ['both'],
}

const SEVERITY_TERMS: Record<Severity, string[]> = {
  info: ['info', 'information', 'informational'],
  watch: ['watch'],
  warning: ['warning', 'warn'],
  critical: ['critical'],
}

const NATIONWIDE_TERMS = ['nationwide', 'countrywide', 'national', 'whole']

/** What the user can type beyond names — surfaced in the search dropdown,
 *  because a vocabulary nobody can see is a vocabulary nobody uses. */
export const SEARCH_HINTS = ['rail', 'sea', 'road', 'air', 'critical', 'import', 'nationwide']

/** Split to lowercase words on anything non-alphanumeric, so "Port-Gentil",
 *  "Côte d'Ivoire" and "MZBEW/2" all yield sensible searchable words. */
export function words(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

/** Free-text side of the haystack, in one function so the matcher and any
 *  highlighter can't drift apart on what "matches".
 *
 *  NB: `Feed.tsx` still has its own `haystack()` + single-needle `includes()`.
 *  It covers the same fields but not the enum vocabulary, and it can't do
 *  multi-token queries. Folding it onto this matcher also means teaching its
 *  `Highlight` to take several tokens — worth doing, not done here. */
export function alertText(a: Alert): string {
  return [
    a.title,
    a.description,
    a.impacts,
    a.action_plan,
    a.category,
    a.sub_category,
    a.industry ?? '',
    a.author.name,
    a.author.branch,
    ...a.locations.flatMap((l) => [l.name, l.code, l.country_name, l.country]),
  ].join(' ')
}

interface Facets {
  words: string[] // every free-text word on the alert
  terms: string[] // every vocabulary term this alert answers to
}

function facetsFor(a: Alert): Facets {
  const terms = new Set<string>(SEVERITY_TERMS[a.severity])
  for (const l of a.locations) {
    for (const m of l.modes) MODE_TERMS[m]?.forEach((t) => terms.add(t))
    // `both` genuinely covers each direction, so an import query must hit it.
    if (l.flow === 'both') {
      FLOW_TERMS.import.forEach((t) => terms.add(t))
      FLOW_TERMS.export.forEach((t) => terms.add(t))
    }
    FLOW_TERMS[l.flow]?.forEach((t) => terms.add(t))
    if (l.scope === 'country') NATIONWIDE_TERMS.forEach((t) => terms.add(t))
  }
  return { words: words(alertText(a)), terms: [...terms] }
}

export const tokenize = words

function hasPrefix(haystack: string[], token: string): boolean {
  return haystack.some((w) => w.startsWith(token))
}

function hitsEnum(token: string, terms: string[]): boolean {
  if (token.length < MIN_ENUM_TOKEN) return false
  return hasPrefix(terms, token)
}

/** Rough relevance, so "the alert actually called this" outranks "the phrase
 *  appears somewhere in its action plan". */
function score(a: Alert, tokens: string[], facets: Facets): number {
  const title = words(a.title)
  const where = words(a.locations.flatMap((l) => [l.name, l.country_name, l.country]).join(' '))
  const what = words([a.category, a.sub_category, a.industry ?? ''].join(' '))

  let total = 0
  // Phrase bonus: the whole query, in order, in the title.
  if (a.title.toLowerCase().includes(tokens.join(' '))) total += 100
  for (const t of tokens) {
    if (hasPrefix(title, t)) total += 10
    else if (hasPrefix(where, t)) total += 6
    else if (hasPrefix(what, t)) total += 4
    else if (hitsEnum(t, facets.terms)) total += 3
    else total += 1 // matched only in description/impacts/action plan
  }
  return total
}

/**
 * Alerts matching every token of `query`, best first.
 *
 * Exported for the dashboard as well as the search box: the map dims the
 * markers this does NOT return, so both must agree on what "matches" or the
 * dropdown starts offering alerts the map has just faded out.
 */
export function matchAlerts(alerts: Alert[], query: string): Alert[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  const scored: { alert: Alert; score: number }[] = []
  for (const a of alerts) {
    const facets = facetsFor(a)
    const ok = tokens.every((t) => hasPrefix(facets.words, t) || hitsEnum(t, facets.terms))
    if (ok) scored.push({ alert: a, score: score(a, tokens, facets) })
  }
  return scored.sort((x, y) => y.score - x.score).map((s) => s.alert)
}
