// Validación de los cambios del mapa (estados). Cada problema con estado lleva `stateId`
// para que el botón "Ir" centre el mapa en él.
import type { Issue, MapContext } from '../export/validator'
import type { Project } from '../types'
import { effectiveOwner, lookup } from './mapOps'

export function validateMap(project: Project, ctx: MapContext): Issue[] {
  const issues: Issue[] = []
  const { map } = ctx
  const edits = Object.keys(project.stateEdits)

  // ---- ERRORES ----
  // Cambios en el mapa sin carpeta del juego o hechos en el mapa de demostración
  if (edits.length && (!map || map.source !== 'real' || !ctx.gamePath))
    issues.push({
      severity: 'error',
      message:
        map?.source === 'demo'
          ? `Hay ${edits.length} estado(s) modificados en el MAPA DE DEMOSTRACIÓN: esos cambios no se pueden exportar. Configura la carpeta de HOI4 en Ajustes y rehaz los cambios en el mapa real (o bórralos con el borrador).`
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
    if (s && !effectiveOwner(s, project))
      issues.push({
        severity: 'error',
        message: `El estado ${s.name} (#${s.id}) quedó sin dueño. Píntalo con el pincel.`,
        stateId: s.id
      })
  }

  // Capital de un país del mod en un estado que no es suyo (solo si la capital la ponemos nosotros)
  for (const c of project.countries) {
    if (!c.capital) continue
    const s = byId.get(c.capital)
    if (!s) continue
    const owner = effectiveOwner(s, project)
    const ours = c.mode === 'nuevo' || c.existing.historyEdited
    if (owner !== c.tag && ours)
      issues.push({
        severity: 'error',
        message: `La capital de ${c.names.name || c.tag} (${s.name}) es de ${owner || 'nadie'}, no suya. Píntala para ${c.tag} o elige otra capital (herramienta Capital, C).`,
        stateId: s.id
      })
    else if (owner !== c.tag)
      // ---- AVISO: a un país del juego le quité el estado de su capital ----
      issues.push({
        severity: 'aviso',
        message: `A ${c.names.name || c.tag} le quitaste el estado de su capital (${s.name}). El juego le buscará otra capital al empezar.`,
        stateId: s.id
      })
    // Capital sin victory points
    if (!s.victoryPoints.length)
      issues.push({
        severity: 'aviso',
        message: `La capital de ${c.names.name || c.tag} (${s.name}) no tiene victory points.`,
        stateId: s.id
      })
  }

  // ---- AVISOS ----
  // Países que se quedan sin estados (del mod o del juego afectados por mis cambios)
  const now = new Map<string, number>()
  const before = new Map<string, number>()
  for (const s of map.states) {
    before.set(s.owner, (before.get(s.owner) ?? 0) + 1)
    const o = effectiveOwner(s, project)
    now.set(o, (now.get(o) ?? 0) + 1)
  }
  for (const c of project.countries)
    if (!now.get(c.tag) && c.mode === 'nuevo')
      issues.push({
        severity: 'aviso',
        message: `${c.names.name || c.tag} no tiene estados: un país nuevo sin estados no aparecerá en la partida. Píntale estados en el mapa.`
      })
  for (const [tag, n] of before)
    if (n && tag && !now.get(tag))
      issues.push({
        severity: 'aviso',
        message: `${tag} se queda sin estados: desaparecerá al inicio de la partida.`
      })

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

  if (map.unknownColorPixels > 0)
    issues.push({
      severity: 'aviso',
      message: `provinces.bmp tiene ${map.unknownColorPixels} píxel(es) con colores que no están en definition.csv (se tratan como "sin provincia").`
    })
  return issues
}
