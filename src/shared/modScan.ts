// Lectura de texto de mods en el formato de Paradox, CON posiciones: sirve para importar un mod
// existente sin perder el texto que no se entiende (se guarda tal cual como "Avanzado (texto)").
// Solo lectura: nada aquí escribe archivos.

export interface Stmt {
  key: string
  /** '=' (u otro operador); '' si es un valor suelto dentro de una lista */
  op: string
  /** Valor simple sin comillas (null si es un bloque o un valor suelto) */
  value: string | null
  quoted: boolean
  /** Hijos si es un bloque `{ … }` */
  block: Stmt[] | null
  /** Texto entre las llaves (sin ellas) */
  inner: string | null
  /** Posición de la sentencia completa en el texto original [s, e) */
  s: number
  e: number
}

type Tok = { t: 'w' | 'q' | '{' | '}' | 'op'; v: string; s: number; e: number }

function tokenize(text: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (c === '#') {
      while (i < n && text[i] !== '\n') i++
      continue
    }
    if (/\s|﻿/.test(c)) {
      i++
      continue
    }
    if (c === '{' || c === '}') {
      out.push({ t: c, v: c, s: i, e: i + 1 })
      i++
      continue
    }
    if (c === '=' || c === '<' || c === '>' || c === '!') {
      let j = i + 1
      if (text[j] === '=') j++
      out.push({ t: 'op', v: text.slice(i, j), s: i, e: j })
      i = j
      continue
    }
    if (c === '"') {
      let j = i + 1
      while (j < n && text[j] !== '"') j++
      out.push({ t: 'q', v: text.slice(i + 1, j), s: i, e: j + 1 })
      i = j + 1
      continue
    }
    let j = i
    while (j < n && !/[\s{}=<>!#"]/.test(text[j])) j++
    out.push({ t: 'w', v: text.slice(i, j), s: i, e: j })
    i = j
  }
  return out
}

/** Sentencias del texto, o null si las llaves no cuadran */
export function scan(text: string): Stmt[] | null {
  const toks = tokenize(text)
  let pos = 0
  const parse = (until: boolean): Stmt[] | null => {
    const out: Stmt[] = []
    while (pos < toks.length) {
      const k = toks[pos]
      if (k.t === '}') {
        if (!until) return null
        return out
      }
      if (k.t === '{') {
        // Bloque anónimo ({ a b } suelto): se lee su contenido como un bloque sin clave
        pos++
        const open = k.e
        const kids = parse(true)
        if (!kids || toks[pos]?.t !== '}') return null
        out.push({
          key: '',
          op: '',
          value: null,
          quoted: false,
          block: kids,
          inner: text.slice(open, toks[pos].s),
          s: k.s,
          e: toks[pos].e
        })
        pos++
        continue
      }
      if (k.t === 'op') return null
      const next = toks[pos + 1]
      if (next?.t === 'op') {
        const v = toks[pos + 2]
        if (!v) return null
        if (v.t === '{') {
          pos += 3
          const kids = parse(true)
          if (!kids || toks[pos]?.t !== '}') return null
          out.push({
            key: k.v,
            op: next.v,
            value: null,
            quoted: false,
            block: kids,
            inner: text.slice(v.e, toks[pos].s),
            s: k.s,
            e: toks[pos].e
          })
          pos++
        } else if (v.t === 'w' || v.t === 'q') {
          out.push({
            key: k.v,
            op: next.v,
            value: v.v,
            quoted: v.t === 'q',
            block: null,
            inner: null,
            s: k.s,
            e: v.e
          })
          pos += 3
        } else return null
      } else {
        out.push({
          key: k.v,
          op: '',
          value: null,
          quoted: k.t === 'q',
          block: null,
          inner: null,
          s: k.s,
          e: k.e
        })
        pos++
      }
    }
    return until ? null : out
  }
  return parse(false)
}

export const find = (s: Stmt[] | null | undefined, key: string): Stmt | undefined =>
  s?.find((x) => x.key === key && x.op !== '')
export const findAll = (s: Stmt[] | null | undefined, key: string): Stmt[] =>
  (s ?? []).filter((x) => x.key === key && x.op !== '')
export const val = (s: Stmt[] | null | undefined, key: string): string | undefined => {
  const f = find(s, key)
  return f && f.block === null ? (f.value ?? undefined) : undefined
}

/** Texto de un bloque listo para un BlockScript: sin sangría común y con UNA tabulación por línea */
export function codeOf(stmt: Stmt | undefined): string {
  if (!stmt?.inner) return ''
  const lines = stmt.inner.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  if (!lines.length) return ''
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length))
  return lines.map((l) => (l.trim() ? '\t' + l.slice(ind).trimEnd() : '')).join('\n') + '\n'
}

/** Texto original de las sentencias de `all` cuya clave NO está en `handled` (lo que no se entendió) */
export function restCode(text: string, all: Stmt[] | null | undefined, handled: string[]): string {
  const parts = (all ?? []).filter((x) => !handled.includes(x.key)).map((x) => text.slice(x.s, x.e))
  if (!parts.length) return ''
  return codeOf({ inner: parts.join('\n') } as Stmt)
}

/** Claves y textos de un .yml de localización */
export function parseYml(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const l of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_.\-']+):\d*\s+"(.*)"\s*(#.*)?$/.exec(l)
    if (m) out[m[1]] = m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }
  return out
}
