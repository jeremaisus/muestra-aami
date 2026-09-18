const supabase = require('../config/supabase');
const { manejarErrorPg } = require('../utils/pgErrors');
const { idsClasesPorMuestra } = require('../services/clasesPorMuestra.service');

const SELECT =
  '*, profesor:muestra_profesores(id, nombre), clase_alumnos:muestra_clase_alumnos(alumno:muestra_alumnos(id, persona:muestra_personas(id, nombre, show_id), instrumento:muestra_instrumentos(id, nombre, color)))';

function serialize(c) {
  return {
    id: c.id,
    profesorId: c.profesor_id,
    dia: c.dia,
    horaInicio: c.hora_inicio,
    horaFin: c.hora_fin,
    profesor: c.profesor ? { id: c.profesor.id, nombre: c.profesor.nombre } : undefined,
    alumnos: (c.clase_alumnos || [])
      .map((ca) => ca.alumno)
      .filter(Boolean)
      .map((a) => ({
        id: a.id,
        persona: a.persona
          ? { id: a.persona.id, nombre: a.persona.nombre, muestraId: a.persona.show_id }
          : undefined,
        instrumento: a.instrumento
          ? { id: a.instrumento.id, nombre: a.instrumento.nombre, color: a.instrumento.color }
          : undefined,
      })),
  };
}

// Admin siempre; un profesor solo sobre sus propias clases (el interruptor
// profes_pueden_editar_horarios ya lo filtra la ruta antes de llegar acá).
function esDuenio(req, profesorId) {
  return req.acceso.rol === 'admin' || req.acceso.profesor_id === profesorId;
}

// Ser dueño de la clase no alcanza: sin esto, un profesor podría sumar a su
// propio bloque un alumnoId de otro profesor (nunca se lo ofrece la
// interfaz, pero nada en la ruta lo impedía). Devuelve un mensaje de error
// si algún alumno no es del profesor esperado, o null si está todo bien.
async function verificarAlumnosDelProfesor(alumnoIds, profesorId) {
  const { data, error } = await supabase.from('muestra_alumnos').select('id, profesor_id').in('id', alumnoIds);
  if (error) throw error;

  const encontrados = new Map(data.map((a) => [a.id, a.profesor_id]));
  const ajeno = alumnoIds.some((id) => encontrados.get(id) !== profesorId);
  return ajeno ? 'Solo podés cargar alumnos propios' : null;
}

async function listar(req, res, next) {
  try {
    let claseIdsFiltro;
    if (req.query.showId) {
      claseIdsFiltro = await idsClasesPorMuestra(req.query.showId);
      if (claseIdsFiltro.length === 0) return res.json({ clases: [] });
    }

    let query = supabase.from('muestra_clases').select(SELECT).order('dia').order('hora_inicio');
    if (req.query.profesorId) query = query.eq('profesor_id', req.query.profesorId);
    if (req.query.dia) query = query.eq('dia', Number(req.query.dia));
    if (claseIdsFiltro) query = query.in('id', claseIdsFiltro);

    const { data, error } = await query;
    if (error) return next(error);

    res.json({ clases: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { profesorId, dia, horaInicio, horaFin, alumnoIds } = req.body || {};

    if (!profesorId || !dia || !horaInicio || !horaFin) {
      return res.status(400).json({ error: 'profesorId, dia, horaInicio y horaFin son requeridos' });
    }

    if (req.acceso.rol !== 'admin' && req.acceso.profesor_id !== profesorId) {
      return res.status(403).json({ error: 'Solo podés cargar horarios propios' });
    }

    if (req.acceso.rol !== 'admin' && Array.isArray(alumnoIds) && alumnoIds.length > 0) {
      const error403 = await verificarAlumnosDelProfesor(alumnoIds, profesorId);
      if (error403) return res.status(403).json({ error: error403 });
    }

    const { data: clase, error } = await supabase
      .from('muestra_clases')
      .insert({ profesor_id: profesorId, dia, hora_inicio: horaInicio, hora_fin: horaFin })
      .select('id')
      .single();

    if (error) {
      return manejarErrorPg(error, next, {
        23503: 'profesorId inválido',
        23514: 'El horario no respeta la ventana 14:00-21:30, el paso de 15 minutos o hora_fin > hora_inicio',
      });
    }

    let aviso;
    if (Array.isArray(alumnoIds) && alumnoIds.length > 0) {
      const { error: errorRel } = await supabase
        .from('muestra_clase_alumnos')
        .insert(alumnoIds.map((alumnoId) => ({ clase_id: clase.id, alumno_id: alumnoId })));

      if (errorRel) {
        return manejarErrorPg(errorRel, next, { 23503: 'Uno de los alumnoIds es inválido' });
      }

      if (alumnoIds.length > 3) {
        aviso = 'Este bloque tiene más de 3 alumnos.';
      }
    }

    const { data: claseCompleta, error: errorFetch } = await supabase
      .from('muestra_clases')
      .select(SELECT)
      .eq('id', clase.id)
      .single();

    if (errorFetch) return next(errorFetch);

    res.status(201).json({ clase: serialize(claseCompleta), aviso });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const { data: existente, error: errorFetch } = await supabase
      .from('muestra_clases')
      .select('id, profesor_id')
      .eq('id', id)
      .maybeSingle();

    if (errorFetch) return next(errorFetch);
    if (!existente) return res.status(404).json({ error: 'Clase no encontrada' });

    if (!esDuenio(req, existente.profesor_id)) {
      return res.status(403).json({ error: 'Solo podés editar horarios propios' });
    }

    if (body.profesorId !== undefined && req.acceso.rol !== 'admin') {
      return res.status(403).json({ error: 'No podés reasignar el horario a otro profesor' });
    }

    const cambios = {};
    if (body.profesorId !== undefined) cambios.profesor_id = body.profesorId;
    if (body.dia !== undefined) cambios.dia = body.dia;
    if (body.horaInicio !== undefined) cambios.hora_inicio = body.horaInicio;
    if (body.horaFin !== undefined) cambios.hora_fin = body.horaFin;

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    const { data, error } = await supabase
      .from('muestra_clases')
      .update(cambios)
      .eq('id', id)
      .select(SELECT)
      .maybeSingle();

    if (error) {
      return manejarErrorPg(error, next, {
        23503: 'profesorId inválido',
        23514: 'El horario no respeta la ventana 14:00-21:30, el paso de 15 minutos o hora_fin > hora_inicio',
      });
    }

    res.json({ clase: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const { id } = req.params;

    const { data: existente, error: errorFetch } = await supabase
      .from('muestra_clases')
      .select('id, profesor_id')
      .eq('id', id)
      .maybeSingle();

    if (errorFetch) return next(errorFetch);
    if (!existente) return res.status(404).json({ error: 'Clase no encontrada' });

    if (!esDuenio(req, existente.profesor_id)) {
      return res.status(403).json({ error: 'Solo podés borrar horarios propios' });
    }

    const { error } = await supabase.from('muestra_clases').delete().eq('id', id);
    if (error) return next(error);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function agregarAlumno(req, res, next) {
  try {
    const { id } = req.params;
    const { alumnoId } = req.body || {};
    if (!alumnoId) return res.status(400).json({ error: 'alumnoId es requerido' });

    const { data: clase, error: errorFetch } = await supabase
      .from('muestra_clases')
      .select('id, profesor_id')
      .eq('id', id)
      .maybeSingle();

    if (errorFetch) return next(errorFetch);
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });

    if (!esDuenio(req, clase.profesor_id)) {
      return res.status(403).json({ error: 'Solo podés editar horarios propios' });
    }

    if (req.acceso.rol !== 'admin') {
      const error403 = await verificarAlumnosDelProfesor([alumnoId], clase.profesor_id);
      if (error403) return res.status(403).json({ error: error403 });
    }

    const { error: errorInsert } = await supabase
      .from('muestra_clase_alumnos')
      .insert({ clase_id: id, alumno_id: alumnoId });

    if (errorInsert) {
      return manejarErrorPg(errorInsert, next, {
        23505: 'Ese alumno ya está en este bloque',
        23503: 'alumnoId inválido',
      });
    }

    const { count, error: errorCount } = await supabase
      .from('muestra_clase_alumnos')
      .select('alumno_id', { count: 'exact', head: true })
      .eq('clase_id', id);

    if (errorCount) return next(errorCount);

    res.status(201).json({
      ok: true,
      aviso: count > 3 ? 'Este bloque ya tiene más de 3 alumnos.' : undefined,
    });
  } catch (err) {
    next(err);
  }
}

async function quitarAlumno(req, res, next) {
  try {
    const { id, alumnoId } = req.params;

    const { data: clase, error: errorFetch } = await supabase
      .from('muestra_clases')
      .select('id, profesor_id')
      .eq('id', id)
      .maybeSingle();

    if (errorFetch) return next(errorFetch);
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });

    if (!esDuenio(req, clase.profesor_id)) {
      return res.status(403).json({ error: 'Solo podés editar horarios propios' });
    }

    const { error, count } = await supabase
      .from('muestra_clase_alumnos')
      .delete({ count: 'exact' })
      .eq('clase_id', id)
      .eq('alumno_id', alumnoId);

    if (error) return next(error);
    if (!count) return res.status(404).json({ error: 'Ese alumno no está en este bloque' });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar, eliminar, agregarAlumno, quitarAlumno };
