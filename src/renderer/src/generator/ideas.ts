// Genera common/ideas/<mod>_ideas.txt con los espíritus nacionales.
// El bloque country = { } hace que el juego los trate como espíritus nacionales.
import type { Project } from '../types'
import { modifierScriptValue } from '../catalog/modifiers'
import { planIconExport } from '../export/gfx'

export function generateIdeas(project: Project): string {
  const plan = planIconExport(project)
  const blocks = project.ideas.map((i) => {
    const lines: string[] = []
    const pic = plan.ideaPicture.get(i.uid)
    if (pic) lines.push(`\t\t\tpicture = ${pic}`)
    const mods = i.modifiers.filter((m) => m.key && Number.isFinite(m.value))
    if (mods.length) {
      lines.push('\t\t\tmodifier = {')
      for (const m of mods) lines.push(`\t\t\t\t${m.key} = ${modifierScriptValue(m.key, m.value)}`)
      lines.push('\t\t\t}')
    }
    return `\t\t${i.id} = {\n${lines.join('\n')}${lines.length ? '\n' : ''}\t\t}`
  })
  return `ideas = {\n\tcountry = {\n${blocks.join('\n\n')}\n\t}\n}\n`
}
