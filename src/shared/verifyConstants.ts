// Constantes por verificar en los archivos del juego o la wiki de HOI4

export const VERIFY_CONSTANTS = {
  // por verificar: lista completa de categorías de estado válidas en HOI4
  STATE_CATEGORIES: [
    'wasteland',
    'enclave',
    'tiny_island',
    'small_island',
    'pastoral',
    'rural',
    'town',
    'large_town',
    'city',
    'large_city',
    'metropolis',
    'megalopolis'
  ],
  // por verificar: orden de precedencia entre add_core_of y claim en el archivo history/states/
  HISTORY_CORE_PRECEDENCE: 'add_core_of sobreescribe claims en inicio de partida',
  // por verificar: compresión no comprimida ARGB 32-bit en DDS de líderes
  DDS_UNCOMPRESSED_FORMAT: 'A8R8G8B8'
} as const
