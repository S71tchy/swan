// Thin fetch wrapper. All calls go through the Vite proxy (/api -> :8000) so the
// session cookie is same-origin. Swap BASE for a real host in production.
import type {
  AdminUserInput,
  AdminUserRow,
  Alert,
  ApprovalQueue,
  CountryRef,
  DashboardStats,
  ExternalVariant,
  Place,
  PlaceInput,
  PlaceRow,
  ProfileInput,
  ProfileRow,
  RoutingInfo,
  Taxonomy,
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
  logout: () => req<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  session: () => req<UserPublic>('/auth/session'),
  accounts: () => req<UserPublic[]>('/auth/accounts'),

  // me
  me: () => req<UserMe>('/users/me'),
  updateNotifications: (body: UserMe['notifications']) =>
    req<UserMe['notifications']>('/users/me/notifications', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // dashboard + meta
  dashboard: () => req<DashboardStats>('/dashboard/stats'),
  taxonomy: () => req<Taxonomy>('/meta/taxonomy'),
  places: (q = '') => req<Place[]>(`/meta/places?q=${encodeURIComponent(q)}`),
  countries: () => req<CountryRef[]>('/meta/countries'),

  // alerts
  feed: (scope: 'published' | 'map' | 'mine' = 'published') =>
    req<Alert[]>(`/alerts?scope=${scope}`),
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
}
