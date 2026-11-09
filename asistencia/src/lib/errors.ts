/** Error de negocio con código estable y mensaje apto para mostrar al usuario. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const forbidden = (msg = "No tenés permiso para realizar esta acción.") => new AppError("forbidden", msg, 403);
export const notFound = (msg = "No encontrado.") => new AppError("not_found", msg, 404);
