import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/ui'
import { AdminGate, AdminScreen } from '../components/adminUi'
import { RichTextEditor, type RichTextHandle } from '../components/RichTextEditor'
import type { TemplateEntry, TemplatePreview } from '../types'

type Locale = 'en' | 'fr'

const KIND_LABEL: Record<string, string> = { broadcast: 'Subscription', transactional: 'Direct' }

export default function NotificationTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<TemplateEntry[]>([])
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [locale, setLocale] = useState<Locale>('en')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [preview, setPreview] = useState<TemplatePreview | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sourceMode, setSourceMode] = useState(false)
  const [epoch, setEpoch] = useState(0) // bump to remount the rich editor
  // Which selection `subject`/`body` currently hold. The rich editor reads its
  // value once on mount, so it must not mount before the sync effect below has
  // run — otherwise the first template opens with an empty body.
  const [loadedFor, setLoadedFor] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<RichTextHandle>(null)
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
      setLoadedFor(`${selectedKey}:${locale}`)
    }
  }, [selectedKey, locale, templates]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null
  if (!isManager) return <AdminGate breadcrumb="Settings · Notification templates" />

  const dirty = !!localeData && (subject !== localeData.subject || body !== localeData.body)

  function insertToken(tok: string) {
    const snippet = `{{${tok}}}`
    if (focusRef.current === 'subject') {
      setSubject((s) => s + snippet)
      return
    }
    if (!sourceMode) {
      editorRef.current?.insertToken(tok)
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
      setEpoch((e) => e + 1)
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
    <AdminScreen
      title="Notification templates"
      description="Edit the email copy for each event, in English and French. Tokens fill in per alert."
    >
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
          {entry && loadedFor === `${selectedKey}:${locale}` && (
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
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-55)' }}>Body</span>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => {
                      // switching back to rich needs a remount to load edits
                      if (sourceMode) setEpoch((e) => e + 1)
                      setSourceMode((v) => !v)
                    }}
                    style={{ font: '600 10.5px var(--font-display)', padding: '5px 10px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border-soft)', background: 'rgba(255,255,255,.04)', color: 'var(--t-60)' }}
                  >
                    {sourceMode ? '◱ Rich text' : '</> HTML source'}
                  </button>
                </div>
                {sourceMode ? (
                  <textarea
                    ref={bodyRef}
                    value={body}
                    onFocus={() => (focusRef.current = 'body')}
                    onChange={(e) => setBody(e.target.value)}
                    rows={14}
                    spellCheck={false}
                    style={{ ...fieldStyle, resize: 'vertical', minHeight: 220, lineHeight: 1.5, fontFamily: 'var(--font-mono, monospace)' }}
                  />
                ) : (
                  <RichTextEditor
                    key={`${selectedKey}:${locale}:${epoch}`}
                    ref={editorRef}
                    value={body}
                    onChange={setBody}
                    onFocusEditor={() => (focusRef.current = 'body')}
                  />
                )}
              </div>

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
                  <div style={{ font: '500 10px var(--font-display)', letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t-45)', marginBottom: 8 }}>Preview — rendered with sample data</div>
                  <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-50)', marginBottom: 4 }}>Subject</div>
                  <div style={{ font: '600 13px var(--font-body)', color: '#fff', marginBottom: 12 }}>{preview.subject}</div>
                  <iframe
                    title="Email preview"
                    sandbox=""
                    srcDoc={preview.body}
                    style={{ width: '100%', height: 440, border: '1px solid var(--border-soft)', borderRadius: 8, background: '#fff' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
    </AdminScreen>
  )
}
