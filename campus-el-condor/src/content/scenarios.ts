import type { Scenario } from './types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'c1',
    title: 'Llegada en hora pico',
    moduleId: 'm2',
    context: 'Es media tarde y el salón está casi completo.',
    steps: [{
      id: 's1',
      situation: 'Estás terminando de registrar un pedido en una mesa y entra una pareja. Nadie más del equipo los vio todavía.',
      prompt: '¿Qué hacés?',
      choices: [
        { id: 'a', text: 'Hacés contacto visual, los saludás y les decís que en un momento los ubicás; al terminar el registro, avisás a tu compañero o los atendés.', quality: 'best', feedback: 'Reconociste la llegada sin abandonar la tarea a medias y coordinaste la continuidad. La pareja sabe que fue vista y qué va a pasar.' },
        { id: 'b', text: 'Terminás de registrar el pedido sin levantar la vista y después vas a recibirlos.', quality: 'partial', feedback: 'Terminar el registro está bien, pero sin un saludo la pareja no sabe si alguien la vio. Un gesto breve evita que se sientan ignorados.' },
        { id: 'c', text: 'Dejás el pedido a medias y vas a ubicarlos enseguida.', quality: 'poor', feedback: 'Recibís bien a la pareja, pero el pedido inconcluso puede perderse o registrarse mal. Un reconocimiento breve permite atender a los dos.' },
      ],
    }],
    expected: 'Reconocer su llegada y orientar cómo será atendida, coordinando con el equipo.',
    explanation: 'Una recepción breve puede brindar orientación sin abandonar desordenadamente la tarea en curso.',
    resolved: 'La pareja fue reconocida y orientada, y el pedido en curso se completó sin errores.',
    stillToCheck: ['Cómo se distribuyen las mesas entre el equipo en este turno.', 'Si recepción tiene un procedimiento de lista de espera.'],
  },
  {
    id: 'c2',
    title: 'Ingrediente sin confirmar',
    moduleId: 'm4',
    context: 'Una clienta mira la vitrina y pregunta por una torta.',
    steps: [{
      id: 's1',
      situation: 'Te pregunta si una torta contiene un alérgeno que ella no puede consumir. La ficha del producto no lo aclara.',
      prompt: '¿Cómo respondés?',
      choices: [
        { id: 'a', text: 'Le decís que, por lo que se ve, no lo tiene.', quality: 'poor', feedback: 'La apariencia no acredita composición ni ausencia de contaminación cruzada. Una suposición puede poner en riesgo su salud.' },
        { id: 'b', text: 'Le explicás que la ficha no tiene ese dato, consultás la información técnica y a quien prepara, y le confirmás antes de que decida.', quality: 'best', feedback: 'Fuiste transparente con lo que no sabés y buscaste la fuente correcta antes de que ella decida.' },
        { id: 'c', text: 'Le recomendás otra torta que te parece más segura.', quality: 'partial', feedback: 'Ofrecer alternativas está bien, pero la otra torta tampoco tiene un dato verificado. Primero hay que consultar.' },
      ],
    }],
    expected: 'Consultar la información técnica y al responsable de preparación.',
    explanation: 'El nombre o la apariencia no acreditan composición ni ausencia de contaminación cruzada.',
    resolved: 'La clienta recibió una respuesta honesta y la consulta se derivó a quien conoce la elaboración.',
    stillToCheck: ['Fichas técnicas con ingredientes y alérgenos de cada producto.', 'Procedimiento de El Cóndor ante consultas por alergias.'],
  },
  {
    id: 'c3',
    title: 'Pedido demorado',
    moduleId: 'm3',
    context: 'Una mesa pidió un tostado hace un rato.',
    steps: [{
      id: 's1',
      situation: 'Te preguntan por la comida y no sabés en qué estado está.',
      prompt: '¿Qué hacés?',
      choices: [
        { id: 'a', text: 'Les decís que sale en cinco minutos.', quality: 'poor', feedback: 'Prometer un tiempo que nadie confirmó genera una nueva expectativa que probablemente no se cumpla.' },
        { id: 'b', text: 'Les decís que cocina está con mucho trabajo.', quality: 'partial', feedback: 'Es una explicación, pero no informa nada concreto sobre su pedido ni muestra que alguien se esté ocupando.' },
        { id: 'c', text: 'Consultás en cocina, volvés con información real y, si hay un problema, avisás a tu referente.', quality: 'best', feedback: 'Verificaste antes de responder y comunicaste un dato real. Si el problema excede tu función, lo coordinás.' },
      ],
    }],
    expected: 'Verificar con cocina, comunicar información real y coordinar ayuda si hace falta.',
    explanation: 'Prometer una demora inventada dificulta resolver el problema.',
    resolved: 'La mesa recibió información real y el equipo supo que había una demora.',
    stillToCheck: ['Metas de tiempo propias de El Cóndor, si se definen.', 'A quién se avisa cuando una demora requiere una solución.'],
  },
  {
    id: 'c4',
    title: 'Producto diferente',
    moduleId: 'm5',
    context: 'Estás por llevar una bandeja desde la barra.',
    steps: [{
      id: 's1',
      situation: 'Antes de servir, detectás que una de las bebidas no tiene la variante que figura en la comanda.',
      prompt: '¿Qué hacés?',
      choices: [
        { id: 'a', text: 'La llevás igual y, si la mesa reclama, la cambiás.', quality: 'poor', feedback: 'Trasladás al cliente un error que ya habías detectado. Eso suma demora y una mala experiencia.' },
        { id: 'b', text: 'Detenés esa entrega, avisás a barra para corregirla y llevás el resto si corresponde.', quality: 'best', feedback: 'Revisar antes de servir funcionó: el error se corrige antes de llegar a la mesa.' },
        { id: 'c', text: 'Le preguntás a la mesa si le molesta recibirla así.', quality: 'partial', feedback: 'Es respetuoso consultar, pero el error es del circuito: lo esperable es corregirlo antes de entregar.' },
      ],
    }],
    expected: 'Detener esa entrega y coordinar la corrección.',
    explanation: 'Revisar antes de servir evita trasladar un error identificado al cliente.',
    resolved: 'La bebida se corrigió antes de llegar a la mesa.',
    stillToCheck: ['Si la comanda o la preparación tuvo el error, para corregir el circuito.', 'Cómo se registra el producto descartado.'],
  },
  {
    id: 'c5',
    title: 'Beneficio con condiciones',
    moduleId: 'm9',
    context: 'Una mesa pide la cuenta y quiere pagar con un medio que, según dice, tiene un beneficio.',
    steps: [{
      id: 's1',
      situation: 'El cliente espera un descuento inmediato, pero la fuente cargada en el campus indica que es un reintegro posterior de la entidad.',
      prompt: '¿Cómo seguís?',
      choices: [
        { id: 'a', text: 'Le aplicás el porcentaje en la cuenta para evitar una discusión.', quality: 'poor', feedback: 'Modificar el cobro sin autorización cambia lo que el local percibe y no corresponde al mecanismo del beneficio.' },
        { id: 'b', text: 'Le decís que no hay ningún beneficio.', quality: 'partial', feedback: 'El beneficio puede existir: lo que cambia es el mecanismo. Conviene explicarlo, no negarlo.' },
        { id: 'c', text: 'Le explicás que, según la fuente, es un reintegro posterior, verificás las condiciones antes de cobrar y, si hay dudas, consultás al responsable.', quality: 'best', feedback: 'Aclaraste el mecanismo y verificaste antes de cobrar, sin prometer un importe que depende de la entidad.' },
      ],
    }],
    expected: 'Aclarar el mecanismo y verificar condiciones antes de cobrar.',
    explanation: 'Un reintegro posterior no modifica necesariamente el importe cobrado por el local.',
    resolved: 'El cliente entendió el mecanismo antes de pagar.',
    stillToCheck: ['Promociones verificadas de El Cóndor y su fuente.', 'Tope disponible del cliente, que el local no conoce.'],
  },
  {
    id: 'c6',
    title: 'Corrección incompleta',
    moduleId: 'm5',
    context: 'Una mesa canceló un producto hace unos minutos.',
    steps: [{
      id: 's1',
      situation: 'La cancelación se comentó en voz alta en la barra, pero el producto sigue figurando en la comanda.',
      prompt: '¿Qué hacés?',
      choices: [
        { id: 'a', text: 'Nada: ya se avisó de palabra.', quality: 'poor', feedback: 'La comunicación verbal sola no asegura que preparación y cobro tengan el mismo dato.' },
        { id: 'b', text: 'Aplicás el circuito de corrección y avisás a los sectores involucrados, incluida caja.', quality: 'best', feedback: 'El registro y el aviso a cada sector aseguran que nadie prepare ni cobre algo cancelado.' },
        { id: 'c', text: 'Se lo recordás al cliente al traer la cuenta.', quality: 'partial', feedback: 'Detectarlo al final evita un cobro erróneo, pero el producto pudo prepararse igual. Corregir a tiempo es mejor.' },
      ],
    }],
    expected: 'Aplicar el circuito de corrección y avisar a los sectores involucrados.',
    explanation: 'La comunicación verbal por sí sola no asegura que preparación y cobro tengan el mismo dato.',
    resolved: 'La comanda quedó corregida y cada sector tiene el mismo dato.',
    stillToCheck: ['Procedimiento de corrección o anulación en el sistema de El Cóndor.', 'Quién autoriza las anulaciones.'],
  },
  {
    id: 'sim-mesa',
    title: 'Simulador: una mesa completa',
    moduleId: 'm3',
    context: 'Seguí a una mesa de dos personas desde que llega hasta que pide la cuenta.',
    steps: [
      {
        id: 's1',
        situation: 'Llegan dos personas. Hay una mesa libre, pero todavía tiene vajilla de la visita anterior.',
        prompt: '¿Qué hacés primero?',
        choices: [
          { id: 'a', text: 'Los saludás, les indicás que en un momento la mesa queda lista y la preparás enseguida.', quality: 'best', feedback: 'Reconociste la llegada y resolviste la preparación pendiente con una indicación clara.' },
          { id: 'b', text: 'Los hacés sentar y retirás la vajilla mientras están sentados.', quality: 'partial', feedback: 'Se resuelve, pero la primera impresión es una mesa sin preparar. Mejor avisar y prepararla antes.' },
          { id: 'c', text: 'Les decís que no hay mesas.', quality: 'poor', feedback: 'Hay una mesa disponible: solo falta prepararla. Perdés una visita por una tarea pendiente.' },
        ],
      },
      {
        id: 's2',
        situation: 'Piden “dos cafés”. Uno de ellos agrega “el mío cortado”.',
        prompt: '¿Cómo registrás el pedido?',
        choices: [
          { id: 'a', text: 'Anotás “2 cafés”.', quality: 'poor', feedback: 'Barra no puede saber que uno es cortado. El error llega a la mesa.' },
          { id: 'b', text: 'Confirmás en voz alta: “un café y un cortado”, preguntás si quieren algo para acompañar y registrás lo aceptado.', quality: 'best', feedback: 'Confirmaste las variantes, ofreciste una sugerencia pertinente y registraste lo que aceptaron.' },
          { id: 'c', text: 'Anotás “café + cortado” y se lo decís a barra de palabra para asegurarte.', quality: 'partial', feedback: 'El registro está bien. El aviso verbal no hace daño, pero no reemplaza confirmar con la mesa.' },
        ],
      },
      {
        id: 's3',
        situation: 'Pasa un rato. El café salió, pero la medialuna que agregaron no llegó y la mesa mira hacia la barra.',
        prompt: '¿Qué hacés?',
        choices: [
          { id: 'a', text: 'Consultás el estado, vas a la mesa con información real y avisás si necesitás ayuda.', quality: 'best', feedback: 'Detectaste la demora antes de que te llamen y comunicaste un dato real.' },
          { id: 'b', text: 'Les decís que ya sale, sin consultar.', quality: 'poor', feedback: 'Si no sale, la segunda promesa incumplida pesa más que la demora.' },
          { id: 'c', text: 'Esperás a que te pregunten para no molestar.', quality: 'partial', feedback: 'La mesa ya está dando señales. Adelantarte muestra que el equipo está atento.' },
        ],
      },
      {
        id: 's4',
        situation: 'Piden la cuenta y preguntan si hay algún beneficio con su medio de pago.',
        prompt: '¿Qué respondés?',
        choices: [
          { id: 'a', text: 'Les decís que hay un descuento del porcentaje que suele haber.', quality: 'poor', feedback: 'Un beneficio no confirmado puede generar un reclamo al momento de pagar.' },
          { id: 'b', text: 'Verificás la cuenta, consultás las promociones confirmadas del local y explicás las condiciones antes de cobrar.', quality: 'best', feedback: 'Cobro claro: lo consumido verificado y condiciones explicadas con información confirmada.' },
          { id: 'c', text: 'Les decís que pregunten en caja.', quality: 'partial', feedback: 'Puede ser parte del circuito, pero conviene verificar o acompañar la consulta para que no quede en el aire.' },
        ],
      },
    ],
    expected: 'Preparar la mesa antes de ubicar, confirmar variantes, comunicar demoras con datos reales y explicar condiciones confirmadas antes de cobrar.',
    explanation: 'Cada estación del recorrido tiene una acción que previene problemas en la siguiente.',
    resolved: 'La mesa transitó llegada, pedido, demora y cuenta con información clara en cada paso.',
    stillToCheck: ['Metas de tiempo propias, si se definen.', 'Promociones verificadas de El Cóndor.'],
  },
];

export const SCENARIO_BY_ID: Record<string, Scenario> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
export const CASE_IDS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
