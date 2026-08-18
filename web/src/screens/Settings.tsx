import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { TopBar } from '../components/TopBar'
import { LeftRail } from '../components/LeftRail'
import { MapBackdrop } from '../components/MapBackdrop'
import { SectionLabel } from '../components/ui'
import {
  BellIcon,
  BookIcon,
  ChevronRightIcon,
  CodeIcon,
  MailIcon,
  PinIcon,
  ProfilesIcon,
  RightsIcon,
  ShieldIcon,
  UsersIcon,
} from '../components/icons'

// --------------------------------------------------------------------------- //
// Settings home
//
// The hub for everything configurable. Each section owns a route of its own —
// this screen is only the index, so adding a section means adding a card here
// rather than another button in some other screen's header.
// --------------------------------------------------------------------------- //

interface Card {
  key: string
  title: string
  description: string
  path: string
  icon: (stroke: string) => ReactNode
  metric?: string
  /** Renders the metric in AGL yellow — used for "needs attention" counts. */
  alert?: boolean
}

function SettingsCard({ card }: { card: Card }) {
  const navigate = useNavigate()
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={() => navigate(card.path)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: 20,
        borderRadius: 16,
        background: hover ? 'rgba(23,38,63,.94)' : 'var(--glass-90)',
        border: `1px solid ${hover ? 'var(--yellow-border)' : 'var(--border-mid)'}`,
        backdropFilter: 'blur(18px)',
        transition: 'background .15s, border-color .15s, transform .15s',
        transform: hover ? 'translateY(-1px)' : 'none',
      }}
    >
      <span
        style={{
          flex: 'none',
          width: 40,
          height: 40,
          borderRadius: 12,
          display: 'grid',
          placeItems: 'center',
          background: hover ? 'var(--yellow-tint)' : 'rgba(255,255,255,.06)',
          border: `1px solid ${hover ? 'var(--yellow-border)' : 'var(--border-soft)'}`,
        }}
      >
        {card.icon(hover ? 'var(--agl-yellow)' : 'rgba(255,255,255,.7)')}
      </span>

      <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ font: '600 14.5px var(--font-display)', color: '#fff' }}>{card.title}</span>
          <span style={{ flex: 1 }} />
          <ChevronRightIcon size={14} stroke={hover ? 'var(--agl-yellow)' : 'rgba(255,255,255,.3)'} />
        </span>
        <span
          style={{
            display: 'block',
            font: '400 11.5px/1.55 var(--font-body)',
            color: 'var(--t-55)',
            marginTop: 4,
          }}
        >
          {card.description}
        </span>
        {card.metric && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 12,
              font: '600 11px var(--font-display)',
              letterSpacing: '.3px',
              color: card.alert ? 'var(--agl-yellow)' : 'var(--t-60)',
            }}
          >
            {card.alert && <span className="glow-dot" style={{ width: 6, height: 6, background: 'var(--agl-yellow)' }} />}
            {card.metric}
          </span>
        )}
      </span>
    </button>
  )
}

function CardGrid({ cards }: { cards: Card[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
      {cards.map((c) => (
        <SettingsCard key={c.key} card={c} />
      ))}
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const [counts, setCounts] = useState<{
    users: number
    pending: number
    profiles: number
    places: number
    domains: number
    domainsEnforced: number
    templates: number
    customised: number
  } | null>(null)

  const isManager = user?.rights.is_rights_manager

  useEffect(() => {
    if (!isManager) return
    // Live metrics for the cards. Best-effort: a failing call just hides its
    // metric rather than blocking the hub.
    void Promise.all([
      api.adminUsers().catch(() => []),
      api.adminProfiles().catch(() => []),
      api.adminPlaces().catch(() => []),
      api.adminTemplates().catch(() => []),
      api.adminEmailDomains().catch(() => []),
    ]).then(([users, profiles, places, templates, domains]) =>
      setCounts({
        users: users.length,
        pending: users.filter((u) => u.status === 'pending').length,
        profiles: profiles.length,
        places: places.length,
        domains: domains.length,
        domainsEnforced: domains.filter((d) => d.active).length,
        templates: templates.length,
        customised: templates.filter((t) => t.en.overridden || t.fr.overridden).length,
      }),
    )
  }, [isManager])

  if (!user) return null

  const n = (v: number | undefined, one: string, many: string) =>
    v === undefined ? undefined : `${v} ${v === 1 ? one : many}`

  const personal: Card[] = [
    {
      key: 'profile',
      title: 'My profile',
      description: 'Your identity, branch and the four rights dimensions you currently hold.',
      path: '/profile',
      icon: (s) => <RightsIcon size={18} stroke={s} />,
      metric: user.rights.is_rights_manager ? 'Rights Manager' : user.role_label,
    },
    {
      key: 'my-notifications',
      title: 'My notifications',
      description: 'The email subscriptions that decide which alerts reach your inbox.',
      path: '/profile?section=notifications',
      icon: (s) => <BellIcon size={18} stroke={s} />,
      metric: n(user.subscriptions.length, 'subscription', 'subscriptions'),
    },
  ]

  const administration: Card[] = [
    {
      key: 'users',
      title: 'Users',
      description: 'Identities, rights and per-user email subscriptions. Validate new registrations here.',
      path: '/admin/users',
      icon: (s) => <UsersIcon size={18} stroke={s} />,
      metric: counts
        ? counts.pending > 0
          ? `${counts.users} users · ${counts.pending} pending`
          : n(counts.users, 'user', 'users')
        : undefined,
      alert: (counts?.pending ?? 0) > 0,
    },
    {
      key: 'email-domains',
      title: 'Email domains',
      description: 'Domains no account may be created on — keeps registration on corporate addresses.',
      path: '/admin/email-domains',
      icon: (s) => <ShieldIcon size={18} stroke={s} />,
      metric: counts
        ? counts.domains === 0
          ? 'Nothing blocked'
          : `${counts.domainsEnforced} enforced of ${counts.domains}`
        : undefined,
      alert: counts?.domains === 0,
    },
    {
      key: 'profiles',
      title: 'Profiles',
      description: 'Named bundles of country rights, resolved live so edits reach every holder at once.',
      path: '/admin/profiles',
      icon: (s) => <ProfilesIcon size={18} stroke={s} />,
      metric: n(counts?.profiles, 'profile', 'profiles'),
    },
    {
      key: 'locations',
      title: 'Locations',
      description: 'The gazetteer behind alert-location search — codes, coordinates and aliases.',
      path: '/admin/locations',
      icon: (s) => <PinIcon size={18} stroke={s} />,
      metric: n(counts?.places, 'location', 'locations'),
    },
    {
      key: 'templates',
      title: 'Notification templates',
      description: 'The email copy sent for each event, in English and French, with token preview.',
      path: '/admin/templates',
      icon: (s) => <MailIcon size={18} stroke={s} />,
      metric: counts
        ? counts.customised > 0
          ? `${counts.templates} templates · ${counts.customised} customised`
          : n(counts.templates, 'template', 'templates')
        : undefined,
    },
    {
      key: 'reference',
      title: 'Reference data',
      description: 'Countries, categories, industries, roles, severities and transport modes.',
      path: '/admin/reference',
      icon: (s) => <BookIcon size={18} stroke={s} />,
      metric: 'Read-only',
    },
    {
      key: 'api',
      title: 'API & integrations',
      description: 'Browse the OpenAPI surface and open the interactive Swagger and ReDoc docs.',
      path: '/admin/api',
      icon: (s) => <CodeIcon size={18} stroke={s} />,
      metric: 'OpenAPI 3.1',
    },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.45} blur={2} overlay="rgba(8,14,26,.5)" />
      <TopBar breadcrumb="Settings" />
      <LeftRail />

      <div
        className="scroll-y"
        style={{
          position: 'absolute',
          left: 100,
          right: 24,
          top: 92,
          bottom: 24,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div>
          <div style={{ font: '700 22px var(--font-display)', color: '#fff' }}>Settings</div>
          <div style={{ font: '400 12px var(--font-body)', color: 'var(--t-50)' }}>
            Your account, and — with Rights Manager access — the reference data the platform runs on.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionLabel>Your account</SectionLabel>
          <CardGrid cards={personal} />
        </div>

        {isManager ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionLabel>Administration</SectionLabel>
            <CardGrid cards={administration} />
          </div>
        ) : (
          <div
            style={{
              borderRadius: 14,
              border: '1px solid var(--border-soft)',
              background: 'rgba(255,255,255,.04)',
              padding: '14px 18px',
              font: '400 11.5px/1.6 var(--font-body)',
              color: 'var(--t-50)',
            }}
          >
            Users, profiles, locations, email domains, notification templates and the API reference appear here for Rights Managers.
            Ask one to grant you access if you need them.
          </div>
        )}
      </div>
    </div>
  )
}
