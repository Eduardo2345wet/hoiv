// Revisa un país (en el asistente y antes de exportar). Cada problema dice
// qué pasa, cómo arreglarlo y en qué paso del asistente se arregla.
import { IDEOLOGIES, IDEOLOGY_LABELS, type Country, type Project } from '../types'
import { FORBIDDEN_TAGS, TAG_REGEX, type Issue } from '../export/validator'
import { getCatalogOptions, type GameCatalog } from '../catalog/catalog'
import { colorDistance, SIMILAR_COLOR_DISTANCE } from './color'
import { mostPopular, sumPopularities } from './politics'
import { rulingLeader } from './countryOps'

/** Pasos del asistente */
export const STEPS = ['Identidad', 'Política', 'Capital', 'Bandera', 'Líder', 'Resumen'] as const
export const STEP = {
  identidad: 0,
  politica: 1,
  capital: 2,
  bandera: 3,
  lider: 4,
  resumen: 5
} as const

export function validateCountry(c: Country, project: Project, game: GameCatalog | null): Issue[] {
  const issues: Issue[] = []
  const label = c.names.name || c.tag || 'país sin nombre'
  const err = (step: number, message: string): void => {
    issues.push({ severity: 'error', message: `${label}: ${message}`, countryUid: c.uid, step })
  }
  const warn = (step: number, message: string): void => {
    issues.push({ severity: 'aviso', message: `${label}: ${message}`, countryUid: c.uid, step })
  }

  // ---- Identidad ----
  if (!TAG_REGEX.test(c.tag))
    err(
      STEP.identidad,
      'el tag debe ser una letra mayúscula y 2 letras o números (ej. NVG). Cámbialo en Identidad.'
    )
  else if (FORBIDDEN_TAGS.includes(c.tag))
    err(STEP.identidad, `"${c.tag}" es una palabra reservada del juego. Elige otro tag.`)
  if (project.countries.some((o) => o.uid !== c.uid && o.tag === c.tag))
    err(
      STEP.identidad,
      `el tag ${c.tag} ya lo usa otro país del mod. Cada país necesita un tag distinto.`
    )
  if (c.mode === 'nuevo' && getCatalogOptions('country', null, game).some((o) => o.id === c.tag))
    err(
      STEP.identidad,
      `el tag ${c.tag} ya existe en el juego. Para un país nuevo elige otro, o cambia a "Modificar uno existente".`
    )
  if (!c.names.name.trim()) err(STEP.identidad, 'no tiene nombre. Escríbelo en Identidad.')
  for (const o of project.countries)
    if (o.uid !== c.uid && colorDistance(o.color, c.color) < SIMILAR_COLOR_DISTANCE)
      warn(
        STEP.identidad,
        `su color es casi igual al de ${o.names.name || o.tag}: en el mapa costará distinguirlos.`
      )

  // ---- Política ----
  const touchesHistory = c.mode === 'nuevo' || c.existing.historyEdited
  if (touchesHistory) {
    const sum = sumPopularities(c.politics.popularities)
    if (sum !== 100)
      err(STEP.politica, `las popularidades suman ${sum} % y deben sumar 100. Usa "Balancear".`)
    if (c.politics.popularities[c.politics.ruling] <= 0)
      err(
        STEP.politica,
        `la ideología gobernante (${IDEOLOGY_LABELS[c.politics.ruling]}) no puede tener 0 %.`
      )
    else if (
      mostPopular(c.politics.popularities) !== c.politics.ruling &&
      IDEOLOGIES.some(
        (i) => c.politics.popularities[i] > c.politics.popularities[c.politics.ruling]
      )
    )
      warn(
        STEP.politica,
        'la ideología gobernante no es la más popular: el país puede cambiar de gobierno pronto.'
      )
  }

  // ---- Capital ----
  if (touchesHistory && !c.capital)
    err(STEP.capital, 'no tiene capital. Escribe el número de estado en Capital.')
  if (c.capital && game?.states?.length) {
    const st = game.states.find((s) => s.id === c.capital)
    if (!st) warn(STEP.capital, `el estado ${c.capital} no existe en el juego.`)
    else if (st.owner && st.owner !== c.tag)
      warn(
        STEP.capital,
        `la capital (${st.name}) pertenece a ${st.owner}: el país no la controla al empezar.`
      )
  }
  if (c.mode === 'nuevo')
    warn(
      STEP.capital,
      'un país NUEVO no aparece en la partida si no es dueño de ningún estado. Asignarle estados llegará con el editor de mapa; mientras tanto puedes liberarlo con un foco o evento de otro país.'
    )

  // ---- Bandera ----
  if (!c.flags.main && c.mode === 'nuevo')
    warn(
      STEP.bandera,
      'usa la bandera de relleno. Sube una imagen en Bandera si quieres una propia.'
    )
  if (c.flags.mainSmall)
    warn(STEP.bandera, 'la imagen de la bandera es más chica que 82×52: se verá borrosa.')

  // ---- Líder ----
  const ruler = rulingLeader(c)
  if (ruler && !ruler.subideology)
    err(
      STEP.lider,
      `el líder gobernante (${ruler.name}) no tiene subideología. Elige una en Líder.`
    )
  for (const l of c.leaders) {
    if (!l.portrait) warn(STEP.lider, `${l.name || 'un líder'} usa el retrato de relleno.`)
    if (l.portraitSmall)
      warn(STEP.lider, `la foto de ${l.name} es más chica que 156×210: se verá borrosa.`)
  }
  if (c.mode === 'existente' && c.existing.historyEdited && !c.existing.historyText)
    err(
      STEP.politica,
      'cambiaste la política, la capital o el líder de un país existente, pero sin la carpeta del juego no se puede exportar su historia. Configura la carpeta de HOI4 en Ajustes.'
    )

  // ---- Árbol ----
  if (!c.focusTreeId) warn(STEP.resumen, 'no tiene árbol de focos: usará el genérico del juego.')
  return issues
}
