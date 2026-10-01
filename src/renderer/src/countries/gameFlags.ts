// Banderas reales de los países del juego (leídas de la instalación del usuario; ver
// main/gameFlags.ts) y qué variante se muestra: la de la ideología gobernante (set_politics de
// history/countries) y, si no existe, <TAG>.tga. Las banderas del mod base tienen prioridad.
import type { Country, Ideology } from '../types'

export type FlagVariant = 'main' | Ideology
export type GameFlags = Record<string, Partial<Record<string, string>>>

export const FLAG_VARIANTS: FlagVariant[] = ['main', 'democratic', 'fascism', 'communism', 'neutrality']

/** Bandera del juego de un país y variante (null si no hay) */
export function gameFlagOf(
  flags: GameFlags | null | undefined,
  tag: string,
  variant: FlagVariant
): string | null {
  return flags?.[tag]?.[variant] ?? null
}

/** Variante que se muestra por defecto: la de la ideología gobernante y, si no, la principal */
export function displayGameFlag(
  flags: GameFlags | null | undefined,
  tag: string,
  ruling: string | undefined
): string | null {
  return (ruling ? gameFlagOf(flags, tag, ruling as FlagVariant) : null) ?? gameFlagOf(flags, tag, 'main')
}

/** ¿El usuario personalizó esta variante de un país del juego? */
export function isCustomFlag(c: Country, variant: FlagVariant): boolean {
  return variant === 'main' ? !!c.flags.main : !!c.flags.byIdeology[variant]
}

/** Quita la bandera personalizada de una variante ("Volver a la del juego") */
export function resetFlagVariant(c: Country, variant: FlagVariant): Country {
  if (variant === 'main') return { ...c, flags: { ...c.flags, main: null } }
  const by = { ...c.flags.byIdeology }
  delete by[variant]
  return { ...c, flags: { ...c.flags, byIdeology: by } }
}
