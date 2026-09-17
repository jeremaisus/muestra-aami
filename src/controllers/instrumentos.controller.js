const supabase = require('../config/supabase');

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function serialize(instrumento) {
  return {
    id: instrumento.id,
    nombre: instrumento.nombre,
    color: instrumento.color,
    esPersonalizado: instrumento.es_personalizado,
    activo: instrumento.activo,
    orden: instrumento.orden,
  };
}

async function listar(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('muestra_instrumentos')
      .select('*')
      .order('orden', { ascending: true, nullsFirst: false });

    if (error) return next(error);

    res.json({ instrumentos: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, color, orden } = req.body || {};

    if (!nombre || !color) {
      return res.status(400).json({ error: 'nombre y color son requeridos' });
    }
    if (!HEX_COLOR.test(color)) {
      return res.status(400).json({ error: 'color debe ser un hex de 6 dígitos, ej. #E8603C' });
    }
    if (orden !== undefined && orden !== null && !Number.isInteger(orden)) {
      return res.status(400).json({ error: 'orden debe ser un número entero' });
    }

    // Los que vienen de acá son siempre la opción "otro" personalizada:
    // el catálogo cerrado ya está cargado por el schema SQL.
    const { data, error } = await supabase
      .from('muestra_instrumentos')
      .insert({ nombre, color, orden: orden ?? null, es_personalizado: true })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un instrumento con ese nombre' });
      }
      return next(error);
    }

    res.status(201).json({ instrumento: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const cambios = {};

    if (body.activo !== undefined) {
      if (typeof body.activo !== 'boolean') {
        return res.status(400).json({ error: 'activo debe ser boolean' });
      }
      cambios.activo = body.activo;
    }

    if (body.color !== undefined) {
      if (!HEX_COLOR.test(body.color)) {
        return res.status(400).json({ error: 'color debe ser un hex de 6 dígitos, ej. #E8603C' });
      }
      cambios.color = body.color;
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
      .from('muestra_instrumentos')
      .update(cambios)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Instrumento no encontrado' });

    res.json({ instrumento: serialize(data) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar };
