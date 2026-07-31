import { useRef, useState } from 'react'
import { ImageError, dataUrlBytes, fmtBytes, preparePicture } from '../lib/image'

/** The alert picture dropzone.
 *
 * This replaced a decorative dashed `<div>` carried over from the mock — it
 * looked droppable but had no file input behind it, so nothing ever happened.
 * Accepts click-to-browse, drag-and-drop and paste-adjacent flows, and shows
 * the chosen image as a preview rather than a filename, because what matters
 * is whether the right picture is attached.
 */
export function PictureField({
  value,
  onChange,
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function accept(file: File | undefined) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      onChange(await preparePicture(file))
    } catch (e) {
      setError(e instanceof ImageError ? e.message : 'Could not use that image.')
    } finally {
      setBusy(false)
    }
  }

  if (value) {
    return (
      <div
        style={{
          flex: 1,
          height: 52,
          borderRadius: 12,
          border: '1px solid var(--border-mid)',
          background: 'rgba(255,255,255,.04)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 6,
          overflow: 'hidden',
        }}
      >
        <img
          src={value}
          alt="Alert picture preview"
          style={{ width: 68, height: 40, objectFit: 'cover', borderRadius: 8, flex: 'none' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '600 11.5px var(--font-body)', color: '#fff' }}>Picture attached</div>
          <div style={{ font: '400 10.5px var(--font-body)', color: 'var(--t-45)' }}>
            {fmtBytes(dataUrlBytes(value))} · shown on the card and alert panel
          </div>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={ghostBtn}
        >
          Replace
        </button>
        <button type="button" onClick={() => onChange(null)} style={ghostBtn}>
          Remove
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void accept(e.target.files?.[0])
            e.target.value = '' // re-picking the same file must still fire onChange
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ flex: 1 }}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void accept(e.dataTransfer.files?.[0])
        }}
        style={{
          height: 52,
          borderRadius: 12,
          border: `1.5px dashed ${dragging ? 'var(--agl-yellow)' : 'rgba(255,255,255,.2)'}`,
          background: dragging ? 'rgba(238,213,142,.08)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          font: '400 12px var(--font-body)',
          color: dragging ? 'var(--agl-yellow)' : 'var(--t-45)',
          cursor: 'pointer',
          transition: 'border-color .12s, background .12s, color .12s',
        }}
      >
        {busy ? 'Processing image…' : '⤒ Drop a picture here, or click to browse'}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void accept(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {error && (
        <div style={{ font: '400 11px var(--font-body)', color: 'var(--sev-critical-text)', marginTop: 5 }}>
          {error}
        </div>
      )}
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  flex: 'none',
  height: 28,
  padding: '0 10px',
  borderRadius: 14,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,.2)',
  color: 'var(--t-75)',
  font: '500 11px var(--font-body)',
  cursor: 'pointer',
}
