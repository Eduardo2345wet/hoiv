// Lee rasgos del juego: common/unit_leader/*.txt (generales y almirantes) y
// common/country_leader/*.txt (líderes y consejeros). Solo claves de primer nivel de cada
// bloque `leader_traits`, con su `slot` (consejeros) o `type` (militares).
export interface GameTrait {
  id: string
  /** Ranura de consejero (political_advisor, army_chief…) si es un rasgo de consejero */
  slot?: string
  /** Tipo de militar (corps_commander, field_marshal, navy…) si lo declara */
  type?: string
}

/** Cuerpo (sin llaves) de `key = { … }` al nivel que se pida, saltando comentarios y textos */
function bodies(text: string, key: string): string[] {
  const out: string[] = []
  const re = new RegExp(`(^|[\\s}])${key}\\s*=\\s*\\{`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    let depth = 0
    const start = m.index + m[0].length
    for (let i = start - 1; i < text.length; i++) {
      const ch = text[i]
      if (ch === '#') while (i < text.length && text[i] !== '\n') i++
      else if (ch === '{') depth++
      else if (ch === '}' && --depth === 0) {
        out.push(text.slice(start, i))
        re.lastIndex = i
        break
      }
    }
  }
  return out
}

/** Hijos directos `nombre = { … }` de un cuerpo */
function children(body: string): { id: string; body: string }[] {
  const out: { id: string; body: string }[] = []
  let depth = 0
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    if (ch === '#') {
      while (i < body.length && body[i] !== '\n') i++
      continue
    }
    if (ch === '}') depth--
    if (ch === '{') depth++
    if (depth === 0 && /[A-Za-z_]/.test(ch) && (i === 0 || /[\s}]/.test(body[i - 1]))) {
      const m = /^([A-Za-z0-9_]+)\s*=\s*\{/.exec(body.slice(i))
      if (m) {
        const s = i + m[0].length
        let d = 1
        let j = s
        for (; j < body.length && d > 0; j++) {
          if (body[j] === '{') d++
          else if (body[j] === '}') d--
        }
        out.push({ id: m[1], body: body.slice(s, j - 1) })
        i = j
        continue
      }
    }
    i++
  }
  return out
}

/** Rasgos de un archivo del juego (sin duplicados) */
export function parseTraits(text: string): GameTrait[] {
  const seen = new Set<string>()
  const out: GameTrait[] = []
  for (const b of bodies(text, 'leader_traits'))
    for (const c of children(b)) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      const slot = /(?:^|\s)slot\s*=\s*([A-Za-z_]+)/.exec(c.body)?.[1]
      const type = /(?:^|\s)type\s*=\s*([A-Za-z_]+)/.exec(c.body)?.[1]
      out.push({ id: c.id, ...(slot ? { slot } : {}), ...(type ? { type } : {}) })
    }
  return out
}
