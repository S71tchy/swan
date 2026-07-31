/** Client-side image preparation for alert pictures.
 *
 * Alert pictures are stored as `data:` URIs in `Alert.picture_url` — the column
 * is a plain string, so base64 needs no upload endpoint, no file storage and no
 * migration, and swapping to object storage later just means putting a different
 * string in the same column.
 *
 * The cost of that choice is that the picture rides along in every alert
 * payload, including the feed list. So the browser downscales and re-encodes
 * before upload rather than shipping a 6 MB phone photo: a 1400px JPEG is
 * indistinguishable at the sizes we render (a 380px panel band, a ~340–560px
 * card) and lands two orders of magnitude smaller.
 */

/** Longest edge of the stored image, in px. Covers the panel band and card at 2x. */
const MAX_EDGE = 1400
const JPEG_QUALITY = 0.82

/** Hard ceiling on the stored data URI. Anything above this would bloat every
 *  feed response, so it's rejected with a message rather than silently accepted. */
const MAX_DATA_URL_BYTES = 1_500_000

export const MAX_PICTURE_MB = 20

export class ImageError extends Error {}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new ImageError('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new ImageError("That file isn't a readable image."))
    img.src = url
  })
}

/** Validate, downscale and encode a picked file into a storable data URI.
 *
 * Returns the smaller of (re-encoded JPEG, original file) — re-encoding a small
 * PNG screenshot can easily make it bigger, and JPEG artefacts on text are the
 * one case where the original is both smaller and better.
 */
export async function preparePicture(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new ImageError('Only image files can be used as the alert picture.')
  }
  if (file.size > MAX_PICTURE_MB * 1024 * 1024) {
    throw new ImageError(`That image is over ${MAX_PICTURE_MB} MB. Try a smaller one.`)
  }

  const originalUrl = await readAsDataUrl(file)
  const img = await loadImage(originalUrl)

  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageError('Your browser could not process that image.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const encoded = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const best = encoded.length < originalUrl.length ? encoded : originalUrl

  if (best.length > MAX_DATA_URL_BYTES) {
    throw new ImageError('That image is too detailed to store. Try a smaller or simpler one.')
  }
  return best
}

/** Approximate decoded byte size of a data URI, for showing "≈240 KB". */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.round((base64.length * 3) / 4)
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
