const { normalizarTexto } = require('../utils/normalizarTexto');

// minúsculas, sin tildes, sin espacios dobles — mismo criterio que titulo_norm
// en el índice único del esquema (unique (show_id, titulo_norm)).
function normalizarTitulo(texto) {
  return normalizarTexto(texto);
}

module.exports = { normalizarTitulo };
