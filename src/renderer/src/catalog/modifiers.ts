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

/**
 * Nombres en español de modificadores frecuentes del juego (para listas y resúmenes).
 * percent = el juego guarda una fracción (0.1 = 10 %). por verificar con modifiers del juego.
 */
export const MODIFIER_NAMES: Record<string, { label: string; percent: boolean }> = {
  stability_factor: { label: 'Estabilidad', percent: true },
  stability_weekly: { label: 'Estabilidad semanal', percent: true },
  war_support_factor: { label: 'Apoyo a la guerra', percent: true },
  war_support_weekly: { label: 'Apoyo a la guerra semanal', percent: true },
  political_power_gain: { label: 'Poder político diario', percent: false },
  political_power_factor: { label: 'Poder político', percent: true },
  consumer_goods_factor: { label: 'Bienes de consumo', percent: true },
  industrial_capacity_factory: { label: 'Producción de fábricas', percent: true },
  industrial_capacity_dockyard: { label: 'Producción de astilleros', percent: true },
  production_speed_buildings_factor: { label: 'Velocidad de construcción', percent: true },
  production_speed_industrial_complex_factor: {
    label: 'Velocidad de fábricas civiles',
    percent: true
  },
  production_speed_arms_factory_factor: { label: 'Velocidad de fábricas militares', percent: true },
  production_speed_infrastructure_factor: { label: 'Velocidad de infraestructura', percent: true },
  research_speed_factor: { label: 'Velocidad de investigación', percent: true },
  army_attack_factor: { label: 'Ataque del ejército', percent: true },
  army_defence_factor: { label: 'Defensa del ejército', percent: true },
  army_core_attack_factor: { label: 'Ataque en territorio propio', percent: true },
  army_core_defence_factor: { label: 'Defensa en territorio propio', percent: true },
  army_speed_factor: { label: 'Velocidad del ejército', percent: true },
  army_org_factor: { label: 'Organización del ejército', percent: true },
  army_morale_factor: { label: 'Moral del ejército', percent: true },
  navy_speed_factor: { label: 'Velocidad de la armada', percent: true },
  navy_org_factor: { label: 'Organización de la armada', percent: true },
  air_attack_factor: { label: 'Ataque aéreo', percent: true },
  air_defence_factor: { label: 'Defensa aérea', percent: true },
  conscription_factor: { label: 'Población reclutable', percent: true },
  conscription: { label: 'Población reclutable', percent: true },
  mobilization_speed: { label: 'Velocidad de movilización', percent: true },
  training_time_factor: { label: 'Tiempo de entrenamiento', percent: true },
  supply_consumption_factor: { label: 'Consumo de suministros', percent: true },
  max_command_power: { label: 'Poder de mando máximo', percent: false },
  command_power_gain: { label: 'Poder de mando diario', percent: false },
  command_power_gain_mult: { label: 'Poder de mando', percent: true },
  experience_gain_army_factor: { label: 'Experiencia del ejército', percent: true },
  experience_gain_navy_factor: { label: 'Experiencia de la armada', percent: true },
  experience_gain_air_factor: { label: 'Experiencia de la fuerza aérea', percent: true },
  industrial_capacity_factor: { label: 'Capacidad industrial', percent: true },
  local_resources_factor: { label: 'Recursos locales', percent: true },
  trade_opinion_factor: { label: 'Opinión comercial', percent: true },
  opinion_gain_monthly_factor: { label: 'Mejora de relaciones', percent: true },
  surrender_limit: { label: 'Límite de rendición', percent: true },
  fuel_gain: { label: 'Combustible diario', percent: false },
  fuel_gain_factor: { label: 'Combustible', percent: true },
  generate_wargoal_tension: { label: 'Tensión para justificar guerras', percent: true },
  justify_war_goal_time: { label: 'Tiempo para justificar guerras', percent: true },
  civilian_intel_to_others: { label: 'Inteligencia civil hacia otros', percent: true },
  non_core_manpower: { label: 'Población fuera del núcleo', percent: true },
  monthly_population: { label: 'Crecimiento de población', percent: true },
  repair_speed_factor: { label: 'Velocidad de reparación', percent: true },
  industry_free_repair_factor: { label: 'Reparación gratuita', percent: true },
  line_change_production_efficiency_factor: {
    label: 'Cambio de línea de producción',
    percent: true
  },
  production_factory_max_efficiency_factor: {
    label: 'Eficiencia máxima de fábricas',
    percent: true
  },
  production_factory_efficiency_gain_factor: { label: 'Eficiencia de fábricas', percent: true },
  encryption_factor: { label: 'Cifrado', percent: true },
  decryption_factor: { label: 'Descifrado', percent: true },
  drift_defence_factor: { label: 'Resistencia a los golpes de estado', percent: true },
  democratic_drift: { label: 'Deriva democrática', percent: true },
  fascism_drift: { label: 'Deriva fascista', percent: true },
  communism_drift: { label: 'Deriva comunista', percent: true },
  neutrality_drift: { label: 'Deriva neutral', percent: true },
  democratic_acceptance: { label: 'Aceptación de la democracia', percent: false },
  fascism_acceptance: { label: 'Aceptación del fascismo', percent: false },
  communism_acceptance: { label: 'Aceptación del comunismo', percent: false }
}

/** Nombre en español de un modificador; null si no está en la lista (se muestra "Otro modificador") */
export const modifierLabel = (key: string): string | null =>
  MODIFIER_NAMES[key]?.label ?? modifierDef(key)?.label ?? null

/** "Estabilidad +10 %" a partir de una clave y su valor TAL COMO LO ESCRIBE EL JUEGO (0.1 = 10 %) */
export function describeGameModifier(key: string, value: number): string | null {
  const d = MODIFIER_NAMES[key]
  if (!d) return null
  const v = d.percent ? Math.round(value * 100 * 100) / 100 : Math.round(value * 100) / 100
  return `${d.label} ${v > 0 ? '+' : ''}${v}${d.percent ? ' %' : ''}`
}
