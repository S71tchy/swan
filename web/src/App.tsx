import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import Login from './screens/Login'
import Dashboard from './screens/Dashboard'
import Feed from './screens/Feed'
import CreateAlert from './screens/CreateAlert'
import Approvals from './screens/Approvals'
import Profile from './screens/Profile'
import RightsAdmin from './screens/RightsAdmin'
import MasterData from './screens/MasterData'

function FullBleedLoader() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg-deep)',
        color: 'var(--t-45)',
        font: "500 13px var(--font-body)",
        letterSpacing: '1px',
      }}
    >
      Loading SWAN…
    </div>
  )
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullBleedLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <FullBleedLoader /> : user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/feed"
        element={
          <RequireAuth>
            <Feed />
          </RequireAuth>
        }
      />
      <Route
        path="/create"
        element={
          <RequireAuth>
            <CreateAlert />
          </RequireAuth>
        }
      />
      <Route
        path="/create/:id"
        element={
          <RequireAuth>
            <CreateAlert />
          </RequireAuth>
        }
      />
      <Route
        path="/approvals"
        element={
          <RequireAuth>
            <Approvals />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RightsAdmin />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/data"
        element={
          <RequireAuth>
            <MasterData />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
