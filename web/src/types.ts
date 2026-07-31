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
export type LocationScope = 'point' | 'country'

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

export type NotificationEvent = 'published' | 'closed' | 'submitted'

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
