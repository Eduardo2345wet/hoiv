// Serializador Clausewitz común de las secciones nuevas: claves, bloques, listas y strings.
// Los strings llevan comillas UNA sola vez; nunca salen comillas escapadas ("\"...\"").

export type Scalar = string | number | boolean
export interface Node {
  key: string
  /** Valor simple: `key = value` (un string se escribe entre comillas solo si `quoted`) */
  value?: Scalar
  quoted?: boolean
  /** Bloque: `key = { … }` */
  children?: Node[]
  /** Lista de valores dentro de un bloque: `key = { a b c }` */
  list?: Scalar[]
  /** Texto ya escrito (por ejemplo el script de unos bloques de Blockly) */
  raw?: string
  /** Operador distinto de "=" (>, <) */
  op?: string
}

/** Un string entre comillas, una sola vez: quita comillas envolventes y sustituye las internas */
export function quote(s: string): string {
  let t = String(s)
  while (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1)
  t = t.replace(/\\"/g, "'").replace(/"/g, "'").replace(/\r?\n/g, ' ')
  return `"${t}"`
}

const scalar = (v: Scalar, quoted?: boolean): string =>
  typeof v === 'boolean' ? (v ? 'yes' : 'no') : quoted ? quote(String(v)) : String(v)

/** Pone `tabs` tabulaciones delante de cada línea no vacía */
export function indent(code: string, tabs = 1): string {
  const pad = '\t'.repeat(tabs)
  return code
    .split('\n')
    .map((l) => (l.trim() ? pad + l : l))
    .join('\n')
}

export function serialize(nodes: Node[], level = 0): string {
  const pad = '\t'.repeat(level)
  const out: string[] = []
  for (const n of nodes) {
    if (n.raw !== undefined) {
      // El script de los bloques ya viene con una tabulación por línea: se normaliza antes de indentar
      if (n.raw.trim()) out.push(indent(n.raw.replace(/\n+$/, '').replace(/^\t/gm, ''), level))
    } else if (n.children) {
      out.push(`${pad}${n.key} ${n.op ?? '='} {`)
      const inner = serialize(n.children, level + 1)
      if (inner) out.push(inner)
      out.push(`${pad}}`)
    } else if (n.list) {
      out.push(
        `${pad}${n.key} ${n.op ?? '='} { ${n.list.map((v) => scalar(v, n.quoted)).join(' ')} }`
      )
    } else if (n.value !== undefined) {
      out.push(`${pad}${n.key} ${n.op ?? '='} ${scalar(n.value, n.quoted)}`)
    }
  }
  return out.join('\n')
}

/** Archivo completo: termina con un salto de línea */
export const file = (nodes: Node[]): string => serialize(nodes) + '\n'

// Atajos para escribir nodos
export const kv = (key: string, value: Scalar, quoted = false): Node => ({ key, value, quoted })
export const str = (key: string, value: string): Node => ({ key, value, quoted: true })
export const block = (key: string, children: Node[]): Node => ({ key, children })
export const list = (key: string, values: Scalar[]): Node => ({ key, list: values })
/** Script ya generado (bloques) dentro de un bloque */
export const raw = (code: string): Node => ({ key: '', raw: code })
