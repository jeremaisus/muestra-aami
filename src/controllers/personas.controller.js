const supabase = require('../config/supabase');
const { manejarErrorPg } = require('../utils/pgErrors');

function serialize(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    showId: p.show_id,
    participa: p.participa,
    observaciones: p.observaciones,
  };
}

async function listar(req, res, next) {
  try {
    let query = supabase.from('muestra_personas').select('*').order('nombre');
    if (req.query.showId) query = query.eq('show_id', req.query.showId);

    const { data, error } = await query;
    if (error) return next(error);

    res.json({ personas: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('muestra_personas')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Persona no encontrada' });

    res.json({ persona: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, showId, observaciones } = req.body || {};
    if (!nombre || !showId) {
      return res.status(400).json({ error: 'nombre y showId son requeridos' });
    }

    const { data, error } = await supabase
      .from('muestra_personas')
      .insert({ nombre, show_id: showId, observaciones: observaciones ?? null })
      .select('*')
      .single();

    if (error) return manejarErrorPg(error, next, { 23503: 'showId inválido' });
    res.status(201).json({ persona: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const cambios = {};

    if (body.nombre !== undefined) {
      if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
        return res.status(400).json({ error: 'nombre inválido' });
      }
      cambios.nombre = body.nombre;
    }

    if (body.participa !== undefined) {
      if (typeof body.participa !== 'boolean') {
        return res.status(400).json({ error: 'participa debe ser boolean' });
      }
      cambios.participa = body.participa;
    }

    if (body.observaciones !== undefined) {
      cambios.observaciones = body.observaciones;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    const { data, error } = await supabase
      .from('muestra_personas')
      .update(cambios)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Persona no encontrada' });

    res.json({ persona: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const { error, count } = await supabase
      .from('muestra_personas')
      .delete({ count: 'exact' })
      .eq('id', req.params.id);

    if (error) return next(error);
    if (!count) return res.status(404).json({ error: 'Persona no encontrada' });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
