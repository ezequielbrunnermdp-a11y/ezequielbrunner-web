-- =====================================================================
-- Migración 2: datos iniciales (generada por scripts/generar-seed.mjs)
-- Sucursales iniciales y versión 1 del cuestionario integral (15 categorías)
-- =====================================================================
insert into public.branches (name) values
  ('San Luis'),
  ('Colón'),
  ('Alem'),
  ('Tucumán'),
  ('San Juan'),
  ('Chile'),
  ('Torreón'),
  ('Rivadavia'),
  ('Balcarce')
on conflict (name) do nothing;

do $$
declare
  v_version uuid;
  v_cat uuid;
begin
  if exists (select 1 from public.questionnaire_versions) then
    return;
  end if;
  perform set_config('app.seeding', 'on', true);
  insert into public.questionnaire_versions (number, name, status, published_at, notes)
  values (1, 'Cuestionario integral de auditoría', 'publicada', now(), 'Versión inicial')
  returning id into v_version;

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 1, 'imagen_marca', 'Imagen de marca', 5, null, null, 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿La fachada está limpia y en buenas condiciones?', null, false),
    (v_cat, 2, '¿La cartelería institucional se encuentra correctamente instalada?', null, false),
    (v_cat, 3, '¿La identificación de El Cóndor respeta la marca?', null, false),
    (v_cat, 4, '¿Los vidrios están limpios?', null, false),
    (v_cat, 5, '¿La entrada resulta atractiva y ordenada?', null, false),
    (v_cat, 6, '¿Las mesas están limpias y bien distribuidas?', null, false),
    (v_cat, 7, '¿Las sillas y el mobiliario están en buen estado?', null, false),
    (v_cat, 8, '¿La iluminación es correcta?', null, false),
    (v_cat, 9, '¿La música ambiental es adecuada?', null, false),
    (v_cat, 10, '¿La temperatura del salón es confortable?', null, false),
    (v_cat, 11, '¿El personal utiliza el uniforme correspondiente?', null, false),
    (v_cat, 12, '¿Las vitrinas están ordenadas y correctamente presentadas?', null, false),
    (v_cat, 13, '¿Los productos están exhibidos de manera atractiva?', null, false),
    (v_cat, 14, '¿La cartelería promocional está actualizada?', null, false),
    (v_cat, 15, '¿El local mantiene una imagen institucional consistente?', null, false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 2, 'atencion_cliente', 'Atención al cliente', 10, null, 'compra_prueba', 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿El cliente es recibido cordialmente?', null, false),
    (v_cat, 2, '¿El personal demuestra amabilidad?', null, false),
    (v_cat, 3, '¿Se ofrece asistencia para elegir productos?', null, false),
    (v_cat, 4, '¿Los empleados conocen la carta?', null, false),
    (v_cat, 5, '¿Conocen los precios vigentes?', null, false),
    (v_cat, 6, '¿Conocen las promociones?', null, false),
    (v_cat, 7, '¿Realizan venta sugestiva?', null, false),
    (v_cat, 8, '¿Los tiempos de atención son adecuados?', null, false),
    (v_cat, 9, '¿Los pedidos se entregan correctamente?', null, false),
    (v_cat, 10, '¿La presentación del servicio es profesional?', null, false),
    (v_cat, 11, '¿El personal puede informar correctamente sobre ingredientes y alérgenos?', null, false),
    (v_cat, 12, '¿Se resuelven adecuadamente los reclamos?', null, false),
    (v_cat, 13, '¿Existe una actitud predispuesta al servicio?', null, false),
    (v_cat, 14, '¿El cliente recibe el comprobante correspondiente?', null, false),
    (v_cat, 15, '¿La experiencia general cumple con los estándares de El Cóndor?', null, false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 3, 'calidad_productos', 'Calidad de productos', 15, null, 'degustacion', 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿Las medialunas tienen la presentación esperada?', null, false),
    (v_cat, 2, '¿Las medialunas mantienen la frescura adecuada?', null, false),
    (v_cat, 3, '¿Se respeta el tamaño y gramaje establecido?', null, false),
    (v_cat, 4, '¿Las facturas mantienen la calidad?', null, false),
    (v_cat, 5, '¿Los panes presentan condiciones adecuadas?', null, false),
    (v_cat, 6, '¿Los sándwiches cumplen los estándares?', null, false),
    (v_cat, 7, '¿Los tostados están correctamente preparados?', null, false),
    (v_cat, 8, '¿Las tortas presentan buena calidad?', null, false),
    (v_cat, 9, '¿Se respetan las porciones?', null, false),
    (v_cat, 10, '¿El café tiene calidad adecuada?', null, false),
    (v_cat, 11, '¿La extracción del café es correcta?', null, false),
    (v_cat, 12, '¿La leche está preparada correctamente?', null, false),
    (v_cat, 13, '¿Las bebidas se sirven a la temperatura correspondiente?', null, false),
    (v_cat, 14, '¿Se respetan las recetas oficiales?', null, false),
    (v_cat, 15, '¿Los ingredientes son los autorizados?', null, false),
    (v_cat, 16, '¿Existe consistencia entre los productos ofrecidos?', null, false),
    (v_cat, 17, '¿Se detectan productos no autorizados?', 'Puntuar el cumplimiento: 5 = no se detectan productos no autorizados.', false),
    (v_cat, 18, '¿Se cumple el estándar de presentación establecido por la fábrica?', null, false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 4, 'higiene_bromatologia', 'Higiene y bromatología', 20, null, null, 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿La cocina está limpia?', null, false),
    (v_cat, 2, '¿La barra está limpia?', null, false),
    (v_cat, 3, '¿Los depósitos están ordenados?', null, false),
    (v_cat, 4, '¿Las cámaras de frío están limpias?', null, false),
    (v_cat, 5, '¿Las heladeras funcionan a temperaturas adecuadas?', null, true),
    (v_cat, 6, '¿Los freezers mantienen las condiciones requeridas?', null, true),
    (v_cat, 7, '¿Se registran las temperaturas cuando corresponde?', null, false),
    (v_cat, 8, '¿La mercadería está correctamente rotulada?', null, false),
    (v_cat, 9, '¿Se respetan los vencimientos?', null, true),
    (v_cat, 10, '¿Se utiliza un sistema de rotación por vencimiento?', null, false),
    (v_cat, 11, '¿Los alimentos se conservan correctamente?', null, true),
    (v_cat, 12, '¿Se previene la contaminación cruzada?', null, true),
    (v_cat, 13, '¿El personal realiza lavado de manos correctamente?', null, false),
    (v_cat, 14, '¿Se utilizan los elementos de higiene exigibles?', null, false),
    (v_cat, 15, '¿Los utensilios se encuentran limpios?', null, false),
    (v_cat, 16, '¿Los baños están correctamente higienizados?', null, false),
    (v_cat, 17, '¿Existe control de plagas documentado?', null, true),
    (v_cat, 18, '¿Los residuos se gestionan correctamente?', null, false),
    (v_cat, 19, '¿Los productos de limpieza están separados de los alimentos?', null, true),
    (v_cat, 20, '¿El personal posee la documentación de manipulación de alimentos exigible?', null, false),
    (v_cat, 21, '¿Se respetan los procedimientos de descongelación?', null, false),
    (v_cat, 22, '¿Se mantienen las condiciones de conservación durante la recepción?', null, false),
    (v_cat, 23, '¿Se verifican las condiciones sanitarias del hielo y agua utilizados?', null, true),
    (v_cat, 24, '¿Se cumplen los procedimientos de limpieza y desinfección?', null, false),
    (v_cat, 25, '¿Existen evidencias de riesgos sanitarios que requieran intervención inmediata?', 'Puntuar el cumplimiento: 5 = no se observan riesgos. Si existe un riesgo, marcarlo como crítico.', true);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 5, 'inventarios', 'Inventarios', 7, null, null, 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿El stock físico coincide con el registrado?', null, false),
    (v_cat, 2, '¿Existen diferencias sin justificar?', 'Puntuar el cumplimiento: 5 = no existen diferencias sin justificar.', false),
    (v_cat, 3, '¿La mercadería está organizada?', null, false),
    (v_cat, 4, '¿Se realiza rotación por vencimiento?', null, false),
    (v_cat, 5, '¿Se registran los desperdicios?', null, false),
    (v_cat, 6, '¿Los consumos internos están documentados?', null, false),
    (v_cat, 7, '¿Se controlan los faltantes?', null, false),
    (v_cat, 8, '¿Se controlan los sobrantes?', null, false),
    (v_cat, 9, '¿Los ajustes de inventario están autorizados?', null, false),
    (v_cat, 10, '¿Se documentan transferencias de mercadería?', null, false),
    (v_cat, 11, '¿Los productos de mayor rotación tienen stock suficiente?', null, false),
    (v_cat, 12, '¿Se detecta mercadería inmovilizada innecesariamente?', 'Puntuar el cumplimiento: 5 = no hay mercadería inmovilizada innecesariamente.', false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 6, 'compras_abastecimiento', 'Compras y abastecimiento', 5, null, 'atribucion', 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿Los pedidos a fábrica se realizan correctamente?', null, false),
    (v_cat, 2, '¿Se respetan los procedimientos de pedido?', null, false),
    (v_cat, 3, '¿Se compran los productos obligatorios a fábrica según contrato?', null, false),
    (v_cat, 4, '¿Se utilizan proveedores autorizados?', null, false),
    (v_cat, 5, '¿Se controla la mercadería recibida?', null, false),
    (v_cat, 6, '¿Se revisan cantidades y calidad?', null, false),
    (v_cat, 7, '¿Se verifican los remitos?', null, false),
    (v_cat, 8, '¿Se registran diferencias y rechazos?', null, false),
    (v_cat, 9, '¿Se notifican problemas de abastecimiento?', null, false),
    (v_cat, 10, '¿La sucursal evita quiebres de stock por mala planificación?', null, false),
    (v_cat, 11, '¿La fábrica cumple con los compromisos de entrega?', 'Control atribuible a la franquiciante.', false),
    (v_cat, 12, '¿Se identifican los problemas de calidad originados en fábrica?', 'Registrar si el problema es atribuible a la franquiciante.', false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 7, 'ventas_caja', 'Ventas y caja', 8, null, 'caja', 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿Se registran todas las ventas?', null, false),
    (v_cat, 2, '¿Se emiten los comprobantes correspondientes?', null, false),
    (v_cat, 3, '¿Se realizan los cierres de caja?', null, false),
    (v_cat, 4, '¿Existen diferencias recurrentes?', 'Puntuar el cumplimiento: 5 = no existen diferencias recurrentes.', false),
    (v_cat, 5, '¿Los descuentos están autorizados?', null, false),
    (v_cat, 6, '¿Las notas de crédito están justificadas?', null, false),
    (v_cat, 7, '¿Las anulaciones tienen motivo documentado?', null, false),
    (v_cat, 8, '¿Las cortesías están autorizadas?', null, false),
    (v_cat, 9, '¿Los consumos internos están registrados?', null, false),
    (v_cat, 10, '¿Existen operaciones atípicas pendientes de revisión?', 'Puntuar el cumplimiento: 5 = no hay operaciones atípicas pendientes.', false),
    (v_cat, 11, '¿Los usuarios del sistema tienen permisos correctos?', null, false),
    (v_cat, 12, '¿Existen modificaciones manuales de precios sin autorización?', 'Puntuar el cumplimiento: 5 = no existen modificaciones sin autorización.', false),
    (v_cat, 13, '¿Se registran correctamente los diferentes medios de pago?', null, false),
    (v_cat, 14, '¿Los cierres coinciden con los movimientos correspondientes?', null, false),
    (v_cat, 15, '¿Se investigan las diferencias detectadas?', null, false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 8, 'rentabilidad_mermas', 'Rentabilidad y mermas', 5, null, 'indicadores', 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿Se realiza seguimiento del desperdicio diario?', null, false),
    (v_cat, 2, '¿Se planifican adecuadamente los pedidos?', null, false),
    (v_cat, 3, '¿Se analizan las ventas por producto?', null, false),
    (v_cat, 4, '¿Se controla el costo de mercadería?', null, false),
    (v_cat, 5, '¿Se revisa el ticket promedio?', null, false),
    (v_cat, 6, '¿Se identifican productos de baja rotación?', null, false),
    (v_cat, 7, '¿Se evalúan quiebres de stock y exceso de mercadería?', null, false),
    (v_cat, 8, '¿Se realizan acciones para reducir mermas?', null, false),
    (v_cat, 9, '¿Se analizan diferencias entre compras, ventas y existencias?', null, false),
    (v_cat, 10, '¿Existe un seguimiento de indicadores comerciales acordados?', null, false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 9, 'personal', 'Personal', 5, 'El auditor controla estándares y documentación. No asume funciones propias del empleador del personal del franquiciado.', null, 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿La dotación es adecuada?', null, false),
    (v_cat, 2, '¿Los empleados utilizan uniforme?', null, false),
    (v_cat, 3, '¿Mantienen buena presentación?', null, false),
    (v_cat, 4, '¿Conocen los procedimientos operativos?', null, false),
    (v_cat, 5, '¿Recibieron capacitación?', null, false),
    (v_cat, 6, '¿Existe un responsable de turno?', null, false),
    (v_cat, 7, '¿Las funciones están organizadas?', null, false),
    (v_cat, 8, '¿El trato entre compañeros es correcto?', null, false),
    (v_cat, 9, '¿El trato hacia los clientes es profesional?', null, false),
    (v_cat, 10, '¿Existe documentación laboral verificable?', null, false),
    (v_cat, 11, '¿Se cumplen los procedimientos internos de la franquicia?', null, false),
    (v_cat, 12, '¿El equipo conoce las pautas de seguridad e higiene?', null, false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 10, 'mantenimiento', 'Mantenimiento', 5, null, null, 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿La cafetera funciona correctamente?', null, false),
    (v_cat, 2, '¿El molino está calibrado y mantenido?', null, false),
    (v_cat, 3, '¿Los hornos funcionan correctamente?', null, false),
    (v_cat, 4, '¿Las heladeras están en buen estado?', null, false),
    (v_cat, 5, '¿Los freezers funcionan correctamente?', null, false),
    (v_cat, 6, '¿Las instalaciones eléctricas están en condiciones seguras?', null, true),
    (v_cat, 7, '¿Las instalaciones de gas están en condiciones seguras?', null, true),
    (v_cat, 8, '¿Los equipos de protección contra incendios cumplen los requisitos exigibles?', null, true),
    (v_cat, 9, '¿Los sanitarios funcionan correctamente?', null, false),
    (v_cat, 10, '¿El mobiliario está en buen estado?', null, false),
    (v_cat, 11, '¿Existe mantenimiento preventivo?', null, false),
    (v_cat, 12, '¿Las reparaciones pendientes están documentadas?', null, false),
    (v_cat, 13, '¿Las salidas de emergencia están despejadas?', null, true),
    (v_cat, 14, '¿Las condiciones de accesibilidad exigibles están atendidas?', null, false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 11, 'marketing', 'Marketing', 3, null, null, 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿Se implementan las campañas oficiales?', null, false),
    (v_cat, 2, '¿La cartelería promocional está vigente?', null, false),
    (v_cat, 3, '¿Se respetan las promociones autorizadas?', null, false),
    (v_cat, 4, '¿La información de precios está actualizada?', null, false),
    (v_cat, 5, '¿Las publicaciones de la sucursal respetan la marca?', null, false),
    (v_cat, 6, '¿Se utiliza correctamente el material institucional?', null, false),
    (v_cat, 7, '¿Se responden profesionalmente los reclamos digitales?', null, false),
    (v_cat, 8, '¿La información publicada sobre la sucursal es correcta?', null, false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 12, 'club_condor', 'Club El Cóndor', 3, null, 'club', 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿El QR del Club está visible?', null, false),
    (v_cat, 2, '¿Funciona correctamente?', null, false),
    (v_cat, 3, '¿El personal conoce el programa?', null, false),
    (v_cat, 4, '¿Se invita a los clientes a participar?', null, false),
    (v_cat, 5, '¿Se registran correctamente los beneficios?', null, false),
    (v_cat, 6, '¿Se respetan las promociones?', null, false),
    (v_cat, 7, '¿Los canjes se encuentran justificados?', null, false),
    (v_cat, 8, '¿Existen operaciones atípicas para revisar?', 'Puntuar el cumplimiento: 5 = no hay operaciones atípicas.', false),
    (v_cat, 9, '¿Los descuentos se aplican correctamente?', null, false),
    (v_cat, 10, '¿Se respetan las políticas de privacidad del programa?', null, false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 13, 'delivery', 'Delivery', 3, null, null, 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿Las cartas digitales están actualizadas?', null, false),
    (v_cat, 2, '¿Los productos disponibles coinciden con la oferta real?', null, false),
    (v_cat, 3, '¿Los tiempos de preparación son adecuados?', null, false),
    (v_cat, 4, '¿El empaquetado es correcto?', null, false),
    (v_cat, 5, '¿Los productos se entregan en condiciones?', null, false),
    (v_cat, 6, '¿Se registran cancelaciones?', null, false),
    (v_cat, 7, '¿Se responden los reclamos?', null, false),
    (v_cat, 8, '¿Se registran las ventas de delivery?', null, false),
    (v_cat, 9, '¿Se verifican las liquidaciones?', null, false),
    (v_cat, 10, '¿Se respetan los protocolos de conservación y transporte?', null, false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 14, 'documentacion_legal', 'Documentación legal', 4, 'Distinguir entre verificado, pendiente de verificar y no cumple. La falta de documentación aportada al auditor no siempre equivale a su inexistencia.', null, 'documento')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿La sucursal cuenta con la habilitación correspondiente?', null, true),
    (v_cat, 2, '¿El rubro explotado coincide con el autorizado?', null, false),
    (v_cat, 3, '¿La razón social responsable está identificada?', null, false),
    (v_cat, 4, '¿Se cuenta con los seguros exigibles?', null, false),
    (v_cat, 5, '¿Se dispone de la documentación sanitaria requerida?', null, false),
    (v_cat, 6, '¿Los registros de establecimientos y productos corresponden a la actividad, cuando son exigibles?', null, false),
    (v_cat, 7, '¿Se puede verificar la documentación laboral requerida?', null, false),
    (v_cat, 8, '¿Se cuenta con documentación de seguridad e higiene?', null, false),
    (v_cat, 9, '¿Se cumplen las obligaciones documentales y de información al consumidor?', null, false),
    (v_cat, 10, '¿Existen vencimientos o requerimientos administrativos pendientes?', 'Puntuar el cumplimiento: 5 = no existen pendientes.', false);

  insert into public.categories (version_id, position, code, name, weight, description, extras, kind)
  values (v_version, 15, 'contrato_franquicia', 'Contrato de franquicia', 2, 'Evaluar solo obligaciones efectivamente pactadas en el contrato vigente. Si una obligación no está pactada, marcar No aplica.', null, 'puntaje')
  returning id into v_cat;
  insert into public.questions (category_id, position, text, guidance, critical_control) values
    (v_cat, 1, '¿Se utiliza correctamente la marca?', null, false),
    (v_cat, 2, '¿Se cumple el manual operativo vigente?', null, false),
    (v_cat, 3, '¿Se respetan los productos autorizados?', null, false),
    (v_cat, 4, '¿Se utilizan proveedores permitidos?', null, false),
    (v_cat, 5, '¿Se cumplen las obligaciones de información acordadas?', null, false),
    (v_cat, 6, '¿Se respetan las condiciones comerciales pactadas?', null, false),
    (v_cat, 7, '¿Se implementan los estándares de la cadena?', null, false),
    (v_cat, 8, '¿Se cumplen los compromisos de corrección anteriores?', null, false),
    (v_cat, 9, '¿Existen incumplimientos contractuales documentados?', 'Puntuar el cumplimiento: 5 = no existen incumplimientos documentados.', false),
    (v_cat, 10, '¿La comunicación entre franquicia y franquiciante es adecuada?', null, false);
  perform set_config('app.seeding', 'off', true);
end $$;
