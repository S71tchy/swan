import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface RichTextHandle {
  insertToken: (token: string) => void
}

interface Props {
  value: string
  onChange: (html: string) => void
  onFocusEditor?: () => void
}

// A small dependency-free WYSIWYG editor built on contentEditable. It is
// uncontrolled after mount (remount via a `key` to load a different value),
// which avoids the cursor-jump problems of a fully controlled contentEditable.
type Cmd = { label: string; title: string; run: (exec: (c: string, v?: string) => void) => void }

const COMMANDS: Cmd[] = [
  { label: 'B', title: 'Bold', run: (e) => e('bold') },
  { label: 'I', title: 'Italic', run: (e) => e('italic') },
  { label: 'U', title: 'Underline', run: (e) => e('underline') },
  { label: 'H', title: 'Heading', run: (e) => e('formatBlock', '<h2>') },
  { label: '¶', title: 'Normal text', run: (e) => e('formatBlock', '<p>') },
  { label: '“ ”', title: 'Quote', run: (e) => e('formatBlock', '<blockquote>') },
  { label: '• List', title: 'Bulleted list', run: (e) => e('insertUnorderedList') },
  { label: '1. List', title: 'Numbered list', run: (e) => e('insertOrderedList') },
  {
    label: '🔗',
    title: 'Insert link',
    run: (e) => {
      const url = window.prompt('Link URL (a token like {{alert_url}} also works)', 'https://')
      if (url) e('createLink', url)
    },
  },
  { label: '⌫ Clear', title: 'Clear formatting', run: (e) => e('removeFormat') },
]

export const RichTextEditor = forwardRef<RichTextHandle, Props>(function RichTextEditor(
  { value, onChange, onFocusEditor },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)

  // Load initial HTML once on mount (remount via key to change document).
  useEffect(() => {
    if (elRef.current) elRef.current.innerHTML = value || ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emit = () => onChange(elRef.current?.innerHTML ?? '')

  const exec = (cmd: string, val?: string) => {
    elRef.current?.focus()
    // execCommand is deprecated but remains the pragmatic, dependency-free way
    // to drive a contentEditable across current browsers.
    document.execCommand(cmd, false, val)
    emit()
  }

  useImperativeHandle(ref, () => ({
    insertToken(token: string) {
      const el = elRef.current
      if (!el) return
      el.focus()
      const text = `{{${token}}}`
      const sel = window.getSelection()
      if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        const node = document.createTextNode(text)
        range.insertNode(node)
        range.setStartAfter(node)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      } else {
        el.appendChild(document.createTextNode(text))
      }
      emit()
    },
  }))

  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 9, overflow: 'hidden' }}>
      <style>{rteCss}</style>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 6, background: 'rgba(255,255,255,.05)', borderBottom: '1px solid var(--border-soft)' }}>
        {COMMANDS.map((c) => (
          <button
            key={c.title}
            type="button"
            title={c.title}
            onMouseDown={(e) => e.preventDefault() /* keep selection */}
            onClick={() => c.run(exec)}
            style={{
              minWidth: 28,
              height: 26,
              padding: '0 8px',
              borderRadius: 6,
              border: '1px solid var(--border-soft)',
              background: 'rgba(255,255,255,.04)',
              color: 'var(--t-75)',
              font: '600 11px var(--font-body)',
              cursor: 'pointer',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div
        ref={elRef}
        className="swan-rte"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onFocus={onFocusEditor}
      />
    </div>
  )
})

// White "paper" editing surface that mirrors the email's own styling, so the
// editor is a fair preview of the rendered message.
const rteCss = `
.swan-rte {
  min-height: 220px;
  max-height: 380px;
  overflow-y: auto;
  padding: 18px 20px;
  background: #ffffff;
  color: #1b365f;
  font: 400 14px/1.6 'Segoe UI', system-ui, sans-serif;
  outline: none;
}
.swan-rte h1, .swan-rte h2, .swan-rte h3 { color: #1b365f; margin: 0 0 10px; font-weight: 700; line-height: 1.3; }
.swan-rte h2 { font-size: 18px; }
.swan-rte h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .5px; color: #6b7688; }
.swan-rte p { margin: 0 0 12px; }
.swan-rte a { color: #1b365f; }
.swan-rte ul, .swan-rte ol { margin: 0 0 12px 20px; padding: 0; }
.swan-rte blockquote { margin: 0 0 12px; padding: 8px 14px; border-left: 3px solid #eed58e; background: #faf6ea; color: #5a6273; }
.swan-rte .btn { background:#eed58e; color:#1b365f; text-decoration:none; font-weight:700; padding:9px 18px; border-radius:6px; display:inline-block; }
`
