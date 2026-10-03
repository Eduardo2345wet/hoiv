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
  /**
   * Claves que se quitan de los bloques con fecha (1939.1.1 = { … }) del history de nivel
   * superior. Se usa en el modo Sin nación para que en 1939 no se devuelvan los estados.
   */
  stripDated?: string[]
  /** Otros datos del estado (S6): valores finales deseados; 0 quita la línea */
  props?: StateProps
}

/** Datos editables del estado además de dueño y cores. Solo se tocan las líneas indicadas. */
export interface StateProps {
  manpower?: number
  category?: string
  resources?: Record<string, number>
  /** Edificios del estado (infrastructure, industrial_complex…) */
  buildings?: Record<string, number>
  /** Edificios por provincia: provincia → { naval_base, bunker… } */
  provinceBuildings?: Record<number, Record<string, number>>
  /** Puntos de victoria: provincia → valor (0 = quitar) */
  victoryPoints?: Record<number, number>
}

const DATE_KEY = /^\d{1,4}\.\d{1,2}\.\d{1,2}$/

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

const TAG_KEY = /^[A-Z][A-Z0-9]{2}$/
const LOGIC_KEYS = ['NOT', 'AND', 'limit']

/**
 * Sentencias a quitar de un bloque con fecha (patrón real de HOI4 1.19.3):
 *   1938.10.25 = { if = { limit = { … } remove_core_of = GXC  CHI = { transfer_state = PREV } } }
 * Se quitan las claves pedidas sueltas, en cualquier `if`/`else` y dentro de `TAG = { … }`; y si un
 * `if` o un `TAG = { }` se queda sin nada (salvo su `limit`), se quita ENTERO. Nunca se entra en
 * `limit` ni en NOT/AND.
 */
function datedKills(toks: Tok[], stmts: Stmt[], keys: string[]): Stmt[] {
  const kill: Stmt[] = []
  for (const st of stmts) {
    if (!st.block) {
      if (keys.includes(st.key)) kill.push(st)
      continue
    }
    const containerKey =
      TAG_KEY.test(st.key) && !LOGIC_KEYS.includes(st.key)
        ? true
        : ['if', 'else', 'else_if'].includes(st.key)
    if (!containerKey) continue
    const inner = statements(toks, st.valStart + 1, st.valEnd)
    if (!inner) continue
    const sub = datedKills(toks, inner, keys)
    if (!sub.length) continue
    const meaningful = inner.filter((x) => x.key !== 'limit')
    if (meaningful.length && meaningful.every((x) => sub.includes(x))) kill.push(st)
    else kill.push(...sub)
  }
  return kill
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

  /** Quita una sentencia: la línea entera si está sola, o solo la sentencia si comparte línea */
  const removeStmt = (c: Stmt): void => {
    const s = toks[c.keyTok].s
    const e = toks[c.valEnd].e
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

  /**
   * Fija `key = value` entre las sentencias `stmts` de un bloque (llaves en los tokens open/close):
   * cambia solo el valor si existe, la quita si value es null, o la agrega tras la última sentencia
   * cuya clave esté en `after` (o al principio del bloque). Respeta sangría y finales de línea.
   */
  const setEntry = (
    stmts: Stmt[],
    open: number,
    close: number,
    key: string,
    value: string | null,
    after: string[]
  ): void => {
    const cur = stmts.find((x) => x.key === key && !x.block)
    if (cur) {
      if (value === null) removeStmt(cur)
      else if (toks[cur.valStart].v !== value)
        edits.push({ s: toks[cur.valStart].s, e: toks[cur.valStart].e, text: value })
      return
    }
    if (value === null) return
    const line = `${key} = ${value}`
    const anchor = [...stmts].reverse().find((x) => after.includes(x.key))
    const singleLine = lineStart(text, toks[open].s) === lineStart(text, toks[close].s)
    if (anchor) {
      const aEnd = toks[anchor.valEnd].e
      let pos = lineEnd(text, aEnd)
      if (text[pos - 1] === '\r') pos--
      if (text.slice(aEnd, pos).trim() || singleLine) {
        edits.push({ s: aEnd, e: aEnd, text: ` ${line}` })
      } else {
        edits.push({ s: pos, e: pos, text: eol + indentOf(text, toks[anchor.keyTok].s) + line })
      }
      return
    }
    const pos = toks[open].e
    if (singleLine || !stmts.length) {
      const ind = indentOf(text, toks[open].s)
      if (singleLine) edits.push({ s: pos, e: pos, text: ` ${line}` })
      else edits.push({ s: pos, e: pos, text: eol + ind + '\t' + line })
    } else
      edits.push({ s: pos, e: pos, text: eol + indentOf(text, toks[stmts[0].keyTok].s) + line })
  }

  /** Un bloque `key = { a = 1 … }` con números: cambia solo esas claves; si falta, lo crea */
  const setNumBlock = (
    stmts: Stmt[],
    open: number,
    close: number,
    key: string,
    entries: Record<string, number>,
    after: string[]
  ): void => {
    const list = Object.entries(entries)
    if (!list.length) return
    const blk = stmts.find((x) => x.key === key && x.block)
    if (blk) {
      const sub = statements(toks, blk.valStart + 1, blk.valEnd)
      if (!sub) return
      for (const [k, v] of list)
        setEntry(sub, blk.valStart, blk.valEnd, k, v > 0 ? String(v) : null, [])
      return
    }
    const body = list.filter(([, v]) => v > 0).map(([k, v]) => `${k} = ${v}`)
    if (body.length) setEntry(stmts, open, close, key, `{ ${body.join(' ')} }`, after)
  }

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
    for (const c of cores) if (!want.has(toks[c.valStart].v)) removeStmt(c)

    // Bloques con fecha: quitar las claves pedidas (solo sentencias directas del bloque)
    if (target.stripDated?.length) {
      for (const dated of items.filter((x) => x.block && DATE_KEY.test(x.key))) {
        const inner = statements(toks, dated.valStart + 1, dated.valEnd)
        if (!inner) {
          errors.push({
            id: target.id,
            message: `No se pudo leer el bloque ${dated.key} del estado ${target.id}.`
          })
          continue
        }
        for (const st of datedKills(toks, inner, target.stripDated)) removeStmt(st)
      }
    }

    // Otros datos del estado (población, categoría, recursos, edificios, puntos de victoria)
    const pr = target.props
    if (pr) {
      const sOpen = stateStmt.valStart
      const sClose = stateStmt.valEnd
      if (pr.manpower !== undefined)
        setEntry(inner, sOpen, sClose, 'manpower', String(Math.round(pr.manpower)), ['name', 'id'])
      if (pr.category)
        setEntry(inner, sOpen, sClose, 'state_category', pr.category, ['manpower', 'name', 'id'])
      if (pr.resources)
        setNumBlock(inner, sOpen, sClose, 'resources', pr.resources, [
          'state_category',
          'manpower',
          'name'
        ])
      const wantsBuildings =
        (pr.buildings && Object.keys(pr.buildings).length) ||
        (pr.provinceBuildings && Object.keys(pr.provinceBuildings).length)
      if (wantsBuildings) {
        const hOpen = h.valStart
        const hClose = h.valEnd
        const bl = items.filter((x) => x.key === 'buildings' && x.block)
        if (bl.length > 1) {
          errors.push({
            id: target.id,
            message: `El estado ${target.id} tiene varios bloques buildings; no se puede parchar con seguridad.`
          })
          continue
        }
        const provs = pr.provinceBuildings ?? {}
        if (bl.length) {
          const b = bl[0]
          const bi = statements(toks, b.valStart + 1, b.valEnd)
          if (!bi) {
            errors.push({
              id: target.id,
              message: `No se pudo leer el bloque buildings del estado ${target.id}.`
            })
            continue
          }
          for (const [k, v] of Object.entries(pr.buildings ?? {}))
            setEntry(bi, b.valStart, b.valEnd, k, v > 0 ? String(v) : null, [
              ...Object.keys(pr.buildings ?? {}),
              'infrastructure'
            ])
          for (const [prov, vals] of Object.entries(provs))
            setNumBlock(bi, b.valStart, b.valEnd, prov, vals, [])
        } else {
          const parts = [
            ...Object.entries(pr.buildings ?? {})
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k} = ${v}`),
            ...Object.entries(provs)
              .map(([prov, vals]) => {
                const body = Object.entries(vals)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${k} = ${v}`)
                return body.length ? `${prov} = { ${body.join(' ')} }` : ''
              })
              .filter(Boolean)
          ]
          if (parts.length)
            setEntry(items, hOpen, hClose, 'buildings', `{ ${parts.join(' ')} }`, [
              'owner',
              'controller',
              'add_core_of'
            ])
        }
      }
      for (const [prov, val] of Object.entries(pr.victoryPoints ?? {})) {
        const vp = items.find((x) => {
          if (x.key !== 'victory_points' || !x.block) return false
          const first = toks[x.valStart + 1]
          return first?.t === 'w' && first.v === prov
        })
        if (vp) {
          const valTok = toks[vp.valStart + 2]
          if (!valTok || valTok.t !== 'w') continue
          if (val > 0) {
            if (valTok.v !== String(val))
              edits.push({ s: valTok.s, e: valTok.e, text: String(val) })
          } else removeStmt(vp)
        } else if (val > 0) {
          const last = [...items].reverse().find((x) => x.key === 'victory_points' && x.block)
          const aft = last ?? [...items].reverse().find((x) => x.key === 'buildings' && x.block)
          const hOpen = h.valStart
          const hClose = h.valEnd
          const line = `victory_points = { ${prov} ${val} }`
          if (aft) {
            const aEnd = toks[aft.valEnd].e
            let pos = lineEnd(text, aEnd)
            if (text[pos - 1] === '\r') pos--
            if (text.slice(aEnd, pos).trim()) edits.push({ s: aEnd, e: aEnd, text: ` ${line}` })
            else
              edits.push({
                s: pos,
                e: pos,
                text: eol + indentOf(text, toks[aft.keyTok].s) + line
              })
          } else
            setEntry(items, hOpen, hClose, 'victory_points', `{ ${prov} ${val} }`, [
              'owner',
              'controller',
              'add_core_of'
            ])
        }
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
  // Varias inserciones en la misma posición se unen en el orden en que se pidieron
  const pooled = new Map<number, string>()
  const real: Edit[] = []
  for (const ed of edits)
    if (ed.s === ed.e) pooled.set(ed.s, (pooled.get(ed.s) ?? '') + ed.text)
    else real.push(ed)
  edits.length = 0
  edits.push(...real, ...[...pooled].map(([pos, t]) => ({ s: pos, e: pos, text: t })))
  edits.sort((a, b) => b.s - a.s || b.e - a.e)
  let out = text
  for (const ed of edits) out = out.slice(0, ed.s) + ed.text + out.slice(ed.e)
  return { text: out, errors }
}
