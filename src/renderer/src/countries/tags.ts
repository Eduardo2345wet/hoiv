// Tags de país: validación y propuesta automática a partir del nombre.
import { asciiSlug } from '../../../shared/names'
import { FORBIDDEN_TAGS, TAG_REGEX } from '../export/validator'

/**
 * Propone un tag de 3 letras: primera letra del nombre + sus primeras consonantes
 * ("Nueva Granada" → NVG). Si choca con uno usado, prueba otras combinaciones y números.
 */
export function suggestTag(name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((t) => t.toUpperCase()))
  const ok = (t: string): boolean =>
    TAG_REGEX.test(t) && !FORBIDDEN_TAGS.includes(t) && !used.has(t)
  const letters = asciiSlug(name)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  const first = letters[0] ?? 'X'
  const consonants = letters.slice(1).replace(/[AEIOU]/g, '')
  const rest = letters.slice(1)

  const candidates: string[] = []
  const pools = [consonants, rest]
  for (const pool of pools)
    for (let i = 0; i < pool.length; i++)
      for (let j = i + 1; j < pool.length; j++) candidates.push(first + pool[i] + pool[j])
  for (const c of candidates) if (ok(c)) return c
  for (let n = 0; n < 100; n++) {
    const t = `${first}${String(n).padStart(2, '0')}`
    if (ok(t)) return t
  }
  for (let a = 65; a <= 90; a++)
    for (let b = 65; b <= 90; b++) {
      const t = `X${String.fromCharCode(a)}${String.fromCharCode(b)}`
      if (ok(t)) return t
    }
  return 'XXX'
}
