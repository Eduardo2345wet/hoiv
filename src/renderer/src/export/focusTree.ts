// Construye el archivo common/national_focus/TAG_focus.txt a partir del proyecto.

import { generateFocusScripts, type FocusScripts } from '../generator/focusScripts'
import type { BlocklyState, Focus, Project } from '../model/project'

type ScriptsFn = (state: BlocklyState | null) => FocusScripts

/** Indenta cada línea no vacía con N tabuladores. */
export function indent(text: string, level: number): string {
  const tabs = '\t'.repeat(level)
  return text
    .split('\n')
    .map((l) => (l.length ? tabs + l : l))
    .join('\n')
}

/** Bloque "nombre = { ... }" con el contenido indentado a 1 nivel. Vacío si no hay contenido. */
function section(name: string, body: string, keepEmpty = false): string {
  if (!body.trim() && !keepEmpty) return ''
  if (!body.trim()) return `${name} = {\n}\n`
  return `${name} = {\n${indent(body, 1)}}\n`
}

/** Script de un foco (sin la indentación del focus_tree). */
export function buildFocusBlock(
  focus: Focus,
  byUid: Map<string, Focus>,
  getScripts: ScriptsFn = generateFocusScripts
): string {
  const scripts = getScripts(focus.blocks)
  const ids = (uids: string[]): string[] =>
    uids.map((u) => byUid.get(u)?.id).filter((id): id is string => !!id)

  let body = ''
  body += `id = ${focus.id}\n`
  body += `icon = ${focus.icon}\n`
  body += `x = ${focus.x}\n`
  body += `y = ${focus.y}\n`
  body += `cost = ${focus.cost}\n`

  const prereqs = ids(focus.prerequisites)
  if (prereqs.length) {
    if (focus.prerequisiteMode === 'any') {
      // Un solo bloque con varios focos = basta con completar uno.
      body += `prerequisite = { ${prereqs.map((id) => `focus = ${id}`).join(' ')} }\n`
    } else {
      // Un bloque por foco = hay que completarlos todos.
      for (const id of prereqs) body += `prerequisite = { focus = ${id} }\n`
    }
  }

  const exclusive = ids(focus.mutuallyExclusive)
  if (exclusive.length) {
    body += `mutually_exclusive = { ${exclusive.map((id) => `focus = ${id}`).join(' ')} }\n`
  }

  body += section('available', scripts.available)
  body += section('bypass', scripts.bypass)
  body += 'ai_will_do = {\n\tfactor = 1\n}\n'
  body += section('completion_reward', scripts.completion_reward, true)

  return `focus = {\n${indent(body, 1)}}\n`
}

/** Genera el script de todos los focos, indexado por uid (útil para el validador). */
export function buildFocusBlocks(
  project: Project,
  getScripts: ScriptsFn = generateFocusScripts
): Map<string, string> {
  const byUid = new Map(project.foci.map((f) => [f.uid, f]))
  return new Map(project.foci.map((f) => [f.uid, buildFocusBlock(f, byUid, getScripts)]))
}

/** Archivo completo del árbol de focos. */
export function buildFocusTreeFile(project: Project, focusBlocks: Map<string, string>): string {
  const { tag } = project
  let body = ''
  body += `id = ${tag}_focus_tree\n`
  body += 'country = {\n'
  body += '\tfactor = 0\n'
  body += '\tmodifier = {\n'
  body += '\t\tadd = 10\n'
  body += `\t\ttag = ${tag}\n`
  body += '\t}\n'
  body += '}\n'
  body += 'default = no\n'
  for (const focus of project.foci) {
    body += '\n' + (focusBlocks.get(focus.uid) ?? '')
  }
  return `focus_tree = {\n${indent(body, 1)}}\n`
}
