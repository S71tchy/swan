import { useState } from 'react'
import { ApiError } from '../api'
import { Button } from './ui'
import { CountryPicker, Drawer, Field, FormError, ToggleRow, inputStyle } from './adminUi'
import type { CountryRef } from '../types'

// The rights-profile drawer, opened from Settings → Profiles. A profile is a
// named bundle of country rights resolved at read time, so edits propagate live
// to every holder — never a point-in-time copy.

export type ProfileForm = { name: string; countries: string[]; embeds_rights_manager: boolean }

export function ProfileEditor({
  initial,
  isNew,
  countries,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial: ProfileForm
  isNew: boolean
  countries: CountryRef[]
  onClose: () => void
  onSaved: (payload: ProfileForm) => Promise<void>
  onDeleted?: () => Promise<void>
}) {
  const [form, setForm] = useState<ProfileForm>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleCountry(code: string) {
    setForm((f) => ({
      ...f,
      countries: f.countries.includes(code) ? f.countries.filter((x) => x !== code) : [...f.countries, code],
    }))
  }

  async function save() {
    setError(null)
    if (!form.name.trim()) {
      setError('Profile name is required.')
      return
    }
    setBusy(true)
    try {
      await onSaved(form)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!onDeleted) return
    setError(null)
    setBusy(true)
    try {
      await onDeleted()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete.')
      setBusy(false)
    }
  }

  return (
    <Drawer onClose={onClose}>
      <div style={{ padding: '26px 26px 30px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ font: '600 17px var(--font-display)', color: '#fff' }}>
            {isNew ? 'New profile' : form.name}
          </div>
          <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
            A named bundle of country rights. Editing it propagates live to every holder.
          </div>
        </div>

        <Field label="Profile name">
          <input
            style={{ ...inputStyle, opacity: isNew ? 1 : 0.6, textTransform: 'uppercase' }}
            value={form.name}
            disabled={!isNew}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))}
          />
        </Field>

        <div>
          <div style={{ font: '500 11.5px var(--font-body)', color: 'var(--t-70)', marginBottom: 8 }}>
            Countries ({form.countries.length})
          </div>
          <CountryPicker countries={countries} selected={form.countries} onToggle={toggleCountry} />
        </div>

        <ToggleRow
          label="Embeds Rights Manager"
          hint="Holders of this profile gain administration access"
          on={form.embeds_rights_manager}
          onToggle={() => setForm((f) => ({ ...f, embeds_rights_manager: !f.embeds_rights_manager }))}
        />

        {error && <FormError>{error}</FormError>}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          <Button variant="primary" disabled={busy} onClick={save}>
            {isNew ? 'Create profile' : 'Save changes'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!isNew && onDeleted && (
            <Button variant="danger" disabled={busy} onClick={remove} style={{ marginLeft: 'auto' }}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  )
}
