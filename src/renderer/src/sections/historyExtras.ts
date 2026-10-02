// Lo que las secciones (personajes, situación inicial, ejército) agregan a la historia de un país.
// Cada sección registra un contribuyente; countryExport los une y los aplica:
//  · país nuevo: dentro del archivo de historia generado;
//  · país del juego: con el parche mínimo (se parte SIEMPRE del archivo real del juego).
import type { Country, Project } from '../types'

export interface HistoryExtras {
  /** Claves de un solo valor (set_stability…): reemplazan la línea existente o se agregan */
  scalars: Record<string, string>
  /** Líneas sueltas antes de set_politics (recruit_character, add_ideas, diplomacia…) */
  lines: string[]
  /** Bloques con fecha: "1939.1.1" → líneas */
  dated: Record<string, string[]>
  /** Nombre del OOB (oob = "…"); null = no cambiar */
  oob: string | null
}

export const emptyExtras = (): HistoryExtras => ({ scalars: {}, lines: [], dated: {}, oob: null })

type Contributor = (project: Project, c: Country) => Partial<HistoryExtras>
const contributors = new Map<string, Contributor>()
export function registerHistoryContributor(id: string, f: Contributor): void {
  contributors.set(id, f)
}

export function historyExtras(project: Project, c: Country): HistoryExtras {
  const out = emptyExtras()
  for (const f of contributors.values()) {
    const e = f(project, c)
    Object.assign(out.scalars, e.scalars ?? {})
    out.lines.push(...(e.lines ?? []))
    for (const [d, ls] of Object.entries(e.dated ?? {}))
      out.dated[d] = [...(out.dated[d] ?? []), ...ls]
    if (e.oob) out.oob = e.oob
  }
  return out
}
export const hasExtras = (e: HistoryExtras): boolean =>
  !!(Object.keys(e.scalars).length || e.lines.length || Object.keys(e.dated).length || e.oob)

export const datedBlocks = (e: HistoryExtras): string =>
  Object.entries(e.dated)
    .map(([d, ls]) => `${d} = {\n${ls.map((l) => `\t${l}`).join('\n')}\n}`)
    .join('\n')
