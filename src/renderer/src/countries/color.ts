// Colores de país: cómo lo "apaga" el juego en el mapa y si dos colores se parecen.

export type RGB = [number, number, number]

export function rgbToHsv([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, max === 0 ? 0 : d / max, max]
}

export function hsvToRgb([h, s, v]: [number, number, number]): RGB {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let rgb: [number, number, number]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return rgb.map((n) => Math.round((n + m) * 255)) as RGB
}

/** Como se ve en el mapa: mismo tono, saturación ×0.6 y valor ×0.8 */
export function mapColor(rgb: RGB): RGB {
  const [h, s, v] = rgbToHsv(rgb)
  return hsvToRgb([h, s * 0.6, v * 0.8])
}

export const toHex = (rgb: RGB): string =>
  '#' +
  rgb
    .map((n) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')

export function fromHex(hex: string): RGB {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0) as RGB
}

/** Distancia simple entre colores; menos de ~30 se ven casi iguales en el mapa */
export function colorDistance(a: RGB, b: RGB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}
export const SIMILAR_COLOR_DISTANCE = 30
