// Tecnologías (modo avanzado) y subideologías. LO SEGURO PRIMERO:
//  · Subideologías: parche mínimo del archivo de ideologías REAL del juego (solo se inserta el type).
//  · Tecnologías nuevas: archivo propio dentro de carpetas EXISTENTES + parche mínimo de la tecnología
//    del juego que debe llevar el leads_to_tech. NUNCA se escribe interface/countrytechtreeview.gui:
//    una tecnología aparece en una carpeta existente porque su gridbox ya está en el juego.
import type { Project } from '../types'
import { newUid } from '../types'
import { safeFolderName } from '../../../shared/names'
import { block, file, kv, list, str, type Node } from '../export/clausewitz'
import { localisationFiles, type LocText } from '../export/localisation'
import type { ModFile } from '../export/exportMod'
import type { GameCatalog } from '../catalog/catalog'
import { registerSectionGenerator } from './generators'
import type { IdeologyDef, Technology } from './types'

/** por verificar con un ejemplo real: research_cost_coeff de los enlaces nuevos */
export const LINK_COEFF = 1
/** por verificar: tamaño del ícono de subideología y su ruta */
export const IDEOLOGY_ICON_SIZE = { w: 32, h: 32 }
export const GROUPS: { id: IdeologyDef['group']; label: string }[] = [
  { id: 'democratic', label: 'Democracia' },
  { id: 'communism', label: 'Comunismo' },
  { id: 'fascism', label: 'Fascismo' },
  { id: 'neutrality', label: 'Neutralidad' }
]

const mod = (p: Project): string => safeFolderName(p.modName)

// ---------------------------------------------------------------- operaciones

export function newTech(p: Project, over: Partial<Technology> = {}): Technology {
  const taken = new Set((p.technologies ?? []).map((t) => t.id))
  const base = `${mod(p)}_${safeFolderName(over.name || 'tecnologia').replace(/^mi_mod$/, 'tecnologia')}`
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`
  return {
    uid: newUid(),
    id,
    name: '',
    description: '',
    folder: '',
    x: 0,
    y: 0,
    cost: 1,
    year: 1936,
    categories: [],
    leadsTo: [],
    prerequisites: [],
    ...over
  }
}
export function createTech(
  p: Project,
  over: Partial<Technology> = {}
): { project: Project; tech: Technology } {
  const tech = newTech(p, over)
  return { project: { ...p, technologies: [...(p.technologies ?? []), tech] }, tech }
}
export const updateTech = (p: Project, uid: string, patch: Partial<Technology>): Project => ({
  ...p,
  technologies: (p.technologies ?? []).map((t) => (t.uid === uid ? { ...t, ...patch } : t))
})
export const deleteTech = (p: Project, uid: string): Project => ({
  ...p,
  technologies: (p.technologies ?? []).filter((t) => t.uid !== uid)
})

export function newIdeology(p: Project, over: Partial<IdeologyDef> = {}): IdeologyDef {
  const taken = new Set((p.ideologies ?? []).map((i) => i.id))
  const base = `${mod(p)}_${safeFolderName(over.name || 'subideologia').replace(/^mi_mod$/, 'subideologia')}`
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`
  return {
    uid: newUid(),
    group: 'neutrality',
    id,
    name: '',
    description: '',
    color: null,
    icon: null,
    ...over
  }
}
export function createIdeology(
  p: Project,
  over: Partial<IdeologyDef> = {}
): { project: Project; ideology: IdeologyDef } {
  const ideology = newIdeology(p, over)
  return { project: { ...p, ideologies: [...(p.ideologies ?? []), ideology] }, ideology }
}
export const updateIdeology = (p: Project, uid: string, patch: Partial<IdeologyDef>): Project => ({
  ...p,
  ideologies: (p.ideologies ?? []).map((i) => (i.uid === uid ? { ...i, ...patch } : i))
})
export const deleteIdeology = (p: Project, uid: string): Project => ({
  ...p,
  ideologies: (p.ideologies ?? []).filter((i) => i.uid !== uid)
})

// ---------------------------------------------------------------- grafo de tecnologías

/** Tecnologías que exporta el proyecto (solo con el modo avanzado) */
export const exportedTechs = (p: Project): Technology[] =>
  p.techAdvanced ? (p.technologies ?? []) : []

/** Hijos de una tecnología MÍA: sus leadsTo + las mías que la listan como prerrequisito */
export function childrenOfMine(p: Project, t: Technology): string[] {
  const out = new Set(t.leadsTo)
  for (const o of exportedTechs(p)) if (o.prerequisites.includes(t.id)) out.add(o.id)
  return [...out]
}

/** Aristas padre → hijo de todo el árbol (juego + mías) */
export function techEdges(p: Project, game?: GameCatalog | null): [string, string][] {
  const edges: [string, string][] = []
  for (const g of game?.technologies ?? []) for (const c of g.leadsTo) edges.push([g.id, c])
  for (const t of exportedTechs(p)) {
    for (const c of childrenOfMine(p, t)) edges.push([t.id, c])
    for (const pre of t.prerequisites) edges.push([pre, t.id])
  }
  return edges
}

/** ¿Hay un ciclo entre las tecnologías? (devuelve una de las del ciclo) */
export function findTechCycle(edges: [string, string][]): string | null {
  const next = new Map<string, string[]>()
  for (const [a, b] of edges) next.set(a, [...(next.get(a) ?? []), b])
  const state = new Map<string, 1 | 2>()
  const visit = (n: string): string | null => {
    state.set(n, 1)
    for (const m of next.get(n) ?? []) {
      if (state.get(m) === 1) return m
      if (!state.has(m)) {
        const r = visit(m)
        if (r) return r
      }
    }
    state.set(n, 2)
    return null
  }
  for (const n of next.keys())
    if (!state.has(n)) {
      const r = visit(n)
      if (r) return r
    }
  return null
}

// ---------------------------------------------------------------- generación

export function techNode(p: Project, t: Technology): Node {
  const kids: Node[] = [kv('research_cost', t.cost), kv('start_year', t.year)]
  kids.push(
    block('folder', [kv('name', t.folder), block('position', [kv('x', t.x), kv('y', t.y)])])
  )
  for (const c of childrenOfMine(p, t))
    kids.push(block('path', [kv('leads_to_tech', c), kv('research_cost_coeff', LINK_COEFF)]))
  if (t.categories.length) kids.push(list('categories', t.categories))
  return block(t.id, kids)
}

export const techFilePath = (p: Project): string => `common/technologies/${mod(p)}_technologies.txt`

export function techFiles(p: Project): ModFile[] {
  const ts = exportedTechs(p)
  if (!ts.length) return []
  return [
    {
      path: techFilePath(p),
      text: file([
        block(
          'technologies',
          ts.map((t) => techNode(p, t))
        )
      ])
    }
  ]
}

/** Claves de localización de una subideología (nombre y descripción) */
export function ideologyLoc(p: Project): ModFile[] {
  const e: Record<string, LocText> = {}
  for (const t of exportedTechs(p)) {
    e[t.id] = t.name
    if (t.description.trim()) e[`${t.id}_desc`] = t.description
  }
  for (const i of p.ideologies ?? []) {
    e[i.id] = i.name
    e[`${i.id}_desc`] = i.description || i.name
    // por verificar: nombre de partido de CADA país del mod para esta subideología (cae al del grupo)
    for (const c of p.countries)
      if (!c.light && !c.technical) {
        const party = c.politics.parties?.[i.group]
        e[`${c.tag}_${i.id}_party`] = party?.short || i.name
        e[`${c.tag}_${i.id}_party_long`] = party?.long || i.name
      }
  }
  return localisationFiles(p, 'technologies', e)
}

export const ideologyIconPath = (p: Project, i: IdeologyDef): string =>
  `gfx/interface/ideologies/${mod(p)}_${i.id}.dds`
export const ideologyImages = (p: Project): { path: string; png: string; w: number; h: number }[] =>
  (p.ideologies ?? []).flatMap((i) =>
    i.icon ? [{ path: ideologyIconPath(p, i), png: i.icon, ...IDEOLOGY_ICON_SIZE }] : []
  )

function ideologyGfx(p: Project): ModFile[] {
  const imgs = (p.ideologies ?? []).filter((i) => i.icon)
  if (!imgs.length) return []
  // por verificar con interface/ideologies.gfx del juego: nombre del sprite
  const sprites = imgs.map((i) =>
    block('SpriteType', [
      str('name', `GFX_ideology_${i.id}`),
      str('texturefile', ideologyIconPath(p, i))
    ])
  )
  return [
    { path: `interface/${mod(p)}_ideologies.gfx`, text: file([block('spriteTypes', sprites)]) }
  ]
}

registerSectionGenerator({
  id: 'tecnologias',
  generate: (p) =>
    (p.technologies?.length && p.techAdvanced) || p.ideologies?.length
      ? [...techFiles(p), ...ideologyGfx(p), ...ideologyLoc(p)]
      : []
})

// ---------------------------------------------------------------- parches mínimos

export type TextPatchReq =
  | { kind: 'tech'; file: string; links: { from: string; to: string }[] }
  | { kind: 'ideology'; file: string; adds: { group: string; id: string; lines?: string[] }[] }

/** Parches que pide el proyecto sobre archivos del juego (técnologías con prerrequisito del juego y subideologías) */
export function textPatchRequests(p: Project, game?: GameCatalog | null): TextPatchReq[] {
  const out: TextPatchReq[] = []
  // Tecnologías del juego que deben llevar un leads_to_tech hacia una mía
  const gameTech = new Map((game?.technologies ?? []).map((t) => [t.id, t]))
  const byFile = new Map<string, { from: string; to: string }[]>()
  for (const t of exportedTechs(p))
    for (const pre of t.prerequisites) {
      const g = gameTech.get(pre)
      if (!g?.file) continue
      byFile.set(g.file, [...(byFile.get(g.file) ?? []), { from: pre, to: t.id }])
    }
  for (const [f, links] of byFile) out.push({ kind: 'tech', file: f, links })
  // Subideologías
  const ideo = new Map<string, { group: string; id: string; lines?: string[] }[]>()
  for (const i of p.ideologies ?? []) {
    const f = game?.ideologyFiles?.find((x) => x.groups.some((g) => g.group === i.group))?.file
    if (!f) continue
    ideo.set(f, [
      ...(ideo.get(f) ?? []),
      {
        group: i.group,
        id: i.id,
        ...(i.color ? { lines: [`color = { ${i.color.join(' ')} }`] } : {})
      }
    ])
  }
  for (const [f, adds] of ideo) out.push({ kind: 'ideology', file: f, adds })
  return out
}

// ---------------------------------------------------------------- validación

export interface TechIssue {
  severity: 'error' | 'aviso'
  message: string
  uid?: string
}

export function validateTechnologies(p: Project, game?: GameCatalog | null): TechIssue[] {
  const out: TechIssue[] = []
  const gameIds = new Set((game?.technologies ?? []).map((t) => t.id))
  const mine = p.technologies ?? []
  const mineIds = new Set(mine.map((t) => t.id))
  const folders = new Set((game?.technologies ?? []).map((t) => t.folder).filter(Boolean))
  if (mine.length && !p.techAdvanced)
    out.push({
      severity: 'aviso',
      message: 'Hay tecnologías nuevas pero el Modo avanzado está desactivado: no se exportan.'
    })
  const seen = new Set<string>()
  for (const t of exportedTechs(p)) {
    const at = (severity: TechIssue['severity'], m: string): number =>
      out.push({ severity, message: `Tecnología ${t.id}: ${m}`, uid: t.uid })
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t.id))
      at('error', 'el ID solo admite letras, números y _.')
    if (seen.has(t.id)) at('error', 'ID repetido.')
    seen.add(t.id)
    if (gameIds.has(t.id)) at('error', 'ese ID ya existe en el juego (la reemplazaría).')
    if (!t.name.trim()) at('error', 'falta el nombre (localización).')
    if (!t.folder) at('error', 'elige una carpeta de la pantalla de investigación.')
    else if (game?.technologies && !folders.has(t.folder))
      at(
        'error',
        `la carpeta ${t.folder} no existe en el juego (su gridbox no está en la pantalla de investigación).`
      )
    if (!(t.cost > 0)) at('error', 'el costo debe ser mayor que 0.')
    if (!Number.isInteger(t.x) || !Number.isInteger(t.y) || t.x < 0 || t.y < 0)
      at('error', 'la posición debe ser un par de enteros ≥ 0.')
    for (const c of t.leadsTo)
      if (!mineIds.has(c) && !gameIds.has(c) && game?.technologies)
        at('error', `desbloquea ${c}, que no existe.`)
    for (const pre of t.prerequisites) {
      if (!mineIds.has(pre) && !gameIds.has(pre)) {
        if (game?.technologies) at('error', `su prerrequisito ${pre} no existe.`)
      } else if (gameIds.has(pre) && !game?.technologies?.find((g) => g.id === pre)?.file)
        at('error', `no se sabe en qué archivo del juego está ${pre}, así que no se puede enlazar.`)
    }
  }
  const cyc = findTechCycle(techEdges(p, game))
  if (cyc)
    out.push({ severity: 'error', message: `Hay un ciclo entre tecnologías (pasa por ${cyc}).` })
  if (exportedTechs(p).length && !game?.technologies)
    out.push({
      severity: 'aviso',
      message:
        'Sin carpeta del juego no se pueden comprobar las tecnologías ni parchar sus enlaces.'
    })
  return out
}

export function validateIdeologies(p: Project, game?: GameCatalog | null): TechIssue[] {
  const out: TechIssue[] = []
  const seen = new Set<string>()
  const existing = new Set(
    (game?.ideologyFiles ?? []).flatMap((f) => f.groups.flatMap((g) => g.types))
  )
  for (const i of p.ideologies ?? []) {
    const at = (severity: TechIssue['severity'], m: string): number =>
      out.push({ severity, message: `Subideología ${i.id}: ${m}`, uid: i.uid })
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(i.id))
      at('error', 'el ID solo admite letras, números y _.')
    if (seen.has(i.id)) at('error', 'ID repetido.')
    seen.add(i.id)
    if (existing.has(i.id)) at('error', 'ese ID ya existe en el juego.')
    if (!i.name.trim()) at('error', 'falta el nombre (localización).')
    if (
      game?.ideologyFiles &&
      !game.ideologyFiles.some((f) => f.groups.some((g) => g.group === i.group))
    )
      at('error', `el grupo ${i.group} no está en los archivos de ideologías del juego.`)
    if (!game?.ideologyFiles)
      at(
        'aviso',
        'sin la carpeta del juego no se puede exportar (se parcha el archivo real de ideologías).'
      )
    if (i.color && i.color.some((c) => !(c >= 0 && c <= 255)))
      at('error', 'el color va de 0 a 255.')
  }
  return out
}
