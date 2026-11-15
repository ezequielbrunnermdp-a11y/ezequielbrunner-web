# Investigación de integraciones — JURIS IA

Fecha de la investigación: 15/11/2026. Este documento distingue lo **verificado**, lo **no verificable desde el entorno de desarrollo** y lo **implementado**.

## 1. MEV — Mesa de Entradas Virtual (mev.scba.gov.ar)

### Qué se pudo verificar
- No se pudo abrir mev.scba.gov.ar directamente desde el entorno de desarrollo: la red lo bloqueó, tanto con `curl` como con el lector web. Lo que sigue proviene de fuentes indexadas: la ayuda de la propia MEV (`mev.scba.gov.ar/ayuda.asp`), páginas de la SCBA y avisos de colegios profesionales.
- **Acceso con usuario y contraseña personales.** El alta se hace desde la MEV ("Usuario Nuevo"), como particular o como abogado. La contraseña debe tener al menos 12 caracteres y cambiarse cada 90 días como máximo (Res. SC 101/23).
- **Criterios de búsqueda de la MEV**:
  - por **carátula**: devuelve las causas que contienen todas las palabras ingresadas;
  - por **número de causa**: coincidencia exacta, con barras y guiones;
  - por **número de receptoría**;
  - mediante **"sets" de búsqueda**: conjuntos de causas que arma el usuario.
  - Hay que **seleccionar el organismo** (departamento judicial / juzgado) donde tramita la causa.
- **Causas que requieren autorización** (reservadas): el juzgado autoriza al usuario MEV mediante una presentación electrónica. Una vez autorizada, la causa aparece en el set "Lista de causas con AUTORIZACION".
- **Restricción explícita**: según la ayuda de la MEV, los usuarios están pensados **para personas y no para sistemas informáticos ni agentes de inteligencia artificial**.
- **No se encontró ninguna API pública, web service ni convenio de integración** documentado para terceros.

### Qué no se pudo verificar
- No se pudo comprobar en la ayuda si existe búsqueda por **nombre de parte** sin carátula, ni con qué alcance.
- No se pudo ver la estructura HTML exacta de las pantallas de trámites.
- No se pudo confirmar si la SCBA tiene un procedimiento para autorizar integraciones de sistemas. Habría que consultarlo a la Subsecretaría de Tecnología Informática de la SCBA.

### Decisión de diseño
- **JURIS IA no automatiza la MEV**: no hace scraping, no inicia sesión con cuentas de usuario y no elude CAPTCHA ni controles.
- La búsqueda de causas opera sobre la **base local** de causas que el usuario incorporó. En cada búsqueda, la interfaz muestra qué fuentes se consultaron efectivamente (base local) y cuáles no (MEV y otros fueros), con el motivo.
- **Importación** de lo obtenido legítimamente:
  - documentos en PDF, DOCX, HTML guardado desde el navegador, TXT e imágenes;
  - el **listado de movimientos** copiado como texto. El parser se basa en líneas que empiezan con una fecha dd/mm/aaaa y no depende del HTML de la MEV.
- Si en el futuro la SCBA habilita una integración oficial, se puede agregar un conector en `src/lib/search.ts` (`fuentesConsultadas`) y un importador dedicado.

## 2. JUBA y otras fuentes de jurisprudencia

- JUBA (juba.scba.gov.ar) ofrece sentencias definitivas, resoluciones interlocutorias y sumarios de la SCBA desde 1984, además de buscadores separados (general y Tribunal de Casación Penal). **No se encontró una API documentada.** Tampoco se pudo acceder a juba.scba.gov.ar desde el entorno de desarrollo, por el mismo bloqueo de red.
- SAIJ, la Secretaría de Jurisprudencia de la CSJN, InfoLEG y Normas GBA: tampoco se integró ninguna API.
- **Lo implementado**:
  1. **Enlaces oficiales** para búsqueda manual y una consulta sugerida, armada con hechos, materia, tribunal y normativa.
  2. **Opcionalmente** (`JURISPRUDENCIA_WEB_SEARCH=true`), una búsqueda con la herramienta `web_search` de Claude **restringida a dominios oficiales** (`allowed_domains`). Cada antecedente vuelve con la URL de la fuente consultada. Requiere que la organización de Anthropic tenga habilitada la búsqueda web; esto no se probó en desarrollo.
- El asistente tiene la instrucción de **no citar precedentes sin fuente verificable** en la conversación.

## 3. Claude (Anthropic)

- SDK oficial `@anthropic-ai/sdk` (TypeScript). Modelo por defecto: `claude-opus-5-5`.
- **Citas nativas**: los fragmentos del expediente se envían como bloques `search_result` con `citations.enabled`. La API devuelve citas `search_result_location` con el texto citado exacto. JURIS IA las resuelve a documento, fecha y página, y **verifica cada cita contra el texto almacenado**.
- Herramientas propias: `buscar_en_expediente`, `leer_documento` y `listar_actuaciones` (RAG agéntico). Thinking adaptativo y fallback del servidor ante rechazos.
- Historial *append-only*: el prompt de sistema es fijo, y el inventario y la perspectiva se agregan como mensajes de sistema intermedios, sin reescribir turnos anteriores.
- **No se pudo probar contra la API en desarrollo** porque no había `ANTHROPIC_API_KEY`. El script `npm run eval:citas` hace esa prueba al configurar la clave.

## 4. Embeddings

- Anthropic no ofrece un endpoint de embeddings. Se integró **Voyage AI** como opción (`VOYAGE_API_KEY`) con pgvector (1024 dimensiones, índice HNSW).
- Sin esa clave, la recuperación es léxica: full-text en español con `unaccent`, más trigramas, combinados por Reciprocal Rank Fusion. Esta configuración es la que se probó.

## 5. Protección de datos (Ley 25.326)

- Documentos cifrados en reposo (AES-256-GCM) fuera del directorio público. Control de integridad con SHA-256 en cada lectura.
- Control de acceso por causa (propietario y miembros). Las causas reservadas exigen registrar el fundamento de la autorización.
- Para crear una causa hay que declarar la licitud del acceso.
- Auditoría de accesos: ver causa, abrir original, consultas al chat, búsquedas, exportaciones.
- Los textos de los documentos se envían a la API de Anthropic para el análisis. El responsable de la base de datos debe evaluar ese tratamiento: transferencia internacional, política de retención y consentimiento o base legal según la Ley 25.326 y las disposiciones de la AAIP.
