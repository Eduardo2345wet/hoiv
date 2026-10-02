// Historia de un país EXISTENTE: leer sus valores y reescribir solo lo que cambió,
// copiando todo lo demás del archivo original del juego.
import { IDEOLOGIES, type Country, type Ideology } from '../types'
import { characterId } from './countryOps'
import { datedBlocks, type HistoryExtras } from '../sections/historyExtras'

interface Span {
  start: number
  end: number
}

/** Busca "clave = { ... }" en el nivel superior (fuera de bloques de fecha como 1939.1.1 = {}) */
function topLevelBlock(text: string, key: string): Span | null {
  let depth = 0
  let inQuote = false
  let inComment = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inComment) {
      if (ch === '\n') inComment = false
      continue
    }
    if (ch === '"') inQuote = !inQuote
    if (inQuote) continue
    if (ch === '#') {
      inComment = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (
      depth === 0 &&
      text.startsWith(key, i) &&
      /[\s=]/.test(text[i + key.length] ?? '') &&
      (i === 0 || /\s/.test(text[i - 1]))
    ) {
      const m = /^\s*=\s*\{/.exec(text.slice(i + key.length))
      if (!m) continue
      let d = 0
      for (let j = i + key.length + m[0].length - 1; j < text.length; j++) {
        if (text[j] === '{') d++
        else if (text[j] === '}' && --d === 0) return { start: i, end: j + 1 }
      }
      return null
    }
  }
  return null
}

function topLevelLine(text: string, key: string): Span | null {
  const re = new RegExp(`^[ \\t]*${key}[ \\t]*=[ \\t]*[^{\\n]*$`, 'm')
  const m = re.exec(text)
  return m ? { start: m.index, end: m.index + m[0].length } : null
}

export interface ParsedHistory {
  capital?: number
  ruling?: Ideology
  lastElection?: string
  electionFrequency?: number
  electionsAllowed?: boolean
  popularities?: Partial<Record<Ideology, number>>
}

/** Lee capital, política y popularidades del archivo del juego */
export function parseHistory(text: string): ParsedHistory {
  const out: ParsedHistory = {}
  const cap = topLevelLine(text, 'capital')
  if (cap) out.capital = Number(text.slice(cap.start, cap.end).match(/(\d+)/)?.[1])
  const pol = topLevelBlock(text, 'set_politics')
  if (pol) {
    const b = text.slice(pol.start, pol.end)
    const ruling = b.match(/ruling_party\s*=\s*(\w+)/)?.[1]
    if (ruling && (IDEOLOGIES as string[]).includes(ruling)) out.ruling = ruling as Ideology
    out.lastElection = b.match(/last_election\s*=\s*"?([\d.]+)"?/)?.[1]
    const freq = b.match(/election_frequency\s*=\s*(\d+)/)?.[1]
    if (freq) out.electionFrequency = Number(freq)
    const allowed = b.match(/elections_allowed\s*=\s*(yes|no)/)?.[1]
    if (allowed) out.electionsAllowed = allowed === 'yes'
  }
  const pop = topLevelBlock(text, 'set_popularities')
  if (pop) {
    const b = text.slice(pop.start, pop.end)
    out.popularities = {}
    for (const i of IDEOLOGIES) {
      const v = b.match(new RegExp(`${i}\\s*=\\s*(\\d+)`))?.[1]
      if (v) out.popularities[i] = Number(v)
    }
  }
  return out
}

/** Aplica los valores leídos del juego a un país (sin marcarlo como "historia cambiada") */
export function applyParsedHistory(c: Country, h: ParsedHistory): Country {
  const pops = { democratic: 0, fascism: 0, communism: 0, neutrality: 0, ...h.popularities }
  return {
    ...c,
    capital: h.capital ?? c.capital,
    politics: {
      ...c.politics,
      ruling: h.ruling ?? c.politics.ruling,
      lastElection: h.lastElection ?? c.politics.lastElection,
      electionFrequency: h.electionFrequency ?? c.politics.electionFrequency,
      electionsAllowed: h.electionsAllowed ?? c.politics.electionsAllowed,
      popularities: h.popularities ? pops : c.politics.popularities
    }
  }
}

/**
 * Reescribe la historia original con la capital, la política y las popularidades del país,
 * y recluta sus líderes nuevos justo antes de set_politics. Todo lo demás se copia igual.
 */
export function patchHistory(original: string, c: Country, extras?: HistoryExtras): string {
  let text = original.replace(/\r\n/g, '\n')
  const pol = c.politics
  const politics = [
    'set_politics = {',
    `\truling_party = ${pol.ruling}`,
    `\tlast_election = "${pol.lastElection}"`,
    `\telection_frequency = ${pol.electionFrequency}`,
    `\telections_allowed = ${pol.electionsAllowed ? 'yes' : 'no'}`,
    '}'
  ].join('\n')
  const pops = [
    'set_popularities = {',
    ...IDEOLOGIES.map((i) => `\t${i} = ${pol.popularities[i]}`),
    '}'
  ].join('\n')
  const recruits = [
    ...c.leaders.map((l) => `recruit_character = ${characterId(c, l.id)}`),
    ...(extras?.lines ?? [])
  ].join('\n')

  const replace = (span: Span | null, value: string, fallbackAppend: boolean): void => {
    if (span) text = text.slice(0, span.start) + value + text.slice(span.end)
    else if (fallbackAppend) text = text.trimEnd() + '\n' + value + '\n'
  }
  if (c.capital) {
    const cap = topLevelLine(text, 'capital')
    if (cap) text = text.slice(0, cap.start) + `capital = ${c.capital}` + text.slice(cap.end)
    else text = `capital = ${c.capital}\n` + text
  }
  replace(topLevelBlock(text, 'set_popularities'), pops, true)
  const polSpan = topLevelBlock(text, 'set_politics')
  // recruit_character va antes de set_politics (nunca como última línea)
  const withRecruits = recruits ? `${recruits}\n${politics}` : politics
  if (polSpan) replace(polSpan, withRecruits, false)
  else {
    const popSpan = topLevelBlock(text, 'set_popularities')!
    text = text.slice(0, popSpan.start) + withRecruits + '\n' + text.slice(popSpan.start)
  }
  // Claves de un solo valor: reemplazan la línea del juego (o se agregan al principio)
  for (const [k, v] of Object.entries(extras?.scalars ?? {})) {
    const line = topLevelLine(text, k)
    if (line) text = text.slice(0, line.start) + `${k} = ${v}` + text.slice(line.end)
    else text = `${k} = ${v}\n` + text
  }
  if (extras?.oob) {
    const oob = topLevelLine(text, 'oob')
    if (oob) text = text.slice(0, oob.start) + `oob = "${extras.oob}"` + text.slice(oob.end)
    else text = `oob = "${extras.oob}"\n` + text
  }
  const dated = extras ? datedBlocks(extras) : ''
  if (dated) text = text.trimEnd() + '\n' + dated + '\n'
  return text.endsWith('\n') ? text : text + '\n'
}
