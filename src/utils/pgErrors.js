const CODIGOS = {
  23505: { status: 409, mensaje: 'Ya existe un registro con esos datos' },
  23503: { status: 400, mensaje: 'Referencia inválida: revisá los ids enviados' },
  23514: { status: 400, mensaje: 'El dato no cumple una regla de validación' },
};

// Traduce errores de Postgres/PostgREST a respuestas HTTP legibles, en vez de
// dejar que caigan como 500 genéricos en errorHandler.
function manejarErrorPg(error, next, mensajesPersonalizados = {}) {
  const conocido = CODIGOS[error.code];
  if (!conocido) return next(error);

  const err = new Error(mensajesPersonalizados[error.code] || conocido.mensaje);
  err.status = conocido.status;
  next(err);
}

module.exports = { manejarErrorPg };
