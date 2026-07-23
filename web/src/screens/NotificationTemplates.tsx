import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { TopBar } from '../components/TopBar'
import { LeftRail } from '../components/LeftRail'
import { MapBackdrop } from '../components/MapBackdrop'
import { Button } from '../components/ui'
import { AdminGate } from '../components/adminUi'
import type { TemplateEntry, TemplatePreview } from '../types'

type Locale = 'en' | 'fr'

const KIND_LABEL: Record<string, string> = { broadcast: 'Subscription', transactional: 'Direct' }

export default function NotificationTemplates() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<TemplateEntry[]>([])
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [locale, setLocale] = useState<Locale>('en')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [preview, setPreview] = useState<TemplatePreview | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const focusRef = useRef<'subject' | 'body'>('body')

  const isManager = user?.rights.is_rights_manager

  async function reload() {
    const t = await api.adminTemplates()
    setTemplates(t)
    setSelectedKey((k) => k || t[0]?.key || '')
  }
  useEffect(() => {
    if (isManager) void reload()
  }, [isManager])

  const entry = useMemo(() => templates.find((t) => t.key === selectedKey), [templates, selectedKey])
  const localeData = entry ? entry[locale] : null

  // Load fields from server data whenever the selection changes (discards edits).
  useEffect(() => {
    if (localeData) {
      setSubject(localeData.subject)
      setBody(localeData.body)
      setPreview(null)
      setMsg(null)
    }
  }, [selectedKey, locale, templates]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null
  if (!isManager) return <AdminGate breadcrumb="Notification templates" />

  const dirty = !!localeData && (subject !== localeData.subject || body !== localeData.body)

  function insertToken(tok: string) {
    const snippet = `{{${tok}}}`
    if (focusRef.current === 'subject') {
      setSubject((s) => s + snippet)
      return
    }
    const el = bodyRef.current
    if (el && el.selectionStart != null) {
      const start = el.selectionStart
      const end = el.selectionEnd ?? start
      setBody((b) => b.slice(0, start) + snippet + b.slice(end))
    } else {
      setBody((b) => b + snippet)
    }
  }

  async function save() {
    if (!entry) return
    setBusy(true)
    setMsg(null)
    try {
      const updated = await api.adminUpdateTemplate(entry.key, locale, { subject, body })
      setTemplates((ts) => ts.map((t) => (t.key === updated.key ? updated : t)))
      setMsg('Saved.')
    } catch {
      setMsg('Could not save.')
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    if (!entry) return
    setBusy(true)
    setMsg(null)
    try {
      const updated = await api.adminResetTemplate(entry.key, locale)
      setTemplates((ts) => ts.map((t) => (t.key === updated.key ? updated : t)))
      setSubject(updated[locale].subject)
      setBody(updated[locale].body)
      setMsg('Reset to default.')
    } catch {
      setMsg('Could not reset.')
    } finally {
      setBusy(false)
    }
  }

  async function runPreview() {
    if (!entry) return
    setBusy(true)
    setMsg(null)
    try {
      setPreview(await api.adminPreviewTemplate(entry.key, locale, { subject, body }))
    } catch {
      setMsg('Could not render preview.')
    } finally {
      setBusy(false)
    }
  }

  async function testSend() {
    if (!entry) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await api.adminTestTemplate(entry.key, locale, { subject, body })
      setMsg(`Test queued to ${r.sent_to} — check the mailbox (or the server console if SMTP isn't configured).`)
    } catch {
      setMsg('Could not send test.')
    } finally {
      setBusy(false)
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%', borderRadius: 9, background: 'rgba(255,255,255,.05)',
    border: '1px solid var(--border-strong)', padding: '10px 12px', color: '#fff',
    font: '400 13px var(--font-body)', outline: 'none',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.45} blur={2} overlay="rgba(8,14,26,.5)" />
      <TopBar breadcrumb="Notification templates" showCreate={false} />
      <LeftRail />

      <div style={{ position: 'absolute', left: 100, right: 24, top: 92, bottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/admin')} style={backBtn}>← Rights</button>
          <div>
            <div style={{ font: '700 22px var(--font-display)', color: '#fff' }}>Notification templates</div>
            <div style={{ font: '400 12px var(--font-body)', color: 'var(--t-50)' }}>
              Edit the email copy for each event, in English and French. Tokens fill in per alert.
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, minHeight: 0 }}>
          {/* template list */}
          <div className="scroll-y" style={{ overflowY: 'auto', borderRadius: 16, background: 'var(--glass-90)', border: '1px solid var(--border-mid)', backdropFilter: 'blur(18px)', padding: 8 }}>
            {templates.map((t) => {
              const overridden = t.en.overridden || t.fr.overridden
              return (
                <button
                  key={t.key}
                  onClick={() => setSelectedKey(t.key)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                    border: 'none', cursor: 'pointer', marginBottom: 2,
                    background: t.key === selectedKey ? 'var(--yellow-tint)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ font: '600 12px var(--font-body)', color: t.key === selectedKey ? 'var(--agl-yellow)' : '#fff' }}>{t.label}</span>
                    {overridden && <span title="Customised" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--agl-turquoise, #00A6C1)' }} />}
                  </div>
                  <div style={{ font: '400 10px var(--font-body)', color: 'var(--t-45)', marginTop: 2 }}>{KIND_LABEL[t.kind]}</div>
                </button>
              )
            })}
          </div>

          {/* editor */}
          {entry && (
            <div className="scroll-y" style={{ overflowY: 'auto', borderRadius: 16, background: 'var(--glass-90)', border: '1px solid var(--border-mid)', backdropFilter: 'blur(18px)', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '600 15px var(--font-display)', color: '#fff' }}>{entry.label}</div>
                  <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-55)' }}>{entry.description}</div>
                </div>
                {/* locale tabs */}
                <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-soft)' }}>
                  {(['en', 'fr'] as Locale[]).map((l) => (
                    <button key={l} onClick={() => setLocale(l)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', font: '600 11px var(--font-display)', textTransform: 'uppercase', background: locale === l ? 'var(--agl-yellow)' : 'transparent', color: locale === l ? 'var(--agl-navy)' : 'var(--t-60)' }}>
                      {l}
                      {entry[l].overridden ? ' •' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* token palette */}
              <div>
                <div style={{ font: '500 10px var(--font-display)', letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t-45)', marginBottom: 6 }}>Tokens — click to insert</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {entry.tokens.map((tok) => (
                    <button key={tok} onClick={() => insertToken(tok)} style={{ padding: '4px 9px', borderRadius: 8, cursor: 'pointer', font: '500 11px var(--font-mono, monospace)', color: 'var(--t-75)', background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-soft)' }}>
                      {`{{${tok}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ display: 'block' }}>
                <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-55)' }}>Subject</span>
                <input value={subject} onFocus={() => (focusRef.current = 'subject')} onChange={(e) => setSubject(e.target.value)} style={{ ...fieldStyle, marginTop: 6 }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-55)' }}>Body</span>
                <textarea ref={bodyRef} value={body} onFocus={() => (focusRef.current = 'body')} onChange={(e) => setBody(e.target.value)} rows={12} style={{ ...fieldStyle, marginTop: 6, resize: 'vertical', minHeight: 180, lineHeight: 1.5, fontFamily: 'var(--font-mono, monospace)' }} />
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Button variant="primary" disabled={busy || !dirty} onClick={save}>Save</Button>
                <Button variant="ghost" disabled={busy} onClick={runPreview}>Preview</Button>
                <Button variant="ghost" disabled={busy} onClick={testSend}>Send test to me</Button>
                {localeData?.overridden && (
                  <Button variant="ghost" disabled={busy} onClick={reset} style={{ marginLeft: 'auto', color: 'var(--sev-critical-text)' }}>Reset to default</Button>
                )}
              </div>
              {(msg || dirty) && (
                <div style={{ font: '400 11.5px var(--font-body)', color: dirty && !msg ? 'var(--t-55)' : 'var(--agl-yellow)' }}>
                  {msg || 'Unsaved changes.'}
                </div>
              )}

              {preview && (
                <div style={{ borderRadius: 12, border: '1px solid var(--border-soft)', background: 'rgba(0,0,0,.25)', padding: 16 }}>
                  <div style={{ font: '500 10px var(--font-display)', letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t-45)', marginBottom: 8 }}>Preview (sample data)</div>
                  <div style={{ font: '600 13px var(--font-body)', color: '#fff', marginBottom: 8 }}>{preview.subject}</div>
                  <pre style={{ font: '400 12px/1.55 var(--font-mono, monospace)', color: 'var(--t-75)', whiteSpace: 'pre-wrap', margin: 0 }}>{preview.body}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const backBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
  border: '1px solid var(--border-soft)', background: 'rgba(255,255,255,.05)',
  color: 'var(--t-70)', font: '600 12px var(--font-display)', cursor: 'pointer',
}
