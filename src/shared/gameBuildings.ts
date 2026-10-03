// Edificios (common/buildings) y categorías de estado (common/state_category) del juego.
// Lectura simple por llaves (sin jomini) para poder usarla en el proceso principal sin esperar.

export interface GameBuilding {
  id: string
  max: number
  provincial: boolean
}

/** Entradas `clave = { … }` que están directamente dentro de `outer = { … }` */
export function entries(text: string, outer: string): { key: string; body: string }[] {
  const clean = text.replace(/#[^\n]*/g, '')
  const m = new RegExp(`(?:^|\\s)${outer}\\s*=\\s*\\{`).exec(clean)
  if (!m) return []
  let i = m.index + m[0].length
  const out: { key: string; body: string }[] = []
  let depth = 1
  let start = -1
  let key = ''
  let word = ''
  let prev = ''
  for (; i < clean.length && depth > 0; i++) {
    const c = clean[i]
    if (c === '{') {
      if (depth === 1) {
        key = prev
        start = i + 1
      }
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 1 && start >= 0) {
        out.push({ key, body: clean.slice(start, i) })
        start = -1
      }
    } else if (depth === 1 && /[A-Za-z0-9_]/.test(c)) word += c
    else if (depth === 1 && word) {
      prev = word
      word = ''
    }
  }
  return out
}

/** Valor de una clave numérica o `yes` de primer nivel dentro del cuerpo de una entrada */
export function topValue(body: string, key: string): string | null {
  let depth = 0
  let flat = ''
  for (const c of body) {
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (depth === 0) flat += c
  }
  return new RegExp(`\\b${key}\\s*=\\s*([A-Za-z0-9_.]+)`).exec(flat)?.[1] ?? null
}

/**
 * por verificar con common/buildings del juego: `max_level` y `province_based`
 * (si el juego usa otro nombre para "edificio por provincia", solo cambia esa constante).
 */
export const PROVINCE_BASED_KEY = 'province_based'

export function parseBuildings(text: string): GameBuilding[] {
  return entries(text, 'buildings').map(({ key, body }) => ({
    id: key,
    max: Number(topValue(body, 'max_level') ?? 0) || 0,
    provincial: topValue(body, PROVINCE_BASED_KEY) === 'yes'
  }))
}

export function parseStateCategories(text: string): string[] {
  return entries(text, 'state_categories').map((e) => e.key)
}
