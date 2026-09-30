// Construye el archivo de localización (textos que ve el jugador).
// El BOM (\uFEFF) lo añade el proceso principal al escribir el archivo.

import type { Project } from '../model/project'

/** Escapa el texto para que quepa en una línea de YAML de Paradox. */
function escapeLoc(value: string): string {
  return value.replace(/\r?\n/g, '\\n')
}

export function buildLocalisation(project: Project): string {
  const lines = ['l_english:']
  for (const focus of project.foci) {
    lines.push(` ${focus.id}:0 "${escapeLoc(focus.name)}"`)
    lines.push(` ${focus.id}_desc:0 "${escapeLoc(focus.description)}"`)
  }
  return lines.join('\n') + '\n'
}
