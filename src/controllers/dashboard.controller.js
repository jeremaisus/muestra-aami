const supabase = require('../config/supabase');

function serializeFaltante(f) {
  return {
    cancionId: f.cancion_id,
    titulo: f.titulo,
    muestra: f.muestra,
    estado: f.estado,
    instrumento: f.instrumento,
    numero: f.numero,
    slotId: f.slot_id,
  };
}

function serializeSinAsignar(a) {
  return {
    alumnoId: a.alumno_id,
    nombre: a.nombre,
    instrumento: a.instrumento,
    profesor: a.profesor,
    muestra: a.muestra,
  };
}

// Las vistas del esquema exponen el nombre de la muestra, no el show_id, así
// que si viene showId por query lo resolvemos a nombre antes de filtrar.
async function resolverNombreShow(showId) {
  if (!showId) return null;
  const { data, error } = await supabase.from('muestra_shows').select('nombre').eq('id', showId).maybeSingle();
  if (error) throw error;
  return data?.nombre || null;
}

async function faltantes(req, res, next) {
  try {
    const nombreShow = await resolverNombreShow(req.query.showId);
    let query = supabase.from('muestra_v_faltantes').select('*');
    if (nombreShow) query = query.eq('muestra', nombreShow);

    const { data, error } = await query;
    if (error) return next(error);

    res.json({ faltantes: data.map(serializeFaltante) });
  } catch (err) {
    next(err);
  }
}

async function sinAsignar(req, res, next) {
  try {
    const nombreShow = await resolverNombreShow(req.query.showId);
    let query = supabase.from('muestra_v_sin_asignar').select('*');
    if (nombreShow) query = query.eq('muestra', nombreShow);

    const { data, error } = await query;
    if (error) return next(error);

    res.json({ sinAsignar: data.map(serializeSinAsignar) });
  } catch (err) {
    next(err);
  }
}

module.exports = { faltantes, sinAsignar };
