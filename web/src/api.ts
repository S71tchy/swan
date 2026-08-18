// Thin fetch wrapper. Every call is same-origin under /api: in dev via the Vite
// proxy to :8000, in prod because FastAPI serves both the API (/api) and the
// built app from one origin — so the session cookie is always same-site.
import type {
  AdminUserInput,
  AdminUserRow,
  Alert,
  ApprovalQueue,
  CategoryInput,
  CategoryRow,
  CountryRef,
  EmailDomainCheck,
  EmailDomainRule,
  EmailDomainRuleInput,
  IndustryRow,
  DashboardStats,
  ExternalVariant,
  LiveVersion,
  NotificationTrigger,
  OpenApiDoc,
  Place,
  PlaceInput,
  PlaceRow,
  ProfileInput,
  ProfileRow,
  RegisterInput,
  RegistrationPolicy,
  RoutingInfo,
  Subscription,
  SubscriptionInput,
  Taxonomy,
  UnsubscribeScope,
  UnsubscribeState,
  TemplateEntry,
  TemplatePreview,
  UserMe,
  UserPublic,
} from './types'

const BASE = '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export const api = {
  // auth
  login: (email?: string) =>
    req<UserPublic>('/auth/login', { method: 'POST', body: JSON.stringify({ email: email ?? null }) }),
  passwordLogin: (email: string, password: string) =>
    req<UserPublic>('/auth/password-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (body: RegisterInput) =>
    req<UserPublic>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => req<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  session: () => req<UserPublic>('/auth/session'),
  accounts: () => req<UserPublic[]>('/auth/accounts'),

  // me
  me: () => req<UserMe>('/users/me'),
  /** The global "stop all email" switch, and the way back from it. */
  setEmailOptOut: (email_opt_out: boolean) =>
    req<UserPublic>('/users/me/notifications', { method: 'PATCH', body: JSON.stringify({ email_opt_out }) }),

  // notification subscriptions (self-service)
  createSubscription: (body: SubscriptionInput) =>
    req<Subscription>('/users/me/subscriptions', { method: 'POST', body: JSON.stringify(body) }),
  updateSubscription: (id: string, body: Partial<SubscriptionInput>) =>
    req<Subscription>(`/users/me/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSubscription: (id: string) =>
    req<void>(`/users/me/subscriptions/${id}`, { method: 'DELETE' }),

  // dashboard + meta
  dashboard: () => req<DashboardStats>('/dashboard/stats'),
  taxonomy: () => req<Taxonomy>('/meta/taxonomy'),
  places: (q = '') => req<Place[]>(`/meta/places?q=${encodeURIComponent(q)}`),
  countries: () => req<CountryRef[]>('/meta/countries'),
  /** Everything a subscription can be built from (the email template catalog). */
  notificationTriggers: () => req<NotificationTrigger[]>('/meta/notification-triggers'),

  /** Is a corporate address required to register? Login screen hint only. */
  registrationPolicy: () => req<RegistrationPolicy>('/meta/registration-policy'),

  // alerts
  feed: (scope: 'published' | 'map' | 'mine' = 'published') =>
    req<Alert[]>(`/alerts?scope=${scope}`),
  /** Change stamp for the map's alert set — tiny, safe to poll. See LiveVersion. */
  liveVersion: () => req<LiveVersion>('/alerts/live-version'),
  alert: (id: string) => req<Alert>(`/alerts/${id}`),
  routing: (body: Partial<Alert>) =>
    req<RoutingInfo>('/alerts/routing', { method: 'POST', body: JSON.stringify(body) }),
  createAlert: (body: Record<string, unknown>) =>
    req<Alert>('/alerts', { method: 'POST', body: JSON.stringify(body) }),
  updateAlert: (id: string, body: Record<string, unknown>) =>
    req<Alert>(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  submit: (id: string) => req<Alert>(`/alerts/${id}/submit`, { method: 'POST' }),
  publish: (id: string, external: ExternalVariant) =>
    req<Alert>(`/alerts/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ content_confirmed: true, external }),
    }),
  reject: (id: string, comment: string) =>
    req<Alert>(`/alerts/${id}/reject`, { method: 'POST', body: JSON.stringify({ comment }) }),
  close: (id: string) => req<Alert>(`/alerts/${id}/close`, { method: 'POST' }),

  // approvals
  approvals: () => req<ApprovalQueue>('/approvals'),

  // unsubscribe — no session: the signed token in the email link is the auth.
  // Both are POSTs so that a mail scanner fetching the page URL cannot act.
  unsubscribePreview: (token: string) =>
    req<UnsubscribeState>('/notifications/unsubscribe/preview', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  unsubscribe: (token: string, scope: UnsubscribeScope) =>
    req<UnsubscribeState>('/notifications/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ token, scope }),
    }),

  // admin — rights & user administration (Rights Manager only)
  adminCountries: () => req<CountryRef[]>('/admin/countries'),
  adminUsers: () => req<AdminUserRow[]>('/admin/users'),
  adminCreateUser: (body: AdminUserInput) =>
    req<AdminUserRow>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateUser: (id: string, body: Partial<AdminUserInput>) =>
    req<AdminUserRow>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminDeleteUser: (id: string) =>
    req<void>(`/admin/users/${id}`, { method: 'DELETE' }),
  adminProfiles: () => req<ProfileRow[]>('/admin/profiles'),
  adminCreateProfile: (body: ProfileInput) =>
    req<ProfileRow>('/admin/profiles', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateProfile: (name: string, body: Omit<ProfileInput, 'name'>) =>
    req<ProfileRow>(`/admin/profiles/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminDeleteProfile: (name: string) =>
    req<void>(`/admin/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  adminPlaces: () => req<PlaceRow[]>('/admin/places'),
  adminCreatePlace: (body: PlaceInput) =>
    req<PlaceRow>('/admin/places', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdatePlace: (code: string, body: Partial<Omit<PlaceInput, 'code'>>) =>
    req<PlaceRow>(`/admin/places/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminDeletePlace: (code: string) =>
    req<void>(`/admin/places/${encodeURIComponent(code)}`, { method: 'DELETE' }),

  // admin — a user's notification subscriptions
  adminUserSubscriptions: (userId: string) =>
    req<Subscription[]>(`/admin/users/${userId}/subscriptions`),
  adminCreateUserSubscription: (userId: string, body: SubscriptionInput) =>
    req<Subscription>(`/admin/users/${userId}/subscriptions`, { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateUserSubscription: (userId: string, subId: string, body: Partial<SubscriptionInput>) =>
    req<Subscription>(`/admin/users/${userId}/subscriptions/${subId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminDeleteUserSubscription: (userId: string, subId: string) =>
    req<void>(`/admin/users/${userId}/subscriptions/${subId}`, { method: 'DELETE' }),

  // admin — editable taxonomy (categories + industries)
  adminCategories: () => req<CategoryRow[]>('/admin/categories'),
  adminCreateCategory: (body: { name: string; sub_categories?: string[] }) =>
    req<CategoryRow>('/admin/categories', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateCategory: (name: string, body: CategoryInput) =>
    req<CategoryRow>(`/admin/categories/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminDeleteCategory: (name: string) =>
    req<void>(`/admin/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  adminIndustries: () => req<IndustryRow[]>('/admin/industries'),
  adminCreateIndustry: (name: string) =>
    req<IndustryRow>('/admin/industries', { method: 'POST', body: JSON.stringify({ name }) }),
  adminUpdateIndustry: (name: string, body: { name?: string; position?: number }) =>
    req<IndustryRow>(`/admin/industries/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminDeleteIndustry: (name: string) =>
    req<void>(`/admin/industries/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  // admin — blocked email domains (registration / user-creation policy)
  adminEmailDomains: () => req<EmailDomainRule[]>('/admin/email-domains'),
  adminCreateEmailDomain: (body: EmailDomainRuleInput) =>
    req<EmailDomainRule>('/admin/email-domains', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateEmailDomain: (pattern: string, body: Partial<EmailDomainRuleInput>) =>
    req<EmailDomainRule>(`/admin/email-domains/${encodeURIComponent(pattern)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminDeleteEmailDomain: (pattern: string) =>
    req<void>(`/admin/email-domains/${encodeURIComponent(pattern)}`, { method: 'DELETE' }),
  /** Would this address be refused? Asks the server rather than re-implementing
   *  the wildcard/subdomain rules in the browser — one definition of "blocked". */
  adminCheckEmailDomain: (email: string) =>
    req<EmailDomainCheck>('/admin/email-domains/check', { method: 'POST', body: JSON.stringify({ email }) }),

  // admin — email templates
  adminTemplates: () => req<TemplateEntry[]>('/admin/templates'),
  adminUpdateTemplate: (key: string, locale: string, body: { subject: string; body: string }) =>
    req<TemplateEntry>(`/admin/templates/${key}/${locale}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminResetTemplate: (key: string, locale: string) =>
    req<TemplateEntry>(`/admin/templates/${key}/${locale}`, { method: 'DELETE' }),
  adminPreviewTemplate: (key: string, locale: string, body: { subject: string; body: string }) =>
    req<TemplatePreview>(`/admin/templates/${key}/${locale}/preview`, { method: 'POST', body: JSON.stringify(body) }),
  adminTestTemplate: (key: string, locale: string, body: { subject: string; body: string; to?: string }) =>
    req<{ sent_to: string }>(`/admin/templates/${key}/${locale}/test`, { method: 'POST', body: JSON.stringify(body) }),

  // the API's own OpenAPI document — FastAPI serves it under /api alongside the
  // routes it describes, so it comes through the same proxy as everything else
  openapi: () => req<OpenApiDoc>('/openapi.json'),
}

// Absolute doc URLs, for links that must open outside the SPA router.
export const API_DOCS = {
  swagger: `${BASE}/docs`,
  redoc: `${BASE}/redoc`,
  spec: `${BASE}/openapi.json`,
}
