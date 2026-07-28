import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { CountryFlag } from '../components/CountryFlag'
import { AdminGate, AdminScreen, PendingBadge, listPanelStyle } from '../components/adminUi'
import { UserEditor, emptyUser, rowToForm, type UserForm } from '../components/UserEditor'
import type { AdminUserRow, CountryRef, ProfileRow } from '../types'

const COLUMNS = '2.4fr 1.3fr .8fr 1.6fr 1.6fr .9fr'

export default function AdminUsers() {
  const { user, refresh } = useAuth()
  const [onlyPending, setOnlyPending] = useState(false)
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [editUser, setEditUser] = useState<{ form: UserForm; id?: string; hasPassword?: boolean } | null>(null)

  const isManager = user?.rights.is_rights_manager

  async function reload() {
    // Profiles come along for the ride: the editor grants them as rights bundles.
    const [u, p] = await Promise.all([api.adminUsers(), api.adminProfiles()])
    setUsers(u)
    setProfiles(p)
  }

  useEffect(() => {
    if (!isManager) return
    void api.adminCountries().then(setCountries).catch(() => setCountries([]))
    void api
      .taxonomy()
      .then((t) => {
        setRoles(t.roles)
        setCategories(Object.keys(t.categories))
      })
      .catch(() => setRoles([]))
    void reload()
  }, [isManager])

  if (!user) return null
  if (!isManager) return <AdminGate breadcrumb="Settings · Users" />

  async function saveUser(payload: UserForm, id?: string) {
    if (id) await api.adminUpdateUser(id, payload)
    else await api.adminCreateUser(payload)
    setEditUser(null)
    await reload()
    if (id && id === user!.id) await refresh() // my own rights may have changed
  }
  async function deleteUser(id: string) {
    await api.adminDeleteUser(id)
    setEditUser(null)
    await reload()
  }
  // One-click activation from the list (no drawer). Rights stay zero until edited.
  async function validateUser(id: string) {
    await api.adminUpdateUser(id, { status: 'active' })
    await reload()
  }

  const pendingCount = users.filter((u) => u.status === 'pending').length
  const shownUsers = onlyPending ? users.filter((u) => u.status === 'pending') : users

  const reachLabel = (codes: string[]) =>
    codes.length === 0 ? (
      '—'
    ) : (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
        {codes.map((c) => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CountryFlag code={c} size={13} />
            {c}
          </span>
        ))}
      </span>
    )

  return (
    <AdminScreen
      title="Users"
      description="Identities and the four rights dimensions. Every change is audited."
      actions={
        <>
          <button
            onClick={() => setOnlyPending((v) => !v)}
            title="Show only accounts awaiting validation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 10,
              cursor: 'pointer',
              font: '600 12px var(--font-display)',
              color: onlyPending ? 'var(--agl-navy)' : pendingCount > 0 ? 'var(--agl-yellow)' : 'var(--t-60)',
              background: onlyPending ? 'var(--agl-yellow)' : pendingCount > 0 ? 'var(--yellow-tint)' : 'rgba(255,255,255,.05)',
              border: `1px solid ${onlyPending || pendingCount > 0 ? 'var(--yellow-border-strong)' : 'var(--border-soft)'}`,
            }}
          >
            {pendingCount > 0 && !onlyPending && (
              <span className="glow-dot" style={{ width: 7, height: 7, background: 'var(--agl-yellow)' }} />
            )}
            {onlyPending ? 'Show all' : `Pending${pendingCount > 0 ? ` · ${pendingCount}` : ''}`}
          </button>
          <Button variant="primary" onClick={() => setEditUser({ form: emptyUser() })}>
            <PlusIcon size={13} stroke="var(--agl-navy)" />
            New user
          </Button>
        </>
      }
    >
      <div className="scroll-y" style={listPanelStyle}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: COLUMNS,
            gap: 12,
            padding: '14px 22px',
            position: 'sticky',
            top: 0,
            background: 'rgba(15,27,46,.9)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            font: '600 10px var(--font-display)',
            color: 'var(--t-45)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            zIndex: 1,
          }}
        >
          <span>User</span>
          <span>Role</span>
          <span>Create</span>
          <span>Internal reach</span>
          <span>External reach</span>
          <span>Manager</span>
        </div>
        {shownUsers.map((u) => {
          const pending = u.status === 'pending'
          return (
            <div
              key={u.id}
              onClick={() => setEditUser({ form: rowToForm(u), id: u.id, hasPassword: u.has_password })}
              style={{
                display: 'grid',
                gridTemplateColumns: COLUMNS,
                gap: 12,
                padding: '13px 22px',
                borderBottom: '1px solid rgba(255,255,255,.055)',
                borderLeft: pending ? '2px solid var(--agl-yellow)' : '2px solid transparent',
                alignItems: 'center',
                cursor: 'pointer',
                font: '400 12.5px var(--font-body)',
                color: 'var(--t-80)',
                background: pending ? 'rgba(238,213,142,.05)' : 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = pending ? 'rgba(238,213,142,.09)' : 'rgba(255,255,255,.03)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = pending ? 'rgba(238,213,142,.05)' : 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <Avatar initials={u.initials} gold={u.avatar_gold} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: '600 12.5px var(--font-body)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 7 }}>
                    {u.name}
                    {u.id === user.id && (
                      <span style={{ color: 'var(--agl-yellow)', font: '500 10px var(--font-body)' }}>you</span>
                    )}
                    {pending && <PendingBadge />}
                  </div>
                  <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email}
                  </div>
                </div>
              </div>
              {pending ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    void validateUser(u.id)
                  }}
                  style={{
                    justifySelf: 'start',
                    padding: '6px 12px',
                    borderRadius: 9,
                    cursor: 'pointer',
                    font: '600 11px var(--font-display)',
                    color: 'var(--agl-navy)',
                    background: 'var(--agl-yellow)',
                    border: 'none',
                  }}
                >
                  Validate
                </button>
              ) : (
                <span style={{ color: 'var(--t-65)' }}>{u.role_label}</span>
              )}
              <span style={{ color: u.can_create ? 'var(--agl-yellow)' : 'var(--t-40)' }}>
                {u.can_create ? '✓' : '—'}
              </span>
              <span style={{ color: 'var(--t-70)' }}>{reachLabel(u.effective_internal)}</span>
              <span style={{ color: 'var(--t-70)' }}>{reachLabel(u.effective_external)}</span>
              <span style={{ color: u.is_effective_manager ? 'var(--agl-yellow)' : 'var(--t-40)' }}>
                {u.is_effective_manager ? '✓' : '—'}
              </span>
            </div>
          )
        })}
        {shownUsers.length === 0 && (
          <div style={{ padding: '16px 22px', font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>
            No accounts are awaiting validation.
          </div>
        )}
        <div style={{ padding: '14px 22px', font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>
          Self-registered accounts arrive with zero rights and a Pending flag — configure their rights and validate them here.
        </div>
      </div>

      {editUser && (
        <UserEditor
          initial={editUser.form}
          isNew={!editUser.id}
          userId={editUser.id}
          countries={countries}
          profiles={profiles}
          roles={roles}
          categories={categories}
          editingSelf={editUser.id === user.id}
          hasPassword={editUser.hasPassword ?? false}
          onClose={() => setEditUser(null)}
          onSaved={(payload) => saveUser(payload, editUser.id)}
          onDeleted={editUser.id ? () => deleteUser(editUser.id!) : undefined}
        />
      )}
    </AdminScreen>
  )
}
