// Matemática de la vista del mapa (sin React): límites, zoom animado e inercia.
import type { View } from './renderer'

export const MAX_SCALE = 24
/** Duración del zoom animado de la rueda (ms) */
export const ZOOM_MS = 120
/** Constante de tiempo de la inercia al soltar el arrastre (ms): "inercia ligera" */
export const INERTIA_TAU_MS = 180
/** Velocidad mínima (px/ms) para que haya inercia */
export const INERTIA_MIN = 0.15

/** Escala que deja el mapa entero dentro de la pantalla */
export const fitScale = (mapW: number, mapH: number, w: number, h: number): number =>
  Math.min(w / mapW, h / mapH)

/** El zoom mínimo es la mitad del "ajustar": no se pierde el mapa alejándose */
export const minScaleFor = (mapW: number, mapH: number, w: number, h: number): number =>
  Math.max(0.02, fitScale(mapW, mapH, w, h) * 0.5)

export function clampScale(s: number, mapW: number, mapH: number, w: number, h: number): number {
  return Math.max(minScaleFor(mapW, mapH, w, h), Math.min(MAX_SCALE, s))
}

/**
 * Limita la posición para que SIEMPRE quede visible una parte del mapa (al menos `keep` px en
 * cada eje, o el mapa entero si es más chico): no se puede arrastrar el mapa fuera de la vista.
 */
export function clampView(v: View, mapW: number, mapH: number, w: number, h: number): View {
  const scale = clampScale(v.scale, mapW, mapH, w, h)
  const keep = Math.min(200, 0.25 * Math.min(w, h))
  const kx = Math.min(keep, mapW * scale)
  const ky = Math.min(keep, mapH * scale)
  const x = Math.max(kx - mapW * scale, Math.min(w - kx, v.x))
  const y = Math.max(ky - mapH * scale, Math.min(h - ky, v.y))
  return { scale, x, y }
}

export interface ZoomAnim {
  from: number
  to: number
  /** Punto de la pantalla (px) que se queda fijo y el punto del mapa que está debajo */
  sx: number
  sy: number
  mpx: number
  mpy: number
  t0: number
  dur: number
}

/**
 * Empieza (o encadena) un zoom de la rueda centrado en (sx, sy). Si ya había uno en marcha, la
 * meta se acumula: varios giros seguidos suman, y el movimiento sigue siendo continuo.
 */
export function startZoom(
  cur: View,
  prev: ZoomAnim | null,
  factor: number,
  sx: number,
  sy: number,
  now: number,
  mapW: number,
  mapH: number,
  w: number,
  h: number
): ZoomAnim | null {
  const base = prev ? prev.to : cur.scale
  const to = clampScale(base * factor, mapW, mapH, w, h)
  if (to === cur.scale && !prev) return null
  return {
    from: cur.scale,
    to,
    sx,
    sy,
    mpx: (sx - cur.x) / cur.scale,
    mpy: (sy - cur.y) / cur.scale,
    t0: now,
    dur: ZOOM_MS
  }
}

const easeOut = (t: number): number => 1 - (1 - t) ** 3

/** Vista del zoom animado en el instante `now`; la escala va en proporción (logarítmica) */
export function zoomFrame(a: ZoomAnim, now: number): { view: View; done: boolean } {
  const t = Math.max(0, Math.min(1, (now - a.t0) / a.dur))
  const scale = a.from * (a.to / a.from) ** easeOut(t)
  return {
    view: { scale, x: a.sx - a.mpx * scale, y: a.sy - a.mpy * scale },
    done: t >= 1
  }
}

/** Un paso de inercia: desplazamiento (px) en `dt` ms y la velocidad que queda */
export function inertiaStep(
  vx: number,
  vy: number,
  dt: number
): { dx: number; dy: number; vx: number; vy: number; done: boolean } {
  const k = Math.exp(-dt / INERTIA_TAU_MS)
  const nvx = vx * k
  const nvy = vy * k
  return { dx: vx * dt, dy: vy * dt, vx: nvx, vy: nvy, done: Math.hypot(nvx, nvy) < 0.02 }
}

/** Velocidad (px/ms) a partir de las últimas muestras del arrastre (últimos ~100 ms) */
export function releaseVelocity(
  samples: { t: number; x: number; y: number }[]
): { vx: number; vy: number } | null {
  if (samples.length < 2) return null
  const last = samples[samples.length - 1]
  const first = samples.find((s) => last.t - s.t <= 100) ?? samples[0]
  const dt = last.t - first.t
  if (dt <= 0) return null
  const vx = (last.x - first.x) / dt
  const vy = (last.y - first.y) / dt
  return Math.hypot(vx, vy) >= INERTIA_MIN ? { vx, vy } : null
}
