const supabase = require('../config/supabase');

// muestra_clases no tiene show_id propio: la muestra de un bloque surge de
// la persona de sus alumnos (alumno -> persona -> show_id). Filtrar por
// showId implica resolver primero qué clases tienen al menos un alumno de
// esa muestra, antes de armar la query principal.
async function idsClasesPorMuestra(showId) {
  const { data: alumnos, error: errorAlumnos } = await supabase
    .from('muestra_alumnos')
    .select('id, persona:muestra_personas!inner(show_id)')
    .eq('persona.show_id', showId);

  if (errorAlumnos) throw errorAlumnos;
  if (alumnos.length === 0) return [];

  const { data: claseAlumnos, error: errorClaseAlumnos } = await supabase
    .from('muestra_clase_alumnos')
    .select('clase_id')
    .in(
      'alumno_id',
      alumnos.map((a) => a.id)
    );

  if (errorClaseAlumnos) throw errorClaseAlumnos;

  return [...new Set(claseAlumnos.map((ca) => ca.clase_id))];
}

module.exports = { idsClasesPorMuestra };
