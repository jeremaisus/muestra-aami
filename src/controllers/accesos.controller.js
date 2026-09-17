const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');
const { manejarErrorPg } = require('../utils/pgErrors');

const SALT_ROUNDS = 10;
const ROLES = ['admin', 'profesor'];

function serialize(a) {
  return {
    id: a.id,
    usuario: a.usuario,
    etiqueta: a.etiqueta,
    rol: a.rol,
    profesorId: a.profesor_id,
    debeCambiar: a.debe_cambiar,
    activo: a.activo,
    ultimoAcceso: a.ultimo_acceso,
  };
}

async function listar(req, res, next) {
  try {
    const { data, error } = await supabase.from('muestra_accesos').select('*').order('usuario');
    if (error) return next(error);
    res.json({ accesos: data.map(serialize) });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { usuario, password, etiqueta, rol, profesorId } = req.body || {};

    if (!usuario || !password || !etiqueta || !rol) {
      return res.status(400).json({ error: 'usuario, password, etiqueta y rol son requeridos' });
    }
    if (!ROLES.includes(rol)) {
      return res.status(400).json({ error: "rol debe ser 'admin' o 'profesor'" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'password debe tener al menos 8 caracteres' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const { data, error } = await supabase
      .from('muestra_accesos')
      .insert({
        usuario,
        password_hash,
        etiqueta,
        rol,
        profesor_id: profesorId ?? null,
        activo: true,
        debe_cambiar: true,
      })
      .select('*')
      .single();

    if (error) {
      return manejarErrorPg(error, next, {
        23505: 'Ya existe un acceso con ese usuario',
        23503: 'profesorId inválido',
      });
    }

    res.status(201).json({ acceso: serialize(data) });
  } catch (err) {
    next(err);
  }
}

// Desactivar (activo=false) en vez de borrar, mismo patrón que profesores:
// no hay endpoint DELETE.
async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const cambios = {};

    if (id === req.acceso.id) {
      if (body.activo === false) {
        return res.status(400).json({ error: 'No podés desactivar tu propia cuenta' });
      }
      if (body.rol !== undefined && body.rol !== 'admin') {
        return res.status(400).json({ error: 'No podés quitarte el rol de administración a vos mismo' });
      }
    }

    if (body.usuario !== undefined) {
      if (typeof body.usuario !== 'string' || !body.usuario.trim()) {
        return res.status(400).json({ error: 'usuario inválido' });
      }
      cambios.usuario = body.usuario;
    }

    if (body.etiqueta !== undefined) {
      if (typeof body.etiqueta !== 'string' || !body.etiqueta.trim()) {
        return res.status(400).json({ error: 'etiqueta inválida' });
      }
      cambios.etiqueta = body.etiqueta;
    }

    if (body.rol !== undefined) {
      if (!ROLES.includes(body.rol)) {
        return res.status(400).json({ error: "rol debe ser 'admin' o 'profesor'" });
      }
      cambios.rol = body.rol;
    }

    if (body.profesorId !== undefined) cambios.profesor_id = body.profesorId;

    if (body.activo !== undefined) {
      if (typeof body.activo !== 'boolean') {
        return res.status(400).json({ error: 'activo debe ser boolean' });
      }
      cambios.activo = body.activo;
    }

    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 8) {
        return res.status(400).json({ error: 'password debe tener al menos 8 caracteres' });
      }
      cambios.password_hash = await bcrypt.hash(body.password, SALT_ROUNDS);
      cambios.debe_cambiar = true;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    const { data, error } = await supabase
      .from('muestra_accesos')
      .update(cambios)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      return manejarErrorPg(error, next, {
        23505: 'Ya existe un acceso con ese usuario',
        23503: 'profesorId inválido',
      });
    }
    if (!data) return res.status(404).json({ error: 'Acceso no encontrado' });

    res.json({ acceso: serialize(data) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar };
