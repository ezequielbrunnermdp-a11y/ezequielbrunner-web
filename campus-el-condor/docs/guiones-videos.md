# Guiones originales para videos de El Cóndor

Estado: **guiones redactados, videos no producidos.** El campus muestra “Video propio pendiente” y ofrece el texto equivalente.
Los textos son originales; no reproducen frases de materiales de otros comercios.

Recomendaciones de producción: MP4 (H.264 + AAC), 720p, duración de 60 a 90 segundos, subtítulos en WebVTT (`.vtt`),
imágenes reales de El Cóndor con autorización de las personas que aparezcan. Verificá el peso final (límite de 25 MiB por archivo en Cloudflare Pages).

## Guion 1 — Bienvenido al equipo (módulo 1)

Bienvenido a El Cóndor. En esta primera etapa vas a conocer cómo se organiza el trabajo y qué necesitás para atender con claridad. Vas a aprender a consultar el catálogo, registrar pedidos y coordinarte con el equipo. Cada sector aporta algo a la experiencia del cliente: recibir, preparar, entregar y resolver son partes de un mismo recorrido. Si algo no está claro, preguntá. Una consulta a tiempo puede evitar un error y ayudarte a trabajar con más confianza. Empezá por identificar a tu referente, conocer las novedades del turno y recorrer los materiales de este campus. Después, llevá cada aprendizaje a la práctica.

Sugerencia de imágenes: ingreso al local, equipo en sus puestos, una persona consultando a su referente, el campus en un teléfono.

## Guion 2 — Una atención que acompaña (módulo 2)

Una buena atención se construye durante toda la visita. Primero, recibimos y orientamos. Después escuchamos qué busca la persona y recomendamos con información real. Al entregar, revisamos que el pedido coincida con lo solicitado y esté en condiciones. Durante la visita observamos si falta algo y nos acercamos con criterio. Al cerrar, gestionamos la cuenta con claridad, escuchamos las observaciones y agradecemos la visita. No hace falta hablar todo el tiempo: hace falta estar disponibles y cumplir lo que comunicamos. Si surge una dificultad, consultamos y buscamos una solución dentro del circuito del local.

Sugerencia de imágenes: los cinco momentos en secuencia, con planos breves de saludo, toma de pedido, revisión en barra, mesa y despedida.

## Guion 3 — Prepararte para cada turno (módulo 6)

Antes de empezar, revisá tus tareas, las novedades y los materiales del sector. Mantené el orden y seguí los procedimientos de higiene correspondientes. Si cambia un pedido, dejá el registro adecuado y avisá a quienes preparan y cobran. Si encontrás una condición insegura o información que no podés confirmar, consultá a la persona responsable. Durante los primeros días vas a necesitar práctica y acompañamiento. Usá las devoluciones para elegir qué reforzar y volvé al campus cuando quieras repasar. Trabajar en equipo también significa compartir información a tiempo y pedir ayuda cuando hace falta.

Sugerencia de imágenes: preparación del puesto, lavado de manos según procedimiento, corrección de una comanda, conversación de devolución.

## Cómo incorporarlos

- En un dispositivo: “Gestionar contenido” → Archivos → Videos propios (se guarda solo en ese navegador).
- Para todo el equipo: alojar el video (en `public/materiales/` si pesa menos de 25 MiB, o en un servicio de video) y completar `src` (y `captions` si hay subtítulos) en `src/content/library.ts`; luego publicar una nueva versión.
