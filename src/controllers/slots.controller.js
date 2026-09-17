const supabase = require('../config/supabase');
const { manejarErrorPg } = require('../utils/pgErrors');
const {
  contarSlotsPorInstrumento,
  siguienteNumero,
  toggleInteres: toggleInteresService,
} = require('../services/slots.service');

const SELECT =
  '*, instrumento:muestra_instrumentos(id, nombre, color), alumno:muestra_alumnos(id, persona:muestra_personas(id, nombre)), profesor:muestra_profesores(id, nombre)';

function serialize(s) {
  return {
    id: s.id,
    cancionId: s.cancion_id,
    instrumentoId: s.instrumento_id,
    numero: s.numero,
    etiqueta: s.etiqueta,
    alumnoId: s.alumno_id,
    profesorId: s.profesor_id,
    personaId: s.persona_id,
    seBusca: s.se_busca,
    instrumento: s.instrumento
      ? { id: s.instrumento.id, nombre: s.instrumento.nombre, color: s.instrumento.color }
      : undefined,
    alumno: s.alumno
      ? {
          id: s.alumno.id,
          persona: s.alumno.persona ? { id: s.alumno.persona.id, nombre: s.alumno.persona.nombre } : undefined,
        }
      : undefined,
    profesor: s.profesor ? { id: s.profesor.id, nombre: s.profesor.nombre } : undefined,
  };
}

async function listarPorCancion(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('muestra_slots')
      .select(SELECT)
      .eq('cancion_id', req.params.id)
      .order('instrumento_id')
      .order('numero');

    if (error) return next(error);
    res.json({ slots: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const cancionId = req.params.id;
    const { instrumentoId, etiqueta, numero } = req.body || {};
    if (!instrumentoId) return res.status(400).json({ error: 'instrumentoId es requerido' });

    const existentes = await contarSlotsPorInstrumento(cancionId, instrumentoId);
    const numeroFinal = numero ?? (await siguienteNumero(cancionId, instrumentoId));

    const { data, error } = await supabase
      .from('muestra_slots')
      .insert({ cancion_id: cancionId, instrumento_id: instrumentoId, numero: numeroFinal, etiqueta: etiqueta ?? null })
      .select(SELECT)
      .single();

    if (error) {
      return manejarErrorPg(error, next, {
        23505: 'Ya existe un slot con ese número para ese instrumento en esta canción',
        23503: 'instrumentoId inválido',
      });
    }

    // No bloquea: el frontend decide si pide confirmación con este aviso
    // antes o después de llamar al endpoint.
    const aviso =
      existentes > 0
        ? `Ya hay alguien en este instrumento en esta canción. ¿Agregar como slot ${numeroFinal}?`
        : undefined;

    res.status(201).json({ slot: serialize(data), aviso });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const esAdmin = req.acceso.rol === 'admin';

    if (!esAdmin) {
      const camposNoPermitidos = ['profesorId', 'seBusca', 'etiqueta'].filter((c) => body[c] !== undefined);
      if (camposNoPermitidos.length > 0) {
        return res.status(403).json({ error: 'Los profesores solo pueden asignar/quitar alumnos en un slot' });
      }

      // Un profesor solo puede ocupar un slot vacío. Reasignar o quitar un
      // slot ya ocupado (por cualquiera) queda exclusivo de administración,
      // más allá del interruptor profes_pueden_ocupar_slots.
      if (body.alumnoId !== undefined) {
        const { data: actual, error: errorActual } = await supabase
          .from('muestra_slots')
          .select('alumno_id, profesor_id')
          .eq('id', id)
          .maybeSingle();

        if (errorActual) return next(errorActual);
        if (!actual) return res.status(404).json({ error: 'Slot no encontrado' });
        if (actual.alumno_id || actual.profesor_id) {
          return res.status(403).json({ error: 'Ese slot ya está ocupado: solo administración puede reasignarlo o vaciarlo' });
        }
      }
    }

    if (body.alumnoId && body.profesorId) {
      return res.status(400).json({ error: 'Un slot no puede tener alumno y profesor a la vez' });
    }

    const cambios = {};

    if (body.alumnoId !== undefined) {
      cambios.alumno_id = body.alumnoId;
      if (body.alumnoId) cambios.profesor_id = null;
    }
    if (body.profesorId !== undefined) {
      cambios.profesor_id = body.profesorId;
      if (body.profesorId) cambios.alumno_id = null;
    }
    if (body.seBusca !== undefined) {
      if (typeof body.seBusca !== 'boolean') {
        return res.status(400).json({ error: 'seBusca debe ser boolean' });
      }
      cambios.se_busca = body.seBusca;
    }
    if (body.etiqueta !== undefined) cambios.etiqueta = body.etiqueta;

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    const { data, error } = await supabase
      .from('muestra_slots')
      .update(cambios)
      .eq('id', id)
      .select(SELECT)
      .maybeSingle();

    if (error) {
      return manejarErrorPg(error, next, {
        23503: 'alumnoId o profesorId inválido',
        23505: 'Esa persona ya ocupa otro slot en esta canción',
      });
    }
    if (!data) return res.status(404).json({ error: 'Slot no encontrado' });

    res.json({ slot: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const { error, count } = await supabase.from('muestra_slots').delete({ count: 'exact' }).eq('id', req.params.id);
    if (error) return next(error);
    if (!count) return res.status(404).json({ error: 'Slot no encontrado' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function listarInteres(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('muestra_slot_interes')
      .select('id, creado_en, acceso:muestra_accesos(id, usuario, etiqueta)')
      .eq('slot_id', req.params.id)
      .order('creado_en');

    if (error) return next(error);

    res.json({
      interesados: data.map((i) => ({
        id: i.id,
        creadoEn: i.creado_en,
        acceso: i.acceso ? { id: i.acceso.id, usuario: i.acceso.usuario, etiqueta: i.acceso.etiqueta } : undefined,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function toggleInteres(req, res, next) {
  try {
    const resultado = await toggleInteresService(req.params.id, req.acceso.id);
    res.json(resultado);
  } catch (err) {
    return manejarErrorPg(err, next, { 23503: 'slotId inválido' });
  }
}

module.exports = { listarPorCancion, crear, actualizar, eliminar, listarInteres, toggleInteres };
