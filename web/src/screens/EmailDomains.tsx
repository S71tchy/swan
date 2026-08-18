import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/ui'
import { PlusIcon } from '../components/icons'
import {
  AdminGate,
  AdminScreen,
  Drawer,
  Field,
  FormError,
  Toggle,
  ToggleRow,
  inputStyle,
  listPanelStyle,
} from '../components/adminUi'
import type { EmailDomainRule } from '../types'

// --------------------------------------------------------------------------- //
// Settings → Email domains
//
// The registration policy: which email domains an account may *not* be created
// on. SWAN is an internal tool, so accounts belong on corporate addresses; this
// screen is where a Rights Manager says which consumer or disposable providers
// are refused.
//
// The list governs creation only — self-registration from the login screen, a
// user created in Settings, and an admin changing someone's email. It is never
// applied to sign-in, so adding a domain cannot lock out the accounts already
// on it (that is a rights decision, not a spelling one). The Accounts column
// makes that visible, and is also the quickest way to notice a pattern that is
// wider than intended before saving it.
//
// Matching lives server-side in app/email_policy.py and is deliberately not
// duplicated here — even the user editor's own validation asks the API.
// --------------------------------------------------------------------------- //

const COLUMNS = '1.5fr 2.2fr .8fr .8fr'

function RuleEditor({
  rule,
  onClose,
  onSaved,
}: {
  rule: EmailDomainRule | 'new'
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isNew = rule === 'new'
  const original = isNew ? null : rule
  const [pattern, setPattern] = useState(original?.pattern ?? '')
  const [note, setNote] = useState(original?.note ?? '')
  const [active, setActive] = useState(original?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<unknown>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
      await onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.')
      setBusy(false)
    }
  }

  const accounts = original?.accounts ?? 0

  return (
    <Drawer onClose={onClose}>
      <div style={{ padding: '26px 26px 30px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ font: '600 17px var(--font-display)', color: '#fff' }}>
            {isNew ? 'Block a domain' : original!.pattern}
          </div>
          <div style={{ font: '400 11.5px/1.6 var(--font-body)', color: 'var(--t-45)' }}>
            {isNew
              ? 'Nobody will be able to register, or be created, on this domain.'
              : accounts === 0
                ? 'No account uses this domain.'
                : `${accounts} existing account${accounts === 1 ? '' : 's'} on this domain — they keep their access.`}
          </div>
        </div>

        {error && <FormError>{error}</FormError>}

        <Field label="Domain">
          <input
            style={inputStyle}
            autoFocus
            placeholder="gmail.com"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
        </Field>

        <div
          style={{
            borderRadius: 10,
            border: '1px solid var(--border-soft)',
            background: 'rgba(255,255,255,.04)',
            padding: '10px 12px',
            font: '400 11px/1.65 var(--font-body)',
            color: 'var(--t-55)',
          }}
        >
          <code style={{ color: 'var(--agl-yellow)' }}>gmail.com</code> also blocks its subdomains
          (<code style={{ color: 'var(--t-75)' }}>x@mail.gmail.com</code>) — a rule a subdomain walks
          around is not a rule. Use <code style={{ color: 'var(--agl-yellow)' }}>*</code> for anything
          wider: <code style={{ color: 'var(--t-75)' }}>*.edu</code>,{' '}
          <code style={{ color: 'var(--t-75)' }}>mail.*</code>. A leading{' '}
          <code style={{ color: 'var(--t-75)' }}>@</code> — or a whole address — is fine; the domain
          is taken from it.
        </div>

        <Field label="Note (why it is blocked)">
          <input
            style={inputStyle}
            placeholder="Consumer webmail."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        <ToggleRow
          label="Enforced"
          hint="Turn off to lift the rule temporarily — onboarding a contractor — without losing it"
          on={active}
          onToggle={() => setActive((v) => !v)}
        />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          <Button
            variant="primary"
            disabled={busy || !pattern.trim()}
            onClick={() =>
              run(() =>
                isNew
                  ? api.adminCreateEmailDomain({ pattern: pattern.trim(), note: note.trim(), active })
                  : api.adminUpdateEmailDomain(original!.pattern, {
                      pattern: pattern.trim(),
                      note: note.trim(),
                      active,
                    }),
              )
            }
          >
            {isNew ? 'Block domain' : 'Save changes'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!isNew && (
            <Button
              variant="danger"
              disabled={busy}
              style={{ marginLeft: 'auto' }}
              onClick={() => run(() => api.adminDeleteEmailDomain(original!.pattern))}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  )
}

export default function EmailDomains() {
  const { user } = useAuth()
  const [rules, setRules] = useState<EmailDomainRule[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<EmailDomainRule | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isManager = user?.rights.is_rights_manager

  async function reload() {
    setRules(await api.adminEmailDomains())
  }

  useEffect(() => {
    if (!isManager) return
    void reload()
  }, [isManager])

  if (!user) return null
  if (!isManager) return <AdminGate breadcrumb="Settings · Email domains" />

  // Toggling straight from the row, without opening the editor: pausing a rule
  // is the thing done in a hurry, with somebody waiting to be onboarded.
  async function toggleRule(rule: EmailDomainRule) {
    setError(null)
    try {
      await api.adminUpdateEmailDomain(rule.pattern, { active: !rule.active })
      await reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update the rule.')
    }
  }

  const q = query.trim().toLowerCase()
  const shown = q
    ? rules.filter((r) => r.pattern.toLowerCase().includes(q) || r.note.toLowerCase().includes(q))
    : rules
  const enforced = rules.filter((r) => r.active).length

  return (
    <AdminScreen
      title="Email domains"
      description="The domains an account may not be created on — keeping sign-up to corporate addresses."
      actions={
        <>
          <input
            placeholder="Search domains…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ ...inputStyle, width: 220 }}
          />
          <Button variant="primary" onClick={() => setEditing('new')}>
            <PlusIcon size={13} stroke="var(--agl-navy)" />
            Block a domain
          </Button>
        </>
      }
    >
      <div
        style={{
          borderRadius: 12,
          border: '1px solid var(--border-soft)',
          background: 'rgba(255,255,255,.035)',
          padding: '12px 16px',
          font: '400 11.5px/1.6 var(--font-body)',
          color: 'var(--t-55)',
          flex: 'none',
        }}
      >
        <strong style={{ color: 'var(--t-75)' }}>
          {enforced} of {rules.length} rule{rules.length === 1 ? '' : 's'} enforced
        </strong>{' '}
        — checked wherever an account is created: self-registration from the login screen, a new user
        created under Settings → Users, and any change to an existing user's email address.{' '}
        <strong style={{ color: 'var(--t-75)' }}>Sign-in is never affected</strong>, so blocking a
        domain cannot lock out the accounts already on it — deactivate those users instead. Every
        change here is audited.
      </div>

      {error && <FormError>{error}</FormError>}

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
          <span>Domain</span>
          <span>Note</span>
          <span>Accounts</span>
          <span>Enforced</span>
        </div>

        {shown.map((r) => (
          <div
            key={r.pattern}
            onClick={() => setEditing(r)}
            style={{
              display: 'grid',
              gridTemplateColumns: COLUMNS,
              gap: 12,
              padding: '13px 22px',
              borderBottom: '1px solid rgba(255,255,255,.055)',
              alignItems: 'center',
              cursor: 'pointer',
              font: '400 12.5px var(--font-body)',
              color: 'var(--t-80)',
              opacity: r.active ? 1 : 0.55,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ font: '600 12px var(--font-display)', color: 'var(--agl-yellow)' }}>
              {r.pattern}
            </span>
            <span style={{ color: 'var(--t-60)' }}>{r.note || '—'}</span>
            <span
              title={
                r.accounts
                  ? 'Accounts already on this domain — they keep their access'
                  : 'No account uses this domain'
              }
              style={{ color: r.accounts ? 'var(--t-70)' : 'var(--t-40)' }}
            >
              {r.accounts || '—'}
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <Toggle on={r.active} onClick={() => void toggleRule(r)} />
            </span>
          </div>
        ))}

        {shown.length === 0 && (
          <div style={{ padding: '16px 22px', font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>
            {q
              ? 'No domains match your search.'
              : 'Nothing is blocked — any address, including consumer webmail, can register.'}
          </div>
        )}
      </div>

      {editing && <RuleEditor rule={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </AdminScreen>
  )
}
