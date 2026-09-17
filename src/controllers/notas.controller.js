const supabase = require('../config/supabase');
const { manejarErrorPg } = require('../utils/pgErrors');

const VENTANA_EDICION_MS = 15 * 60 * 1000;

function serialize(n) {
  return {
    id: n.id,
    cancionId: n.cancion_id,
    slotId: n.slot_id,
    accesoId: n.acceso_id,
    autor: n.autor,
    texto: n.texto,
    creadaEn: n.creada_en,
    editadaEn: n.editada_en,
  };
}

async function listarPorCancion(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('muestra_notas')
      .select('*')
      .eq('cancion_id', req.params.id)
      .order('creada_en', { ascending: false });

    if (error) return next(error);
    res.json({ notas: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const cancionId = req.params.id;
    const { texto, slotId } = req.body || {};
    if (!texto || !texto.trim()) {
      return res.status(400).json({ error: 'texto es requerido' });
    }

    if (slotId) {
      const { data: slot, error: errorSlot } = await supabase
        .from('muestra_slots')
        .select('id, cancion_id')
        .eq('id', slotId)
        .maybeSingle();

      if (errorSlot) return next(errorSlot);
      if (!slot || slot.cancion_id !== cancionId) {
        return res.status(400).json({ error: 'slotId no pertenece a esta canción' });
      }
    }

    const { data, error } = await supabase
      .from('muestra_notas')
      .insert({
        cancion_id: cancionId,
        slot_id: slotId ?? null,
        acceso_id: req.acceso.id,
        autor: req.acceso.etiqueta,
        texto,
      })
      .select('*')
      .single();

    if (error) return manejarErrorPg(error, next, { 23503: 'cancionId inválido' });
    res.status(201).json({ nota: serialize(data) });
  } catch (err) {
    next(err);
  }
}

// "Después queda fija": ni siquiera admin puede editar pasados los 15 min.
// El único recurso de admin sobre una nota ajena o vieja es borrarla.
async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const { texto } = req.body || {};
    if (!texto || !texto.trim()) {
      return res.status(400).json({ error: 'texto es requerido' });
    }

    const { data: nota, error: errorFetch } = await supabase
      .from('muestra_notas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (errorFetch) return next(errorFetch);
    if (!nota) return res.status(404).json({ error: 'Nota no encontrada' });

    if (nota.acceso_id !== req.acceso.id) {
      return res.status(403).json({ error: 'Solo podés editar tus propias notas' });
    }

    const antiguedadMs = Date.now() - new Date(nota.creada_en).getTime();
    if (antiguedadMs > VENTANA_EDICION_MS) {
      return res.status(403).json({ error: 'La nota ya no se puede editar (pasaron más de 15 minutos)' });
    }

    const { data, error } = await supabase
      .from('muestra_notas')
      .update({ texto, editada_en: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return next(error);
    res.json({ nota: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const { error, count } = await supabase.from('muestra_notas').delete({ count: 'exact' }).eq('id', req.params.id);
    if (error) return next(error);
    if (!count) return res.status(404).json({ error: 'Nota no encontrada' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listarPorCancion, crear, actualizar, eliminar };
