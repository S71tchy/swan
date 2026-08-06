import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
// Vendor CSS first, ours second — tokens.css restyles MapLibre's map controls,
// and at equal specificity the later stylesheet wins. Imported the other way
// round, every override below would silently lose to the default white buttons.
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles/tokens.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
