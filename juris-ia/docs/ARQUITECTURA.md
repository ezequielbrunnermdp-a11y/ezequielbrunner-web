# Arquitectura — JURIS IA

```
Navegador (Next.js / React)
  ├─ Buscador · Incorporar causa
  └─ Causa: [Documentos] [Visor + búsqueda] [Chat]  + pestañas
        │  fetch / SSE (streaming)
Next.js Route Handlers (src/app/api/**)
  ├─ auth.ts ........ sesiones (cookie httpOnly, hash SHA-256 del token), control de acceso por causa, auditoría
  ├─ ingest.ts ...... original → storage.ts (AES-256-GCM, SHA-256) → extract/* (pdfjs, mammoth, HTML, OCR con Claude)
  │                   → chunk.ts (fragmentos por página, segmentos citables) → PostgreSQL
  │                   → after(): classify.ts (Claude, salida estructurada) + embeddings.ts (Voyage, opcional)
  ├─ retrieval.ts ... full-text en español + trigramas (+ pgvector) → Reciprocal Rank Fusion
  ├─ agent.ts ....... bucle agéntico con streaming: buscar_en_expediente · leer_documento · listar_actuaciones [· web_search]
  ├─ chat.ts ........ historial append-only por conversación; inventario y perspectiva como mensajes de sistema intermedios
  ├─ citations.ts ... search_result_location → documento/fecha/página + verificación contra el texto almacenado
  ├─ reports.ts ..... informes (texto completo si cabe; si no, lectura con herramientas)
  ├─ export/ ........ PDF (pdfkit) y DOCX (docx) con referencias documentales
  └─ search.ts ...... búsqueda de causas, homónimos, relacionadas, fuentes consultadas
PostgreSQL 16: users, sessions, cases, case_members, case_parties, documents, document_pages,
               chunks (tsvector + vector(1024)), actuaciones, chat_threads, chat_messages, reports, audit_log
Almacenamiento privado: STORAGE_DIR/AAAA-MM/<uuid>.bin (cifrado)
```

## Cómo se garantiza que las respuestas se basen en el expediente

1. **Fragmentos anclados**: cada fragmento pertenece a una sola página o sección de un documento. Dentro del fragmento, el texto se divide en segmentos (la unidad mínima de cita). Un test de invariante asegura que la segmentación no pierde caracteres.
2. **Citas nativas de la API**: los fragmentos se entregan como bloques `search_result` (`source = chunk:<uuid>`). Claude no puede "redactar" el texto citado: la API devuelve en `cited_text` el contenido exacto de los segmentos.
3. **Verificación independiente**: `renderWithCitations` busca el fragmento por su `uuid` y comprueba que `cited_text` esté contenido en el texto almacenado. Si no está, la cita se marca **NO VERIFICADA**, en rojo en la interfaz y en las exportaciones.
4. **Instrucciones**: el prompt de sistema exige:
   - distinguir hecho alegado, hecho acreditado, decisión judicial e interpretación;
   - reconocer la información insuficiente;
   - no presumir que el expediente está completo;
   - no inventar jurisprudencia;
   - no dar probabilidades numéricas.
5. **Inventario y faltantes**: en cada turno, si el inventario cambió, Claude recibe la lista de documentos, las páginas OCR o sin texto, y las piezas habituales no incorporadas.
6. **OCR marcado**: el texto transcripto por IA queda rotulado (`ocr_ia`), y Claude y la interfaz advierten que hay que cotejarlo.

## Decisiones técnicas

- **Historial append-only**. Claude Opus 5.5 vincula sus bloques de razonamiento al prefijo de la conversación. Por eso el prompt de sistema es fijo y los cambios de inventario y perspectiva se agregan como mensajes `role: "system"`. Además se envía `prefix_mismatch_behavior: "drop_block"` como red de seguridad.
- **Prompt caching** automático (`cache_control` de primer nivel). Abarata los turnos sucesivos con resultados de herramientas extensos.
- **Fallback del servidor** (`fallbacks: "default"`) ante rechazos de clasificadores de seguridad.
- **Streaming SSE**: el texto llega a medida que se genera, más los estados de búsqueda. Al cerrar cada turno, el mensaje final se reemplaza por la versión con citas verificadas.
- **Sin dependencias de ORM**: SQL explícito con `pg`. Esquema idempotente en `db/schema.sql`.

## Límites conocidos

- La clasificación es **por archivo**: un PDF que contiene un expediente completo se clasifica como una sola pieza. Para una cronología fina conviene incorporar las piezas por separado o importar el listado de movimientos.
- Sin `VOYAGE_API_KEY`, la recuperación es solo léxica. El agente compensa con varias búsquedas y lectura completa, pero no hay similitud semántica.
- El procesamiento de la carga es sincrónico (extracción y OCR) dentro de la petición, con un límite de 50 MB por archivo. Para volúmenes grandes conviene una cola de trabajos.
- Las alertas y el seguimiento automático no están implementados.
