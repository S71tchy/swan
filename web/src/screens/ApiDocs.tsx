import { useEffect, useMemo, useState } from 'react'
import { API_DOCS, api } from '../api'
import { useAuth } from '../auth'
import { SectionLabel } from '../components/ui'
import { ChevronRightIcon, ExternalLinkIcon } from '../components/icons'
import { AdminGate, AdminScreen } from '../components/adminUi'
import type { OpenApiDoc, OpenApiOperation } from '../types'

// --------------------------------------------------------------------------- //
// Settings → API & integrations
//
// A brand-native view of the API surface, read straight from the live OpenAPI
// document, plus the doorway to the interactive tools. Swagger itself opens in
// its own tab: it ships its own light theme and needs full width to be usable,
// so embedding it here would fight the glass chrome and lose.
// --------------------------------------------------------------------------- //

const METHOD_ORDER = ['get', 'post', 'patch', 'put', 'delete']

const METHOD_COLOR: Record<string, string> = {
  get: 'var(--agl-turquoise, #00A6C1)',
  post: 'var(--agl-yellow)',
  patch: 'var(--agl-orange)',
  put: 'var(--agl-orange)',
  delete: 'var(--sev-critical-text)',
}

interface Endpoint {
  method: string
  path: string
  op: OpenApiOperation
}

function MethodTag({ method }: { method: string }) {
  const color = METHOD_COLOR[method] ?? 'var(--t-55)'
  return (
    <span
      style={{
        flex: 'none',
        width: 58,
        textAlign: 'center',
        padding: '3px 0',
        borderRadius: 7,
        border: `1px solid ${color}`,
        color,
        background: 'rgba(255,255,255,.04)',
        font: '700 9.5px var(--font-display)',
        letterSpacing: '.6px',
        textTransform: 'uppercase',
      }}
    >
      {method}
    </span>
  )
}

function LinkButton({
  href,
  label,
  hint,
  primary,
  download,
}: {
  href: string
  label: string
  hint: string
  primary?: boolean
  download?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <a
      href={href}
      target={download ? undefined : '_blank'}
      rel="noreferrer"
      download={download ? 'swan-openapi.json' : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '13px 16px',
        borderRadius: 12,
        textDecoration: 'none',
        background: primary
          ? hover
            ? '#f5e2a8'
            : 'var(--agl-yellow)'
          : hover
            ? 'rgba(255,255,255,.09)'
            : 'rgba(255,255,255,.05)',
        border: `1px solid ${primary ? 'var(--agl-yellow)' : 'var(--border-soft)'}`,
        color: primary ? 'var(--agl-navy)' : '#fff',
      }}
    >
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', font: '600 12.5px var(--font-display)' }}>{label}</span>
        <span
          style={{
            display: 'block',
            font: '400 11px var(--font-body)',
            color: primary ? 'rgba(27,54,95,.75)' : 'var(--t-50)',
            marginTop: 2,
          }}
        >
          {hint}
        </span>
      </span>
      <ExternalLinkIcon size={14} stroke={primary ? 'var(--agl-navy)' : 'var(--t-55)'} />
    </a>
  )
}

function TagGroup({ tag, endpoints }: { tag: string; endpoints: Endpoint[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,.055)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '13px 22px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
          <ChevronRightIcon size={13} stroke="var(--t-45)" />
        </span>
        <span style={{ font: '600 13px var(--font-display)', color: '#fff', textTransform: 'capitalize' }}>{tag}</span>
        <span style={{ flex: 1 }} />
        <span style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
          {endpoints.length} endpoint{endpoints.length === 1 ? '' : 's'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 22px 14px 45px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {endpoints.map((e) => (
            <div
              key={`${e.method}:${e.path}`}
              style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '7px 0', minWidth: 0 }}
            >
              <MethodTag method={e.method} />
              <span
                style={{
                  font: '500 12px var(--font-mono, monospace)',
                  color: e.op.deprecated ? 'var(--t-40)' : 'var(--t-85, rgba(255,255,255,.85))',
                  textDecoration: e.op.deprecated ? 'line-through' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {e.path}
              </span>
              <span
                style={{
                  font: '400 11.5px var(--font-body)',
                  color: 'var(--t-45)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {e.op.summary ?? ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ApiDocs() {
  const { user } = useAuth()
  const [doc, setDoc] = useState<OpenApiDoc | null>(null)
  const [failed, setFailed] = useState(false)

  const isManager = user?.rights.is_rights_manager

  useEffect(() => {
    if (!isManager) return
    void api
      .openapi()
      .then(setDoc)
      .catch(() => setFailed(true))
  }, [isManager])

  // Group operations by their first tag, preserving a stable method order.
  const groups = useMemo(() => {
    if (!doc) return []
    const byTag = new Map<string, Endpoint[]>()
    for (const [path, ops] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        if (!METHOD_ORDER.includes(method)) continue
        const tag = op.tags?.[0] ?? 'other'
        if (!byTag.has(tag)) byTag.set(tag, [])
        byTag.get(tag)!.push({ method, path, op })
      }
    }
    for (const list of byTag.values()) {
      list.sort(
        (a, b) => a.path.localeCompare(b.path) || METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method),
      )
    }
    return [...byTag.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [doc])

  const total = groups.reduce((n, [, list]) => n + list.length, 0)

  if (!user) return null
  if (!isManager) return <AdminGate breadcrumb="Settings · API" />

  const origin = window.location.origin

  return (
    <AdminScreen
      title="API & integrations"
      description={
        doc
          ? `${doc.info.title} v${doc.info.version} · OpenAPI ${doc.openapi} · ${total} endpoints`
          : 'The SWAN HTTP API, its interactive docs and its machine-readable spec.'
      }
    >
      <div
        className="scroll-y"
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}
      >
        {/* interactive tools */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <LinkButton
            href={API_DOCS.swagger}
            label="Open Swagger UI"
            hint="Browse and call every endpoint"
            primary
          />
          <LinkButton href={API_DOCS.redoc} label="Open ReDoc" hint="Reference-style documentation" />
          <LinkButton href={API_DOCS.spec} label="Download OpenAPI spec" hint="swan-openapi.json" download />
        </div>

        {/* connection details */}
        <div
          style={{
            borderRadius: 16,
            background: 'var(--glass-90)',
            border: '1px solid var(--border-mid)',
            backdropFilter: 'blur(18px)',
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <SectionLabel>Connecting</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            <div>
              <div style={{ font: '500 10.5px var(--font-display)', letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t-45)', marginBottom: 6 }}>
                Base URL
              </div>
              <code style={{ font: '500 12.5px var(--font-mono, monospace)', color: 'var(--agl-yellow)', wordBreak: 'break-all' }}>
                {origin}/api
              </code>
            </div>
            <div>
              <div style={{ font: '500 10.5px var(--font-display)', letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t-45)', marginBottom: 6 }}>
                Authentication
              </div>
              <div style={{ font: '400 12px/1.6 var(--font-body)', color: 'var(--t-70)' }}>
                A session JWT in an httpOnly cookie, minted by <code style={{ color: 'var(--t-85, rgba(255,255,255,.85))' }}>POST /api/auth/login</code>.
                Swagger calls therefore work as soon as you are signed in here.
              </div>
            </div>
            <div>
              <div style={{ font: '500 10.5px var(--font-display)', letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t-45)', marginBottom: 6 }}>
                Authorisation
              </div>
              <div style={{ font: '400 12px/1.6 var(--font-body)', color: 'var(--t-70)' }}>
                Endpoints under <code style={{ color: 'var(--t-85, rgba(255,255,255,.85))' }}>/api/admin</code> require Rights Manager.
                Everything else is filtered by your four rights dimensions.
              </div>
            </div>
          </div>

          <div
            style={{
              borderRadius: 12,
              border: '1px solid var(--border-soft)',
              background: 'rgba(255,255,255,.035)',
              padding: '12px 14px',
              font: '400 11.5px/1.6 var(--font-body)',
              color: 'var(--t-55)',
            }}
          >
            This is the internal API. The public, client-facing API and its keys are Phase 3 — the external portal is
            fed from this same alert pipeline, so nothing here changes when it lands.
          </div>
        </div>

        {/* endpoint surface */}
        <div
          style={{
            borderRadius: 16,
            background: 'var(--glass-90)',
            border: '1px solid var(--border-mid)',
            backdropFilter: 'blur(18px)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 22px',
              borderBottom: '1px solid rgba(255,255,255,.08)',
              font: '600 10px var(--font-display)',
              color: 'var(--t-45)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Endpoints
          </div>
          {failed && (
            <div style={{ padding: '16px 22px', font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
              Could not load the OpenAPI document. The links above still work.
            </div>
          )}
          {!failed && !doc && (
            <div style={{ padding: '16px 22px', font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
              Loading the spec…
            </div>
          )}
          {groups.map(([tag, endpoints]) => (
            <TagGroup key={tag} tag={tag} endpoints={endpoints} />
          ))}
        </div>
      </div>
    </AdminScreen>
  )
}
