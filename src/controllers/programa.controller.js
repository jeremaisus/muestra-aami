const supabase = require('../config/supabase');

function serialize(c) {
  return {
    id: c.id,
    titulo: c.titulo,
    artista: c.artista,
    estado: c.estado,
    ordenPrograma: c.orden_programa,
  };
}

async function obtener(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('muestra_canciones')
      .select('*')
      .eq('show_id', req.params.id)
      .order('orden_programa', { ascending: true, nullsFirst: false });

    if (error) return next(error);
    res.json({ programa: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

async function reordenar(req, res, next) {
  try {
    const { id: showId } = req.params;
    const { cancionIds } = req.body || {};

    if (!Array.isArray(cancionIds) || cancionIds.length === 0) {
      return res.status(400).json({ error: 'cancionIds es requerido' });
    }

    const { data: existentes, error: errorFetch } = await supabase
      .from('muestra_canciones')
      .select('id')
      .eq('show_id', showId)
      .in('id', cancionIds);

    if (errorFetch) return next(errorFetch);
    if (existentes.length !== cancionIds.length) {
      return res.status(400).json({ error: 'Alguno de los cancionIds no pertenece a esta muestra' });
    }

    for (let i = 0; i < cancionIds.length; i++) {
      const { error } = await supabase
        .from('muestra_canciones')
        .update({ orden_programa: i + 1 })
        .eq('id', cancionIds[i]);

      if (error) return next(error);
    }

    const { data, error: errorFinal } = await supabase
      .from('muestra_canciones')
      .select('*')
      .eq('show_id', showId)
      .order('orden_programa', { ascending: true, nullsFirst: false });

    if (errorFinal) return next(errorFinal);
    res.json({ programa: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

module.exports = { obtener, reordenar };
