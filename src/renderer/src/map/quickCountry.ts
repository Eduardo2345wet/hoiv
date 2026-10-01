// "País rápido": un país NUEVO listo para pintar, sin pasos obligatorios.
// Bandera y líder de relleno; se completa después con el asistente.
import { addCountry, newCountry, newLeader } from '../countries/countryOps'
import { store } from '../store/appStore'
import { setBrush } from './brush'
import type { Country } from '../types'

export function quickCountry(name: string, tag: string, color: [number, number, number]): Country {
  const c = newCountry({ mode: 'nuevo', tag, name })
  c.color = color
  // Líder de relleno (retrato de relleno) de la ideología gobernante
  c.leaders = [newLeader(`Líder de ${name}`, c.politics.ruling)]
  return c
}

/** Crea el país rápido en el proyecto (1 paso de deshacer) y lo deja como pincel */
export function createQuickCountry(
  name: string,
  tag: string,
  color: [number, number, number]
): Country {
  const c = quickCountry(name, tag, color)
  store.updateProject((p) => addCountry(p, c))
  setBrush(c.tag)
  return c
}
