// Genera common/ideas/<mod>_ideas.txt con los espíritus nacionales.
// El bloque country = { } hace que el juego los trate como espíritus nacionales.
import type { Project } from '../types'
import { modifierScriptValue } from '../catalog/modifiers'
import { planIconExport } from '../export/gfx'

export function generateIdeas(project: Project): string {
  const plan = planIconExport(project)
  const blocks = project.ideas.map((i) => {
    const lines: string[] = []
    // Ícono propio → su sprite; si no, el picture de la idea del juego (sin copiar archivos)
    const pic = plan.ideaPicture.get(i.uid) ?? i.picture
    if (pic) lines.push(`\t\t\tpicture = ${pic}`)
    const mods = i.modifiers.filter((m) => m.key && Number.isFinite(m.value))
    const extraMod = (i.extraModifierText ?? '').split('\n').filter((l) => l.trim())
    if (mods.length || extraMod.length) {
      lines.push('\t\t\tmodifier = {')
      for (const m of mods) lines.push(`\t\t\t\t${m.key} = ${modifierScriptValue(m.key, m.value)}`)
      for (const l of extraMod) lines.push(`\t\t\t\t${l.trim()}`)
      lines.push('\t\t\t}')
    }
    // Avanzado (texto): tal cual, sin interpretar
    for (const l of (i.extraText ?? '').split('\n').filter((x) => x.trim()))
      lines.push(`\t\t\t${l.trim()}`)
    return `\t\t${i.id} = {\n${lines.join('\n')}${lines.length ? '\n' : ''}\t\t}`
  })
  return `ideas = {\n\tcountry = {\n${blocks.join('\n\n')}\n\t}\n}\n`
}
