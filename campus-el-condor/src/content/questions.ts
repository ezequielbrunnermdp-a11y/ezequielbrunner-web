import type { Question } from './types';

type Raw = [id: string, moduleId: string, prompt: string, options: [string, string, string], correctIndex: 0 | 1 | 2, explanation: string, expected: string, criteria: string];

const RAW: Raw[] = [
  ['Q01', 'm1', '¿Qué conviene identificar al comenzar un turno en un sector nuevo?', [
    'El referente, las tareas asignadas y el canal de novedades.',
    'Qué mesas suelen dejar mejores propinas y quién atiende más rápido.',
    'Solo las tareas asignadas: las novedades se consultan cuando aparece un problema.',
  ], 0, 'Conocer referente, tareas y canal de novedades permite coordinar y consultar antes de improvisar. Esperar a que aparezca un problema obliga a resolver sobre la marcha.',
  'El referente, las tareas asignadas y el canal de novedades. Permite coordinar y consultar antes de improvisar.',
  'Menciona al menos referente y tareas; suma si nombra el canal de novedades y explica que evita improvisar.'],

  ['Q02', 'm1', 'Una indicación no quedó clara. ¿Cómo seguís?', [
    'La ejecutás como mejor la entendiste y después avisás qué hiciste.',
    'Pedís una aclaración a la persona responsable antes de ejecutar una acción dudosa.',
    'Le preguntás a cualquier cliente habitual cómo se hace en el local.',
  ], 1, 'Pedir una aclaración a tiempo evita corregir después. La interpretación propia puede generar un error que afecte a otros sectores.',
  'Pedís una aclaración a la persona responsable antes de ejecutar una acción dudosa.',
  'Correcta si consulta antes de actuar y dirige la consulta a quien corresponde.'],

  ['Q03', 'm1', '¿Por qué una tarea de cocina o barra influye en la atención del salón?', [
    'Porque comparten el mismo horario de trabajo.',
    'No influye: cada sector se evalúa por separado.',
    'Porque preparación, pedido, entrega y cobro forman un circuito; un error afecta a las tareas siguientes.',
  ], 2, 'La experiencia del cliente depende de un circuito compartido: lo que falla en un punto se traslada a los siguientes.',
  'Porque preparación, pedido, entrega y cobro forman un circuito; un error afecta a las tareas siguientes.',
  'Correcta si explica la idea de circuito o encadenamiento entre sectores.'],

  ['Q04', 'm2', '¿Cómo recibís a alguien si todavía estás terminando otra atención?', [
    'Reconocés su llegada y brindás una indicación concreta, coordinando la continuidad con el equipo.',
    'Terminás tu tarea sin mirarlo para no perder concentración.',
    'Dejás la mesa que atendías a mitad del pedido para ubicarlo enseguida.',
  ], 0, 'Un reconocimiento breve orienta a la persona sin abandonar desordenadamente la tarea en curso.',
  'Reconocés su llegada y brindás una indicación concreta, coordinando la continuidad con el equipo.',
  'Correcta si incluye reconocer la llegada y dar una indicación; suma si menciona coordinar con el equipo.'],

  ['Q05', 'm2', '¿Qué hace útil una recomendación?', [
    'Que sea el producto de mayor precio, porque aumenta el ticket.',
    'Que se repita igual a todas las mesas para no olvidarse.',
    'Que responda a lo que la persona busca y se base en productos e información confirmados, sin presión.',
  ], 2, 'Una recomendación útil parte de escuchar, usa información verificada y respeta la decisión del cliente.',
  'Que responda a lo que la persona busca y se base en productos e información confirmados, sin presión.',
  'Correcta si menciona la necesidad del cliente y la información confirmada; suma si menciona no presionar.'],

  ['Q06', 'm2', '¿Cómo acompañás una mesa sin interrumpirla innecesariamente?', [
    'Preguntás “¿todo bien?” cada pocos minutos para que vean que estás atento.',
    'Observás y te acercás con criterio cuando podés ayudar; consultás brevemente y respetás el contexto.',
    'No te acercás hasta que te llamen.',
  ], 1, 'Acompañar es observar y ofrecer ayuda en el momento oportuno, sin invadir ni desaparecer.',
  'Observás y te acercás con criterio cuando podés ayudar; consultás brevemente y respetás el contexto.',
  'Correcta si combina observar y acercarse con criterio, respetando la conversación de la mesa.'],

  ['Q07', 'm3', 'La mesa pregunta por una demora y no conocés el estado. ¿Qué hacés?', [
    'Respondés que sale en cinco minutos para tranquilizarla.',
    'Le decís que cocina está con mucho trabajo y que tenga paciencia.',
    'Consultás al sector responsable y comunicás una actualización real, sin inventar minutos.',
  ], 2, 'Prometer un tiempo inventado genera una nueva expectativa incumplida. La información real permite resolver.',
  'Consultás al sector responsable y comunicás una actualización real, sin inventar minutos.',
  'Correcta si consulta antes de responder y evita prometer tiempos no confirmados.'],

  ['Q08', 'm3', '¿Alcanza con avisar que se va a resolver un reclamo?', [
    'No. Hay que coordinar una solución autorizada y comprobar después si quedó resuelto.',
    'Sí: con avisar, el cliente sabe que se ocupan.',
    'Sí, si además le ofrecés una bonificación por tu cuenta.',
  ], 0, 'Un reclamo se cierra cuando la solución está autorizada y se comprobó que funcionó. Las bonificaciones requieren autorización.',
  'No. Hay que coordinar una solución autorizada y comprobar después si quedó resuelto.',
  'Correcta si menciona solución autorizada y verificación posterior.'],

  ['Q09', 'm3', '¿Cuándo una mesa está lista para recibir a la siguiente persona?', [
    'Apenas se retiran los platos principales.',
    'Cuando terminó la atención anterior y se completaron retiro, limpieza y preparación según el procedimiento.',
    'Cuando la mesa anterior pidió la cuenta.',
  ], 1, 'La mesa está lista recién cuando se completó la última estación del recorrido: retiro, limpieza y preparación.',
  'Cuando terminó la atención anterior y se completaron retiro, limpieza y preparación según el procedimiento.',
  'Correcta si menciona retiro, limpieza y preparación completos.'],

  ['Q10', 'm4', '¿Podés asegurar ingredientes solo por el nombre de una torta?', [
    'Sí, si es una torta conocida.',
    'Sí, si te lo explicó un compañero alguna vez.',
    'No. Debés consultar su ficha y verificar lo que no está informado.',
  ], 2, 'El nombre o la apariencia no acreditan composición. La ficha vigente y quien prepara son las fuentes confiables.',
  'No. Debés consultar su ficha y verificar lo que no está informado.',
  'Correcta si responde que no y nombra la ficha o la verificación con preparación.'],

  ['Q11', 'm4', '¿Una lista de alérgenos vacía demuestra que un alimento no contiene alérgenos?', [
    'No. Puede significar que el dato no fue cargado.',
    'Sí, porque si tuviera alguno figuraría.',
    'Sí, salvo que el cliente insista.',
  ], 0, 'Ausencia de información no equivale a ausencia del alérgeno. Hay que verificar.',
  'No. Puede significar que el dato no fue cargado. Ausencia de información no equivale a ausencia del alérgeno.',
  'Correcta si distingue entre falta de dato y ausencia comprobada.'],

  ['Q12', 'm4', '¿Qué datos verificás antes de recomendar una variante?', [
    'Solamente su precio.',
    'Que esté disponible y autorizada, qué incluye y qué información necesita el cliente.',
    'Que sea la variante que más se vende.',
  ], 1, 'Una variante solo puede recomendarse si existe, está autorizada y podés describirla con información confirmada.',
  'Que esté disponible y autorizada, qué incluye y qué información necesita el cliente.',
  'Correcta si menciona disponibilidad y autorización; suma si menciona contenido e información para el cliente.'],

  ['Q13', 'm5', '¿Sirve el código de un producto aprendido en otro comercio?', [
    'Sí, los códigos de cafetería son estándar.',
    'Sí, si el producto tiene el mismo nombre.',
    'Solo si se verifica en el catálogo vigente del sistema del local. Los códigos no son universales.',
  ], 2, 'Cada sistema y cada carta definen sus códigos. Un mismo nombre puede tener códigos diferentes en otro local.',
  'Solo si se verifica en el catálogo vigente del sistema del local. Los códigos no son universales.',
  'Correcta si indica que los códigos no son universales y deben verificarse en el catálogo vigente.'],

  ['Q14', 'm5', '¿Qué debe reflejar una comanda?', [
    'Producto, cantidad, variante y observaciones aceptadas conforme al circuito real del local.',
    'Solo el producto; las variantes se aclaran de palabra.',
    'El total a cobrar, para agilizar la caja.',
  ], 0, 'La comanda es el mensaje que reciben preparación y cobro. Si no incluye variantes y observaciones, cada sector completa a su manera.',
  'Producto, cantidad, variante y observaciones aceptadas conforme al circuito real del local.',
  'Correcta si nombra al menos producto, cantidad y variante.'],

  ['Q15', 'm5', 'Cambió un pedido. ¿Alcanza con comentarlo de palabra?', [
    'Sí, si lo decís en voz alta en la barra.',
    'No. Hay que usar el circuito de corrección y comunicarlo a los sectores afectados.',
    'Sí, siempre que se lo digas al cliente.',
  ], 1, 'La comunicación verbal sola no asegura que preparación y cobro tengan el mismo dato.',
  'No. Hay que usar el circuito de corrección y comunicarlo a los sectores afectados.',
  'Correcta si menciona registro en el circuito y aviso a los sectores.'],

  ['Q16', 'm6', '¿Cómo comunicás un problema durante un turno con mucha actividad?', [
    'Esperás a que termine el turno para no molestar.',
    'Lo comentás con el primer compañero que pase.',
    'Explicás el hecho, lo que ya verificaste y la ayuda que necesitás de forma breve y respetuosa.',
  ], 2, 'Un mensaje con hecho, verificación y pedido concreto permite actuar rápido sin malentendidos.',
  'Explicás el hecho, lo que ya verificaste y la ayuda que necesitás de forma breve y respetuosa.',
  'Correcta si incluye hecho y pedido concreto; suma si menciona lo ya verificado.'],

  ['Q17', 'm6', '¿Qué fuente corresponde consultar para un procedimiento de pausas o ausencias?', [
    'La documentación propia vigente y el responsable correspondiente.',
    'Lo que se hacía en tu trabajo anterior.',
    'Lo que diga el compañero con más antigüedad.',
  ], 0, 'Las reglas de personal dependen de cada empresa. No se aplican reglas de otros comercios.',
  'La documentación propia vigente y el responsable correspondiente, sin aplicar reglas de otra empresa.',
  'Correcta si menciona documentación propia o responsable; suma si aclara no aplicar reglas ajenas.'],

  ['Q18', 'm6', '¿Cómo resolvés una diferencia con un compañero frente a clientes?', [
    'La resolvés en el momento para que no se acumule.',
    'Evitás discutir en el salón y coordinás una conversación respetuosa con el referente cuando corresponda.',
    'La ignorás para siempre.',
  ], 1, 'Discutir frente a clientes afecta la experiencia y no resuelve. La conversación se da fuera del salón y, si hace falta, con el referente.',
  'Evitás discutir en el salón y coordinás una conversación respetuosa con el referente cuando corresponda.',
  'Correcta si evita la discusión frente a clientes y propone una conversación posterior.'],

  ['Q19', 'm7', '¿Un producto devuelto por una mesa puede volver al servicio?', [
    'Sí, si no fue tocado.',
    'Sí, si se lo ofrece al personal.',
    'No. Debe separarse y gestionarse conforme al procedimiento sanitario y al registro del local.',
  ], 2, 'Un producto que estuvo en una mesa no se reutiliza ni se consume: se separa y se registra.',
  'No. Debe separarse y gestionarse conforme al procedimiento sanitario y al registro del local.',
  'Correcta si responde que no y menciona separar y registrar.'],

  ['Q20', 'm7', '¿Por qué importa distinguir una devolución de una merma?', [
    'Porque son hechos distintos y necesitan motivos y registros adecuados para reconstruir lo ocurrido.',
    'No importa: las dos son pérdidas.',
    'Solo importa para el cálculo de propinas.',
  ], 0, 'El motivo correcto permite entender qué pasó y prevenir diferencias en la mercadería.',
  'Porque son hechos distintos y necesitan motivos y registros adecuados para reconstruir lo ocurrido.',
  'Correcta si explica que el registro permite reconstruir lo ocurrido.'],

  ['Q21', 'm7', 'Un cliente pide una invitación que no podés autorizar. ¿Qué hacés?', [
    'Se la concedés para conservar al cliente.',
    'Consultás a la persona habilitada y respetás el circuito de registro.',
    'Le decís que no sin consultar.',
  ], 1, 'Las excepciones requieren autorización y registro. Ni prometerla ni negarla sin consultar es la respuesta adecuada.',
  'Consultás a la persona habilitada y respetás el circuito de registro; no la prometés por cuenta propia.',
  'Correcta si consulta a la persona habilitada y menciona el registro.'],

  ['Q22', 'm8', 'Detectás un producto con conservación dudosa. ¿Cómo actuás?', [
    'Lo usás primero para que no se pierda.',
    'Lo probás para decidir si sigue en condiciones.',
    'Lo separás del servicio y avisás al responsable para que determine el procedimiento aplicable.',
  ], 2, 'Ante la duda, el producto sale del servicio y decide el responsable según el procedimiento.',
  'Lo separás del servicio y avisás al responsable para que determine el procedimiento aplicable.',
  'Correcta si menciona separar y avisar.'],

  ['Q23', 'm8', '¿Que una superficie se vea limpia garantiza que esté desinfectada?', [
    'No. Hay que cumplir el procedimiento correspondiente y verificar sus condiciones de uso.',
    'Sí, si no tiene manchas.',
    'Sí, si se limpió durante el turno.',
  ], 0, 'La desinfección depende de un procedimiento, no de la apariencia.',
  'No. Hay que cumplir el procedimiento correspondiente y verificar sus condiciones de uso.',
  'Correcta si responde que no y menciona el procedimiento.'],

  ['Q24', 'm8', '¿Qué hacés si mover una carga supera tus posibilidades seguras?', [
    'La movés de a poco aunque cueste.',
    'Pedís ayuda o utilizás medios habilitados.',
    'La dejás en el paso hasta que alguien la mueva.',
  ], 1, 'Improvisar una maniobra riesgosa puede causar lesiones; dejarla en el paso genera otro riesgo.',
  'Pedís ayuda o utilizás medios habilitados; no improvisás una maniobra riesgosa.',
  'Correcta si menciona pedir ayuda o medios habilitados.'],

  ['Q25', 'm9', '¿Qué diferencia hay entre descuento inmediato y reintegro?', [
    'Ninguna: los dos bajan el importe que cobra el local.',
    'El reintegro se aplica en caja y el descuento lo devuelve el banco.',
    'El descuento modifica el cobro según sus condiciones; el reintegro lo realiza después la entidad correspondiente.',
  ], 2, 'Un reintegro posterior no modifica necesariamente el importe cobrado por el local.',
  'El descuento modifica el cobro según sus condiciones; el reintegro lo realiza después la entidad correspondiente.',
  'Correcta si distingue quién aplica cada beneficio y cuándo.'],

  ['Q26', 'm9', '¿El porcentaje permite saber por sí solo cuánto recibirá el cliente?', [
    'No. Deben verificarse elegibilidad, topes, períodos, medio de pago y demás condiciones.',
    'Sí: alcanza con multiplicar el total por el porcentaje.',
    'Sí, si la promoción está vigente.',
  ], 0, 'El tope disponible y otras condiciones pueden limitar el beneficio, incluso por consumos que el local desconoce.',
  'No. Deben verificarse elegibilidad, topes, períodos, medio de pago y demás condiciones.',
  'Correcta si responde que no y nombra al menos el tope o las condiciones.'],

  ['Q27', 'm9', '¿Una promoción con fecha vigente está necesariamente confirmada para El Cóndor?', [
    'Sí, si figura en la página de la entidad.',
    'No. También debe verificarse su fuente y participación en el local o sucursal correspondiente.',
    'Sí, si un cliente la muestra en el teléfono.',
  ], 1, 'La vigencia es solo una condición. La participación del local debe confirmarse con una fuente verificada.',
  'No. También debe verificarse su fuente y participación en el local o sucursal correspondiente.',
  'Correcta si menciona verificar fuente o participación del local.'],

  ['Q28', 'm10', '¿Para qué sirve revisar una respuesta incorrecta?', [
    'Para memorizar la opción correcta y aprobar la próxima vez.',
    'Para comprender el criterio, identificar qué repasar y volver a practicar.',
    'No sirve: lo importante es el puntaje final.',
  ], 1, 'Revisar el error ayuda a entender el criterio y aplicarlo en situaciones nuevas.',
  'Para comprender el criterio, identificar qué repasar y volver a practicar.',
  'Correcta si menciona comprender el criterio o identificar qué repasar.'],

  ['Q29', 'm10', '¿Aprobar un cuestionario equivale a una habilitación o certificación oficial?', [
    'Sí, el campus emite una certificación.',
    'Sí, si se aprueba con más del umbral.',
    'No. Es un resultado pedagógico del campus y no acredita por sí mismo una habilitación profesional.',
  ], 2, 'Los resultados del campus orientan el aprendizaje; no son habilitaciones ni certificaciones.',
  'No. Es un resultado pedagógico del campus y no acredita por sí mismo una habilitación profesional.',
  'Correcta si responde que no y lo describe como resultado pedagógico.'],

  ['Q30', 'm10', '¿Qué debería incluir una devolución útil?', [
    'Un hecho concreto, su efecto y una acción de mejora comprensible.',
    'Un puntaje del uno al diez.',
    'Una opinión general sobre la actitud de la persona.',
  ], 0, 'Describir hechos y proponer acciones permite mejorar sin juicios personales.',
  'Un hecho concreto, su efecto y una acción de mejora comprensible, evitando juicios personales.',
  'Correcta si incluye hecho y acción de mejora; suma si menciona el efecto y evita juicios personales.'],
];

const IDS = ['a', 'b', 'c'];

export const QUESTIONS: Question[] = RAW.map(([id, moduleId, prompt, options, correctIndex, explanation, expected, criteria]) => ({
  id,
  moduleId,
  prompt,
  options: options.map((text, i) => ({ id: IDS[i], text })),
  correct: IDS[correctIndex],
  explanation,
  expected,
  criteria,
}));

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export function questionsForModule(moduleId: string) {
  return QUESTIONS.filter((q) => q.moduleId === moduleId);
}
