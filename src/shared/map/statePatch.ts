// Parche MÍNIMO de archivos history/states: solo cambia `owner` y las líneas `add_core_of`
// del bloque `history = { … }` de NIVEL SUPERIOR de cada estado. No toca bloques con fecha
// (1939.1.1 = { … }), if/limit, comentarios, orden ni finales de línea.
// Trabaja sobre texto latin1 (1 carácter = 1 byte) y solo inserta/quita caracteres ASCII,
// así el resto del archivo queda idéntico byte a byte.

export interface StateTarget {
  id: number
  /** Dueño final deseado */
  owner: string
  /** Cores finales deseados */
  cores: string[]
}

interface Tok {
  t: 'w' | '{' | '}' | 'op'
  s: number
  e: number
  v: string
}

/** Tokens del formato de Paradox (sin comentarios ni espacios) */
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
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '﻿') {
      i++
      continue
    }
    if (c === '{' || c === '}') {
      out.push({ t: c, s: i, e: i + 1, v: c })
      i++
      continue
    }
    if (c === '=' || c === '<' || c === '>' || c === '!') {
      let j = i + 1
      if (text[j] === '=') j++
      out.push({ t: 'op', s: i, e: j, v: text.slice(i, j) })
      i = j
      continue
    }
    if (c === '"') {
      let j = i + 1
      while (j < n && text[j] !== '"') j++
      out.push({ t: 'w', s: i, e: j + 1, v: text.slice(i + 1, j) })
      i = j + 1
      continue
    }
    let j = i
    while (j < n && !/[\s{}=<>!#"]/.test(text[j])) j++
    out.push({ t: 'w', s: i, e: j, v: text.slice(i, j) })
    i = j
  }
  return out
}

interface Stmt {
  key: string
  keyTok: number
  /** índices de token del valor (si es bloque: '{' y su '}') */
  valStart: number
  valEnd: number
  block: boolean
}

/** Sentencias de UN nivel entre los tokens [from, to) */
function statements(toks: Tok[], from: number, to: number): Stmt[] | null {
  const out: Stmt[] = []
  let i = from
  while (i < to) {
    const k = toks[i]
    if (k.t !== 'w') {
      // Valores sueltos dentro de listas ({ 1 2 3 }) no son sentencias
      if (k.t === '{') {
        const close = matchBrace(toks, i)
        if (close < 0) return null
        i = close + 1
        continue
      }
      return null
    }
    if (toks[i + 1]?.t !== 'op') {
      i++ // elemento de lista
      continue
    }
    const v = i + 2
    if (v >= to) return null
    if (toks[v].t === '{') {
      const close = matchBrace(toks, v)
      if (close < 0 || close >= to) return null
      out.push({ key: k.v, keyTok: i, valStart: v, valEnd: close, block: true })
      i = close + 1
    } else if (toks[v].t === 'w') {
      out.push({ key: k.v, keyTok: i, valStart: v, valEnd: v, block: false })
      i = v + 1
    } else return null
  }
  return out
}

function matchBrace(toks: Tok[], open: number): number {
  let d = 0
  for (let i = open; i < toks.length; i++) {
    if (toks[i].t === '{') d++
    else if (toks[i].t === '}' && --d === 0) return i
  }
  return -1
}

interface Edit {
  s: number
  e: number
  text: string
}

const lineStart = (text: string, pos: number): number => text.lastIndexOf('\n', pos - 1) + 1
function lineEnd(text: string, pos: number): number {
  const i = text.indexOf('\n', pos)
  return i < 0 ? text.length : i
}
const indentOf = (text: string, pos: number): string =>
  /^[ \t]*/.exec(text.slice(lineStart(text, pos)))![0]

export interface PatchResult {
  text: string
  /** Errores por estado: el archivo NO se debe exportar si hay alguno */
  errors: { id: number; message: string }[]
}

export function patchStateText(text: string, targets: StateTarget[]): PatchResult {
  const errors: PatchResult['errors'] = []
  const toks = tokenize(text)
  const top = statements(toks, 0, toks.length)
  if (!top)
    return {
      text,
      errors: targets.map((t) => ({
        id: t.id,
        message: 'No se pudo leer la estructura del archivo (llaves desbalanceadas).'
      }))
    }
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const edits: Edit[] = []

  for (const target of targets) {
    const stateStmt = top.find((s) => {
      if (s.key !== 'state' || !s.block) return false
      const inner = statements(toks, s.valStart + 1, s.valEnd)
      return !!inner?.some(
        (x) => x.key === 'id' && !x.block && Number(toks[x.valStart].v) === target.id
      )
    })
    if (!stateStmt) {
      errors.push({
        id: target.id,
        message: `No se encontró el estado ${target.id} en el archivo.`
      })
      continue
    }
    const inner = statements(toks, stateStmt.valStart + 1, stateStmt.valEnd)!
    const hist = inner.filter((x) => x.key === 'history' && x.block)
    if (hist.length !== 1) {
      errors.push({
        id: target.id,
        message: `El estado ${target.id} tiene ${hist.length} bloques history de nivel superior; no se puede parchar con seguridad.`
      })
      continue
    }
    const h = hist[0]
    const items = statements(toks, h.valStart + 1, h.valEnd)
    if (!items) {
      errors.push({
        id: target.id,
        message: `No se pudo leer el bloque history del estado ${target.id}.`
      })
      continue
    }
    // Solo el nivel superior de history: los bloques con fecha / if / limit se ignoran
    const owners = items.filter((x) => x.key === 'owner' && !x.block)
    if (owners.length > 1) {
      errors.push({
        id: target.id,
        message: `El estado ${target.id} tiene varias líneas owner en su history; no se puede parchar con seguridad.`
      })
      continue
    }
    const cores = items.filter((x) => x.key === 'add_core_of' && !x.block)
    const want = new Set(target.cores)
    const have = new Set(cores.map((c) => toks[c.valStart].v))

    // owner
    const ownerStmt = owners[0]
    if (ownerStmt && toks[ownerStmt.valStart].v !== target.owner) {
      const vt = toks[ownerStmt.valStart]
      edits.push({ s: vt.s, e: vt.e, text: target.owner })
    }

    // Quitar cores que ya no quiero
    const kept = cores.filter((c) => want.has(toks[c.valStart].v))
    for (const c of cores) {
      if (want.has(toks[c.valStart].v)) continue
      const s = toks[c.keyTok].s
      const e = toks[c.valStart].e
      const ls = lineStart(text, s)
      const le = lineEnd(text, e)
      const before = text.slice(ls, s)
      const after = text.slice(e, le).replace(/\r$/, '')
      if (!before.trim() && !after.trim()) {
        // Línea completa: se quita con su salto de línea
        edits.push({ s: ls, e: Math.min(text.length, le + 1), text: '' })
      } else {
        // Comparte línea con otras cosas: solo la sentencia y los espacios que la siguen
        const m = /^[ \t]*/.exec(text.slice(e))![0]
        edits.push({ s, e: e + m.length, text: '' })
      }
    }

    // Agregar owner y cores que faltan (con la sangría del archivo)
    const toAdd = target.cores.filter((t) => !have.has(t)).sort()
    const lines: string[] = []
    if (!ownerStmt) lines.push(`owner = ${target.owner}`)
    lines.push(...toAdd.map((t) => `add_core_of = ${t}`))
    if (lines.length) {
      const anchor = !ownerStmt ? null : (kept[kept.length - 1] ?? ownerStmt)
      let pos: number
      let indent: string
      if (anchor) {
        const aEnd = toks[anchor.valEnd].e
        pos = lineEnd(text, aEnd)
        if (text[pos - 1] === '\r') pos--
        indent = indentOf(text, toks[anchor.keyTok].s)
        // Si hay algo más detrás de la sentencia en la misma línea, se inserta justo después de ella
        if (text.slice(aEnd, pos).trim()) pos = aEnd
      } else {
        // Al inicio del bloque history
        pos = toks[h.valStart].e
        const first = items[0]
        indent = first
          ? indentOf(text, toks[first.keyTok].s)
          : indentOf(text, toks[h.keyTok].s) + '\t'
        if (!indent && first && lineStart(text, toks[first.keyTok].s) === lineStart(text, pos))
          indent = ''
      }
      edits.push({ s: pos, e: pos, text: lines.map((l) => eol + indent + l).join('') })
    }
  }

  if (errors.length) return { text, errors }
  edits.sort((a, b) => b.s - a.s || b.e - a.e)
  let out = text
  for (const ed of edits) out = out.slice(0, ed.s) + ed.text + out.slice(ed.e)
  return { text: out, errors }
}
