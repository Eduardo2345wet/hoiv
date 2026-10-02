// Revisa el proyecto antes de exportar y devuelve avisos en español.
import type { Project } from '../types'
import { generateAllFocusTrees } from '../generator/focusTree'
import { generateIdeas } from '../generator/ideas'
import { isKnownId, projectFlags, type GameCatalog } from '../catalog/catalog'
import { planIconExport } from './gfx'
import { SHINE_TEMPLATE, shineShape } from '../../../shared/shine'
import { validateCountry } from '../countries/validateCountry'
import { modSlug } from '../../../shared/names'
import { plannedPaths } from './exportMod'
import { treeCountry } from '../countries/countryOps'
import { validateMap } from '../map/validateMap'
import type { MapData } from '../../../shared/map/types'

export type Severity = 'error' | 'aviso'
export interface Issue {
  severity: Severity
  message: string
  /** uid del foco afectado (para seleccionarlo al hacer clic) */
  focusUid?: string
  /** "Ir" abre "Ver pendientes" del mapa */
  goPending?: boolean
  /** Estado del mapa afectado (botón "Ir" centra el mapa en él) */
  stateId?: number
  /** País afectado y paso del asistente donde se arregla (botón "Ir") */
  countryUid?: string
  step?: number
  /** Arreglo automático ofrecido por el botón "Renombrar automáticamente" */
  fix?: 'rename-focus' | 'rename-idea'
  ideaUid?: string
  /** Tipo para agrupar en la ventana (Capitales, Focos…) */
  kind?: string
  /** Clave estable para ignorar el aviso (por defecto, su texto) */
  key?: string
  /** Tags de los países del juego que desaparecen (el botón de la tarjeta los usa) */
  vanished?: string[]
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

/** Contexto del mapa para validar los cambios de estados */
export interface MapContext {
  map: MapData | null
  gamePath: string | null
  /** Tags del juego (para comprobar choques del tag de Sin nación) */
  gameTags?: string[]
  /** Errores del parche de archivos de estado (proceso principal) */
  patchErrors?: { file: string; id?: number; message: string }[]
  /** Errores del parche de capitales (history/countries) */
  capitalErrors?: { file: string; message: string }[]
  /** Contenido del juego (capitales originales); validateProject lo completa */
  game?: GameCatalog | null
}

export function validateProject(
  project: Project,
  game: GameCatalog | null = null,
  mapCtx: MapContext | null = null
): Issue[] {
  const issues: Issue[] = []
  // (los tags de los países se validan en countries/validateCountries.ts)
  if (!project.modName.trim())
    issues.push({ severity: 'error', message: 'El mod no tiene nombre.' })
  else if (!modSlug(project.modName))
    issues.push({
      severity: 'error',
      message:
        'El nombre del mod no es válido; cámbialo en Archivo → Propiedades del proyecto (necesita al menos una letra o un número).'
    })
  // Un mod solo de mapa (sin árboles) puede no tener focos; con árboles, cada uno necesita alguno
  if (project.focuses.length === 0 && project.focusTrees.length > 0)
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
  // Sprites _shine de los focos (sin ellos el árbol muestra "?" con laureles)
  const shineNames = new Set(plan.shineSprites.map((x) => x.name))
  for (const name of plan.focusSprites)
    if (!shineNames.has(`${name}_shine`))
      issues.push({
        severity: 'error',
        message: `El sprite de foco "${name}" no tiene su "${name}_shine": en el árbol se vería "?".`
      })
  const shineCount = new Map<string, string[]>()
  for (const sp of plan.shineSprites)
    shineCount.set(sp.name, [...(shineCount.get(sp.name) ?? []), sp.owner])
  for (const [name, owners] of shineCount)
    if (owners.length > 1)
      issues.push({
        severity: 'error',
        message: `El sprite "${name}" se repite (${owners.join(', ')}). Cambia el id de uno de los focos.`
      })
  if (
    plan.shineSprites.length &&
    game?.goalsShineShape &&
    game.goalsShineShape !== shineShape(SHINE_TEMPLATE)
  )
    issues.push({
      severity: 'aviso',
      message:
        'La plantilla de brillo (_shine) de los focos no coincide con interface/goals_shine.gfx de tu versión del juego. Los íconos pueden verse sin brillo o como "?"; avisa para actualizar la plantilla.'
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

  // ---- IDs que ya existen en el juego (carpeta del juego) ----
  if (game?.focusIds?.length) {
    const gameFocus = new Set(game.focusIds)
    for (const f of project.focuses)
      if (gameFocus.has(f.id))
        issues.push({
          severity: 'error',
          message: `El id del foco "${f.id}" ya existe en el juego: tu foco lo sustituiría o chocaría con él.`,
          focusUid: f.uid,
          fix: 'rename-focus'
        })
  }
  if (game?.ideas?.length) {
    const gameIdeas = new Set(game.ideas.map(([id]) => id))
    for (const i of project.ideas)
      if (gameIdeas.has(i.id))
        issues.push({
          severity: 'error',
          message: `El id del espíritu "${i.id}" ya existe en el juego.`,
          ideaUid: i.uid,
          fix: 'rename-idea'
        })
  }

  // ---- Países ----
  // El país técnico "Sin nación" se valida aparte (en el mapa)
  for (const c of project.countries ?? [])
    if (!c.technical && !c.light) issues.push(...validateCountry(c, project, game))
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

  // ---- Mapa ----
  if (mapCtx) {
    issues.push(...validateMap(project, { ...mapCtx, game: mapCtx.game ?? game }))
    // Con el mapa cargado ya sabemos qué países tienen estados: el aviso genérico sobra
    const map = mapCtx.map
    if (map) {
      const owners = new Set(map.states.map((s) => project.stateEdits[s.id]?.owner ?? s.owner))
      return issues.filter(
        (i) =>
          !(
            i.message.includes('no aparece en la partida si no es dueño') &&
            project.countries.some((c) => c.uid === i.countryUid && owners.has(c.tag))
          )
      )
    }
  }

  return issues
}
