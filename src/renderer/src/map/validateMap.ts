// Validación de los cambios del mapa (estados). Cada problema con estado lleva `stateId`
// para que el botón "Ir" centre el mapa en él.
import type { Issue, MapContext } from '../export/validator'
import type { Project } from '../types'
import { lookup, ownerWithBase } from './mapOps'
import { exportOwner, noNationActive, pendingStates, technicalCountry } from './noNation'
import { validateTag } from '../export/validator'
import { validateStateData } from './validateStateData'
import { lostCapitals, planCapitalMoves } from './capitals'

export function validateMap(project: Project, ctx: MapContext): Issue[] {
  const issues: Issue[] = []
  const { map } = ctx
  const edits = Object.keys(project.stateEdits)

  // ---- ERRORES ----
  // Cambios en el mapa sin carpeta del juego o hechos en el mapa de demostración
  // (el modo Sin nación cambia todos los estados, aunque no haya pintado nada)
  const nnActive = noNationActive(project)
  if ((edits.length || nnActive) && (!map || map.source !== 'real' || !ctx.gamePath))
    issues.push({
      severity: 'error',
      message:
        map?.source === 'demo'
          ? nnActive && !edits.length
            ? 'El modo Sin nación está activo en el MAPA DE DEMOSTRACIÓN: no se puede exportar. Configura la carpeta de HOI4 en Ajustes.'
            : `Hay ${edits.length} estado(s) modificados en el MAPA DE DEMOSTRACIÓN: esos cambios no se pueden exportar. Configura la carpeta de HOI4 en Ajustes y rehaz los cambios en el mapa real (o bórralos con el borrador).`
          : `Hay ${edits.length} estado(s) modificados pero no hay carpeta del juego configurada: sin los archivos originales no se pueden exportar. Configúrala en Ajustes.`
    })

  // Parche imposible de aplicar con seguridad (el archivo NO se exporta)
  for (const e of ctx.patchErrors ?? [])
    issues.push({
      severity: 'error',
      message: `No se puede exportar history/states/${e.file}: ${e.message}`,
      stateId: e.id
    })

  // Base de un mod: necesita la carpeta del juego y el mod tiene que estar activo antes
  const ms = project.mapSettings
  if (ms?.base === 'mod' && ms.mod) {
    issues.push({
      severity: 'aviso',
      message: `La base del mapa es el mod "${ms.mod.name}": tu mod necesitará ese mod activado y cargado antes (se agrega a dependencies).`
    })
    if (!ctx.gamePath)
      issues.push({
        severity: 'error',
        message: 'La base del mapa es un mod, pero no hay carpeta del juego configurada.'
      })
  }

  if (!map) return issues
  const byId = lookup(map)

  // Estados pintados que no existen en la base actual
  const missing = edits.filter((id) => !byId.has(Number(id)))
  if (missing.length)
    issues.push({
      severity: 'aviso',
      message: `La base actual no tiene ${missing.length} estado(s) que pintaste (${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}): esos cambios no se exportarán.`
    })

  // Estado modificado que queda sin dueño
  for (const id of edits) {
    const s = byId.get(Number(id))
    if (s && !ownerWithBase(s, project))
      issues.push({
        severity: 'error',
        message: `El estado ${s.name} (#${s.id}) quedó sin dueño. Píntalo con el pincel.`,
        stateId: s.id
      })
  }

  const reported = new Set<string>()
  // Capital de un país del mod en un estado que no es suyo (solo si la capital la ponemos nosotros)
  for (const c of project.countries) {
    if (!c.capital || c.technical) continue
    const s = byId.get(c.capital)
    if (!s) continue
    const owner = exportOwner(s, project)
    const ours = c.mode === 'nuevo' || c.existing.historyEdited
    if (owner !== c.tag && ours)
      issues.push({
        severity: 'error',
        message: `La capital de ${c.names.name || c.tag} (${s.name}) es de ${owner || 'nadie'}, no suya. Píntala para ${c.tag} o elige otra capital (herramienta Capital, C).`,
        stateId: s.id
      })
    else if (owner !== c.tag) {
      // ---- AVISO: a un país del juego le quité el estado de su capital ----
      reported.add(c.tag)
      issues.push({
        severity: 'aviso',
        message: `A ${c.names.name || c.tag} le quitaste el estado de su capital (${s.name}). El juego le buscará otra capital al empezar.`,
        stateId: s.id
      })
    }
    // Capital sin victory points
    if (!s.victoryPoints.length)
      issues.push({
        severity: 'aviso',
        message: `La capital de ${c.names.name || c.tag} (${s.name}) no tiene victory points.`,
        stateId: s.id
      })
  }

  // Capital de un país DEL JUEGO cuyo estado ahora es de otro país: el juego mostraría
  // "Attempting to set capital state #N for X, they dont own it!"
  const lost = lostCapitals(project, map, ctx.game ?? null).filter((l) => !reported.has(l.tag))
  const moves = new Map(planCapitalMoves(project, map, ctx.game ?? null).map((m) => [m.tag, m]))
  const noNationOn = noNationActive(project)
  // Los que conservan estados: aviso por país y su capital se mueve al exportar. Los que se
  // quedan sin estados van en un solo aviso agrupado (más abajo). En Sin nación, una sola línea.
  if (!noNationOn)
    for (const l of lost.filter((x) => x.remaining > 0)) {
      const m = moves.get(l.tag)
      const where = `${byId.get(l.capital)?.name ?? 'Estado ' + l.capital} (#${l.capital})`
      const owner = l.newOwner || 'nadie'
      const how = m?.to
        ? `Se moverá a ${byId.get(m.to)?.name ?? 'Estado ' + m.to} (#${m.to}) al exportar${m.manual ? ' (elegida por ti)' : ''}.`
        : 'Con "Mover automáticamente las capitales perdidas" apagado, el juego avisará "Attempting to set capital state". Elige otra capital o activa el ajuste.'
      issues.push({
        severity: 'aviso',
        kind: 'Capitales',
        message: `La capital de ${l.name} (${l.tag}), ${where}, ahora es de ${owner}. ${how}`,
        stateId: l.capital
      })
    }
  // Capitales que no se pueden parchar con seguridad: ese archivo no se exporta
  for (const e of ctx.capitalErrors ?? [])
    issues.push({
      severity: 'error',
      message: `No se puede exportar history/countries/${e.file}: ${e.message}`
    })

  // ---- AVISOS ----
  // Países que se quedan sin estados (del mod o del juego afectados por mis cambios)
  const noNation = noNationActive(project)
  const now = new Map<string, number>()
  const before = new Map<string, number>()
  for (const s of map.states) {
    before.set(s.owner, (before.get(s.owner) ?? 0) + 1)
    const o = exportOwner(s, project)
    now.set(o, (now.get(o) ?? 0) + 1)
  }
  for (const c of project.countries)
    if (!c.technical && !now.get(c.tag) && (c.mode === 'nuevo' || noNation))
      issues.push({
        severity: 'aviso',
        message:
          c.mode === 'nuevo'
            ? `${c.names.name || c.tag} no tiene estados: un país nuevo sin estados no aparecerá en la partida. Píntale estados en el mapa.`
            : `${c.names.name || c.tag} no tiene estados: desaparecerá al inicio de la partida.`
      })
  const gone = [...before.entries()]
    .filter(
      ([tag, n]) => n && tag && !now.get(tag) && !project.countries.some((c) => c.tag === tag)
    )
    .map(([tag]) => tag)
  // Países del juego que existían al inicio y por MIS cambios se quedan sin estados (los liberables
  // que ya empiezan sin estados no entran aquí: `before` solo cuenta lo que tenían en la base)
  const vanished = [
    ...new Set([...gone, ...lost.filter((l) => l.remaining === 0).map((l) => l.tag)])
  ].sort()
  const nameOf = (tag: string): string => ctx.game?.countries.find(([t]) => t === tag)?.[1] ?? tag
  const moved = [...moves.values()].filter((m) => m.to !== null && !reported.has(m.tag)).length
  if (noNation && (vanished.length || moved))
    issues.push({
      severity: 'aviso',
      kind: 'Capitales',
      message: `Sin nación: ${vanished.length} países del juego no existirán al inicio y ${moved} cambiarán de capital por tus cambios. Es normal.`
    })
  else if (vanished.length)
    issues.push({
      severity: 'aviso',
      kind: 'Capitales',
      message: `${vanished.length} países del juego no existirán al inicio por tus cambios (${vanished
        .slice(0, 12)
        .map(nameOf)
        .join(
          ', '
        )}${vanished.length > 12 ? '…' : ''}). Para ellos, el error.log mostrará 'Attempting to set capital state… they dont own it!'. Es normal y no tumba el juego.`,
      vanished
    })

  // Mis focos mencionan países que no existirán al inicio
  const exists = (tag: string): boolean => !!now.get(tag)
  const mentioned = new Set<string>()
  for (const f of project.focuses)
    for (const m of (f.scripts.available + f.scripts.bypass + f.scripts.reward).matchAll(
      /\b(?:tag|target|add_to_faction|puppet|declare_war_on|exists|country_exists) = ([A-Z][A-Z0-9]{2})\b/g
    ))
      if (!exists(m[1]) && (before.has(m[1]) || project.countries.some((c) => c.tag === m[1])))
        mentioned.add(m[1])
  if (mentioned.size)
    issues.push({
      severity: 'aviso',
      message: `Tus focos mencionan países que no existirán al inicio (sin estados): ${[...mentioned].join(', ')}.`
    })

  // ---- Modo Sin nación ----
  if (noNation) {
    const tech = technicalCountry(project)
    const tag = tech?.tag ?? project.mapSettings.noNation.tag
    const tagErr = validateTag(tag)
    const clash =
      before.has(tag) ||
      project.countries.some((c) => !c.technical && c.tag === tag) ||
      (ctx.gameTags ?? []).includes(tag)
    if (tagErr || clash)
      issues.push({
        severity: 'error',
        message: `El tag de "${tech?.names.name ?? 'Sin nación'}" (${tag || 'vacío'}) ${tagErr ? 'no es válido' : 'choca con otro país'}. Cámbialo en Ajustes del mapa.`
      })
    const pending = pendingStates(project, map)
    if (pending.length)
      issues.push({
        severity: 'aviso',
        message: `Quedan ${pending.length} estado(s) Sin nación (pendientes de pintar). Es una lista de tareas, no un error.`,
        goPending: true
      })
    issues.push({
      severity: 'aviso',
      message:
        'El modo Sin nación está pensado para el inicio de 1936: en los estados pendientes se quitan los cambios con fecha (owner, controller, add_core_of, transfer_state).'
    })
  }

  // Estados modificados con cambios con fecha que pueden pisar mi cambio
  for (const id of edits) {
    const s = byId.get(Number(id))
    if (s?.hasDatedChanges)
      issues.push({
        severity: 'aviso',
        message: `El estado ${s.name} (#${s.id}) tiene cambios con fecha (1939.1.1 = { … } u otros) que pueden pisar tu cambio cuando llegue esa fecha.`,
        stateId: s.id
      })
  }

  // Datos de estado (población, edificios, recursos, puntos de victoria)
  issues.push(...validateStateData(project, map, ctx.game))

  if (map.unknownColorPixels > 0)
    issues.push({
      severity: 'aviso',
      message: `provinces.bmp tiene ${map.unknownColorPixels} píxel(es) con colores que no están en definition.csv (se tratan como "sin provincia").`
    })
  return issues
}
