const supabase = require('../config/supabase');
const { manejarErrorPg } = require('../utils/pgErrors');
const { parsearCSV } = require('../utils/csv');
const { normalizarTexto } = require('../utils/normalizarTexto');

const SELECT_CON_RELACIONES =
  '*, persona:muestra_personas(id, nombre, show_id, participa), instrumento:muestra_instrumentos(id, nombre, color), profesor:muestra_profesores(id, nombre)';

function serialize(a) {
  return {
    id: a.id,
    personaId: a.persona_id,
    instrumentoId: a.instrumento_id,
    profesorId: a.profesor_id,
    persona: a.persona
      ? { id: a.persona.id, nombre: a.persona.nombre, showId: a.persona.show_id, participa: a.persona.participa }
      : undefined,
    instrumento: a.instrumento
      ? { id: a.instrumento.id, nombre: a.instrumento.nombre, color: a.instrumento.color }
      : undefined,
    profesor: a.profesor ? { id: a.profesor.id, nombre: a.profesor.nombre } : undefined,
  };
}

async function listar(req, res, next) {
  try {
    let query = supabase.from('muestra_alumnos').select(SELECT_CON_RELACIONES).order('creado_en');

    if (req.query.showId) query = query.eq('persona.show_id', req.query.showId);
    if (req.query.profesorId) query = query.eq('profesor_id', req.query.profesorId);
    if (req.query.instrumentoId) query = query.eq('instrumento_id', req.query.instrumentoId);

    const { data, error } = await query;
    if (error) return next(error);

    let alumnos = data.filter((a) => a.persona).map(serialize);

    if (req.query.sinAsignar === 'true') {
      const { data: sinAsignar, error: errorVista } = await supabase
        .from('muestra_v_sin_asignar')
        .select('alumno_id');
      if (errorVista) return next(errorVista);

      const idsSinAsignar = new Set(sinAsignar.map((r) => r.alumno_id));
      alumnos = alumnos.filter((a) => idsSinAsignar.has(a.id));
    }

    res.json({ alumnos });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('muestra_alumnos')
      .select(SELECT_CON_RELACIONES)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: 'Alumno no encontrado' });

    res.json({ alumno: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { personaId, instrumentoId, profesorId } = req.body || {};
    if (!personaId || !instrumentoId || !profesorId) {
      return res.status(400).json({ error: 'personaId, instrumentoId y profesorId son requeridos' });
    }

    const { data, error } = await supabase
      .from('muestra_alumnos')
      .insert({ persona_id: personaId, instrumento_id: instrumentoId, profesor_id: profesorId })
      .select(SELECT_CON_RELACIONES)
      .single();

    if (error) {
      return manejarErrorPg(error, next, {
        23505: 'Esta persona ya tiene un alumno cargado con ese instrumento',
        23503: 'personaId, instrumentoId o profesorId inválido',
      });
    }

    res.status(201).json({ alumno: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const cambios = {};

    if (body.instrumentoId !== undefined) cambios.instrumento_id = body.instrumentoId;
    if (body.profesorId !== undefined) cambios.profesor_id = body.profesorId;

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    const { data, error } = await supabase
      .from('muestra_alumnos')
      .update(cambios)
      .eq('id', id)
      .select(SELECT_CON_RELACIONES)
      .maybeSingle();

    if (error) {
      return manejarErrorPg(error, next, {
        23505: 'Esta persona ya tiene un alumno cargado con ese instrumento',
        23503: 'instrumentoId o profesorId inválido',
      });
    }
    if (!data) return res.status(404).json({ error: 'Alumno no encontrado' });

    res.json({ alumno: serialize(data) });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const { error, count } = await supabase
      .from('muestra_alumnos')
      .delete({ count: 'exact' })
      .eq('id', req.params.id);

    if (error) return next(error);
    if (!count) return res.status(404).json({ error: 'Alumno no encontrado' });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function importarPreview(req, res, next) {
  try {
    const { showId, csv } = req.body || {};
    if (!showId || !csv) {
      return res.status(400).json({ error: 'showId y csv son requeridos' });
    }

    const { columnas, filas } = parsearCSV(csv);
    const requeridas = ['nombre', 'instrumento', 'profesor'];
    const faltantes = requeridas.filter((c) => !columnas.includes(c));
    if (faltantes.length > 0) {
      return res.status(400).json({ error: `Faltan columnas en el CSV: ${faltantes.join(', ')}` });
    }

    const idxNombre = columnas.indexOf('nombre');
    const idxInstrumento = columnas.indexOf('instrumento');
    const idxProfesor = columnas.indexOf('profesor');

    const [
      { data: instrumentos, error: errorInstr },
      { data: profesores, error: errorProf },
      { data: personas, error: errorPersonas },
    ] = await Promise.all([
      supabase.from('muestra_instrumentos').select('id, nombre').eq('activo', true),
      supabase.from('muestra_profesores').select('id, nombre').eq('activo', true),
      supabase.from('muestra_personas').select('id, nombre').eq('show_id', showId),
    ]);

    if (errorInstr) return next(errorInstr);
    if (errorProf) return next(errorProf);
    if (errorPersonas) return next(errorPersonas);

    const buscarPorNombre = (lista, nombre) =>
      lista.find((item) => normalizarTexto(item.nombre) === normalizarTexto(nombre));

    const resultado = filas.map((fila, index) => {
      const nombre = fila[idxNombre] || '';
      const instrumentoNombre = fila[idxInstrumento] || '';
      const profesorNombre = fila[idxProfesor] || '';
      const errores = [];

      if (!nombre) errores.push('Falta el nombre');

      const instrumento = buscarPorNombre(instrumentos, instrumentoNombre);
      if (!instrumento) errores.push(`Instrumento "${instrumentoNombre}" no existe en el catálogo`);

      const profesor = buscarPorNombre(profesores, profesorNombre);
      if (!profesor) errores.push(`Profesor "${profesorNombre}" no existe`);

      const coincidencias = nombre
        ? personas
            .filter((p) => normalizarTexto(p.nombre) === normalizarTexto(nombre))
            .map((p) => ({ id: p.id, nombre: p.nombre }))
        : [];

      return {
        fila: index + 1,
        nombre,
        instrumentoNombre,
        profesorNombre,
        instrumentoId: instrumento?.id || null,
        profesorId: profesor?.id || null,
        coincidencias,
        errores,
      };
    });

    res.json({ filas: resultado });
  } catch (err) {
    next(err);
  }
}

async function importarConfirmar(req, res, next) {
  try {
    const { showId, filas } = req.body || {};
    if (!showId || !Array.isArray(filas) || filas.length === 0) {
      return res.status(400).json({ error: 'showId y filas son requeridos' });
    }

    const resultados = [];

    for (const fila of filas) {
      const { nombre, instrumentoId, profesorId, personaId } = fila || {};

      if (!instrumentoId || !profesorId || (!personaId && !nombre)) {
        resultados.push({ ok: false, error: 'Fila incompleta', fila });
        continue;
      }

      try {
        let idPersona = personaId;

        if (!idPersona) {
          const { data: personaCreada, error: errorPersona } = await supabase
            .from('muestra_personas')
            .insert({ nombre, show_id: showId })
            .select('id')
            .single();

          if (errorPersona) throw errorPersona;
          idPersona = personaCreada.id;
        }

        const { data: alumnoCreado, error: errorAlumno } = await supabase
          .from('muestra_alumnos')
          .insert({ persona_id: idPersona, instrumento_id: instrumentoId, profesor_id: profesorId })
          .select('id')
          .single();

        if (errorAlumno) throw errorAlumno;

        resultados.push({ ok: true, alumnoId: alumnoCreado.id, personaId: idPersona });
      } catch (err) {
        resultados.push({ ok: false, error: err.message, fila });
      }
    }

    res.json({ resultados });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar, importarPreview, importarConfirmar };
