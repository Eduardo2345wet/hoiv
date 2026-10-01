// Qué línea lleva cada segmento de frontera según los dueños ACTUALES. La misma regla está
// escrita en el shader de vértices (webglRenderer.ts); el respaldo Canvas 2D usa esta función.
// Pintar solo cambia dueños y banderas: la geometría de las fronteras no se vuelve a calcular.
import { MAP_THEME, THEME_RGB, type RGB3 } from '../../../shared/map/theme'
import { FLAG } from './colors'

export type BorderPass = 'normal' | 'active' | 'hover'

export interface SegmentInfo {
  /** Posición (1, 2, …) de cada estado en `states`; 0 = costa (mar o lago) */
  slotA: number
  slotB: number
  /** Dueño (índice de la paleta; 0 = sin pintar) y banderas de cada lado */
  ownerA: number
  ownerB: number
  flagsA: number
  flagsB: number
}

export interface SegmentStyle {
  color: RGB3
  /** Ancho en píxeles CSS (constante en pantalla) */
  widthCss: number
}

/**
 * - normal: gris claro entre estados del mismo dueño o sin pintar; gris oscuro (más grueso)
 *   entre estados PINTADOS de países distintos; nada en la costa.
 * - active: contorno ámbar del país activo (también por la costa).
 * - hover: contorno gris oscuro del estado bajo el cursor (también por la costa).
 */
export function segmentStyle(
  pass: BorderPass,
  s: SegmentInfo,
  hoverSlot: number
): SegmentStyle | null {
  if (pass === 'normal') {
    if (s.slotA === 0 || s.slotB === 0) return null
    const country = s.ownerA !== 0 && s.ownerB !== 0 && s.ownerA !== s.ownerB
    return country
      ? { color: THEME_RGB.countryBorder, widthCss: MAP_THEME.width.countryBorder }
      : { color: THEME_RGB.stateBorder, widthCss: MAP_THEME.width.stateBorder }
  }
  if (pass === 'active')
    return ((s.flagsA ^ s.flagsB) & FLAG.active) !== 0
      ? { color: THEME_RGB.activeContour, widthCss: MAP_THEME.width.activeContour }
      : null
  return hoverSlot !== 0 && (s.slotA === hoverSlot || s.slotB === hoverSlot)
    ? { color: THEME_RGB.hoverContour, widthCss: MAP_THEME.width.hoverContour }
    : null
}
