const supabase = require('../config/supabase');
const { manejarErrorPg } = require('../utils/pgErrors');
const { normalizarTitulo } = require('../services/duplicados.service');

function serialize(c) {
  return {
    id: c.id,
    showId: c.show_id,
    titulo: c.titulo,
    artista: c.artista,
    pais: c.pais,
    tonalidad: c.tonalidad,
    observaciones: c.observaciones,
    estado: c.estado,
    ordenPrograma: c.orden_programa,
  };
}

async function listar(req, res, next) {
  try {
    let query = supabase
      .from('muestra_canciones')
      .select('*')
      .order('orden_programa', { ascending: true, nullsFirst: false })
      .order('titulo');

    if (req.query.showId) query = query.eq('show_id', req.query.showId);

    const { data, error } = await query;
    if (error) return next(error);

    res.json({ canciones: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('muestra_canciones')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Canción no encontrada' });

    res.json({ cancion: serialize(data) });
  } catch (err) {
    next(err);
  }
}

// Comparación exacta sobre titulo_norm: mismo criterio que el índice único
// del esquema (unique (show_id, titulo_norm)). No es fuzzy matching.
// excludeId se usa al editar: para que una canción no se marque duplicada
// contra sí misma cuando el título no cambió.
async function checkDuplicado(req, res, next) {
  try {
    const { showId, titulo, excludeId } = req.query;
    if (!showId || !titulo) {
      return res.status(400).json({ error: 'showId y titulo son requeridos' });
    }

    const tituloNorm = normalizarTitulo(titulo);

    let query = supabase
      .from('muestra_canciones')
      .select('id, titulo')
      .eq('show_id', showId)
      .eq('titulo_norm', tituloNorm);

    if (excludeId) query = query.neq('id', excludeId);

    const { data, error } = await query.maybeSingle();

    if (error) return next(error);

    res.json({ duplicado: Boolean(data), cancion: data || null });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { showId, titulo, artista, pais, tonalidad, observaciones } = req.body || {};
    if (!showId || !titulo) {
      return res.status(400).json({ error: 'showId y titulo son requeridos' });
    }

    const { data, error } = await supabase
      .from('muestra_canciones')
      .insert({
        show_id: showId,
        titulo,
        titulo_norm: normalizarTitulo(titulo),
        artista: artista ?? null,
        pais: pais ?? null,
        tonalidad: tonalidad ?? null,
        observaciones: observaciones ?? null,
      })
      .select('*')
      .single();

    if (error) {
      return manejarErrorPg(error, next, {
        23505: 'Ya existe una canción con un título igual (o muy parecido) en esta muestra',
        23503: 'showId inválido',
      });
    }

    // Arma la banda de arranque: un slot vacío por cada instrumento activo
    // del catálogo, salvo Iniciación musical y Sin asignar (no son
    // instrumentos de banda). Es un adelanto para ahorrar pasos, no una
    // restricción: se puede borrar o sumar slots después sin problema.
    const { data: instrumentos, error: errorInstrumentos } = await supabase
      .from('muestra_instrumentos')
      .select('id')
      .eq('activo', true)
      .not('nombre', 'in', '("Iniciación musical","Sin asignar")');

    if (errorInstrumentos) return next(errorInstrumentos);

    if (instrumentos.length > 0) {
      const { error: errorSlots } = await supabase
        .from('muestra_slots')
        .insert(instrumentos.map((i) => ({ cancion_id: data.id, instrumento_id: i.id, numero: 1 })));

      if (errorSlots) return next(errorSlots);
    }

    res.status(201).json({ cancion: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const cambios = {};

    if (body.titulo !== undefined) {
      if (typeof body.titulo !== 'string' || !body.titulo.trim()) {
        return res.status(400).json({ error: 'titulo inválido' });
      }
      cambios.titulo = body.titulo;
      cambios.titulo_norm = normalizarTitulo(body.titulo);
    }
    if (body.artista !== undefined) cambios.artista = body.artista;
    if (body.pais !== undefined) cambios.pais = body.pais;
    if (body.tonalidad !== undefined) cambios.tonalidad = body.tonalidad;
    if (body.observaciones !== undefined) cambios.observaciones = body.observaciones;
    if (body.ordenPrograma !== undefined) cambios.orden_programa = body.ordenPrograma;
    if (body.showId !== undefined) cambios.show_id = body.showId;

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    const { data, error } = await supabase
      .from('muestra_canciones')
      .update(cambios)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      return manejarErrorPg(error, next, {
        23505: 'Ya existe una canción con un título igual (o muy parecido) en esta muestra',
        23503: 'showId inválido',
      });
    }
    if (!data) return res.status(404).json({ error: 'Canción no encontrada' });

    res.json({ cancion: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function actualizarEstado(req, res, next) {
  try {
    const { estado } = req.body || {};
    if (!['incompleta', 'completa'].includes(estado)) {
      return res.status(400).json({ error: "estado debe ser 'incompleta' o 'completa'" });
    }

    const { data, error } = await supabase
      .from('muestra_canciones')
      .update({ estado })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Canción no encontrada' });

    res.json({ cancion: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const { error, count } = await supabase
      .from('muestra_canciones')
      .delete({ count: 'exact' })
      .eq('id', req.params.id);

    if (error) return next(error);
    if (!count) return res.status(404).json({ error: 'Canción no encontrada' });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, checkDuplicado, crear, actualizar, actualizarEstado, eliminar };
