// Migración automática de proyecto.json: los proyectos viejos se abren sin error.
import { PROJECT_VERSION, type Project } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
export function migrateProject(raw: any): Project {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.focuses) || !raw.tag)
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

  p.focuses = p.focuses.map((f: any) => ({
    prerequisites: [],
    mutuallyExclusive: [],
    blocks: null,
    scripts: { available: '', bypass: '', reward: '' },
    description: '',
    iconAuto: false,
    ...f,
    icon: f.icon ?? { kind: 'game', gfx: 'GFX_goal_unknown' }
  }))
  p.ideas = Array.isArray(p.ideas) ? p.ideas : []
  p.icons = Array.isArray(p.icons) ? p.icons : []
  p.countryFlags = Array.isArray(p.countryFlags) ? p.countryFlags : []
  p.modName = p.modName ?? 'mod'
  p.version = PROJECT_VERSION
  return p as Project
}
