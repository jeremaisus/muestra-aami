const supabase = require('../config/supabase');

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function serialize(show) {
  return {
    id: show.id,
    nombre: show.nombre,
    fecha: show.fecha,
    orden: show.orden,
  };
}

async function listar(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('muestra_shows')
      .select('*')
      .order('orden', { ascending: true, nullsFirst: false });

    if (error) return next(error);

    res.json({ shows: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const cambios = {};

    if (body.fecha !== undefined) {
      if (body.fecha !== null && !FECHA_ISO.test(body.fecha)) {
        return res.status(400).json({ error: 'fecha debe tener formato YYYY-MM-DD' });
      }
      cambios.fecha = body.fecha;
    }

    if (body.orden !== undefined) {
      if (!Number.isInteger(body.orden)) {
        return res.status(400).json({ error: 'orden debe ser un número entero' });
      }
      cambios.orden = body.orden;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    const { data, error } = await supabase
      .from('muestra_shows')
      .update(cambios)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Muestra no encontrada' });

    res.json({ show: serialize(data) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, actualizar };
