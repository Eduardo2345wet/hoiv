// Parches MÍNIMOS de archivos de texto del juego (tecnologías e ideologías): solo se INSERTAN líneas,
// el resto del archivo (comentarios, orden, finales de línea, bytes no ASCII) queda idéntico.
// Trabajan sobre texto latin1 (1 carácter = 1 byte), igual que el parche de estados.
import { find, findAll, scan, type Stmt } from './modScan'

export interface PatchOut {
  text: string
  errors: string[]
}

interface Ins {
  pos: number
  text: string
}

const lineStart = (t: string, p: number): number => t.lastIndexOf('\n', p - 1) + 1
const indentAt = (t: string, p: number): string => /^[ \t]*/.exec(t.slice(lineStart(t, p)))![0]
const sameLine = (t: string, a: number, b: number): boolean => !t.slice(a, b).includes('\n')

/** Texto latin1 listo para escanear: el BOM (ï»¿ en latin1) se tapa con espacios, sin mover posiciones */
const forScan = (t: string): string => t.replace(/^ï»¿/, '   ')

function apply(text: string, ins: Ins[]): string {
  // Varias inserciones en la misma posición: se unen en el orden pedido
  const pooled = new Map<number, string>()
  for (const i of ins) pooled.set(i.pos, (pooled.get(i.pos) ?? '') + i.text)
  let out = text
  for (const [pos, t] of [...pooled].sort((a, b) => b[0] - a[0]))
    out = out.slice(0, pos) + t + out.slice(pos)
  return out
}

/**
 * Inserta `lines` dentro de un bloque `{ … }` (open/close = posiciones de las llaves), después del
 * último hijo (`anchor`) o al principio si no hay. Respeta sangría, finales de línea y bloques de una línea.
 */
function insertInto(
  text: string,
  eol: string,
  open: number,
  close: number,
  anchor: Stmt | undefined,
  lines: string[]
): Ins {
  const inline = sameLine(text, open, close)
  if (inline) {
    const pos = anchor ? anchor.e : open + 1
    return { pos, text: lines.map((l) => ` ${l.replace(/\n\s*/g, ' ')}`).join('') }
  }
  if (anchor) {
    const ind = indentAt(text, anchor.s)
    return {
      pos: anchor.e,
      text: lines.map((l) => eol + ind + l.split('\n').join(eol + ind)).join('')
    }
  }
  const ind = indentAt(text, open) + '\t'
  return {
    pos: open + 1,
    text: lines.map((l) => eol + ind + l.split('\n').join(eol + ind)).join('')
  }
}

/** Posición de las llaves de un bloque a partir de su sentencia (busca el '{' tras la clave) */
function braces(text: string, st: Stmt): { open: number; close: number } {
  return { open: text.indexOf('{', st.s), close: st.e - 1 }
}

// ------------------------------------------------------------------ tecnologías

/**
 * Hace que cada tecnología `from` lleve `path = { leads_to_tech = to research_cost_coeff = 1 }`
 * (idempotente: si ya la lleva, no cambia nada). Los pasos son [from, to].
 */
export function patchTechLinks(raw: string, links: { from: string; to: string }[]): PatchOut {
  const text = raw
  const top = scan(forScan(text))
  if (!top) return { text, errors: ['No se pudo leer la estructura del archivo de tecnologías.'] }
  const root = find(top, 'technologies')
  if (!root?.block) return { text, errors: ['El archivo no tiene un bloque technologies.'] }
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const errors: string[] = []
  const ins: Ins[] = []
  for (const l of links) {
    const tech = root.block.find((s) => s.key === l.from && s.block)
    if (!tech?.block) {
      errors.push(`No se encontró la tecnología ${l.from} en el archivo.`)
      continue
    }
    const already = findAll(tech.block, 'path').some((p) =>
      p.block?.some((x) => x.key === 'leads_to_tech' && x.value === l.to)
    )
    if (already) continue
    const paths = findAll(tech.block, 'path')
    const anchor = paths[paths.length - 1] ?? tech.block[tech.block.length - 1]
    const { open, close } = braces(text, tech)
    ins.push(
      insertInto(text, eol, open, close, anchor, [
        `path = { leads_to_tech = ${l.to} research_cost_coeff = 1 }`
      ])
    )
  }
  return errors.length ? { text, errors } : { text: apply(text, ins), errors }
}

// ------------------------------------------------------------------ ideologías

export interface IdeologyAdd {
  group: string
  id: string
  /** Líneas dentro del bloque del tipo (vacío = `id = { }`) */
  lines?: string[]
}

/** Agrega subideologías dentro de `types = { … }` de su grupo (idempotente) */
export function patchIdeologyTypes(raw: string, adds: IdeologyAdd[]): PatchOut {
  const text = raw
  const top = scan(forScan(text))
  if (!top) return { text, errors: ['No se pudo leer la estructura del archivo de ideologías.'] }
  const root = find(top, 'ideologies')
  if (!root?.block) return { text, errors: ['El archivo no tiene un bloque ideologies.'] }
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const errors: string[] = []
  const ins: Ins[] = []
  for (const a of adds) {
    const group = root.block.find((s) => s.key === a.group && s.block)
    const types = find(group?.block, 'types')
    if (!group?.block || !types?.block) {
      errors.push(`No se encontró types dentro del grupo ${a.group}.`)
      continue
    }
    if (types.block.some((t) => t.key === a.id)) continue
    const body = a.lines?.length ? `${a.id} = {\n\t${a.lines.join('\n\t')}\n}` : `${a.id} = { }`
    const anchor = types.block[types.block.length - 1]
    const { open, close } = braces(text, types)
    ins.push(insertInto(text, eol, open, close, anchor, [body]))
  }
  return errors.length ? { text, errors } : { text: apply(text, ins), errors }
}

/** Grupos y subideologías de un archivo de ideologías (para validar y elegir) */
export function readIdeologyGroups(raw: string): { group: string; types: string[] }[] {
  const top = scan(forScan(raw))
  const root = find(top, 'ideologies')
  if (!root?.block) return []
  return root.block
    .filter((g) => g.block && find(g.block, 'types'))
    .map((g) => ({
      group: g.key,
      types: (find(g.block, 'types')?.block ?? []).filter((t) => t.block).map((t) => t.key)
    }))
}
