const supabase = require('../config/supabase');
const { manejarErrorPg } = require('../utils/pgErrors');

function serialize(p) {
  return { id: p.id, nombre: p.nombre, activo: p.activo };
}

async function listar(req, res, next) {
  try {
    const { data, error } = await supabase.from('muestra_profesores').select('*').order('nombre');
    if (error) return next(error);
    res.json({ profesores: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre } = req.body || {};
    if (!nombre || typeof nombre !== 'string') {
      return res.status(400).json({ error: 'nombre es requerido' });
    }

    const { data, error } = await supabase
      .from('muestra_profesores')
      .insert({ nombre })
      .select('*')
      .single();

    if (error) return manejarErrorPg(error, next);
    res.status(201).json({ profesor: serialize(data) });
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

    if (body.activo !== undefined) {
      if (typeof body.activo !== 'boolean') {
        return res.status(400).json({ error: 'activo debe ser boolean' });
      }
      cambios.activo = body.activo;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    const { data, error } = await supabase
      .from('muestra_profesores')
      .update(cambios)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Profesor no encontrado' });

    res.json({ profesor: serialize(data) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar };
