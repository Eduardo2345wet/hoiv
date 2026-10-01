// Revisa el proyecto antes de exportar y devuelve avisos en español.
import type { Project } from '../types'
import { generateAllFocusTrees } from '../generator/focusTree'
import { generateIdeas } from '../generator/ideas'
import { isKnownId, projectFlags, type GameCatalog } from '../catalog/catalog'
import { planIconExport } from './gfx'
import { validateCountry } from '../countries/validateCountry'
import { plannedPaths } from './exportMod'
import { treeCountry } from '../countries/countryOps'

export type Severity = 'error' | 'aviso'
export interface Issue {
  severity: Severity
  message: string
  /** uid del foco afectado (para seleccionarlo al hacer clic) */
  focusUid?: string
  /** País afectado y paso del asistente donde se arregla (botón "Ir") */
  countryUid?: string
  step?: number
  /** ID de estado del mapa (para ir y centrar el mapa) */
  stateId?: number
}

export const TAG_REGEX = /^[A-Z][A-Z0-9]{2}$/
export const FORBIDDEN_TAGS = ['NOT', 'AND', 'TAG', 'OOB', 'LOG', 'NUM', 'RED']
export const ID_REGEX = /^[A-Za-z0-9_]+$/

/** Devuelve un mensaje de error si el tag no es válido, o null si está bien */
export function validateTag(tag: string): string | null {
  if (!TAG_REGEX.test(tag))
    return 'El tag debe tener 3 caracteres: una letra mayúscula seguida de 2 letras mayúsculas o números (ej. GER, MX1).'
  if (FORBIDDEN_TAGS.includes(tag))
    return `"${tag}" es una palabra reservada del juego, elige otro tag.`
  return null
}

/** Cuenta llaves { } ignorando las que estén dentro de comillas */
export function checkBraces(text: string): string | null {
  let depth = 0
  let inQuotes = false
  let line = 1
  for (const ch of text) {
    if (ch === '\n') line++
    if (ch === '"') inQuotes = !inQuotes
    if (inQuotes) continue
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth < 0) return `Hay una llave "}" de más cerca de la línea ${line}.`
    }
  }
  if (depth > 0) return `Faltan ${depth} llave(s) "}" por cerrar.`
  return null
}

export function validateProject(
  project: Project,
  game: GameCatalog | null = null,
  mapData: import('../map/types').MapData | null = null
): Issue[] {
  const issues: Issue[] = []
  // (los tags de los países se validan en countries/validateCountries.ts)
  if (!project.modName.trim())
    issues.push({ severity: 'error', message: 'El mod no tiene nombre.' })
  if (project.focuses.length === 0)
    issues.push({
      severity: 'error',
      message: 'El árbol no tiene ningún foco.'
    })

  const uids = new Set(project.focuses.map((f) => f.uid))
  const ids = new Set(project.focuses.map((f) => f.id))
  const seen = new Map<string, number>()
  const positions = new Map<string, string>()

  for (const f of project.focuses) {
    const label = f.name.trim() || f.id || '(sin id)'
    seen.set(f.id, (seen.get(f.id) ?? 0) + 1)

    if (!f.id.trim())
      issues.push({
        severity: 'error',
        message: 'Hay un foco sin id.',
        focusUid: f.uid
      })
    else if (!ID_REGEX.test(f.id))
      issues.push({
        severity: 'error',
        message: `El id "${f.id}" solo puede tener letras sin tildes, números y guion bajo (_).`,
        focusUid: f.uid
      })
    if (!f.name.trim())
      issues.push({
        severity: 'error',
        message: `El foco "${f.id}" no tiene nombre.`,
        focusUid: f.uid
      })
    if (!(f.cost > 0))
      issues.push({
        severity: 'error',
        message: `El foco "${label}" debe costar al menos 1 semana.`,
        focusUid: f.uid
      })

    for (const p of f.prerequisites)
      if (!uids.has(p))
        issues.push({
          severity: 'error',
          message: `El foco "${label}" tiene un prerrequisito que apunta a un foco borrado.`,
          focusUid: f.uid
        })
    for (const m of f.mutuallyExclusive)
      if (!uids.has(m))
        issues.push({
          severity: 'error',
          message: `El foco "${label}" es excluyente con un foco borrado.`,
          focusUid: f.uid
        })

    // Referencias a cosas que no existen (siempre AVISO, nunca error)
    const script = f.scripts.available + f.scripts.bypass + f.scripts.reward
    for (const m of script.matchAll(/has_completed_focus = (\S+)/g))
      if (!ids.has(m[1]))
        issues.push({
          severity: 'aviso',
          message: `El foco "${label}" usa "completó el foco ${m[1]}", pero ese foco ya no existe.`,
          focusUid: f.uid
        })
    for (const m of script.matchAll(/\b(?:has_idea|add_ideas|remove_ideas) = (\S+)/g))
      if (!isKnownId('idea', m[1], project, game))
        issues.push({
          severity: 'aviso',
          message: `El foco "${label}" usa el espíritu "${m[1]}", que no está ni en el mod ni en el juego.`,
          focusUid: f.uid
        })
    for (const m of script.matchAll(/\b(?:tag|target|add_to_faction|puppet) = ([A-Za-z0-9]+)\s/g))
      if (!isKnownId('country', m[1], project, game))
        issues.push({
          severity: 'aviso',
          message: `El foco "${label}" usa el país "${m[1]}", que no está en la lista (¿es de otro mod?).`,
          focusUid: f.uid
        })
    for (const m of script.matchAll(/has_country_flag = (\S+)/g))
      if (!projectFlags(project).includes(m[1]))
        issues.push({
          severity: 'aviso',
          message: `El foco "${label}" comprueba la marca "${m[1]}", pero nada la pone (set_country_flag).`,
          focusUid: f.uid
        })
    if (/= *(\n|$)/.test(script))
      issues.push({
        severity: 'error',
        message: `El foco "${label}" tiene un bloque con un campo sin elegir.`,
        focusUid: f.uid
      })

    // Íconos
    if (
      f.icon.kind === 'asset' &&
      !project.icons.some((a) => a.id === (f.icon as { assetId: string }).assetId)
    )
      issues.push({
        severity: 'aviso',
        message: `El foco "${label}" no tiene ícono.`,
        focusUid: f.uid
      })

    const pos = `${f.treeId},${f.x},${f.y}`
    if (positions.has(pos))
      issues.push({
        severity: 'aviso',
        message: `Los focos "${positions.get(pos)}" y "${label}" están en la misma casilla.`,
        focusUid: f.uid
      })
    else positions.set(pos, label)

    if (!f.scripts.reward.trim())
      issues.push({
        severity: 'aviso',
        message: `El foco "${label}" no tiene recompensa.`,
        focusUid: f.uid
      })
  }

  // ---- Espíritus nacionales ----
  for (const i of project.ideas) {
    const label = i.name.trim() || i.id
    seen.set(i.id, (seen.get(i.id) ?? 0) + 1)
    if (!ID_REGEX.test(i.id))
      issues.push({
        severity: 'error',
        message: `El id de espíritu "${i.id}" no es válido (letras sin tildes, números y _).`
      })
    if (!i.name.trim())
      issues.push({
        severity: 'error',
        message: `El espíritu "${i.id}" no tiene nombre.`
      })
    if (
      !i.icon ||
      (i.icon.kind === 'asset' &&
        !project.icons.some((a) => a.id === (i.icon as { assetId: string }).assetId))
    )
      issues.push({
        severity: 'aviso',
        message: `El espíritu "${label}" no tiene ícono.`
      })
  }

  // ---- Íconos ----
  const plan = planIconExport(project)
  const spriteCount = new Map<string, string[]>()
  for (const sp of plan.sprites)
    spriteCount.set(sp.name, [...(spriteCount.get(sp.name) ?? []), sp.owner])
  for (const [name, owners] of spriteCount)
    if (owners.length > 1)
      issues.push({
        severity: 'error',
        message: `El nombre de sprite "${name}" se repite (${owners.join(', ')}). Cambia uno de los ids.`
      })
  for (const d of plan.dds) {
    const a = project.icons.find((x) => x.id === d.assetId)
    if (a?.small)
      issues.push({
        severity: 'aviso',
        message: `El ícono "${a.name}" es más chico que el tamaño final: se verá borroso.`
      })
  }

  for (const [id, count] of seen)
    if (count > 1 && id)
      issues.push({
        severity: 'error',
        message: `El id "${id}" está repetido ${count} veces.`
      })

  for (const t of generateAllFocusTrees(project)) {
    const braces = checkBraces(t.text)
    if (braces)
      issues.push({
        severity: 'error',
        message: `Llaves desbalanceadas en el árbol de ${t.tag}: ${braces}`
      })
  }
  const ideaBraces = project.ideas.length ? checkBraces(generateIdeas(project)) : null
  if (ideaBraces)
    issues.push({
      severity: 'error',
      message: `Llaves desbalanceadas en las ideas: ${ideaBraces}`
    })

  // ---- Países ----
  for (const c of project.countries ?? []) issues.push(...validateCountry(c, project, game))
  for (const t of project.focusTrees ?? [])
    if (!treeCountry(project, t.id) && project.focuses.some((f) => f.treeId === t.id))
      issues.push({
        severity: 'aviso',
        message: `El árbol "${t.name}" no pertenece a ningún país: se exportará con el tag ${project.tag}. Asígnalo a un país en la pestaña Países.`
      })

  // ---- Archivos con el mismo nombre (Windows no distingue mayúsculas) ----
  const seenPaths = new Map<string, string>()
  for (const path of plannedPaths(project, game)) {
    const key = path.toLowerCase()
    if (seenPaths.has(key))
      issues.push({
        severity: 'error',
        message: `Dos archivos del mod tendrían el mismo nombre: ${path}. Cambia el tag o el nombre de uno de los elementos.`
      })
    else seenPaths.set(key, path)
  }

  // ---- Validación del Mapa ----
  const edits = project.stateEdits || {}
  const editedStateIds = Object.keys(edits).map(Number)

  if (editedStateIds.length > 0) {
    if (!mapData || mapData.isDemoMap) {
      issues.push({
        severity: 'error',
        message: 'Hay cambios en el mapa sin carpeta del juego configurada (o hechos en el mapa de demostración).'
      })
    }
  }

  if (mapData) {
    if (mapData.missingColorCount && mapData.missingColorCount > 0) {
      issues.push({
        severity: 'aviso',
        message: `Hay ${mapData.missingColorCount} colores en provinces.bmp que no están en definition.csv.`
      })
    }

    // Calcular pertenencia actual de estados por tag
    const countryStateCounts: Record<string, number> = {}
    const getOwner = (s: import('../map/types').State): string => {
      const edit = edits[s.id]
      if (edit && edit.owner !== undefined) return edit.owner
      return s.originalOwner
    }

    Object.values(mapData.states).forEach((s) => {
      const owner = getOwner(s)
      if (owner) {
        countryStateCounts[owner] = (countryStateCounts[owner] || 0) + 1
      }

      // Validar si un estado modificado queda sin owner
      if (edits[s.id] && !owner) {
        issues.push({
          severity: 'error',
          message: `El estado "${s.name}" (#${s.id}) no tiene dueño asignado.`,
          stateId: s.id
        })
      }

      // Validar avisos de cambios con fecha en estados modificados
      if (edits[s.id] && s.hasDateChanges) {
        issues.push({
          severity: 'aviso',
          message: `El estado "${s.name}" (#${s.id}) tiene cambios con fecha (1939.1.1...) que pueden sobreescribir tus cambios en 1939.`,
          stateId: s.id
        })
      }

      // Aviso si se quitó la capital de un país del juego
      if (s.originalOwner && owner !== s.originalOwner) {
        const gameCountry = project.countries.find((c) => c.tag === s.originalOwner)
        if (gameCountry && gameCountry.capital === s.id) {
          issues.push({
            severity: 'aviso',
            message: `Le quité el estado de su capital ("${s.name}" #${s.id}) al país del juego ${s.originalOwner}.`,
            stateId: s.id,
            countryUid: gameCountry.uid
          })
        }
      }
    })

    // Validar capitales
    for (const c of project.countries) {
      if (c.capital) {
        const capState = mapData.states[c.capital]
        if (capState) {
          const capOwner = getOwner(capState)
          if (capOwner !== c.tag) {
            issues.push({
              severity: 'error',
              message: `La capital de ${c.names.name} (${c.tag}) está en el estado "${capState.name}" (#${c.capital}), que no le pertenece.`,
              stateId: c.capital,
              countryUid: c.uid
            })
          }
          if (capState.victoryPoints.length === 0) {
            issues.push({
              severity: 'aviso',
              message: `La capital de ${c.names.name} (#${c.capital}) no tiene puntos de victoria.`,
              stateId: c.capital
            })
          }
        }
      }

      // Avisos de países sin estados
      const count = countryStateCounts[c.tag] || 0
      if (count === 0) {
        issues.push({
          severity: 'aviso',
          message:
            c.mode === 'nuevo'
              ? `El país nuevo "${c.names.name}" (${c.tag}) no tiene estados y no aparecerá en la partida.`
              : `El país "${c.tag}" se ha quedado sin estados y desaparecerá al inicio.`,
          countryUid: c.uid
        })
      }
    }
  }

  return issues
}
