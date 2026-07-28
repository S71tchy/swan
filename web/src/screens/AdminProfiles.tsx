import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { CountryFlag } from '../components/CountryFlag'
import { AdminGate, AdminScreen } from '../components/adminUi'
import { ProfileEditor, type ProfileForm } from '../components/ProfileEditor'
import type { CountryRef, ProfileRow } from '../types'

export default function AdminProfiles() {
  const { user, refresh } = useAuth()
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [editProfile, setEditProfile] = useState<{ data: ProfileForm; isNew: boolean } | null>(null)

  const isManager = user?.rights.is_rights_manager

  async function reload() {
    setProfiles(await api.adminProfiles())
  }

  useEffect(() => {
    if (!isManager) return
    void api.adminCountries().then(setCountries).catch(() => setCountries([]))
    void reload()
  }, [isManager])

  if (!user) return null
  if (!isManager) return <AdminGate breadcrumb="Settings · Profiles" />

  async function saveProfile(payload: ProfileForm, isNew: boolean) {
    if (isNew) await api.adminCreateProfile(payload)
    else
      await api.adminUpdateProfile(payload.name, {
        countries: payload.countries,
        embeds_rights_manager: payload.embeds_rights_manager,
      })
    setEditProfile(null)
    await reload()
    await refresh() // a profile edit can change my own effective rights
  }
  async function deleteProfile(name: string) {
    await api.adminDeleteProfile(name)
    setEditProfile(null)
    await reload()
    await refresh()
  }

  return (
    <AdminScreen
      title="Profiles"
      description="Named bundles of country rights. Edits propagate live to every holder."
      actions={
        <Button
          variant="primary"
          onClick={() => setEditProfile({ data: { name: '', countries: [], embeds_rights_manager: false }, isNew: true })}
        >
          <PlusIcon size={13} stroke="var(--agl-navy)" />
          New profile
        </Button>
      }
    >
      <div className="scroll-y" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {profiles.map((p) => (
            <div
              key={p.name}
              onClick={() =>
                setEditProfile({
                  data: { name: p.name, countries: [...p.countries], embeds_rights_manager: p.embeds_rights_manager },
                  isNew: false,
                })
              }
              style={{
                borderRadius: 16,
                background: 'var(--glass-90)',
                border: '1px solid var(--border-mid)',
                backdropFilter: 'blur(18px)',
                padding: 18,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ font: '600 14px var(--font-display)', color: '#fff' }}>{p.name}</div>
                <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>
                  {p.holders} holder{p.holders === 1 ? '' : 's'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {p.countries.length === 0 && (
                  <span style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>No countries</span>
                )}
                {p.countries.map((c) => (
                  <span
                    key={c}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,.06)',
                      border: '1px solid var(--border-soft)',
                      font: '500 10.5px var(--font-body)',
                      color: 'var(--t-75)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <CountryFlag code={c} size={13} />
                    {c}
                  </span>
                ))}
              </div>
              {p.embeds_rights_manager && (
                <span
                  style={{
                    alignSelf: 'flex-start',
                    padding: '3px 9px',
                    borderRadius: 12,
                    background: 'var(--yellow-tint)',
                    border: '1px solid var(--yellow-border)',
                    font: '500 10px var(--font-body)',
                    color: 'var(--agl-yellow)',
                  }}
                >
                  Embeds Rights Manager
                </span>
              )}
            </div>
          ))}
          {profiles.length === 0 && (
            <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>No profiles defined yet.</div>
          )}
        </div>
      </div>

      {editProfile && (
        <ProfileEditor
          initial={editProfile.data}
          isNew={editProfile.isNew}
          countries={countries}
          onClose={() => setEditProfile(null)}
          onSaved={(payload) => saveProfile(payload, editProfile.isNew)}
          onDeleted={!editProfile.isNew ? () => deleteProfile(editProfile.data.name) : undefined}
        />
      )}
    </AdminScreen>
  )
}
