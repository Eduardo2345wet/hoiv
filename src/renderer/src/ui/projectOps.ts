// Operaciones puras sobre el proyecto (crear, mover, conectar, borrar focos).
// Siempre devuelven un proyecto NUEVO (React necesita objetos nuevos para redibujar).
import { EMPTY_SCRIPTS, newUid, type Focus, type Project } from '../types'

export function createFocus(tag: string, existing: Focus[], x: number, y: number): Focus {
  let n = existing.length + 1
  while (existing.some((f) => f.id === `${tag}_foco_${n}`)) n++
  return {
    uid: newUid(),
    id: `${tag}_foco_${n}`,
    name: `Foco ${n}`,
    description: '',
    cost: 10,
    icon: 'GFX_goal_generic_production',
    x,
    y,
    prerequisites: [],
    mutuallyExclusive: [],
    blocks: null,
    scripts: { ...EMPTY_SCRIPTS }
  }
}

export function updateFocus(p: Project, uid: string, patch: Partial<Focus>): Project {
  return { ...p, focuses: p.focuses.map((f) => (f.uid === uid ? { ...f, ...patch } : f)) }
}

/** Borra un foco y limpia las líneas que apuntaban a él */
export function deleteFocus(p: Project, uid: string): Project {
  return {
    ...p,
    focuses: p.focuses
      .filter((f) => f.uid !== uid)
      .map((f) => ({
        ...f,
        prerequisites: f.prerequisites.filter((u) => u !== uid),
        mutuallyExclusive: f.mutuallyExclusive.filter((u) => u !== uid)
      }))
  }
}

/** Añade o quita el prerrequisito "parent → child" */
export function togglePrerequisite(p: Project, parent: string, child: string): Project {
  if (parent === child) return p
  return {
    ...p,
    focuses: p.focuses.map((f) => {
      if (f.uid !== child) return f
      const has = f.prerequisites.includes(parent)
      return {
        ...f,
        prerequisites: has ? f.prerequisites.filter((u) => u !== parent) : [...f.prerequisites, parent]
      }
    })
  }
}

/** Añade o quita la exclusión mutua entre a y b (se guarda en los dos) */
export function toggleExclusive(p: Project, a: string, b: string): Project {
  if (a === b) return p
  const target = p.focuses.find((f) => f.uid === a)
  const has = !!target?.mutuallyExclusive.includes(b)
  return {
    ...p,
    focuses: p.focuses.map((f) => {
      const other = f.uid === a ? b : f.uid === b ? a : null
      if (!other) return f
      const list = f.mutuallyExclusive.filter((u) => u !== other)
      return { ...f, mutuallyExclusive: has ? list : [...list, other] }
    })
  }
}
