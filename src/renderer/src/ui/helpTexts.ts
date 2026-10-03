// TODOS los textos de ayuda ("?") de la aplicación, en un solo archivo: fáciles de editar y traducir.
// Cada ayuda explica qué hace (1 o 2 frases), da un ejemplo y, si aplica, cómo se ve en el juego.
export interface HelpEntry {
  title: string
  what: string
  example?: string
  ingame?: string
}

export const HELP: Record<string, HelpEntry> = {
  // ---- Eventos
  'evento.grupo': {
    title: 'Grupo de eventos',
    what: 'Los eventos se guardan por grupos. Un grupo reúne los eventos de una misma historia o tema.',
    example: 'Guerra civil de México: el aviso, el estallido y el desenlace.'
  },
  'evento.activacion': {
    title: 'Cómo se activa',
    what: 'Puede ocurrir solo cuando otro elemento lo lance (un foco, una decisión u otro evento), o por su cuenta cuando se cumplan las condiciones que pongas.',
    example:
      'Lanzado por un foco: aparece justo al terminar el foco. Por condiciones: aparece cuando el país está en guerra.'
  },
  'evento.unaVez': {
    title: 'Una sola vez en la partida',
    what: 'Después de ocurrir, el evento no vuelve a aparecer en toda la partida.',
    example: 'Útil para un descubrimiento o una crisis que solo pasa una vez.'
  },
  'evento.noticia': {
    title: 'Para todos los países (noticia)',
    what: 'Una noticia mundial se muestra a todos los jugadores como un titular, no solo al país afectado.',
    ingame: 'Aparece en la esquina como un recuadro de noticias que todos pueden abrir.'
  },
  'evento.oculto': {
    title: 'Oculto',
    what: 'El evento no muestra ninguna ventana: ejecuta sus efectos en silencio.',
    example: 'Dar una marca al país o lanzar otro evento unos días después.'
  },
  'evento.tiempoPromedio': {
    title: 'Tiempo promedio para que ocurra',
    what: 'Cuántos días tarda, en promedio, en ocurrir una vez que se cumplen las condiciones. El juego lo tira al azar alrededor de ese valor.',
    example: '30 días: suele pasar al cabo de un mes, a veces antes y a veces después.'
  },
  'evento.tiempoResponder': {
    title: 'Tiempo para responder',
    what: 'Días que el jugador tiene para elegir una opción antes de que el juego elija por él. Si lo dejas vacío, se usa el valor normal del juego.',
    example: '7 días: la ventana se cierra sola a la semana.'
  },
  // ---- Súper eventos
  'super.que': {
    title: 'Súper evento',
    what: 'Una ventana grande, con imagen, cita y sonido, para momentos importantes. A diferencia de un evento normal, no ofrece opciones: solo un botón para continuar.',
    example: 'La caída de un gobierno o el inicio de una guerra mundial.'
  },
  'super.sonido': {
    title: 'Sonido (.wav)',
    what: 'Un efecto de sonido que suena al abrirse la ventana. Debe ser un archivo .wav sin comprimir.',
    example: 'Un redoble de tambores o una sirena.'
  },
  // ---- Decisiones
  'decision.categoria': {
    title: 'Categoría',
    what: 'En el juego, cada decisión vive dentro de una categoría, que es una pestaña de la pantalla de decisiones.',
    example: 'Política exterior, Economía, Reformas militares.',
    ingame: 'Las decisiones de la misma categoría aparecen juntas bajo su imagen.'
  },
  'decision.mision': {
    title: 'Misión (con cuenta regresiva)',
    what: 'Una misión se activa y tiene un tiempo límite. Si lo cumples a tiempo recibes la recompensa; si se acaba el tiempo, ocurre otra cosa.',
    ingame: 'Se muestra con un reloj que cuenta los días que quedan.'
  },
  'decision.contraPaises': {
    title: 'Decisión contra otros países',
    what: 'Se puede tomar contra uno o varios países concretos, y cada uno aparece como una entrada propia.',
    example: 'Exigir un territorio a un vecino.'
  },
  'decision.sobreEstados': {
    title: 'Decisión sobre estados',
    what: 'Se toma sobre uno o varios estados del mapa; al abrir la categoría se resaltan en el mapa.',
    example: 'Reconstruir un estado dañado.'
  },
  'decision.costoPP': {
    title: 'Costo en poder político',
    what: 'El poder político que se gasta al tomar la decisión. Con 0, la decisión es gratuita.',
    example: '50: hay que tener al menos 50 de poder político.'
  },
  // ---- Países
  'pais.banderasIdeologia': {
    title: 'Banderas por ideología',
    what: 'El juego muestra una bandera distinta según la ideología que gobierne el país. Si no subes una, usa la bandera principal.',
    example: 'Una bandera para cuando gobierna el comunismo y otra para la democracia.'
  },
  'pais.articulo': {
    title: 'Nombre con artículo',
    what: 'Cómo se escribe el nombre cuando va dentro de una frase. En español suele llevar artículo.',
    example: 'Nombre: México. Con artículo: el México republicano.'
  },
  'pais.tag': {
    title: 'Tag',
    what: 'Un código de 3 letras o números que identifica al país en el juego. Debe ser único.',
    example: 'MEX para México.'
  },
  // ---- Mapa
  'mapa.cores': {
    title: 'Cores',
    what: 'Un país tiene un core en un estado cuando lo considera propio. Sirve para reclamarlo y para que no haya penalizaciones al poseerlo.',
    ingame: 'Se ve como un borde del color del país sobre el estado.'
  },
  'mapa.sinNacion': {
    title: 'Sin nación',
    what: 'Un modo en el que todos los estados que no pintes quedan sin dueño, como terreno vacío.',
    example: 'Útil para crear un mapa casi vacío y repartirlo tú.'
  },
  'mapa.capital': {
    title: 'Capital',
    what: 'El estado donde el país tiene su gobierno. Debe ser un estado que el país posea.',
    ingame: 'Ahí aparece la estrella en el mapa.'
  },
  // ---- Focos
  'foco.saltarSi': {
    title: 'Saltar si',
    what: 'Condición para que el foco se considere hecho sin gastar tiempo, porque ya se logró de otra forma.',
    example: 'Saltar si el país ya posee ese estado.'
  },
  'foco.excluyente': {
    title: 'Excluyente',
    what: 'Dos focos excluyentes no se pueden elegir los dos: al tomar uno, el otro se bloquea.',
    ingame: 'Se unen con una línea roja.'
  },
  'foco.prerrequisito': {
    title: 'Prerrequisito',
    what: 'Un foco que debe estar completo antes. Si pones varios en un mismo grupo, basta con uno; si los pones por separado, hacen falta todos.',
    ingame: 'Se unen con una línea hacia el foco que depende de ellos.'
  },
  // ---- Ejército
  'ejercito.plantilla': {
    title: 'Plantilla de división',
    what: 'El diseño de una división: qué batallones lleva y cómo se colocan. Después colocas divisiones en el mapa usando una plantilla.',
    ingame: 'Es lo que ves en la pantalla de diseño de divisiones.'
  },
  'ejercito.linea': {
    title: 'Batallones de línea',
    what: 'Los batallones que combaten: infantería, blindados, artillería… Se colocan en la cuadrícula de 5×5.',
    example: 'Cinco batallones de infantería forman una división básica.'
  },
  'ejercito.apoyo': {
    title: 'Compañías de apoyo',
    what: 'Pequeñas unidades que dan ventajas a la división (ingenieros, reconocimiento, hospital…). Van en una columna aparte.',
    example: 'Una compañía de ingenieros ayuda a cruzar ríos.'
  },
  // ---- Tecnologías e ideologías
  'tech.subideologia': {
    title: 'Subideología',
    what: 'Una variante dentro de una de las cuatro grandes ideologías del juego: democracia, comunismo, fascismo o no alineado.',
    example: 'Una socialdemocracia dentro del grupo de la democracia.',
    ingame: 'Aparece con su nombre y color en la ventana de gobierno.'
  },
  'tech.modoAvanzado': {
    title: 'Modo avanzado',
    what: 'Permite crear tecnologías nuevas. Para enlazarlas, la aplicación modifica con cuidado archivos de tecnología del juego.',
    example: 'Si algo sale mal, desactívalo y exporta de nuevo: tu copia del juego nunca se toca.'
  }
}
