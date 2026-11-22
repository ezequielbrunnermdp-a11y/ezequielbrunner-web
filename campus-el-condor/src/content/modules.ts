import type { Module } from './types';
import { proposedMeta } from './meta';

/* Contenido pedagógico original. Ninguna regla aquí es política aprobada de El Cóndor:
   cada módulo se publica en el campus con approvalStatus "sin-aprobar". */

export const MODULES: Module[] = [
  {
    id: 'm1',
    number: 1,
    title: 'Tu primer día',
    short: 'Ubicarte, conocer el circuito y saber a quién consultar.',
    objective: 'Conocer el recorrido y saber a quién consultar.',
    intro:
      'Bienvenido a El Cóndor. Durante los primeros días vas a conocer personas, productos y formas de trabajar. No necesitás resolver todo de memoria: necesitás saber dónde consultar, escuchar las indicaciones del turno y pedir ayuda cuando algo no esté claro. Este campus te acompaña para que puedas aprender de a poco y aplicar cada tema en situaciones concretas.',
    lessons: [
      {
        id: 'm1-l1',
        title: 'Ubicarse antes de actuar',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Al comenzar, identificá a la persona responsable del turno, tu sector y las tareas asignadas. Preguntá dónde se consultan las novedades, los faltantes y los pedidos especiales. Conocer el circuito evita improvisaciones y facilita la coordinación.' },
          { type: 'list', items: [
            '¿Quién es mi referente en este turno y cómo lo ubico si está ocupado?',
            '¿Qué tareas tengo asignadas y en qué orden conviene hacerlas?',
            '¿Dónde se informan las novedades: faltantes, cambios de carta, reservas, pedidos especiales?',
            '¿Qué materiales puedo consultar si tengo una duda sobre un producto o un procedimiento?',
          ] },
          { type: 'example', title: 'Práctica', text: 'Llegás a tu primer turno y el salón ya tiene movimiento. En lugar de empezar a levantar vajilla por iniciativa propia, te presentás con quien coordina: “Hola, soy nuevo en salón. ¿Con quién me organizo hoy y qué querés que haga primero?”. En un minuto sabés qué hacer y a quién recurrir.' },
          { type: 'callout', tone: 'info', title: 'Una buena primera pregunta', text: 'Preguntar no es una señal de inexperiencia: es la forma más rápida de evitar un error que después hay que corregir entre varios.' },
        ],
      },
      {
        id: 'm1-l2',
        title: 'Una experiencia compartida',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Lo que vive un cliente depende de varias personas. Un pedido bien tomado ayuda a barra y cocina; una entrega revisada evita devoluciones; una mesa preparada permite recibir mejor a quien llega. Cada tarea influye en la siguiente.' },
          { type: 'stations', items: [
            { title: 'Recepción', text: 'Orienta la llegada y distribuye la atención del salón.' },
            { title: 'Salón', text: 'Toma el pedido, entrega, acompaña la mesa y gestiona la cuenta.' },
            { title: 'Barra', text: 'Prepara bebidas y cafetería a partir de lo que llega registrado.' },
            { title: 'Cocina', text: 'Elabora a partir de la comanda y de las fichas de cada producto.' },
            { title: 'Caja y encargados', text: 'Cobran lo registrado, autorizan excepciones y resuelven lo que excede a cada puesto.' },
          ] },
          { type: 'example', title: 'Práctica', text: 'Si en el salón se anota “cortado” sin aclarar que era en jarrito, barra prepara el formato habitual, la mesa lo devuelve y caja termina cobrando algo distinto de lo que se sirvió. Un dato que faltó al principio se convierte en tres problemas.' },
        ],
      },
      {
        id: 'm1-l3',
        title: 'Valores para trabajar juntos',
        minutes: 2,
        blocks: [
          { type: 'callout', tone: 'pending', title: 'Contenido propuesto', text: 'Estos valores son una propuesta pedagógica para conversar en el equipo. No constituyen una declaración institucional de El Cóndor mientras la empresa no la confirme.' },
          { type: 'list', items: [
            'Trato respetuoso: con clientes, compañeros y proveedores, también en los momentos de más presión.',
            'Responsabilidad: cumplir lo que se comunica y avisar a tiempo cuando no se puede.',
            'Cuidado del producto: respetar cómo se prepara, conserva y presenta cada elaboración.',
            'Colaboración: compartir información y dar una mano cuando otro sector la necesita.',
            'Disposición para aprender: consultar, aceptar devoluciones y volver a practicar.',
          ] },
        ],
      },
    ],
    exercises: [
      { kind: 'checklist', id: 'm1-x1', title: 'Checklist de orientación' },
      { kind: 'flashcards', id: 'm1-x2', title: 'Tarjetas de repaso', cards: [
        { front: '¿Qué tres datos conviene tener claros al empezar un turno?', back: 'Quién es tu referente, cuáles son tus tareas y dónde se informan las novedades.' },
        { front: '¿Qué hacés si una indicación no quedó clara?', back: 'Pedís una aclaración antes de actuar. Ejecutar algo dudoso suele generar más trabajo después.' },
        { front: '¿Por qué un error de pedido afecta a cocina y caja?', back: 'Porque pedido, preparación, entrega y cobro son un mismo circuito: lo que falta al principio se arrastra hasta el final.' },
      ] },
    ],
    synthesis: [
      'Antes de actuar, ubicá a tu referente, tu sector y tus tareas.',
      'Las novedades del turno tienen un canal: preguntá cuál es.',
      'Cada tarea condiciona a la siguiente; un dato bien tomado ayuda a todo el equipo.',
    ],
    closing: 'Saber consultar es parte de trabajar bien.',
    meta: proposedMeta(),
  },
  {
    id: 'm2',
    number: 2,
    title: 'Cinco momentos para cuidar la atención',
    short: 'Recibir, escuchar, entregar, acompañar y cerrar.',
    objective: 'Conectar las acciones del equipo con la experiencia de la mesa.',
    intro:
      'La atención no se resume en tomar un pedido. Desde que una persona entra hasta que se va, atraviesa momentos distintos, y en cada uno necesita algo diferente de nosotros. Este módulo los ordena en cinco momentos para que puedas reconocer qué conviene hacer y qué conviene evitar.',
    lessons: [
      {
        id: 'm2-l1',
        title: 'Los cinco momentos',
        minutes: 6,
        blocks: [
          { type: 'p', text: 'Desplegá cada momento para ver la conducta útil, un error frecuente, un ejemplo y una pregunta para pensar en tu propio turno.' },
          { type: 'moments', items: [
            {
              title: 'Recibir y orientar',
              summary: 'Registrá la llegada con un saludo claro, una actitud disponible y una indicación concreta. Si estás terminando otra tarea, reconocé a la persona y explicá cómo será atendida. Evitá que tenga que adivinar dónde ubicarse o a quién pedir ayuda.',
              useful: 'Hacer contacto visual, saludar y dar una indicación concreta aunque estés ocupado.',
              mistake: 'Seguir con la tarea sin mirar a quien entró, o decir “ya va” sin aclarar qué va a pasar.',
              example: '“Buenas tardes, bienvenidos. ¿Buscan una mesa para dos? Les preparo aquella junto a la ventana y enseguida los atiendo.”',
              question: 'Si estás cobrando y entra alguien, ¿qué frase breve podés decir para que sepa que lo viste?',
            },
            {
              title: 'Escuchar y recomendar',
              summary: 'Antes de sugerir, averiguá qué busca. Prestá atención al tiempo disponible, las preferencias y las dudas. Ofrecé una alternativa que puedas describir con información comprobada. Una buena recomendación resuelve una necesidad y respeta la decisión del cliente.',
              useful: 'Preguntar primero, escuchar la respuesta y sugerir algo que puedas describir con datos confirmados.',
              mistake: 'Recomendar siempre lo mismo, insistir después de un “no, gracias” o describir un producto con datos que no verificaste.',
              example: '“¿Preferís algo más liviano o tenías ganas de algo dulce?”',
              question: '¿Qué dato necesitarías confirmar antes de recomendar un producto que todavía no probaste?',
            },
            {
              title: 'Confirmar y entregar con cuidado',
              summary: 'Repetí lo necesario para evitar errores de pedido. Antes de llevar un producto, verificá identificación, presentación y correspondencia con la comanda. Si detectás un problema, resolvelo con el sector responsable antes de entregarlo.',
              useful: 'Confirmar en voz alta variantes y cantidades, y revisar cada producto contra la comanda antes de salir.',
              mistake: 'Llevar lo que salió de barra sin mirarlo, aunque notes que algo no coincide.',
              example: '“Te confirmo el pedido para asegurarme de haberlo tomado bien: dos cortados, uno con leche descremada, y una porción para compartir.”',
              question: '¿Qué tres cosas mirás de un producto antes de llevarlo a la mesa?',
            },
            {
              title: 'Acompañar sin interrumpir',
              summary: 'Observá la mesa y acercate cuando puedas ayudar. Consultá si está todo bien, facilitá lo que falte y retirá vajilla con criterio y permiso. Evitá conversaciones que interrumpan una reunión o una charla personal.',
              useful: 'Mirar el salón de forma periódica y acercarte en una pausa natural de la conversación.',
              mistake: 'Interrumpir para preguntar “¿todo bien?” cada pocos minutos o retirar un plato sin consultar.',
              example: '“¿Está todo como lo esperaban? Si necesitan algo, estoy cerca.”',
              question: '¿Qué señales de una mesa te indican que te necesitan sin que te llamen?',
            },
            {
              title: 'Cerrar y dejar preparado',
              summary: 'Gestioná la cuenta con claridad, escuchá cualquier observación y agradecé la visita. Después de la salida, prepará la mesa según el procedimiento del local y verificá que quede disponible para la próxima atención.',
              useful: 'Traer la cuenta sin demoras, explicar lo que corresponda y despedir con calidez.',
              mistake: 'Dejar la mesa sin preparar hasta que llega la siguiente persona, o cobrar sin escuchar un comentario.',
              example: '“Gracias por venir. Que tengan una linda tarde.”',
              question: 'Cuando se va una mesa, ¿qué pasos tenés que completar para que esté realmente lista?',
            },
          ] },
        ],
      },
      {
        id: 'm2-l2',
        title: 'Frases que ayudan',
        minutes: 2,
        blocks: [
          { type: 'p', text: 'No hace falta un guion: hacen falta frases claras que puedas adaptar a cada situación. Usalas como punto de partida y ajustalas al tono de cada mesa.' },
          { type: 'phrases', items: [
            '“Buenas tardes, bienvenidos. ¿Buscan una mesa para dos?”',
            '“Ya los vi; termino con esta mesa y enseguida estoy con ustedes.”',
            '“¿Preferís algo más liviano o tenías ganas de algo dulce?”',
            '“Te confirmo el pedido para asegurarme de haberlo tomado bien.”',
            '“¿Está todo como lo esperaban? Si necesitan algo, estoy cerca.”',
            '“Gracias por venir. Que tengan una linda tarde.”',
          ] },
          { type: 'dodont', doText: ['Usar el nombre del producto tal como figura en la carta vigente.', 'Confirmar lo que no quedó claro.', 'Mantener un tono cordial y breve.'], dontText: ['Prometer tiempos o beneficios que nadie confirmó.', 'Usar apodos o confianzas que la persona no propuso.', 'Responder “no sé” sin ofrecer averiguarlo.'] },
        ],
      },
    ],
    exercises: [
      { kind: 'order', id: 'm2-x1', title: 'Ordená los cinco momentos', instructions: 'Ordená los momentos según ocurren durante una visita. Podés usar los botones de subir y bajar o el teclado.', items: [
        { id: 'a', text: 'Recibir y orientar' },
        { id: 'b', text: 'Escuchar y recomendar' },
        { id: 'c', text: 'Confirmar y entregar con cuidado' },
        { id: 'd', text: 'Acompañar sin interrumpir' },
        { id: 'e', text: 'Cerrar y dejar preparado' },
      ], explanation: 'La visita empieza con la recepción, sigue con la escucha y el pedido, continúa con la entrega revisada y el acompañamiento, y termina con el cierre y la preparación de la mesa siguiente.' },
      { kind: 'scenario', id: 'm2-x2', title: 'Caso: llegada en hora pico', scenarioId: 'c1' },
    ],
    synthesis: [
      'Reconocé cada llegada, aunque estés ocupado.',
      'Preguntá antes de recomendar y usá información comprobada.',
      'Revisá el producto contra la comanda antes de entregarlo.',
      'Acompañá con criterio y cerrá dejando la mesa lista.',
    ],
    closing: 'No hace falta hablar todo el tiempo: hace falta estar disponibles y cumplir lo que comunicamos.',
    meta: proposedMeta(),
  },
  {
    id: 'm3',
    number: 3,
    title: 'Del ingreso a la próxima mesa',
    short: 'El recorrido operativo completo, en ocho estaciones.',
    objective: 'Entender el recorrido operativo completo.',
    intro:
      'Cada mesa recorre un circuito que empieza en la puerta y termina cuando el lugar queda listo para otra persona. Conocer sus estaciones te ayuda a anticipar lo que viene y a detectar a tiempo cuándo algo se está demorando.',
    lessons: [
      {
        id: 'm3-l1',
        title: 'Ocho estaciones de una mesa',
        minutes: 4,
        blocks: [
          { type: 'stations', items: [
            { title: 'Llegada', text: 'Reconocer al cliente y orientar la ubicación.' },
            { title: 'Pedido', text: 'Facilitar la carta, escuchar, aclarar dudas y confirmar.' },
            { title: 'Sugerencia', text: 'Ofrecer un complemento pertinente y registrar lo aceptado.' },
            { title: 'Entrega', text: 'Contrastar con la comanda y revisar antes de servir.' },
            { title: 'Seguimiento', text: 'Observar satisfacción, necesidades y demoras.' },
            { title: 'Cuenta', text: 'Atender la solicitud y verificar lo consumido.' },
            { title: 'Cobro', text: 'Confirmar importe, medio de pago y condiciones aplicables.' },
            { title: 'Preparación', text: 'Retirar, limpiar y dejar listo el lugar.' },
          ] },
          { type: 'p', text: 'Las estaciones no siempre son lineales: una mesa puede volver a pedir después del seguimiento, o pedir la cuenta mientras todavía espera un producto. Lo importante es saber en qué estación está cada mesa que atendés.' },
        ],
      },
      {
        id: 'm3-l2',
        title: 'Comunicar una demora',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Si advertís una demora, consultá el estado con el sector responsable y acercá una actualización real a la mesa. Evitá prometer minutos que nadie confirmó. Si la solución excede tu función, convocá al referente y mantené informado al cliente.' },
          { type: 'list', ordered: true, items: [
            'Detectá la demora antes de que la mesa tenga que preguntar.',
            'Consultá en cocina o barra en qué estado está el pedido.',
            'Volvé a la mesa con información concreta: qué pasa y qué se está haciendo.',
            'Si no hay solución a tu alcance, avisá a tu referente.',
            'Volvé a pasar cuando tengas una novedad.',
          ] },
          { type: 'example', title: 'Práctica', text: '“Consulté en cocina: el tostado está saliendo ahora porque hubo varios pedidos juntos. Apenas esté, te lo traigo.” Es breve, es real y no promete un tiempo que no conocés.' },
        ],
      },
      {
        id: 'm3-l3',
        title: 'Un reclamo requiere seguimiento',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Escuchá sin discutir, confirmá qué ocurrió y coordiná una solución autorizada. No prometas bonificaciones o devoluciones por cuenta propia. Volvé a la mesa para comprobar si el problema quedó resuelto.' },
          { type: 'dodont', doText: ['Escuchar hasta el final antes de responder.', 'Repetir lo que entendiste para confirmar.', 'Avisar a quien puede autorizar una solución.', 'Volver a la mesa para comprobar el resultado.'], dontText: ['Justificar el error o culpar a otro sector.', 'Ofrecer una bonificación que no podés autorizar.', 'Dar el tema por cerrado sin volver a preguntar.'] },
        ],
      },
      {
        id: 'm3-l4',
        title: 'Metas de tiempo del servicio',
        minutes: 2,
        blocks: [
          { type: 'p', text: 'Una meta de tiempo sirve si todos la miden igual: tiene que indicar desde qué momento y hasta qué momento se cuenta. Por eso cada meta tiene un hito de inicio y otro de fin.' },
          { type: 'timeGoals' },
          { type: 'callout', tone: 'pending', title: 'Metas sin definir', text: 'El Cóndor todavía no incorporó estándares de tiempo propios. Los materiales de otros comercios usan cifras propias que no se trasladan a este local. Las metas pueden cargarse desde “Gestionar contenido”.' },
        ],
      },
    ],
    exercises: [
      { kind: 'order', id: 'm3-x1', title: 'Ordená las ocho estaciones', instructions: 'Reconstruí el recorrido típico de una mesa, desde la llegada hasta la preparación para la siguiente.', items: [
        { id: 'a', text: 'Llegada' },
        { id: 'b', text: 'Pedido' },
        { id: 'c', text: 'Sugerencia' },
        { id: 'd', text: 'Entrega' },
        { id: 'e', text: 'Seguimiento' },
        { id: 'f', text: 'Cuenta' },
        { id: 'g', text: 'Cobro' },
        { id: 'h', text: 'Preparación' },
      ], explanation: 'La sugerencia se ofrece mientras se toma el pedido, para que quede registrada antes de que barra y cocina empiecen. La cuenta se verifica antes del cobro, y la mesa recién está lista cuando se completó la preparación.' },
      { kind: 'scenario', id: 'm3-x2', title: 'Simulador: una mesa completa', scenarioId: 'sim-mesa' },
      { kind: 'scenario', id: 'm3-x3', title: 'Caso: pedido demorado', scenarioId: 'c3' },
    ],
    synthesis: [
      'Ubicá en qué estación está cada mesa que atendés.',
      'Ante una demora, consultá y comunicá información real.',
      'Un reclamo se cierra cuando comprobaste que quedó resuelto.',
      'Una meta de tiempo necesita un hito de inicio y otro de fin.',
    ],
    closing: 'Una mesa termina cuando la siguiente persona puede sentarse en ella.',
    meta: proposedMeta(),
  },
  {
    id: 'm4',
    number: 4,
    title: 'Conocer lo que ofrecemos',
    short: 'Consultar productos y recomendar con información confiable.',
    objective: 'Consultar productos y recomendar con información confiable.',
    intro:
      'Recomendar bien empieza por conocer bien. En este módulo vas a ver cómo consultar una ficha de producto, qué hacer cuando un dato no está confirmado y por qué una consulta sobre alérgenos nunca se responde por suposición.',
    lessons: [
      {
        id: 'm4-l1',
        title: 'Buscar la ficha vigente',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Antes de describir un producto, buscá su ficha vigente. Identificá qué incluye, qué variantes están autorizadas y qué información necesita el cliente. Si un dato no está confirmado, consultalo.' },
          { type: 'p', text: 'Conocer el nombre de un producto no alcanza para asegurar su composición o disponibilidad.' },
          { type: 'list', items: [
            '¿Está disponible hoy?',
            '¿Qué incluye y en qué formato se sirve?',
            '¿Qué variantes están autorizadas?',
            '¿Cuál es el precio vigente?',
            '¿Hay información confirmada sobre ingredientes y alérgenos?',
          ] },
        ],
      },
      {
        id: 'm4-l2',
        title: 'Alergias y restricciones',
        minutes: 4,
        blocks: [
          { type: 'p', text: 'Si alguien informa una alergia o restricción alimentaria, revisá la información técnica y verificá con el responsable de preparación.' },
          { type: 'callout', tone: 'warning', title: 'Nunca por suposición', text: 'No garantices ausencia de un alérgeno o contaminación cruzada a partir de una suposición. Si la información no está confirmada, decilo y consultá antes de que la persona decida.' },
          { type: 'p', text: 'Una ficha puede tener la información de alérgenos en tres estados: verificada, parcial o desconocida. Una lista vacía no significa que el producto no tenga alérgenos: puede significar que nadie cargó el dato.' },
          { type: 'example', title: 'Práctica', text: '“No quiero darte un dato equivocado. Lo consulto con quien lo prepara y te confirmo antes de que lo pidas.”' },
        ],
      },
      {
        id: 'm4-l3',
        title: 'Sugerir con alternativas reales',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Una sugerencia puede comenzar preguntando si busca una infusión, algo para compartir o una opción para llevar. Presentá alternativas reales, sin exageraciones, y confirmá precios y disponibilidad.' },
          { type: 'dodont', doText: ['Ofrecer dos o tres opciones concretas.', 'Describir lo que sabés con certeza.', 'Aceptar la decisión de la persona.'], dontText: ['Decir “es lo mejor que tenemos” sin fundamento.', 'Inventar ingredientes para hacerlo más atractivo.', 'Sugerir algo que no confirmaste que esté disponible.'] },
        ],
      },
    ],
    exercises: [
      { kind: 'scenario', id: 'm4-x1', title: 'Caso: ingrediente sin confirmar', scenarioId: 'c2' },
      { kind: 'flashcards', id: 'm4-x2', title: 'Tarjetas de repaso', cards: [
        { front: '¿Una lista de alérgenos vacía significa “sin alérgenos”?', back: 'No. Puede significar que el dato no fue cargado. Ausencia de información no equivale a ausencia del alérgeno.' },
        { front: '¿Qué consultás antes de recomendar una variante?', back: 'Que esté disponible y autorizada, qué incluye y qué información necesita el cliente.' },
        { front: '¿Cómo empezás una sugerencia?', back: 'Preguntando qué busca la persona: una infusión, algo para compartir, una opción para llevar.' },
      ] },
    ],
    synthesis: [
      'El nombre de un producto no acredita su composición.',
      'Ante una alergia, consultá la ficha técnica y al responsable de preparación.',
      'Información ausente no equivale a ausencia del alérgeno.',
      'Recomendá alternativas reales con datos confirmados.',
    ],
    closing: 'Un “lo consulto y te confirmo” vale más que una respuesta rápida equivocada.',
    meta: proposedMeta(),
  },
  {
    id: 'm5',
    number: 5,
    title: 'Comandas y códigos',
    short: 'Registrar lo solicitado sin confundir productos ni variantes.',
    objective: 'Registrar lo solicitado sin confundir productos o variantes.',
    intro:
      'La comanda es el mensaje que salón envía a barra, cocina y caja. Si el mensaje está incompleto, cada sector lo completa a su manera. Este módulo trata sobre cómo registrar lo que el cliente aceptó, cómo usar los códigos y cómo corregir sin generar confusiones.',
    lessons: [
      {
        id: 'm5-l1',
        title: 'Qué es un código',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Un código identifica un producto en un sistema determinado. Antes de usarlo, verificá que pertenezca al catálogo vigente del local. Confirmá tamaño, cantidad, variante y observaciones admitidas.' },
          { type: 'p', text: 'Un código aprendido en otro comercio no demuestra que coincida con El Cóndor. Los códigos dependen del sistema y de la carta de cada local, y pueden cambiar cuando se actualiza el catálogo.' },
          { type: 'callout', tone: 'info', title: 'Los ceros cuentan', text: 'En el campus los códigos se guardan como texto: “012” y “12” son códigos distintos.' },
        ],
      },
      {
        id: 'm5-l2',
        title: 'Una comanda que refleja lo aceptado',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'La comanda debe reflejar lo que el cliente aceptó: producto, cantidad, variante y observaciones admitidas.' },
          { type: 'list', items: [
            'Producto: el nombre o código del catálogo vigente.',
            'Cantidad: cuántas unidades, sin dar nada por supuesto.',
            'Variante: tamaño, tipo de leche, punto u otra opción autorizada.',
            'Observaciones: solo las que el local admite y que el cliente pidió.',
          ] },
          { type: 'example', title: 'Práctica', text: 'Si una mesa pide “dos cafés, uno cortado”, la comanda debe distinguir los dos productos. Anotar “2 cafés” obliga a barra a adivinar y a vos a corregir después.' },
        ],
      },
      {
        id: 'm5-l3',
        title: 'Corregir sin perder información',
        minutes: 2,
        blocks: [
          { type: 'p', text: 'Si necesitás corregir la comanda, usá el circuito correspondiente y avisá al sector afectado. Una aclaración verbal no garantiza que la información llegue a quien prepara o cobra.' },
          { type: 'callout', tone: 'pending', title: 'Circuito propio pendiente', text: 'El procedimiento de corrección y anulación depende del sistema de El Cóndor. Hasta que se cargue el procedimiento propio, consultá a tu referente cómo se registra cada corrección.' },
        ],
      },
    ],
    exercises: [
      { kind: 'comanda', id: 'm5-x1', title: 'Práctica de comanda: cantidades y variantes' },
      { kind: 'scenario', id: 'm5-x2', title: 'Caso: producto diferente', scenarioId: 'c4' },
      { kind: 'scenario', id: 'm5-x3', title: 'Caso: corrección incompleta', scenarioId: 'c6' },
    ],
    synthesis: [
      'Un código vale solo dentro del catálogo vigente de este local.',
      'La comanda registra producto, cantidad, variante y observaciones.',
      'Las correcciones se registran en el circuito y se avisan a cada sector.',
    ],
    closing: 'Lo que no está registrado no llega a quien prepara ni a quien cobra.',
    meta: proposedMeta(),
  },
  {
    id: 'm6',
    number: 6,
    title: 'Trabajar en equipo',
    short: 'Coordinar tareas y convivir con respeto.',
    objective: 'Coordinar tareas y mantener una convivencia respetuosa.',
    intro:
      'Un turno con mucho movimiento se sostiene con información compartida a tiempo. En este módulo vas a practicar cómo comunicar entre sectores, cómo plantear una dificultad y dónde encontrar los procedimientos de personal.',
    lessons: [
      {
        id: 'm6-l1',
        title: 'Empezar el turno coordinados',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Al comenzar el turno, revisá las novedades y las tareas asignadas. Si no comprendés una indicación, pedí una aclaración antes de ejecutarla.' },
          { type: 'p', text: 'La comunicación entre salón, barra, cocina y caja debe ser breve y precisa.' },
          { type: 'example', title: 'Práctica', text: 'En lugar de “¿sale lo de la cinco?”, probá: “Mesa cinco: ¿cómo viene el tostado? Lo pidieron hace un rato y preguntan”. Quien te escucha sabe de qué hablás y qué necesitás.' },
        ],
      },
      {
        id: 'm6-l2',
        title: 'Plantear una dificultad',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Si surge una dificultad, explicá qué pasó, qué necesitás y qué información ya verificaste.' },
          { type: 'list', ordered: true, items: ['Qué pasó: el hecho, sin adjetivos.', 'Qué verificaste: lo que ya consultaste o revisaste.', 'Qué necesitás: la ayuda o decisión concreta.'] },
          { type: 'p', text: 'Evitá discusiones frente a clientes, gritos, descalificaciones o comentarios sobre características personales. Si hay una diferencia con un compañero, buscá un momento fuera del salón y, si hace falta, sumá al referente.' },
        ],
      },
      {
        id: 'm6-l3',
        title: 'Presentación y procedimientos de personal',
        minutes: 2,
        blocks: [
          { type: 'p', text: 'La presentación y el cuidado personal deben corresponder a la tarea y al procedimiento del establecimiento.' },
          { type: 'pendingDoc', resourceId: 'r-vestimenta', text: 'Documento de vestimenta y presentación personal de El Cóndor.' },
          { type: 'pendingDoc', resourceId: 'r-personal', text: 'Procedimientos de horarios, ausencias, pausas y refrigerios.' },
          { type: 'callout', tone: 'info', title: 'Mientras tanto', text: 'Para cualquier duda sobre horarios, ausencias, pausas o refrigerios, consultá a la persona responsable. El campus no aplica reglas de otras empresas ni define consecuencias laborales.' },
        ],
      },
    ],
    exercises: [
      { kind: 'multiselect', id: 'm6-x1', title: 'Caso: salón lleno y una cancelación', situation: 'El salón está lleno. Una mesa cambió su pedido: canceló un café con leche y agregó un té. Cocina recibió una modificación de otro plato de esa misma mesa, pero barra todavía no sabe que el café se canceló.', prompt: '¿Qué información hay que transmitir y a quién? Marcá todas las acciones necesarias.', options: [
        { id: 'a', text: 'Avisar a barra que el café con leche se canceló y que se agrega un té.', correct: true, why: 'Barra es quien prepara el café: si no se entera, lo prepara igual.' },
        { id: 'b', text: 'Registrar la cancelación y el agregado en la comanda, según el circuito.', correct: true, why: 'El registro asegura que preparación y cobro tengan el mismo dato.' },
        { id: 'c', text: 'Confirmar que caja cobre según la comanda corregida.', correct: true, why: 'Si caja trabaja con el pedido original, la cuenta sale mal.' },
        { id: 'd', text: 'Anunciar la cancelación en voz alta en el salón para que todos se enteren.', correct: false, why: 'Gritar en el salón no garantiza que llegue al sector correcto y molesta a las mesas.' },
        { id: 'e', text: 'Esperar a que barra pregunte por el café antes de avisar.', correct: false, why: 'Esperar aumenta el riesgo de que se prepare un producto que nadie va a tomar.' },
      ] },
      { kind: 'flashcards', id: 'm6-x2', title: 'Tarjetas de repaso', cards: [
        { front: '¿Qué tres partes tiene un buen pedido de ayuda?', back: 'Qué pasó, qué ya verificaste y qué necesitás.' },
        { front: '¿Dónde consultás un procedimiento de pausas o ausencias?', back: 'En la documentación propia vigente y con el responsable correspondiente.' },
      ] },
    ],
    synthesis: [
      'Comunicá entre sectores con mensajes breves y precisos.',
      'Planteá una dificultad con el hecho, lo verificado y lo que necesitás.',
      'Las diferencias se conversan fuera del salón.',
      'Los procedimientos de personal se consultan en la documentación propia.',
    ],
    closing: 'Trabajar en equipo también significa compartir información a tiempo.',
    meta: proposedMeta(),
  },
  {
    id: 'm7',
    number: 7,
    title: 'Consumos, mercadería y registros',
    short: 'Para qué registrar movimientos y excepciones.',
    objective: 'Entender para qué sirve registrar movimientos y excepciones.',
    intro:
      'Cada producto que sale de barra o cocina tiene que poder explicarse: se vendió, se devolvió, se consumió internamente o se perdió. Este módulo explica por qué esas diferencias importan y cómo evitar resolver excepciones por cuenta propia.',
    lessons: [
      {
        id: 'm7-l1',
        title: 'Cada movimiento tiene un motivo',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Cada movimiento necesita un registro que permita reconstruir qué ocurrió. Un consumo, una corrección, una devolución y una merma son situaciones distintas. Identificar el motivo y usar el circuito correcto ayuda a prevenir diferencias.' },
          { type: 'stations', items: [
            { title: 'Venta', text: 'Lo que el cliente pidió, recibió y paga.' },
            { title: 'Devolución', text: 'Un producto servido que la mesa rechaza o devuelve.' },
            { title: 'Consumo interno', text: 'Lo que consume el personal según el procedimiento que lo autorice.' },
            { title: 'Merma', text: 'Mercadería que se pierde o deja de ser apta sin llegar a venderse.' },
          ] },
        ],
      },
      {
        id: 'm7-l2',
        title: 'Productos devueltos',
        minutes: 2,
        blocks: [
          { type: 'p', text: 'Un producto devuelto por una mesa no debe reutilizarse ni consumirse. Corresponde separarlo del servicio y gestionar su destino conforme al procedimiento sanitario y al registro del local.' },
          { type: 'callout', tone: 'warning', title: 'No vuelve al servicio', text: 'Aunque parezca intacto, un producto que estuvo en una mesa no se ofrece a otra persona ni se consume.' },
        ],
      },
      {
        id: 'm7-l3',
        title: 'Excepciones y autorizaciones',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Si alguien solicita una invitación, un descuento o retirar mercadería, verificá quién puede autorizarlo y cómo queda asentado. Evitá resolver excepciones por cuenta propia o usar un registro que no corresponda al hecho real.' },
          { type: 'callout', tone: 'pending', title: 'Circuito pedagógico propuesto para validar', text: 'Este circuito es una propuesta para conversar con El Cóndor. No reemplaza el procedimiento propio ni simula una integración con el sistema de caja o gestión.' },
          { type: 'list', ordered: true, items: ['Identificar situación y producto.', 'Consultar autorización cuando corresponda.', 'Registrar el motivo adecuado.', 'Avisar al sector afectado.'] },
        ],
      },
    ],
    exercises: [
      { kind: 'classify', id: 'm7-x1', title: 'Clasificá cada caso', instructions: 'Elegí qué tipo de movimiento es cada situación. Después vas a ver qué autorización o registro falta.', categories: [
        { id: 'venta', label: 'Venta' },
        { id: 'devolucion', label: 'Devolución' },
        { id: 'interno', label: 'Consumo interno' },
        { id: 'merma', label: 'Merma' },
      ], cases: [
        { id: 'k1', text: 'Una mesa pide dos medialunas, las recibe y las paga.', answer: 'venta', missing: 'Nada especial: alcanza con que la comanda refleje lo servido y lo cobrado.' },
        { id: 'k2', text: 'Una mesa devuelve un café porque llegó frío y pide otro.', answer: 'devolucion', missing: 'Registrar el motivo de la devolución según el circuito y separar el producto del servicio.' },
        { id: 'k3', text: 'Una persona del equipo toma un café durante su turno.', answer: 'interno', missing: 'Verificar el procedimiento propio que lo autoriza y cómo se registra. Sin ese documento, consultar al responsable.' },
        { id: 'k4', text: 'Se cae una bandeja con dos porciones de torta antes de llegar a la mesa.', answer: 'merma', missing: 'Registrar la pérdida con su motivo y avisar al responsable para que quede asentada.' },
        { id: 'k5', text: 'Un producto quedó sin identificación y no se sabe desde cuándo está elaborado.', answer: 'merma', missing: 'Separarlo del servicio y que el responsable defina su destino según el procedimiento sanitario.' },
      ] },
      { kind: 'flashcards', id: 'm7-x2', title: 'Tarjetas de repaso', cards: [
        { front: '¿Un producto devuelto puede volver al servicio?', back: 'No. Se separa y se gestiona según el procedimiento sanitario y el registro del local.' },
        { front: 'Te piden una invitación que no podés autorizar. ¿Qué hacés?', back: 'Consultás a la persona habilitada y respetás el circuito de registro. No la prometés por tu cuenta.' },
      ] },
    ],
    synthesis: [
      'Venta, devolución, consumo interno y merma son hechos distintos.',
      'Un producto devuelto no vuelve al servicio.',
      'Las excepciones necesitan autorización y registro.',
    ],
    closing: 'Un buen registro permite reconstruir lo que pasó sin depender de la memoria de nadie.',
    meta: proposedMeta(),
  },
  {
    id: 'm8',
    number: 8,
    title: 'Higiene, orden y prevención',
    short: 'Reconocer riesgos y saber cuándo corregir o informar.',
    objective: 'Reconocer situaciones que requieren corregir o informar un riesgo.',
    intro:
      'La higiene y la seguridad se sostienen con hábitos y procedimientos, no con impresiones. Este módulo te ayuda a reconocer situaciones de riesgo. No reemplaza la capacitación práctica ni el plan de emergencias del local.',
    lessons: [
      {
        id: 'm8-l1',
        title: 'La higiene se verifica',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'La higiene no se comprueba únicamente mirando una superficie. Seguí el procedimiento de lavado, limpieza y desinfección indicado para cada tarea. Verificá utensilios y superficies antes de usarlos.' },
          { type: 'p', text: 'Evitá trasladar contaminación entre alimentos, elementos y zonas de preparación: separá lo limpio de lo sucio, usá cada utensilio para su fin y lavá tus manos según el procedimiento.' },
          { type: 'pendingDoc', resourceId: 'r-limpieza', text: 'Procedimiento de limpieza y desinfección.' },
        ],
      },
      {
        id: 'm8-l2',
        title: 'Conservación de alimentos',
        minutes: 2,
        blocks: [
          { type: 'p', text: 'Conservá los alimentos según sus fichas y procedimientos. Ante una condición dudosa de conservación, separá el producto del servicio y avisá al responsable.' },
          { type: 'callout', tone: 'pending', title: 'Datos técnicos pendientes', text: 'El campus no informa temperaturas, vida útil ni tiempos de conservación: esos datos deben venir de las fichas y procedimientos de El Cóndor.' },
          { type: 'pendingDoc', resourceId: 'r-conservacion', text: 'Procedimiento de conservación y manipulación de alimentos.' },
        ],
      },
      {
        id: 'm8-l3',
        title: 'El orden también previene',
        minutes: 3,
        blocks: [
          { type: 'list', items: [
            'Cada elemento debe tener ubicación.',
            'Los pasos deben permanecer despejados.',
            'Un derrame requiere atención y señalización.',
            'Las reparaciones eléctricas corresponden a personas habilitadas.',
          ] },
          { type: 'p', text: 'Si una carga no puede moverse con seguridad, pedí ayuda o utilizá medios habilitados. Ante una emergencia, activá el procedimiento del establecimiento y recurrí a personal capacitado.' },
          { type: 'pendingDoc', resourceId: 'r-emergencias', text: 'Plan de emergencias y contactos del establecimiento.' },
          { type: 'callout', tone: 'warning', title: 'Alcance de esta lección', text: 'Esta lección no reemplaza capacitación práctica ni un plan de emergencias. El campus no incluye teléfonos, aseguradoras ni responsables técnicos: deben surgir de la documentación propia.' },
        ],
      },
    ],
    exercises: [
      { kind: 'hazards', id: 'm8-x1', title: 'Encontrá los riesgos de la escena' },
      { kind: 'flashcards', id: 'm8-x2', title: 'Tarjetas de repaso', cards: [
        { front: '¿Una superficie que se ve limpia está desinfectada?', back: 'No necesariamente. Hay que cumplir el procedimiento correspondiente.' },
        { front: 'Un producto tiene conservación dudosa. ¿Qué hacés?', back: 'Lo separás del servicio y avisás al responsable.' },
        { front: 'La carga es demasiado pesada. ¿Qué hacés?', back: 'Pedís ayuda o usás medios habilitados. No improvisás.' },
      ] },
    ],
    synthesis: [
      'La higiene se verifica con procedimientos, no a simple vista.',
      'Ante una duda de conservación: separar y avisar.',
      'Orden, pasos despejados y derrames señalizados previenen accidentes.',
      'Las emergencias siguen el plan del establecimiento.',
    ],
    closing: 'Corregir o informar un riesgo a tiempo es parte del servicio.',
    meta: proposedMeta(),
  },
  {
    id: 'm9',
    number: 9,
    title: 'Promociones y medios de pago',
    short: 'Informar condiciones sin prometer beneficios no confirmados.',
    objective: 'Informar condiciones sin prometer beneficios no confirmados.',
    intro:
      'Una promoción mal explicada genera una mala experiencia en el momento de pagar. Este módulo enseña a leer las condiciones completas de un beneficio y a diferenciar lo que modifica el cobro de lo que la entidad devuelve después.',
    lessons: [
      {
        id: 'm9-l1',
        title: 'De qué depende una promoción',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Una promoción puede depender de muchas condiciones a la vez. Un porcentaje aislado no alcanza para saber si aplica.' },
          { type: 'list', items: ['Banco o entidad', 'Medio de pago y tarjeta', 'Fecha, día y horario', 'Sucursal y canal', 'Tope y período del tope', 'Exclusiones'] },
          { type: 'callout', tone: 'info', title: 'Vigente no es lo mismo que confirmada', text: 'Que una promoción esté dentro de sus fechas no significa que El Cóndor participe. Hay que verificar la fuente y la sucursal.' },
        ],
      },
      {
        id: 'm9-l2',
        title: 'Descuento inmediato o reintegro',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Diferenciá descuento inmediato de reintegro posterior. El descuento modifica el importe cobrado según sus condiciones; el reintegro lo realiza después la entidad correspondiente.' },
          { type: 'p', text: 'Un reintegro con tope por período puede depender de consumos previos que el local desconoce. No garantices un importe final cuando falten esos datos.' },
          { type: 'example', title: 'Práctica', text: '“Según la información que tenemos, ese beneficio es un reintegro: lo acredita la entidad después, según sus condiciones y tu tope disponible. El importe que te cobramos hoy es el total.”' },
        ],
      },
      {
        id: 'm9-l3',
        title: 'Cómo se estima un beneficio',
        minutes: 2,
        blocks: [
          { type: 'p', text: 'Beneficio estimado = el menor valor entre el importe elegible multiplicado por el porcentaje y el tope disponible informado.' },
          { type: 'p', text: 'La estimación no considera consumos previos del cliente con la misma entidad ni condiciones que no estén informadas. Por eso es una estimación y no una garantía.' },
        ],
      },
    ],
    exercises: [
      { kind: 'promoCalc', id: 'm9-x1', title: 'Calculadora de entrenamiento' },
      { kind: 'scenario', id: 'm9-x2', title: 'Caso: beneficio con condiciones', scenarioId: 'c5' },
    ],
    synthesis: [
      'Un porcentaje no alcanza: revisá todas las condiciones.',
      'El descuento cambia el cobro; el reintegro lo hace la entidad después.',
      'El tope disponible puede depender de consumos que el local desconoce.',
      'Una fecha vigente no confirma la participación del local.',
    ],
    closing: 'Explicar bien una condición evita una discusión en el momento de pagar.',
    meta: proposedMeta(),
  },
  {
    id: 'm10',
    number: 10,
    title: 'Aprender y mejorar',
    short: 'Usar la práctica y las devoluciones para crecer.',
    objective: 'Usar la práctica y las devoluciones para identificar qué aprender después.',
    intro:
      'Aprender un oficio lleva tiempo y repetición. Este módulo propone cómo aprovechar las evaluaciones del campus, cómo dar y recibir devoluciones útiles y cómo armar tu propio plan de repaso.',
    lessons: [
      {
        id: 'm10-l1',
        title: 'Para qué sirve evaluar',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Una evaluación ayuda a reconocer qué comprendiste y qué necesitás repasar. Leé las explicaciones y relacioná cada tema con una situación real.' },
          { type: 'p', text: 'Si algo contradice documentación propia del local, consultalo para corregir el material.' },
          { type: 'callout', tone: 'info', title: 'Resultados pedagógicos', text: 'Las prácticas del campus no generan sanciones, decisiones de contratación ni calificaciones laborales automáticas. Aprobar un cuestionario no equivale a una habilitación o certificación oficial.' },
        ],
      },
      {
        id: 'm10-l2',
        title: 'Devoluciones que ayudan',
        minutes: 3,
        blocks: [
          { type: 'p', text: 'Una devolución útil describe un hecho concreto y propone una mejora. No reduzcas el desempeño de una persona a un único puntaje.' },
          { type: 'stations', items: [
            { title: 'Qué se vio', text: 'La mesa cuatro esperó un rato sin que nadie le acercara la carta.' },
            { title: 'Qué efecto tuvo', text: 'Llamaron dos veces y el pedido se tomó más tarde.' },
            { title: 'Qué se propone', text: 'Al recibir, avisar quién atiende la mesa y acercar la carta enseguida.' },
          ] },
          { type: 'stations', items: [
            { title: 'Qué se vio', text: 'Antes de servir, se revisó la comanda y se detectó una variante distinta.' },
            { title: 'Qué efecto tuvo', text: 'Se corrigió en barra y la mesa recibió lo que había pedido.' },
            { title: 'Qué se propone', text: 'Sostener esa revisión como hábito en cada entrega.' },
          ] },
          { type: 'dodont', doText: ['Describir hechos observables.', 'Proponer una acción concreta.', 'Reconocer lo que funcionó.'], dontText: ['Juzgar a la persona (“sos lento”).', 'Generalizar (“siempre”, “nunca”).', 'Reducir todo a un número.'] },
          { type: 'callout', tone: 'pending', title: 'Controles de servicio', text: 'El campus no afirma que El Cóndor tenga un programa de controles, auditorías o cliente misterioso. Si existe, puede incorporarse como documento propio.' },
        ],
      },
    ],
    exercises: [
      { kind: 'reviewPlan', id: 'm10-x1', title: 'Mi plan personal de repaso' },
      { kind: 'flashcards', id: 'm10-x2', title: 'Tarjetas de repaso', cards: [
        { front: '¿Para qué sirve revisar una respuesta incorrecta?', back: 'Para comprender el criterio, identificar qué repasar y volver a practicar.' },
        { front: '¿Qué incluye una devolución útil?', back: 'Un hecho concreto, su efecto y una acción de mejora comprensible.' },
      ] },
    ],
    synthesis: [
      'Evaluar sirve para saber qué repasar.',
      'Una devolución útil: hecho, efecto y propuesta.',
      'Un puntaje del campus es pedagógico, no una habilitación.',
    ],
    closing: 'Volver al campus cuando quieras repasar también es parte del oficio.',
    meta: proposedMeta(),
  },
];

export const MODULE_BY_ID: Record<string, Module> = Object.fromEntries(MODULES.map((m) => [m.id, m]));

export function allLessons() {
  return MODULES.flatMap((m) => m.lessons.map((l) => ({ module: m, lesson: l })));
}
