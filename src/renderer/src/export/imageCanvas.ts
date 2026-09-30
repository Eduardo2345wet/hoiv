// Utilidades de imágenes que necesitan el navegador (canvas).
export type FitMode = 'ajustar' | 'rellenar'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la imagen'))
    img.src = src
  })
}

/**
 * Redimensiona una imagen a w×h.
 * - ajustar: entra completa (bordes transparentes)
 * - rellenar: cubre todo y recorta; offset (-1..1) mueve el recorte
 */
export function resizeImage(
  img: HTMLImageElement,
  w: number,
  h: number,
  mode: FitMode,
  offset = { x: 0, y: 0 }
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  const scale =
    mode === 'ajustar'
      ? Math.min(w / img.width, h / img.height)
      : Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = (w - dw) / 2 + (mode === 'rellenar' ? (offset.x * (dw - w)) / 2 : 0)
  const dy = (h - dh) / 2 + (mode === 'rellenar' ? (offset.y * (dh - h)) / 2 : 0)
  ctx.drawImage(img, dx, dy, dw, dh)
  return c
}

/** PNG base64 → píxeles RGBA */
export async function pngToRGBA(
  dataUrl: string
): Promise<{ width: number; height: number; rgba: Uint8ClampedArray }> {
  const img = await loadImage(dataUrl)
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return {
    width: c.width,
    height: c.height,
    rgba: ctx.getImageData(0, 0, c.width, c.height).data
  }
}
