
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}. Ver .env.example`);
  return v;
}

export const env = {
  /** DATABASE_URL (local) o NETLIFY_DB_URL (Netlify Database, inyectada en el despliegue). */
  get databaseUrl() {
    const v = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL;
    if (!v) throw new Error("Falta DATABASE_URL (o NETLIFY_DB_URL en Netlify). Ver .env.example");
    return v;
  },
  /** true cuando corre en Netlify (funciones sin disco persistente y con límite de 60 s). */
  get onNetlify() {
    return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_DB_URL);
  },
  /** Secreto compartido entre la app y la función de segundo plano. */
  get workerSecret() {
    return required("WORKER_SECRET");
  },
  /** URL pública del sitio (Netlify la define como URL). */
  get siteUrl() {
    return process.env.URL || process.env.SITE_URL || "http://localhost:3000";
  },
  /** Token para crear el primer usuario administrador desde /configuracion-inicial. */
  get setupToken() {
    return process.env.SETUP_TOKEN || "";
  },
  /** Clave de 32 bytes en base64 para cifrar los documentos en reposo (AES-256-GCM). */
  get encryptionKey(): Buffer {
    const key = Buffer.from(required("DOCUMENT_ENCRYPTION_KEY"), "base64");
    if (key.length !== 32) throw new Error("DOCUMENT_ENCRYPTION_KEY debe ser 32 bytes en base64");
    return key;
  },
  get storageDir() {
    return process.env.STORAGE_DIR || "./storage";
  },
  get claudeModel() {
    return process.env.CLAUDE_MODEL || "claude-opus-5-5";
  },
  /** Embeddings semánticos (opcional). Sin clave, la recuperación usa búsqueda léxica. */
  get voyageApiKey() {
    return process.env.VOYAGE_API_KEY || "";
  },
  get voyageModel() {
    return process.env.VOYAGE_MODEL || "voyage-3.5";
  },
  /** Búsqueda web de jurisprudencia restringida a dominios oficiales (requiere que la organización tenga habilitada la herramienta web_search). */
  get webSearchEnabled() {
    return process.env.JURISPRUDENCIA_WEB_SEARCH === "true";
  },
  get secureCookies() {
    return process.env.NODE_ENV === "production";
  },
};
