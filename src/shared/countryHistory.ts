// Capital de history/countries/<TAG> - <Nombre>.txt: lectura y parche MÍNIMO.
// Trabaja sobre texto latin1 (1 carácter = 1 byte) o ya decodificado: solo cambia las cifras
// de la línea `capital = N` de NIVEL SUPERIOR (no la de bloques con fecha ni la de if/limit).

interface Tok {
  s: number
  e: number
  v: string
  depth: number
}

/** Tokens (palabras, =, { y }) sin comentarios, espacios ni BOM, con su profundidad de llaves */
export function tokenizePdx(text: string): Tok[] {
  const out: Tok[] = []
  let depth = 0
  let i = 0
  const n = text.length
  // BOM UTF-8: bien decodificado (U+FEFF) o leído como latin1 (ï»¿)
  if (text.startsWith('ï»¿')) i = 3
  while (i < n) {
    const c = text[i]
    if (c === '#') {
      while (i < n && text[i] !== '\n') i++
    } else if (/\s|﻿/.test(c)) {
      i++
    } else if (c === '{') {
      out.push({ s: i, e: i + 1, v: c, depth })
      depth++
      i++
    } else if (c === '}') {
      depth = Math.max(0, depth - 1)
      out.push({ s: i, e: i + 1, v: c, depth })
      i++
    } else if (c === '=' || c === '<' || c === '>' || c === '!') {
      let j = i + 1
      if (text[j] === '=') j++
      out.push({ s: i, e: j, v: text.slice(i, j), depth })
      i = j
    } else if (c === '"') {
      let j = i + 1
      while (j < n && text[j] !== '"') j++
      out.push({ s: i, e: j + 1, v: text.slice(i, j + 1), depth })
      i = j + 1
    } else {
      let j = i
      while (j < n && !/[\s{}=<>!#"]/.test(text[j])) j++
      out.push({ s: i, e: j, v: text.slice(i, j), depth })
      i = j
    }
  }
  return out
}

/** Posiciones del número de cada `capital = N` de nivel superior */
function topLevelCapitals(text: string): { s: number; e: number; n: number }[] {
  const t = tokenizePdx(text)
  const found: { s: number; e: number; n: number }[] = []
  for (let i = 0; i + 2 < t.length; i++)
    if (
      t[i].depth === 0 &&
      t[i].v === 'capital' &&
      t[i + 1].v === '=' &&
      t[i + 2].depth === 0 &&
      /^\d+$/.test(t[i + 2].v)
    )
      found.push({ s: t[i + 2].s, e: t[i + 2].e, n: Number(t[i + 2].v) })
  return found
}

/** `capital = N` del nivel superior del archivo (null si no hay) */
export function readTopLevelCapital(text: string): number | null {
  const f = topLevelCapitals(text)
  return f.length ? f[0].n : null
}

/** Cambia solo el número de la capital de nivel superior. Error si no hay una (y solo una) */
export function patchCapitalText(
  text: string,
  capital: number
): { text: string } | { error: string } {
  if (!Number.isInteger(capital) || capital < 1) return { error: 'Número de estado no válido.' }
  const f = topLevelCapitals(text)
  if (f.length !== 1)
    return {
      error: f.length
        ? 'El archivo tiene varias líneas "capital =" de nivel superior.'
        : 'El archivo no tiene una línea "capital = N" de nivel superior que cambiar.'
    }
  return { text: text.slice(0, f[0].s) + String(capital) + text.slice(f[0].e) }
}
