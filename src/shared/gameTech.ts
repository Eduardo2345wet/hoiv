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
  /** Tecnologías que desbloquea (path = { leads_to_tech = … }) */
  leadsTo: string[]
}

export function parseTechnologies(text: string): GameTech[] {
  const out: GameTech[] = []
  for (const b of bodies(text, 'technologies'))
    for (const c of children(b)) {
      const folder = /folder\s*=\s*\{[^}]*?name\s*=\s*([A-Za-z0-9_]+)/.exec(c.body)?.[1]
      const pos = /position\s*=\s*\{\s*x\s*=\s*(-?\d+)\s*y\s*=\s*(-?\d+)/.exec(c.body)
      const cost = /research_cost\s*=\s*([\d.]+)/.exec(c.body)?.[1]
      const year = /start_year\s*=\s*(\d+)/.exec(c.body)?.[1]
      const leadsTo = [...c.body.matchAll(/leads_to_tech\s*=\s*([A-Za-z0-9_]+)/g)].map((m) => m[1])
      out.push({
        id: c.id,
        ...(folder ? { folder } : {}),
        ...(pos ? { x: Number(pos[1]), y: Number(pos[2]) } : {}),
        ...(cost ? { cost: Number(cost) } : {}),
        ...(year ? { year: Number(year) } : {}),
        leadsTo
      })
    }
  return out
}

/** Claves de nivel superior de un archivo (autonomous_states: `autonomy_puppet = { … }`) */
export function topLevelKeys(text: string): string[] {
  return children(`{${text}}`.slice(1, -1)).map((c) => c.id)
}
