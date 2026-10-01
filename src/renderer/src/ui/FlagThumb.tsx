// Miniatura de la bandera de un país: la subida por el usuario, la REAL del juego (variante de la
// ideología gobernante, con respaldo a <TAG>.tga) o la de relleno
import type { Country, Ideology } from '../types'
import { renderFlagPlaceholder, renderPlainFlag } from '../icons/renderer'
import { store, useApp } from '../store/appStore'
import { colorForTag } from '../countries/countryOps'
import { displayGameFlag, gameFlagOf } from '../countries/gameFlags'

/** Bandera (data URL) de un país del MOD. Con `ideology` pide esa variante; sin ella, la principal. */
export function flagSrc(c: Country, ideology?: Ideology): string {
  // País técnico "Sin nación": bandera gris lisa
  if (c.technical) return renderPlainFlag(c.color)
  const custom = (ideology && c.flags.byIdeology[ideology]) || c.flags.main
  if (custom) return custom
  // País EXISTENTE sin bandera propia: la real del juego
  if (c.mode === 'existente') {
    const flags = store.get().gameFlags
    const real = ideology
      ? (gameFlagOf(flags, c.tag, ideology) ?? gameFlagOf(flags, c.tag, 'main'))
      : (displayGameFlag(flags, c.tag, store.get().game?.countryRuling?.[c.tag]) ?? null)
    if (real) return real
  }
  return renderFlagPlaceholder(c.tag, c.color)
}

/** Bandera de CUALQUIER país por tag: la del mod si es suyo, si no la del juego, si no relleno */
export function flagForTag(tag: string, mine: Country | undefined): string {
  if (mine) return flagSrc(mine)
  const real = displayGameFlag(store.get().gameFlags, tag, store.get().game?.countryRuling?.[tag])
  return real ?? renderFlagPlaceholder(tag, colorForTag(tag))
}

export default function FlagThumb({
  country,
  height = 20
}: {
  country: Country
  height?: number
}): JSX.Element {
  useApp((s) => s.gameFlags) // se redibuja cuando llegan las banderas del juego
  return (
    <img
      src={flagSrc(country)}
      alt={country.tag}
      style={{ height, width: (height * 82) / 52 }}
      className="shrink-0 rounded-sm object-cover ring-1 ring-black/50"
      draggable={false}
    />
  )
}
