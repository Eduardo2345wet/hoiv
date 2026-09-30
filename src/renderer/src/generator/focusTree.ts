// Convierte el proyecto completo en los textos finales del mod:
// el archivo del árbol de focos y el archivo de localización.
import type { Focus, Project } from '../types'
import { planIconExport } from '../export/gfx'

/** Añade un nivel de tabulación a cada línea no vacía */
function indent(code: string, tabs: number): string {
  const pad = '\t'.repeat(tabs)
  return code
    .split('\n')
    .map((l) => (l.trim() ? pad + l : l))
    .join('\n')
}

/** Bloque "clave = { ... }" con contenido ya generado (sin indentar) */
function section(key: string, body: string): string {
  const clean = body.replace(/\s+$/, '')
  if (!clean.trim()) return ''
  return `${key} = {\n${indent(clean.replace(/^\t/gm, ''), 1)}\n}\n`
}

function focusToScript(focus: Focus, byUid: Map<string, Focus>, icon: string): string {
  const lines: string[] = []
  lines.push(`id = ${focus.id}`)
  lines.push(`icon = ${icon}`)
  lines.push(`x = ${focus.x}`)
  lines.push(`y = ${focus.y}`)
  lines.push(`cost = ${focus.cost}`)
  // Cada prerrequisito va en su propio bloque: hay que completarlos TODOS
  for (const uid of focus.prerequisites) {
    const p = byUid.get(uid)
    lines.push(`prerequisite = { focus = ${p ? p.id : 'FOCO_BORRADO'} }`)
  }
  if (focus.mutuallyExclusive.length) {
    const ids = focus.mutuallyExclusive.map(
      (uid) => `focus = ${byUid.get(uid)?.id ?? 'FOCO_BORRADO'}`
    )
    lines.push(`mutually_exclusive = { ${ids.join(' ')} }`)
  }
  let body = lines.join('\n') + '\n'
  body += section('available', focus.scripts.available)
  body += section('bypass', focus.scripts.bypass)
  body += section('completion_reward', focus.scripts.reward) || 'completion_reward = { }\n'
  return `focus = {\n${indent(body.trimEnd(), 1)}\n}`
}

/** Genera el contenido de common/national_focus/TAG_focus.txt */
export function generateFocusTree(project: Project): string {
  const tag = project.tag
  const byUid = new Map(project.focuses.map((f) => [f.uid, f]))
  const header = [
    `id = ${tag}_focus_tree`,
    'country = {',
    '\tfactor = 0',
    '\tmodifier = {',
    '\t\tadd = 10',
    `\t\ttag = ${tag}`,
    '\t}',
    '}',
    'default = no'
  ].join('\n')
  const plan = planIconExport(project)
  const focuses = project.focuses
    .map((f) => focusToScript(f, byUid, plan.focusIcon.get(f.uid) ?? 'GFX_goal_unknown'))
    .join('\n\n')
  return `focus_tree = {\n${indent(header, 1)}\n\n${indent(focuses, 1)}\n}\n`
}

/** Escapa un texto para ponerlo entre comillas en un .yml de Paradox */
function locText(text: string): string {
  return text.replace(/\r?\n/g, '\\n').replace(/"/g, '\\"')
}

/** Genera el contenido del .yml de localización (el BOM se añade al guardar) */
export function generateLocalisation(project: Project): string {
  const lines = ['l_english:']
  for (const f of project.focuses) {
    lines.push(` ${f.id}:0 "${locText(f.name)}"`)
    lines.push(` ${f.id}_desc:0 "${locText(f.description)}"`)
  }
  for (const i of project.ideas) {
    lines.push(` ${i.id}:0 "${locText(i.name)}"`)
    lines.push(` ${i.id}_desc:0 "${locText(i.description)}"`)
  }
  return lines.join('\n') + '\n'
}
