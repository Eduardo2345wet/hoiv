// Operaciones puras sobre los países del proyecto (devuelven un proyecto NUEVO)
import {
  IDEOLOGIES,
  newUid,
  type Country,
  type CountryNames,
  type Ideology,
  type Leader,
  type Project
} from '../types'
import { asciiSlug } from '../../../shared/names'
import {
  BUILTIN_GRAPHICAL_CULTURES,
  BUILTIN_GRAPHICAL_CULTURES_2D,
  BUILTIN_SUBIDEOLOGIES,
  DEFAULT_PARTIES
} from './gameData'

const emptyNames = (): CountryNames => ({ name: '', def: '', adj: '' })

/** País con valores por defecto razonables */
export function newCountry(opts: { mode: Country['mode']; tag: string; name: string }): Country {
  const ruling: Ideology = 'neutrality'
  return {
    uid: newUid(),
    mode: opts.mode,
    tag: opts.tag,
    names: { name: opts.name, def: opts.name, adj: '' },
    ideologyNames: {
      democratic: emptyNames(),
      fascism: emptyNames(),
      communism: emptyNames(),
      neutrality: emptyNames()
    },
    color: [120, 120, 160],
    graphicalCulture: BUILTIN_GRAPHICAL_CULTURES[0],
    graphicalCulture2d: BUILTIN_GRAPHICAL_CULTURES_2D[0],
    politics: {
      ruling,
      popularities: { democratic: 20, fascism: 10, communism: 10, neutrality: 60 },
      electionsAllowed: false,
      electionFrequency: 48,
      lastElection: '1932.1.1',
      parties: {
        democratic: { ...DEFAULT_PARTIES.democratic },
        fascism: { ...DEFAULT_PARTIES.fascism },
        communism: { ...DEFAULT_PARTIES.communism },
        neutrality: { ...DEFAULT_PARTIES.neutrality }
      }
    },
    capital: null,
    flags: { main: null, byIdeology: {} },
    leaders: [],
    focusTreeId: null,
    existing: { renameInGame: false, historyFile: null, historyText: null, historyEdited: false }
  }
}

export function newLeader(name: string, ideology: Ideology, existingIds: string[] = []): Leader {
  const base = asciiSlug(name) || 'lider'
  let id = base
  let n = 2
  while (existingIds.includes(id)) id = `${base}_${n++}`
  return {
    uid: newUid(),
    id,
    name,
    ideology,
    subideology: BUILTIN_SUBIDEOLOGIES[ideology][0],
    portrait: null
  }
}

/** Líder que se recluta: el de la ideología gobernante */
export function rulingLeader(c: Country): Leader | undefined {
  return c.leaders.find((l) => l.ideology === c.politics.ruling)
}

/** Nombres de una ideología (los vacíos usan el nombre normal) */
export function namesFor(c: Country, ideology: Ideology): CountryNames {
  const n = c.ideologyNames[ideology]
  return {
    name: n.name || c.names.name,
    def: n.def || c.names.def || c.names.name,
    adj: n.adj || c.names.adj
  }
}

export function addCountry(p: Project, c: Country): Project {
  return { ...p, countries: [...p.countries, c] }
}

export function updateCountry(p: Project, uid: string, patch: Partial<Country>): Project {
  return { ...p, countries: p.countries.map((c) => (c.uid === uid ? { ...c, ...patch } : c)) }
}

export function replaceCountry(p: Project, c: Country): Project {
  return { ...p, countries: p.countries.map((x) => (x.uid === c.uid ? c : x)) }
}

/** Copia un país con otro tag; la copia no tiene árbol de focos */
export function duplicateCountry(
  p: Project,
  uid: string,
  newTag: string
): { project: Project; country: Country } {
  const src = p.countries.find((c) => c.uid === uid)!
  const copy: Country = {
    ...structuredClone(src),
    uid: newUid(),
    mode: 'nuevo',
    tag: newTag,
    names: { ...src.names, name: `${src.names.name} (copia)` },
    focusTreeId: null,
    existing: { renameInGame: false, historyFile: null, historyText: null, historyEdited: false }
  }
  copy.leaders = copy.leaders.map((l) => ({ ...l, uid: newUid() }))
  return { project: addCountry(p, copy), country: copy }
}

/** Borra el país; su árbol de focos se conserva pero queda sin país */
export function deleteCountry(p: Project, uid: string): Project {
  return { ...p, countries: p.countries.filter((c) => c.uid !== uid) }
}

/** Focos cuyo script menciona este tag (tag = X, declare_war_on, puppet...) */
export function countryReferences(p: Project, tag: string): string[] {
  const re = new RegExp(`\\b(?:tag|target|add_to_faction|puppet) = ${tag}\\b`)
  return p.focuses
    .filter((f) => re.test(f.scripts.available + f.scripts.bypass + f.scripts.reward))
    .map((f) => f.name || f.id)
}

/** Crea un árbol de focos vacío y lo asigna al país */
export function createTreeForCountry(
  p: Project,
  countryUid: string
): { project: Project; treeId: string } {
  const c = p.countries.find((x) => x.uid === countryUid)!
  let n = p.focusTrees.length + 1
  while (p.focusTrees.some((t) => t.id === `arbol_${n}`)) n++
  const treeId = `arbol_${n}`
  const next: Project = {
    ...p,
    focusTrees: [...p.focusTrees, { id: treeId, name: `Árbol de ${c.names.name || c.tag}` }]
  }
  return { project: assignTree(next, countryUid, treeId), treeId }
}

/** Asigna un árbol a un país (un árbol pertenece a un solo país) */
export function assignTree(p: Project, countryUid: string, treeId: string | null): Project {
  return {
    ...p,
    countries: p.countries.map((c) =>
      c.uid === countryUid
        ? { ...c, focusTreeId: treeId }
        : treeId && c.focusTreeId === treeId
          ? { ...c, focusTreeId: null }
          : c
    )
  }
}

/** País dueño de un árbol */
export function treeCountry(p: Project, treeId: string | null | undefined): Country | undefined {
  return p.countries.find((c) => c.focusTreeId === treeId)
}

/** Popularidades con nombres legibles para mostrar */
export function popularityText(c: Country): string {
  return IDEOLOGIES.map((i) => `${i} ${c.politics.popularities[i]}%`).join(' · ')
}
