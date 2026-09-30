// Modificadores comunes para espíritus nacionales.
// percent = true → se muestra como % y se exporta como decimal (10 → 0.1).
// Nombres del juego base; no se pudieron comprobar en línea desde el entorno de
// desarrollo (wiki bloqueado): si alguno no funciona, el error.log del juego lo dirá.
export interface ModifierDef {
  key: string
  label: string
  percent: boolean
}

export const MODIFIERS: ModifierDef[] = [
  { key: 'stability_factor', label: 'Estabilidad', percent: true },
  { key: 'war_support_factor', label: 'Apoyo a la guerra', percent: true },
  {
    key: 'political_power_gain',
    label: 'Poder político diario',
    percent: false
  },
  { key: 'consumer_goods_factor', label: 'Bienes de consumo', percent: true },
  {
    key: 'industrial_capacity_factory',
    label: 'Producción de fábricas',
    percent: true
  },
  {
    key: 'production_speed_buildings_factor',
    label: 'Velocidad de construcción',
    percent: true
  },
  {
    key: 'research_speed_factor',
    label: 'Velocidad de investigación',
    percent: true
  },
  { key: 'army_attack_factor', label: 'Ataque del ejército', percent: true },
  { key: 'army_defence_factor', label: 'Defensa del ejército', percent: true },
  { key: 'conscription_factor', label: 'Población reclutable', percent: true }
]

export const modifierDef = (key: string): ModifierDef | undefined =>
  MODIFIERS.find((m) => m.key === key)

/** Valor tal como va al script (porcentajes → decimal, sin decimales basura) */
export function modifierScriptValue(key: string, value: number): string {
  const def = modifierDef(key)
  const v = def?.percent ? value / 100 : value
  return String(Math.round(v * 10000) / 10000)
}
