// Migración automática de proyecto.json: los proyectos viejos se abren sin error.
import { DEFAULT_MAP_SETTINGS, PROJECT_VERSION, type Project } from './types'
import { templateOf } from './templates'
import { newCountry } from './countries/countryOps'
import { BUILTIN_COUNTRIES } from './catalog/builtin'
import { migrateFocusBlocks } from './blocks/slots'

/* eslint-disable @typescript-eslint/no-explicit-any */
export function migrateProject(raw: any): Project {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.focuses) || typeof raw.tag !== 'string')
    throw new Error('No es un proyecto válido de HOI4 Mod Studio')
  const p = { ...raw }
  const version = typeof p.version === 'number' ? p.version : 1

  // v1 → v2: el ícono pasa de texto (GFX_...) a referencia; nuevos: ideas, icons, countryFlags
  if (version < 2) {
    p.focuses = p.focuses.map((f: any) => ({
      ...f,
      icon: typeof f.icon === 'string' ? { kind: 'game', gfx: f.icon } : f.icon,
      iconAuto: false
    }))
  }

  // v2 → v3: países y árboles. Se crea un país con el tag del mod y se le asigna el árbol existente.
  if (version < 3 || !Array.isArray(p.focusTrees)) {
    const treeId = 'arbol_1'
    p.focusTrees = [{ id: treeId, name: `Árbol de ${p.tag}` }]
    p.focuses = p.focuses.map((f: any) => ({ ...f, treeId: f.treeId ?? treeId }))
    if (!Array.isArray(p.countries) || !p.countries.length) {
      const known = BUILTIN_COUNTRIES.find(([t]) => t === p.tag)
      const c = newCountry({
        mode: known ? 'existente' : 'nuevo',
        tag: p.tag,
        name: known ? known[1] : (p.modName ?? p.tag)
      })
      p.countries = [{ ...c, focusTreeId: treeId }]
    }
  }

  const firstTree = p.focusTrees[0]?.id ?? 'arbol_1'
  p.focuses = p.focuses.map((f: any) => ({
    prerequisites: [],
    mutuallyExclusive: [],
    blocks: null,
    scripts: { available: '', bypass: '', reward: '' },
    description: '',
    iconAuto: false,
    treeId: firstTree,
    ...f,
    icon: f.icon ?? { kind: 'game', gfx: 'GFX_goal_unknown' }
  }))
  p.ideas = Array.isArray(p.ideas) ? p.ideas : []
  p.icons = Array.isArray(p.icons) ? p.icons : []
  p.countryFlags = Array.isArray(p.countryFlags) ? p.countryFlags : []
  p.countries = Array.isArray(p.countries) ? p.countries : []
  // v3 → v4: cambios del mapa (vacío al principio)
  p.stateEdits = p.stateEdits && typeof p.stateEdits === 'object' ? p.stateEdits : {}
  // v4 → v5: base del mapa. Si ya había pintado, lo hizo sobre el mapa del juego.
  if (!p.mapSettings || typeof p.mapSettings !== 'object') {
    p.mapSettings = {
      ...DEFAULT_MAP_SETTINGS,
      base: Object.keys(p.stateEdits).length ? 'game' : null
    }
  } else
    p.mapSettings = {
      ...DEFAULT_MAP_SETTINGS,
      ...p.mapSettings,
      noNation: { ...DEFAULT_MAP_SETTINGS.noNation, ...p.mapSettings.noNation }
    }
  p.modName = p.modName ?? 'mod'
  // v5 → v6: la plantilla es parte del proyecto. Un proyecto viejo toma la de su base guardada
  // y NO se borra nada (los estados ya pintados se conservan tal cual).
  p.template = p.template ?? templateOf(p)
  // v6 → v7: los tres bloques sueltos (requisitos, saltar si, recompensa) pasan a UN bloque
  // "Foco" con tres secciones, sin perder su contenido. Y se quita la sincronización con el juego.
  // v7 → v8: el bloque raíz se redibuja (título arriba y boca debajo); mismas entradas, no se pierde nada
  if (version < 8) {
    p.focuses = p.focuses.map((f: any) =>
      f.blocks ? { ...f, blocks: migrateFocusBlocks(f.blocks) } : f
    )
  }
  delete p.modSync
  p.ignoredIssues = Array.isArray(p.ignoredIssues) ? p.ignoredIssues : []
  p.version = PROJECT_VERSION
  return p as Project
}
