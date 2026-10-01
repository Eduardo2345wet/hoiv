// Lista integrada corta del juego base, para cuando NO hay carpeta de HOI4 configurada.
// IMPORTANTE: solo IDs estándar del juego base (tags de países mayores y leyes,
// que en HOI4 son ideas). No se pudieron comprobar en línea desde el entorno donde
// se escribió esto (el wiki estaba bloqueado): si alguno falla, bórralo de aquí.

/** [tag, nombre en español] */
export const BUILTIN_COUNTRIES: [string, string][] = [
  ['GER', 'Alemania'],
  ['ENG', 'Reino Unido'],
  ['FRA', 'Francia'],
  ['ITA', 'Italia'],
  ['SOV', 'Unión Soviética'],
  ['USA', 'Estados Unidos'],
  ['JAP', 'Japón'],
  ['CHI', 'China Nacionalista'],
  ['PRC', 'China Comunista'],
  ['SPR', 'España'],
  ['POL', 'Polonia'],
  ['CZE', 'Checoslovaquia'],
  ['AUS', 'Austria'],
  ['HUN', 'Hungría'],
  ['ROM', 'Rumanía'],
  ['YUG', 'Yugoslavia'],
  ['TUR', 'Turquía'],
  ['MEX', 'México'],
  ['BRA', 'Brasil'],
  ['ARG', 'Argentina'],
  ['CAN', 'Canadá'],
  ['AST', 'Australia'],
  ['HOL', 'Países Bajos'],
  ['BEL', 'Bélgica'],
  ['SWE', 'Suecia']
]

/** [id, nombre en español] — leyes (en el juego son ideas y funcionan con has_idea / add_ideas) */
export const BUILTIN_IDEAS: [string, string][] = [
  ['civilian_economy', 'Economía civil'],
  ['low_economic_mobilisation', 'Movilización económica baja'],
  ['partial_economic_mobilisation', 'Movilización económica parcial'],
  ['war_economy', 'Economía de guerra'],
  ['tot_economic_mobilisation', 'Movilización económica total'],
  ['isolation', 'Aislamiento'],
  ['closed_economy', 'Economía cerrada'],
  ['limited_exports', 'Exportaciones limitadas'],
  ['free_trade', 'Libre comercio'],
  ['export_focus', 'Enfoque exportador'],
  ['disarmed_nation', 'Nación desarmada'],
  ['volunteer_only', 'Solo voluntarios'],
  ['limited_conscription', 'Reclutamiento limitado'],
  ['extensive_conscription', 'Reclutamiento extensivo'],
  ['service_by_requirement', 'Servicio obligatorio'],
  ['all_adults_serve', 'Todos los adultos sirven'],
  ['scraping_the_barrel', 'Rascando el fondo del barril']
]
