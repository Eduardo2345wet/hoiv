// Tecnologías del juego (common/technologies/*.txt) y estados de autonomía
// (common/autonomous_states/*.txt): lo mínimo para elegirlas y enlazarlas.
import { bodies, children } from './gameTraits'

export interface GameTech {
  id: string
  /** Carpeta de la pantalla de investigación (folder = { name = … }) */
  folder?: string
  /** position = { x y } dentro de la carpeta */
  x?: number
  y?: number
  cost?: number
  year?: number
  /** Archivo de common/technologies donde está definida */
  file?: string
  /** Tecnologías que desbloquea (path = { leads_to_tech = … }) */
  leadsTo: string[]
  /** dependencies = { tecnología = 1 }: requisitos que declara la propia tecnología */
  dependencies?: string[]
  /** Efectos sencillos (clave = valor) para el globo de información */
  effects?: [string, string][]
}

/** Variables `@nombre = número` definidas en el mismo archivo (por ejemplo @1936 = 0) */
export function techVariables(text: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of text.matchAll(/^\s*@([A-Za-z0-9_]+)\s*=\s*(-?\d+(?:\.\d+)?)/gm))
    out[m[1]] = Number(m[2])
  return out
}

const STRUCTURAL = new Set([
  'research_cost',
  'start_year',
  'show_effect_as_desc',
  'xp_research_bonus',
  'xp_unlock_cost',
  'doctrine',
  'is_special_project_tech'
])

/** Pares clave = valor del primer nivel de una tecnología (sin bloques anidados) */
function simpleEffects(body: string): [string, string][] {
  let flat = body
  for (let prev = ''; prev !== flat;) {
    prev = flat
    flat = flat.replace(/\{[^{}]*\}/g, '')
  }
  return [...flat.matchAll(/([a-z_0-9]+)\s*=\s*(-?[\d.]+|yes|no)/g)]
    .filter((m) => !STRUCTURAL.has(m[1]))
    .map((m): [string, string] => [m[1], m[2]])
    .slice(0, 6)
}

export function parseTechnologies(text: string): GameTech[] {
  const out: GameTech[] = []
  const vars = techVariables(text)
  const num = (v: string | undefined): number | undefined => {
    if (v === undefined) return undefined
    if (v.startsWith('@')) return vars[v.slice(1)]
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  for (const b of bodies(text, 'technologies'))
    for (const c of children(b)) {
      const folder = /folder\s*=\s*\{[^}]*?name\s*=\s*([A-Za-z0-9_]+)/.exec(c.body)?.[1]
      const pos =
        /position\s*=\s*\{\s*x\s*=\s*(-?\d+|@[A-Za-z0-9_]+)\s*y\s*=\s*(-?\d+|@[A-Za-z0-9_]+)/.exec(
          c.body
        )
      const x = num(pos?.[1])
      const y = num(pos?.[2])
      const cost = num(/research_cost\s*=\s*(@?[\w.]+)/.exec(c.body)?.[1])
      const year = num(/start_year\s*=\s*(@?\w+)/.exec(c.body)?.[1])
      const leadsTo = [...c.body.matchAll(/leads_to_tech\s*=\s*([A-Za-z0-9_]+)/g)].map((m) => m[1])
      const dep = bodies(c.body, 'dependencies')[0]
      const dependencies = dep
        ? [...dep.matchAll(/([A-Za-z0-9_]+)\s*=\s*\d+/g)].map((m) => m[1])
        : []
      out.push({
        id: c.id,
        ...(folder ? { folder } : {}),
        ...(x !== undefined && y !== undefined ? { x, y } : {}),
        ...(cost !== undefined ? { cost } : {}),
        ...(year !== undefined ? { year } : {}),
        leadsTo,
        ...(dependencies.length ? { dependencies } : {}),
        ...(simpleEffects(c.body).length ? { effects: simpleEffects(c.body) } : {})
      })
    }
  return out
}

/** Claves de nivel superior de un archivo (autonomous_states: `autonomy_puppet = { … }`) */
export function topLevelKeys(text: string): string[] {
  return children(`{${text}}`.slice(1, -1)).map((c) => c.id)
}
