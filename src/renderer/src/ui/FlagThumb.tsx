// Miniatura de la bandera de un país (la de relleno si no subió ninguna)
import type { Country, Ideology } from '../types'
import { renderFlagPlaceholder, renderPlainFlag } from '../icons/renderer'

export function flagSrc(c: Country, ideology?: Ideology): string {
  // País técnico "Sin nación": bandera gris lisa
  if (c.technical) return renderPlainFlag(c.color)
  return (
    (ideology && c.flags.byIdeology[ideology]) ||
    c.flags.main ||
    renderFlagPlaceholder(c.tag, c.color)
  )
}

export default function FlagThumb({
  country,
  height = 20
}: {
  country: Country
  height?: number
}): JSX.Element {
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
