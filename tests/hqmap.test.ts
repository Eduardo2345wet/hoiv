// Mapa generado de alta calidad: tema, vectorización de fronteras, etiquetas y exportación
import { describe, expect, it } from 'vitest'
import {
  MAP_THEME,
  THEME_RGB,
  hexToRgb,
  rgbToHex,
  textIsWhite,
  deviceWidth
} from '../src/shared/map/theme'

describe('tema del mapa (parte 1)', () => {
  it('usa los colores exactos del estilo', () => {
    expect(MAP_THEME.sea).toBe('#446BA3')
    expect(MAP_THEME.land).toBe('#FFFFFF')
    expect(MAP_THEME.stateBorder).toBe('#BFBFBF')
    expect(MAP_THEME.countryBorder).toBe('#6E6E6E')
    expect(MAP_THEME.provinceBorder).toBe('#E6E6E6')
    expect(MAP_THEME.label).toBe('#000000')
    expect(THEME_RGB.sea).toEqual([0x44, 0x6b, 0xa3])
  })
  it('hex <-> rgb es reversible', () => {
    for (const h of Object.values(MAP_THEME).filter((v) => typeof v === 'string' && v[0] === '#'))
      expect(rgbToHex(hexToRgb(h as string))).toBe(h)
  })
  it('los anchos están en los rangos pedidos', () => {
    expect(MAP_THEME.width.stateBorder).toBe(1)
    expect(MAP_THEME.width.countryBorder).toBeGreaterThanOrEqual(1.5)
    expect(MAP_THEME.width.countryBorder).toBeLessThanOrEqual(2)
    expect(MAP_THEME.width.provinceBorder).toBe(0.5)
  })
  it('el texto es negro sobre blanco y blanco sobre colores oscuros', () => {
    expect(textIsWhite([255, 255, 255])).toBe(false)
    expect(textIsWhite([240, 175, 50])).toBe(false)
    expect(textIsWhite([20, 30, 90])).toBe(true)
    expect(textIsWhite([110, 20, 20])).toBe(true)
  })
  it('con DPR 2 una línea de 1 px CSS mide 2 px del dispositivo', () => {
    expect(deviceWidth(1, 2)).toBe(2)
    expect(deviceWidth(MAP_THEME.width.stateBorder, 1)).toBe(1)
  })
})
