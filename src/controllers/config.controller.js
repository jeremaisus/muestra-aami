const supabase = require('../config/supabase');

const CAMPOS_EDITABLES = ['profes_pueden_ocupar_slots', 'profes_pueden_editar_horarios', 'drive_carpeta_url'];

function serialize(config) {
  return {
    profesPuedenOcuparSlots: config.profes_pueden_ocupar_slots,
    profesPuedenEditarHorarios: config.profes_pueden_editar_horarios,
    driveCarpetaUrl: config.drive_carpeta_url,
    actualizadoEn: config.actualizado_en,
    actualizadoPor: config.actualizado_por,
  };
}

async function obtener(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('muestra_config')
      .select('*')
      .eq('id', true)
      .single();

    if (error) return next(error);

    res.json({ config: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const body = req.body || {};
    const cambios = {};

    for (const campo of CAMPOS_EDITABLES) {
      if (body[campo] !== undefined) cambios[campo] = body[campo];
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    if (
      cambios.profes_pueden_ocupar_slots !== undefined &&
      typeof cambios.profes_pueden_ocupar_slots !== 'boolean'
    ) {
      return res.status(400).json({ error: 'profes_pueden_ocupar_slots debe ser boolean' });
    }

    if (
      cambios.profes_pueden_editar_horarios !== undefined &&
      typeof cambios.profes_pueden_editar_horarios !== 'boolean'
    ) {
      return res.status(400).json({ error: 'profes_pueden_editar_horarios debe ser boolean' });
    }

    if (
      cambios.drive_carpeta_url !== undefined &&
      cambios.drive_carpeta_url !== null &&
      typeof cambios.drive_carpeta_url !== 'string'
    ) {
      return res.status(400).json({ error: 'drive_carpeta_url debe ser texto' });
    }

    cambios.actualizado_en = new Date().toISOString();
    cambios.actualizado_por = req.acceso.id;

    const { data, error } = await supabase
      .from('muestra_config')
      .update(cambios)
      .eq('id', true)
      .select('*')
      .single();

    if (error) return next(error);

    res.json({ config: serialize(data) });
  } catch (err) {
    next(err);
  }
}

module.exports = { obtener, actualizar };
