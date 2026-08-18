// Mirrors server/app/schemas.py — the API contract.

export type Severity = 'info' | 'watch' | 'warning' | 'critical'
export type AlertStatus =
  | 'draft'
  | 'submitted'
  | 'published'
  | 'rejected'
  | 'closed'
  | 'expired'
export type TransportMode = 'sea' | 'road' | 'air' | 'rail' | 'warehouse'
export type Flow = 'import' | 'export' | 'both'

/** How much of the map a location block covers.
 *
 * `point` is a specific place (port, border post, warehouse). `country` flags
 * the whole nation — elections, national strikes, currency controls — and the
 * dashboard paints the country polygon instead of relying on the pin alone.
 * Scope lives on the *block*, not the alert, so one alert can carry
 * "Nigeria nationwide, Road+Rail" alongside "Apapa, Sea" with their own modes.
 */
export type LocationScope = 'point' | 'country' | 'zone'

export interface LocationBlock {
  name: string
  code: string
  country: string
  country_name: string
  flag: string
  lat: number
  lng: number
  modes: TransportMode[]
  flow: Flow
  /** Absent on alerts created before nationwide scope existed — treat as 'point'. */
  scope?: LocationScope
  /** Zone blocks only. A zone spans several countries (Hormuz is IR + OM) or
   *  none (open ocean), which the singular `country` cannot express — and every
   *  rights decision reads these. Empty means no perimeter covers the alert, so
   *  it escalates to Rights Managers. */
  countries?: string[]
  /** Zone blocks only: a copy of the shape as filed, so the map draws the alert
   *  the way it was written even if the master zone is later edited. */
  geometry?: { type: 'Polygon'; coordinates: number[][][] } | null
}

export interface AlertAuthor {
  id: string
  name: string
  initials: string
  branch: string
}

export interface Alert {
  id: string
  title: string
  description: string
  picture_url: string | null
  category: string
  sub_category: string
  industry: string | null
  severity: Severity
  status: AlertStatus
  origin: string
  visibility: string
  valid_from: string
  valid_to: string | null
  valid_to_label: string
  impacts: string
  action_plan: string
  locations: LocationBlock[]
  urls: string[]
  attachments: unknown[]
  clients: string[]
  external_variant: { mode: string; title?: string; description?: string } | null
  rejection_comment: string | null
  author: AlertAuthor
  created_at: string
  updated_at: string
  submitted_at: string | null
  published_at: string | null
  closed_at: string | null
}

export interface RightsSummary {
  can_create: boolean
  is_rights_manager: boolean
  internal_countries: string[]
  external_countries: string[]
  client_scope: string[]
  profiles: string[]
  perimeter_label: string
}

export interface PerimeterRow {
  country: string
  country_name: string
  flag: string
  source: string
  internal: boolean
  external: boolean
}

/** A trigger name from the server template catalog (see NotificationTrigger).
 *  Deliberately a plain string rather than a union: the catalog is server-owned
 *  and grew to nine triggers, and pinning three of them here is exactly what
 *  kept the editor unable to offer the rest. */
export type NotificationEvent = string

export interface Subscription {
  id: string
  name: string
  active: boolean
  events: NotificationEvent[]
  countries: string[]
  profiles: string[]
  categories: string[]
  min_severity: Severity
}

export type SubscriptionInput = Omit<Subscription, 'id'>

export interface UserStats {
  created: number
  published: number
  last_alert: string | null
}

export interface UserPublic {
  id: string
  email: string
  name: string
  initials: string
  job_title: string
  branch: string
  role_label: string
  home_country: string
  home_country_name: string
  phone: string
  locale: string
  timezone: string
  avatar_gold: boolean
  status: string
  /** Global email switch. True = every notification is paused for this account. */
  email_opt_out: boolean
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export interface UserMe extends UserPublic {
  rights: RightsSummary
  subscriptions: Subscription[]
  perimeter: PerimeterRow[]
  stats: UserStats
}

export interface DashboardStats {
  active_alerts: number
  severity: { info: number; watch: number; warning: number; critical: number }
  awaiting_your_approval: number
  countries_affected: number
  updated_at: string
}

/** Change stamp for the map's alert set. Polled instead of the feed itself,
 *  which inlines every alert picture as a data URI (~130 KB for 13 alerts). */
export interface LiveVersion {
  version: string
  count: number
}

export interface RoutingInfo {
  countries: string[]
  covered: string[]
  uncovered: string[]
  action: 'publish' | 'submit'
  can_publish: boolean
  /** External publication is granted separately from internal. */
  can_publish_external: boolean
  external_uncovered: string[]
}

export interface Place {
  name: string
  code: string
  country: string
  country_name: string
  flag: string
  lat: number
  lng: number
  label: string
}

export interface Taxonomy {
  categories: Record<string, string[]>
  industries: string[]
  modes: TransportMode[]
  flows: Flow[]
  severities: Severity[]
  profiles: string[]
  roles: string[]
}

/** One reviewable submission, with why it's in your queue. */
export interface ApprovalItem {
  alert: Alert
  countries: string[]
  covered: string[]
  uncovered: string[]
  /** Only actionable because you're a Rights Manager and nobody's perimeter covers it. */
  escalated: boolean
  can_publish_external: boolean
  external_uncovered: string[]
}

export interface ApprovalQueue {
  perimeter_label: string
  pending: number
  escalated: number
  items: ApprovalItem[]
}

export interface ExternalVariant {
  mode: 'identical' | 'modified' | 'none'
  title?: string
  description?: string
}

// --- Admin: rights & user administration ---
export interface CountryRef {
  code: string
  name: string
  flag: string
}

export interface ProfileRow {
  name: string
  countries: string[]
  embeds_rights_manager: boolean
  holders: number
}

export interface AdminUserRow {
  id: string
  email: string
  name: string
  initials: string
  job_title: string
  branch: string
  role_label: string
  home_country: string
  home_country_name: string
  phone: string
  locale: string
  timezone: string
  avatar_gold: boolean
  can_create: boolean
  is_rights_manager: boolean
  internal_pub_countries: string[]
  external_pub_countries: string[]
  client_scope: string[]
  profiles: string[]
  effective_internal: string[]
  effective_external: string[]
  is_effective_manager: boolean
  alerts_authored: number
  has_password: boolean
  status: string
}

export interface AdminUserInput {
  email: string
  name: string
  initials?: string
  job_title?: string
  branch?: string
  role_label?: string
  home_country?: string
  phone?: string
  locale?: string
  timezone?: string
  avatar_gold?: boolean
  can_create?: boolean
  is_rights_manager?: boolean
  internal_pub_countries?: string[]
  external_pub_countries?: string[]
  client_scope?: string[]
  profiles?: string[]
  password?: string
  status?: string
}

export interface ProfileInput {
  name: string
  countries?: string[]
  embeds_rights_manager?: boolean
}

export interface PlaceRow {
  code: string
  name: string
  country: string
  country_name: string
  flag: string
  lat: number
  lng: number
  aliases: string[]
  usage: number
}

export interface PlaceInput {
  code: string
  name: string
  country: string
  lat: number
  lng: number
  aliases?: string[]
  /** Accept a flagged duplicate and create it anyway. */
  confirm_duplicate?: boolean
}

// --- Editable taxonomy (Settings → Reference data) ---
export interface CategoryRow {
  name: string
  sub_categories: string[]
  position: number
  /** Alerts carrying this category — a rename moves them, a delete is refused. */
  usage: number
  /** Alerts per sub-category, so the editor can name what blocks a removal. */
  sub_usage: Record<string, number>
  /** Notification subscriptions filtering on this name. The reason renames cascade. */
  subscriptions: number
}

export interface CategoryInput {
  name?: string
  sub_categories?: string[]
  position?: number
  /** {old: new} for sub-categories edited in place; applied before the list swap. */
  rename_sub?: Record<string, string>
}

export interface IndustryRow {
  name: string
  position: number
  usage: number
}

// --- Duplicate detection (places + zones) ---
export interface DuplicateMatch {
  code: string
  name: string
  /** Human-readable and shown verbatim — the server owns the wording. */
  reason: string
  distance_m: number | null
}

export interface DuplicateReport {
  matches: DuplicateMatch[]
}

// --- Zones (custom polygon / radius master data) ---
export interface ZoneRow {
  code: string
  name: string
  kind: 'polygon' | 'radius'
  /** Declared rights perimeter. Empty = international waters, escalates. */
  countries: string[]
  country_names: string[]
  geometry: { type: 'Polygon'; coordinates: number[][][] }
  lat: number
  lng: number
  radius_m: number | null
  aliases: string[]
  notes: string
  usage: number
}

export interface ZoneInput {
  code?: string
  name: string
  kind: 'polygon' | 'radius'
  countries: string[]
  geometry?: { type: 'Polygon'; coordinates: number[][][] }
  lat?: number
  lng?: number
  radius_m?: number
  aliases?: string[]
  notes?: string
  confirm_duplicate?: boolean
}

// --- Analytics ---
export interface NamedCount {
  name: string
  count: number
}

export interface CountryCount {
  code: string
  name: string
  count: number
}

export interface SeriesPoint {
  bucket: string
  info: number
  watch: number
  warning: number
  critical: number
  total: number
}

export interface AnalyticsTotals {
  alerts: number
  previous_alerts: number
  live_now: number
  published: number
  closed: number
  expired: number
  countries: number
  authors: number
  open_ended: number
  median_days_live: number | null
}

/** Rights-Manager only — absent from the payload entirely for everyone else. */
export interface PipelineStats {
  draft: number
  submitted: number
  rejected: number
  published: number
  closed: number
  rejection_rate: number | null
  median_approval_hours: number | null
  via_approval: number
  direct_publish: number
  top_authors: NamedCount[]
}

export interface AnalyticsSummary {
  range: { start: string; end: string; bucket: 'day' | 'week' | 'month'; days: number }
  totals: AnalyticsTotals
  severity: Record<Severity, number>
  series: SeriesPoint[]
  by_category: NamedCount[]
  by_sub_category: NamedCount[]
  by_industry: NamedCount[]
  by_mode: NamedCount[]
  by_country: CountryCount[]
  pipeline: PipelineStats | null
}

export interface AnalyticsRow {
  id: string
  title: string
  status: string
  severity: string
  category: string
  sub_category: string
  industry: string | null
  countries: string[]
  modes: string[]
  effective_at: string | null
  published_at: string | null
  closed_at: string | null
  valid_from: string | null
  valid_to: string | null
}

export interface AnalyticsRows {
  total: number
  rows: AnalyticsRow[]
}

// --- Notification triggers + unsubscribe ---
/** One subscribable trigger, from the server template catalog. */
export interface NotificationTrigger {
  event: string
  label: string
  description: string
  /** zone = fan-out by perimeter, participant = addressed to you, managers = Rights Managers. */
  audience: 'zone' | 'participant' | 'managers'
  /** Which subscription filters mean anything here. Empty = none do. */
  filters: ('zone' | 'category' | 'severity')[]
}

export interface UnsubscribeState {
  recipient_name: string
  email: string
  opted_out: boolean
  subscription_id: string | null
  subscription_name: string | null
  subscription_active: boolean | null
  subscription_summary: string | null
  active_subscriptions: number
}

export type UnsubscribeScope = 'subscription' | 'all' | 'resume'

/** Public answer to "must I use a work address?" — no domain list, by design. */
export interface RegistrationPolicy {
  corporate_only: boolean
}

// --- Blocked email domains (Settings -> Email domains) ---
export interface EmailDomainRule {
  /** Normalised server-side: lower-case, no leading '@'. */
  pattern: string
  note: string
  active: boolean
  /** Existing accounts on this domain. A rule is never retroactive, so this is
   *  context — but a large number usually means the pattern is too wide. */
  accounts: number
}

export interface EmailDomainRuleInput {
  pattern: string
  note?: string
  active?: boolean
}

export interface EmailDomainCheck {
  allowed: boolean
  pattern: string | null
  message: string | null
}

// --- Email notification templates (admin editor) ---
export interface TemplateLocaleData {
  subject: string
  body: string
  overridden: boolean
}

export interface TemplateEntry {
  key: string
  label: string
  description: string
  kind: 'broadcast' | 'transactional'
  tokens: string[]
  en: TemplateLocaleData
  fr: TemplateLocaleData
}

export interface TemplatePreview {
  subject: string
  body: string
}

// --- OpenAPI (Settings → API & integrations) ---
// Only the slice of the OpenAPI 3.1 document the API page actually renders.
export interface OpenApiOperation {
  summary?: string
  description?: string
  tags?: string[]
  deprecated?: boolean
}

export interface OpenApiDoc {
  openapi: string
  info: { title: string; version: string; description?: string }
  paths: Record<string, Record<string, OpenApiOperation>>
}
