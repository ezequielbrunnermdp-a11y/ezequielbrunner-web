# JURIS IA — Plataforma de inteligencia judicial (MVP)

Aplicación web para incorporar, leer, estudiar y analizar expedientes judiciales de la Provincia de Buenos Aires con Claude, con **citas verificables** a documento, fecha y página.

> **Importante:** JURIS IA **no consulta la MEV automáticamente**. La MEV exige credenciales personales y su ayuda indica que los usuarios son para personas, no para sistemas ni agentes de IA. Tampoco existe una API pública. Las causas se incorporan con documentación obtenida legítimamente. Detalle en [`docs/INVESTIGACION-INTEGRACIONES.md`](docs/INVESTIGACION-INTEGRACIONES.md).

## Qué hace (implementado y probado)

| Módulo | Estado |
|---|---|
| 1. Buscador | Búsqueda en la base local por nombre/razón social, carátula, número, receptoría, departamento, organismo y fuero. Coincidencias parciales y sin tildes. Posibles homónimos (mismo nombre con DNI/CUIT distinto o sin identificador). Causas relacionadas (número base común o parte compartida). Panel de **fuentes consultadas y no consultadas**. |
| 2. Lectura integral | Importación de PDF, DOCX, HTML, TXT e imágenes. Extracción por página. OCR con Claude para páginas escaneadas, marcado como "OCR-IA". Original cifrado e íntegro (SHA-256). Clasificación automática revisable (demanda, contestación, pericia, sentencia…). Aviso de **piezas faltantes** y de páginas sin texto. |
| 3. Chat por causa | Un chat (con varias conversaciones) por expediente. RAG agéntico con búsqueda y lectura completa de piezas. Citas nativas `search_result` **verificadas contra el texto almacenado**; las no verificadas se marcan en rojo. Al hacer clic en una cita se abre el documento en la página citada, con el texto resaltado. Perspectivas: neutral, actor, demandado, juez. Contexto persistente. |
| 4. Análisis profundo | Botón **ANALIZAR EXPEDIENTE**: informe A–F (identificación, historia procesal, prueba, análisis jurídico, escenarios, limitaciones). Envía el texto completo si cabe (~1,4 M caracteres); si no, lee con herramientas. Sin probabilidades numéricas. |
| 5. Cronología | Línea de tiempo con las actuaciones de los documentos y de los listados de movimientos importados. Filtros por categoría y enlace al documento. |
| 6. Estrategia | Análisis desde la posición del actor, del demandado o neutral, rotulado como estrategia hipotética. |
| 7. Jurisprudencia | Enlaces oficiales (JUBA, SAIJ, CSJN, InfoLEG, Normas GBA) y búsqueda opcional de Claude restringida a dominios oficiales, con URL de fuente. |
| 8. Informes | Resumen ejecutivo, informe integral, cronología, análisis de pruebas, comparación demanda/contestación, informe de sentencia, posibles agravios y seguimiento. **Exportación PDF y Word** con referencias documentales. |
| 9. Interfaz | Oscura y sobria, en tres paneles: documentos, visor con búsqueda y chat ampliable a pantalla completa. Pestañas de cronología, pruebas, análisis, estrategia, jurisprudencia, informes y datos. |
| 10. Arquitectura | Next.js 16, TypeScript, Tailwind 4, PostgreSQL 16 con pgvector, pg_trgm y unaccent. Almacenamiento privado cifrado. Autenticación con sesiones. Control de acceso por causa. Auditoría. |

**No implementado todavía** (etapa 5): alertas automáticas, seguimiento periódico, roles de estudio con invitaciones desde la interfaz (existe `case_members` en la base pero no hay pantalla), división automática de un PDF que contiene un expediente completo en sus piezas (hoy se clasifica como un único documento) y un conector oficial con la MEV.

## Requisitos

- Node.js 20 o superior (probado con 22).
- PostgreSQL 16 con las extensiones `vector` (pgvector), `pg_trgm` y `unaccent`.
- Una API key de Anthropic.
- Opcional: una API key de Voyage AI para la búsqueda semántica.

## Instalación

```bash
cd juris-ia
npm install

# Base de datos (opción Docker)
docker compose up -d

# Variables de entorno
cp .env.example .env
#  - ANTHROPIC_API_KEY=...
#  - DOCUMENT_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
set -a; . ./.env; set +a

npm run db:migrate                      # aplica db/schema.sql (idempotente)
npm run user:create -- vos@estudio.com.ar "Nombre Apellido" admin   # pide la contraseña (mín. 12)

npm run build && npm start              # producción, en http://localhost:3000
# o bien: npm run dev
```

Sin Docker, en Debian/Ubuntu: `apt install postgresql-16 postgresql-16-pgvector`. Después, como superusuario: `CREATE EXTENSION vector; CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent;` en la base `juris`.

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión de PostgreSQL. |
| `DOCUMENT_ENCRYPTION_KEY` | Sí | 32 bytes en base64 (AES-256-GCM). **Si se pierde, no se pueden leer los originales.** Guardarla en un gestor de secretos. |
| `ANTHROPIC_API_KEY` | Sí, para la IA | Sin ella funcionan la importación, la búsqueda, el visor, la cronología y la exportación, pero no el chat, los informes, la clasificación ni el OCR. |
| `CLAUDE_MODEL` | No | Por defecto `claude-opus-5-5`. |
| `STORAGE_DIR` | No | Directorio privado de los originales cifrados (por defecto `./storage`). |
| `VOYAGE_API_KEY` / `VOYAGE_MODEL` | No | Embeddings para la búsqueda híbrida. |
| `JURISPRUDENCIA_WEB_SEARCH` | No | `true` habilita la búsqueda web de Claude restringida a dominios oficiales (la organización debe tenerla habilitada). |

## Uso

1. **Incorporar causa**: cargar los datos (carátula, número, receptoría, departamento, organismo, fuero y partes) y el origen de la documentación. Hay que declarar la licitud del acceso. Si la causa es reservada, también el fundamento de la autorización.
2. **Incorporar documentos**: arrastrar los PDF o demás archivos al panel izquierdo. La clasificación automática se puede corregir en "Datos e importación".
3. **Importar movimientos**: pegar el listado de trámites copiado de la MEV (consultada personalmente), revisar la vista previa y luego importarlo.
4. **Chat**: preguntar en lenguaje natural. Al hacer clic en una cita se abre el original en la página correspondiente.
5. **ANALIZAR EXPEDIENTE**, **Estrategia** e **Informes**: generar el informe y exportarlo a PDF o Word.

## Pruebas

```bash
npx tsx tests/fixtures/generar-expediente-ficticio.ts   # genera un PDF FICTICIO de 4 piezas
npm test                                                 # 18 pruebas (unitarias + integración con PostgreSQL)
npm run typecheck
npm run eval:citas                                       # requiere ANTHROPIC_API_KEY: evalúa respuestas reales
```

- **Unitarias**: fragmentación (con un invariante que garantiza que no se pierde texto), verificación de citas, parser de movimientos, cifrado y contraseñas, extracción de PDF, homónimos, exportación a PDF y DOCX.
- **Integración** (requieren `DATABASE_URL` y `DOCUMENT_ENCRYPTION_KEY`): ingesta real, integridad del original, duplicados, recuperación de la página pertinente, resolución y verificación de citas con la estructura documentada de la API, inventario y faltantes.
- **`eval:citas`**: hace preguntas reales a Claude sobre el expediente ficticio. Exige que todas las citas se verifiquen contra la fuente, que aparezcan los montos correctos, que reconozca la falta de pericia producida y que no invente jurisprudencia. **No se ejecutó en el entorno de desarrollo** porque no había API key: ejecútelo al configurar la clave.

El expediente de prueba es **totalmente ficticio** (lo indica en cada página). No se incluye ni se inventa ningún expediente real.

## Seguridad y datos personales

Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y la sección 5 de la investigación. En resumen:

- originales cifrados y con hash;
- sesiones `httpOnly`;
- control de acceso por causa en cada endpoint;
- auditoría;
- ningún HTML importado se ejecuta (se sirve como texto).

Antes de usarlo con datos reales, el estudio debe evaluar el envío de textos a la API de Anthropic según la Ley 25.326.
