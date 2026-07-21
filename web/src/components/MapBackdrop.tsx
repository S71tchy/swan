import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { swanMapStyle } from '../lib/mapStyle'
import { addDetailOverlay } from '../lib/mapOverlay'

// Static map backdrop for the non-dashboard screens (login, feed, create,
// approvals, profile, admin). This is the real MapLibre map — same style and
// Natural Earth detail overlay as the Dashboard — but rendered non-interactively
// (no zoom/drag handlers, no navigation controls) and blurred behind the glass
// panels, exactly the role the mock's static map image played. Degrades
// gracefully offline: the navy base still renders even if tiles/geojson fail.
interface Props {
  opacity?: number
  blur?: number
  overlay?: string
  /** Retained for call-site compatibility; no longer affects the real map. */
  stroke?: boolean
}

export function MapBackdrop({
  opacity = 0.45,
  blur = 2,
  overlay = 'rgba(8,14,26,.5)',
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!container.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: swanMapStyle,
      center: [20, 4],
      zoom: 2.5,
      attributionControl: false,
      interactive: false, // no drag / scroll-zoom / dblclick / keyboard — a static backdrop
    })
    map.on('load', () => addDetailOverlay(map))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <>
      <div
        ref={container}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          opacity,
          filter: blur ? `blur(${blur}px)` : undefined,
          pointerEvents: 'none',
        }}
      />
      {overlay && <div style={{ position: 'absolute', inset: 0, background: overlay, pointerEvents: 'none' }} />}
    </>
  )
}
