// Tamaños finales de los íconos (en píxeles) — un solo lugar para cambiarlos.
import type { IconColor, IconTarget } from '../types'

export const ICON_SIZES: Record<IconTarget, { w: number; h: number }> = {
  /** Foco: el tamaño más común de los íconos de focos del juego */
  focus: { w: 100, h: 88 },
  /** Espíritu nacional: tamaño del ícono de relleno del juego base */
  idea: { w: 60, h: 68 }
}

/** Colores de fondo de los íconos con emoji: [nombre, relleno, borde claro] */
export const ICON_COLORS: Record<IconColor, { label: string; fill: string; light: string }> = {
  acero: { label: 'Gris acero', fill: '#5b6470', light: '#c9d1da' },
  oliva: { label: 'Oliva', fill: '#5f6b3a', light: '#c8d39a' },
  azul: { label: 'Azul', fill: '#2f4f86', light: '#a9c3f0' },
  rojo: { label: 'Rojo', fill: '#8a2f2a', light: '#f0aaa4' },
  dorado: { label: 'Dorado', fill: '#9a7a22', light: '#f3dc8c' },
  negro: { label: 'Negro', fill: '#1d1d22', light: '#8c8c96' }
}

export const DEFAULT_COLOR: Record<IconTarget, IconColor> = {
  focus: 'acero',
  idea: 'oliva'
}
