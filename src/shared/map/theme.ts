// Estilo del mapa generado: TODOS los colores y anchos viven aquí (un solo archivo).
// El aspecto sale siempre de los datos del juego o del paquete; nunca de una imagen externa.
export type RGB3 = [number, number, number]

export const hexToRgb = (hex: string): RGB3 => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgbToHex = (c: RGB3): string =>
  '#' +
  c
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

export const MAP_THEME = {
  /** Mar y lagos; también el fondo fuera del mapa */
  sea: '#446BA3',
  /** Tierra sin pintar (lienzo en blanco) */
  land: '#FFFFFF',
  /** Frontera entre estados del mismo dueño (o sin pintar) */
  stateBorder: '#BFBFBF',
  /** Frontera entre estados pintados de países distintos */
  countryBorder: '#6E6E6E',
  /** Frontera de provincia (solo con el interruptor) */
  provinceBorder: '#E6E6E6',
  /** Números y nombres sobre tierra blanca */
  label: '#000000',
  /** Contorno del país activo */
  activeContour: '#FBBF24',
  /** Contorno del estado bajo el cursor */
  hoverContour: '#3A3A3A',
  /** Anchos en píxeles CSS (constantes en pantalla, a cualquier zoom) */
  width: {
    stateBorder: 1,
    countryBorder: 1.75, // 1.5–2 px
    provinceBorder: 0.5,
    activeContour: 2,
    hoverContour: 2
  },
  /** Tamaños de texto en píxeles CSS */
  font: {
    stateMin: 9,
    stateMax: 14,
    capitalMin: 11,
    capitalMax: 16
  },
  /** Aclarado del estado bajo el cursor (0–1 hacia blanco) */
  hoverBrighten: 0.12,
  /** "Colores como en el juego": saturación ×0.6 y valor ×0.8 (ver countries/color.ts) */
  stripe: { period: 8, thickness: 2, darken: 0.14 }
} as const

export const THEME_RGB = {
  sea: hexToRgb(MAP_THEME.sea),
  land: hexToRgb(MAP_THEME.land),
  stateBorder: hexToRgb(MAP_THEME.stateBorder),
  countryBorder: hexToRgb(MAP_THEME.countryBorder),
  provinceBorder: hexToRgb(MAP_THEME.provinceBorder),
  label: hexToRgb(MAP_THEME.label),
  activeContour: hexToRgb(MAP_THEME.activeContour),
  hoverContour: hexToRgb(MAP_THEME.hoverContour)
}

/** Color de GLSL (vec3) a partir de un RGB 0–255 */
export const glslVec3 = (c: RGB3): string =>
  `vec3(${c.map((v) => (v / 255).toFixed(6)).join(', ')})`

/**
 * ¿El texto sobre este fondo debe ser blanco? Luminancia relativa (sRGB) < 0.4 → blanco.
 * Sobre blanco el texto es negro (#000000).
 */
export function textIsWhite(bg: RGB3): boolean {
  const lin = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * lin(bg[0]) + 0.7152 * lin(bg[1]) + 0.0722 * lin(bg[2])
  return L < 0.4 // por verificar: umbral de contraste elegido a ojo
}

/** Ancho de línea en píxeles del dispositivo: siempre `css` píxeles CSS, a cualquier DPR */
export const deviceWidth = (cssPx: number, dpr: number): number => cssPx * dpr
