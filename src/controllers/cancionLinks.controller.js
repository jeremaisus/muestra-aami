const supabase = require('../config/supabase');
const { manejarErrorPg } = require('../utils/pgErrors');

const URL_HTTP = /^https?:\/\//i;

function serialize(l) {
  return { id: l.id, cancionId: l.cancion_id, etiqueta: l.etiqueta, url: l.url, orden: l.orden };
}

async function listarPorCancion(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('muestra_cancion_links')
      .select('*')
      .eq('cancion_id', req.params.id)
      .order('orden');

    if (error) return next(error);
    res.json({ links: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { etiqueta, url, orden } = req.body || {};
    if (!etiqueta || !url) {
      return res.status(400).json({ error: 'etiqueta y url son requeridos' });
    }
    if (!URL_HTTP.test(url)) {
      return res.status(400).json({ error: 'url debe empezar con http:// o https://' });
    }

    const { data, error } = await supabase
      .from('muestra_cancion_links')
      .insert({ cancion_id: req.params.id, etiqueta, url, orden: orden ?? 1 })
      .select('*')
      .single();

    if (error) return manejarErrorPg(error, next, { 23503: 'cancionId inválido' });
    res.status(201).json({ link: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const body = req.body || {};
    const cambios = {};

    if (body.etiqueta !== undefined) cambios.etiqueta = body.etiqueta;
    if (body.orden !== undefined) cambios.orden = body.orden;
    if (body.url !== undefined) {
      if (!URL_HTTP.test(body.url)) {
        return res.status(400).json({ error: 'url debe empezar con http:// o https://' });
      }
      cambios.url = body.url;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    const { data, error } = await supabase
      .from('muestra_cancion_links')
      .update(cambios)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Link no encontrado' });

    res.json({ link: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const { error, count } = await supabase
      .from('muestra_cancion_links')
      .delete({ count: 'exact' })
      .eq('id', req.params.id);

    if (error) return next(error);
    if (!count) return res.status(404).json({ error: 'Link no encontrado' });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listarPorCancion, crear, actualizar, eliminar };
