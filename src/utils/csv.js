function parsearLinea(linea) {
  const campos = [];
  let actual = '';
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (entreComillas) {
      if (c === '"') {
        if (linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        actual += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ',') {
      campos.push(actual.trim());
      actual = '';
    } else {
      actual += c;
    }
  }
  campos.push(actual.trim());
  return campos;
}

// Espera una fila de encabezado. No devuelve objetos con las columnas
// originales: el caller decide qué hacer con `columnas` (nombres en
// minúscula) y `filas` (arrays paralelos).
function parsearCSV(texto) {
  const lineas = texto.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
  if (lineas.length === 0) return { columnas: [], filas: [] };

  const columnas = parsearLinea(lineas[0]).map((c) => c.toLowerCase());
  const filas = lineas.slice(1).map(parsearLinea);

  return { columnas, filas };
}

module.exports = { parsearCSV };
