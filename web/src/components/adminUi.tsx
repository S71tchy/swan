import { useNavigate } from 'react-router-dom'
import { TopBar } from './TopBar'
import { LeftRail } from './LeftRail'
import { MapBackdrop } from './MapBackdrop'
import { Button } from './ui'

// Shared building blocks for the admin screens (Rights administration + Master
// data): the form input style, a labelled field, the right-hand editor drawer,
// and the "manager access required" gate.

export const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  borderRadius: 10,
  background: 'rgba(255,255,255,.05)',
  border: '1px solid var(--border-strong)',
  padding: '0 12px',
  color: '#fff',
  font: '400 13px var(--font-body)',
  outline: 'none',
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-55)' }}>{label}</span>
      {children}
    </label>
  )
}

export function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(6,11,20,.55)' }} />
      <div
        className="scroll-y"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 560,
          maxWidth: '100vw',
          background: 'var(--glass-slideover, rgba(15,27,46,.97))',
          borderLeft: '1px solid var(--border-mid)',
          backdropFilter: 'blur(20px)',
          boxShadow: '-30px 0 80px rgba(0,0,0,.5)',
          animation: 'swanSlideOver .28s ease-out',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// Full-screen "you need Rights Manager" gate, shared by both admin screens.
export function AdminGate({ breadcrumb }: { breadcrumb: string }) {
  const navigate = useNavigate()
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.45} blur={2} overlay="rgba(8,14,26,.5)" />
      <TopBar breadcrumb={breadcrumb} showCreate={false} />
      <LeftRail />
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div
          style={{
            width: 420,
            maxWidth: 'calc(100vw - 40px)',
            borderRadius: 18,
            background: 'var(--glass-90)',
            border: '1px solid var(--border-mid)',
            backdropFilter: 'blur(18px)',
            padding: 30,
            textAlign: 'center',
          }}
        >
          <div style={{ font: '600 17px var(--font-display)', color: '#fff', marginBottom: 8 }}>
            Rights Manager access required
          </div>
          <div style={{ font: '400 12.5px/1.6 var(--font-body)', color: 'var(--t-60)', marginBottom: 18 }}>
            This area manages users, profiles and reference data. Ask a Rights Manager to grant you access.
          </div>
          <Button variant="outline" onClick={() => navigate('/profile')}>
            Back to my profile
          </Button>
        </div>
      </div>
    </div>
  )
}
