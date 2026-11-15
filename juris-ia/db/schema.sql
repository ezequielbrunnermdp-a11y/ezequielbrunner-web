-- JURIS IA — esquema PostgreSQL (idempotente).
-- Requiere las extensiones vector (pgvector), pg_trgm y unaccent.
-- Si el usuario de la app no es superusuario, crearlas antes como superusuario.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() no es IMMUTABLE; este envoltorio permite usarla en índices.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'abogado' CHECK (role IN ('admin', 'abogado')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES users(id),
  caratula         text NOT NULL,
  numero           text,
  receptoria       text,
  departamento     text,
  organismo        text,
  fuero            text,
  objeto           text,
  estado_procesal  text,
  -- Origen de la información: cómo se obtuvo legítimamente (MEV consultada por el usuario,
  -- copia del expediente, documentación del cliente, etc.).
  origen           text NOT NULL DEFAULT 'importacion_manual',
  reservada        boolean NOT NULL DEFAULT false,
  autorizacion_acceso text,           -- obligatorio si reservada = true
  notas            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT reservada OR autorizacion_acceso IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS cases_caratula_trgm ON cases USING gin (f_unaccent(lower(caratula)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS cases_numero_idx ON cases (lower(numero));
CREATE INDEX IF NOT EXISTS cases_receptoria_idx ON cases (lower(receptoria));

-- Control de acceso por causa (además del propietario).
CREATE TABLE IF NOT EXISTS case_members (
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permiso text NOT NULL DEFAULT 'lectura' CHECK (permiso IN ('lectura', 'edicion')),
  PRIMARY KEY (case_id, user_id)
);

CREATE TABLE IF NOT EXISTS case_parties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  rol           text NOT NULL DEFAULT 'otro', -- actor, demandado, tercero, perito, testigo, letrado, otro
  identificador text,                          -- DNI / CUIT / CUIL si consta
  origen        text NOT NULL DEFAULT 'usuario', -- usuario | extraido_ia (requiere verificación)
  documento_id  uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parties_nombre_trgm ON case_parties USING gin (f_unaccent(lower(nombre)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS parties_case_idx ON case_parties (case_id);

CREATE TABLE IF NOT EXISTS documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  uploaded_by     uuid NOT NULL REFERENCES users(id),
  filename        text NOT NULL,
  mime_type       text NOT NULL,
  size_bytes      bigint NOT NULL,
  sha256          text NOT NULL,            -- hash del archivo ORIGINAL (integridad)
  storage_key     text NOT NULL,            -- archivo cifrado en el almacenamiento privado
  page_count      int NOT NULL DEFAULT 0,
  -- Clasificación (la sugiere Claude; el usuario puede corregirla)
  tipo            text NOT NULL DEFAULT 'sin_clasificar',
  titulo          text,
  fecha           date,
  parte           text,
  fojas           text,
  resumen         text,
  clasificacion_origen text NOT NULL DEFAULT 'pendiente', -- pendiente | ia | usuario
  status          text NOT NULL DEFAULT 'procesando',     -- procesando | listo | error
  status_detail   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, sha256)
);
CREATE INDEX IF NOT EXISTS documents_case_idx ON documents (case_id);

CREATE TABLE IF NOT EXISTS document_pages (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number int NOT NULL,
  text        text NOT NULL,
  -- texto_nativo: capa de texto del archivo; ocr_ia: transcripción por IA de una imagen
  -- (debe verificarse contra el original); sin_texto: no se pudo extraer.
  text_source text NOT NULL DEFAULT 'texto_nativo',
  PRIMARY KEY (document_id, page_number)
);

CREATE TABLE IF NOT EXISTS chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  case_id      uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  page_number  int NOT NULL,
  ordinal      int NOT NULL,
  -- Segmentos (párrafos/oraciones). Son la unidad mínima de cita que ve Claude.
  segments     jsonb NOT NULL,
  text         text NOT NULL,
  tsv          tsvector GENERATED ALWAYS AS (to_tsvector('spanish', f_unaccent(text))) STORED,
  embedding    vector(1024)
);
CREATE INDEX IF NOT EXISTS chunks_case_idx ON chunks (case_id);
CREATE INDEX IF NOT EXISTS chunks_doc_idx ON chunks (document_id, page_number);
CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS chunks_trgm_idx ON chunks USING gin (f_unaccent(lower(text)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);

-- Actuaciones / movimientos (cronología). Pueden provenir de un documento o de un listado
-- de movimientos importado (p. ej. copiado por el usuario desde la MEV).
CREATE TABLE IF NOT EXISTS actuaciones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  fecha       date,
  tipo        text NOT NULL,
  categoria   text NOT NULL, -- demanda | contestacion | prueba | resolucion | sentencia | recurso | otro
  parte       text,
  descripcion text NOT NULL,
  origen      text NOT NULL, -- documento | listado_movimientos | usuario
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS actuaciones_case_idx ON actuaciones (case_id, fecha);

CREATE TABLE IF NOT EXISTS chat_threads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id),
  title      text NOT NULL DEFAULT 'Conversación',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cada fila guarda un mensaje de la API tal cual (append-only): los bloques de contenido,
-- incluidos thinking, tool_use y tool_result, se reenvían sin modificar.
CREATE TABLE IF NOT EXISTS chat_messages (
  id          bigserial PRIMARY KEY,
  thread_id   uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     jsonb NOT NULL,
  visible     boolean NOT NULL DEFAULT true,   -- false: resultados de herramientas, etc.
  perspectiva text,
  citas       jsonb,                           -- citas resueltas y verificadas (solo assistant)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_thread_idx ON chat_messages (thread_id, id);

CREATE TABLE IF NOT EXISTS reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id),
  kind        text NOT NULL,
  perspectiva text,
  markdown    text NOT NULL,
  citas       jsonb NOT NULL DEFAULT '[]',
  meta        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         bigserial PRIMARY KEY,
  user_id    uuid,
  action     text NOT NULL,
  case_id    uuid,
  detail     jsonb NOT NULL DEFAULT '{}',
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_case_idx ON audit_log (case_id, created_at);

-- Tareas largas (chat, informes, OCR/clasificación, jurisprudencia). En Netlify las ejecuta
-- una función de segundo plano (hasta 15 min); la interfaz consulta su avance.
CREATE TABLE IF NOT EXISTS jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  case_id    uuid REFERENCES cases(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  payload    jsonb NOT NULL,
  status     text NOT NULL DEFAULT 'pendiente', -- pendiente | en_curso | listo | error
  progreso   text,
  texto      text NOT NULL DEFAULT '',
  mensajes   jsonb NOT NULL DEFAULT '[]',
  result     jsonb,
  error      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_case_idx ON jobs (case_id, created_at);
