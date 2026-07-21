import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { swanMapStyle } from '../lib/mapStyle'
import { addDetailOverlay } from '../lib/mapOverlay'

// A small MapLibre map you click to drop a pin. Reuses the Ops-Deck style and
// degrades gracefully offline (navy background, marker still projected).
export function LocationPinPicker({
  lat,
  lng,
  onChange,
  height = 190,
}: {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
  height?: number
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const hasPos = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)

  useEffect(() => {
    if (!container.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: swanMapStyle,
      center: hasPos ? [lng as number, lat as number] : [12, 4],
      zoom: hasPos ? 4.5 : 1.6,
      attributionControl: false,
      maxZoom: 9,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => addDetailOverlay(map))
    map.on('click', (e) => {
      onChangeRef.current(+e.lngLat.lat.toFixed(4), +e.lngLat.lng.toFixed(4))
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!hasPos) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    if (!markerRef.current) {
      const el = document.createElement('div')
      el.style.cssText =
        'width:16px;height:16px;border-radius:50%;background:#EED58E;border:2px solid #1B365F;box-shadow:0 0 12px rgba(238,213,142,.85)'
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([lng as number, lat as number])
        .addTo(map)
    } else {
      markerRef.current.setLngLat([lng as number, lat as number])
    }
  }, [lat, lng, hasPos])

  return (
    <div style={{ position: 'relative' }}>
      <div ref={container} style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-strong)' }} />
      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          padding: '4px 9px',
          borderRadius: 8,
          background: 'rgba(10,18,32,.8)',
          border: '1px solid var(--border-soft)',
          font: '400 10.5px var(--font-body)',
          color: 'var(--t-60)',
          pointerEvents: 'none',
        }}
      >
        {hasPos ? `${(lat as number).toFixed(3)}, ${(lng as number).toFixed(3)} — click to move` : 'Click the map to drop a pin'}
      </div>
    </div>
  )
}
