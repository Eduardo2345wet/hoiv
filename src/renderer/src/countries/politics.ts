// Popularidades: siempre enteros que suman exactamente 100.
import { IDEOLOGIES, type Ideology } from '../types'

export type Popularities = Record<Ideology, number>

export const sumPopularities = (p: Popularities): number => IDEOLOGIES.reduce((s, i) => s + p[i], 0)

/**
 * Reparte la diferencia hasta 100 entre las OTRAS 3 ideologías, en proporción a su valor
 * actual (a partes iguales si todas están en 0). No toca la que moví (`fixed`).
 * Usa el método del mayor resto para que el total sea exactamente 100.
 */
export function balancePopularities(pops: Popularities, fixed: Ideology): Popularities {
  const moved = Math.max(0, Math.min(100, Math.round(pops[fixed])))
  const others = IDEOLOGIES.filter((i) => i !== fixed)
  const target = 100 - moved
  const current = others.map((i) => Math.max(0, pops[i]))
  const total = current.reduce((a, b) => a + b, 0)
  const exact = others.map((_, n) =>
    total > 0 ? (current[n] / total) * target : target / others.length
  )
  const floors = exact.map(Math.floor)
  let left = target - floors.reduce((a, b) => a + b, 0)
  // Mayor resto primero
  const order = exact
    .map((v, n) => ({ n, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r || a.n - b.n)
  for (const { n } of order) {
    if (left <= 0) break
    floors[n]++
    left--
  }
  const out = { ...pops, [fixed]: moved } as Popularities
  others.forEach((i, n) => (out[i] = floors[n]))
  return out
}

/** La ideología más popular (la primera en caso de empate) */
export function mostPopular(p: Popularities): Ideology {
  return IDEOLOGIES.reduce((best, i) => (p[i] > p[best] ? i : best), IDEOLOGIES[0])
}
