# Ventas por empleado (Morphi)

Código de la página publicada como artifact en claude.ai:
https://claude.ai/artifact/NW1Pe2ntATJ5TR4vRHSkVH

- Lee las ventas en vivo desde el conector **Morphi** de Claude (solo lectura: `sucursales`, `referencias_de_ventas`, `ventas`).
  No tiene credenciales: cada persona que la abre usa su propia conexión a Morphi.
- Solo funciona abierta en claude.ai (fuera de ahí muestra un aviso).
- Se publica con la herramienta Artifact, no con el sitio web. `artifact.html` es el contenido de la página
  (sin `<html>`/`<head>`: claude.ai los agrega al publicar).

## Ranking inteligente — solo Puerto de Palos

Puntaje 0–100 por camarero. En cada indicador, el mejor del período saca 100 y el resto en proporción.
El total es el promedio ponderado (pesos configurables desde el panel "Configurar" de la página, guardados en
la base de la página, documento `config/ranking-ppalos`).

| Indicador | Peso sugerido | Fuente en Morphi |
|---|---|---|
| Facturación por cubierto | 25 | ventas por mozo (importe ÷ cubiertos) |
| Ticket promedio | 15 | ventas por mozo (importe ÷ tickets; NC restadas) |
| Postres c/100 cubiertos | 20 | rubros 011 POSTRES y 588 VOLCAN DE CHOCOLATE |
| Parrilladas de mariscos c/100 cub. | 15 | producto 248 PARRI PESCADOS Y MARISCOS |
| Degustaciones de pescados c/100 cub. | 15 | producto 214 DEGUS PESC Y SAL |
| Frituras mixtas c/100 cub. | 10 | producto 019 FRITURA MIXTA |

- Unidades vendidas sueltas, menos los renglones cobrados $ 0 (regalos, invitaciones, 100 % de descuento).
- Mínimo para el ranking principal: 20 cubiertos por semana (proporcional al período). Configurable.
- Turnos por hora del ticket: mediodía 6–18 h, noche 19–5 h. Configurables.
- Fuera hasta definirlos: 215 PARRILLADA PROMO (no dice si es de pescados o carnes), Take Away 2010 y 2005.

## Asignación de plazas — Puerto de Palos

- En la página: Ranking → **Asignación de plazas**. Ranking acumulado de los últimos 7 días trabajados
  (configurable) hasta ayer. 1º Galería, 2º Español, 3º Argentino, 4º VIP, 5º Lateral; del 6º al 10º,
  segundo camarero de cada plaza; más de 10 quedan pendientes.
- Morphi no expone horarios, francos ni vacaciones (están solo en Gestión Win32). Por eso la propuesta usa a
  quienes atendieron cada turno en la ventana y queda "condicionada a disponibilidad" hasta que el encargado
  marca quién trabaja y confirma. Lo confirmado se guarda en la base de la página (`plazas/<fecha>-<turno>`)
  y no modifica el ranking.
- Correo diario: tarea programada "Puerto de Palos – asignación de plazas diaria" (7:40, hora de Argentina),
  que consulta Morphi, corre `plazas.py` y manda el correo con Gmail. `plazas.py` es el mismo motor que lleva
  la tarea (sha256 en el texto de la tarea); si se cambia, hay que actualizar también la tarea.
