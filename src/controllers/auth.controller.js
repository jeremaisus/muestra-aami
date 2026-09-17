const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const env = require('../config/env');
const { COOKIE_NAME } = require('../middleware/auth');

const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 180;
const SALT_ROUNDS = 10;

function setSessionCookie(res, accesoId) {
  const token = jwt.sign({ sub: accesoId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

function serializeAcceso(acceso) {
  return {
    id: acceso.id,
    usuario: acceso.usuario,
    etiqueta: acceso.etiqueta,
    rol: acceso.rol,
    profesorId: acceso.profesor_id,
    debeCambiar: acceso.debe_cambiar,
  };
}

async function login(req, res, next) {
  try {
    const { usuario, password } = req.body || {};
    if (!usuario || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const { data: acceso, error } = await supabase
      .from('muestra_accesos')
      .select('*')
      .ilike('usuario', usuario)
      .eq('activo', true)
      .maybeSingle();

    if (error) return next(error);

    const credencialesInvalidas = () =>
      res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    if (!acceso) return credencialesInvalidas();

    const passwordOk = await bcrypt.compare(password, acceso.password_hash);
    if (!passwordOk) return credencialesInvalidas();

    await supabase
      .from('muestra_accesos')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', acceso.id);

    setSessionCookie(res, acceso.id);
    res.json({ acceso: serializeAcceso(acceso) });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  res.clearCookie(COOKIE_NAME);
  res.status(204).end();
}

async function cambiarPassword(req, res, next) {
  try {
    const { passwordActual, passwordNueva } = req.body || {};
    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }
    if (passwordNueva.length < 8) {
      return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 8 caracteres' });
    }

    const { data: acceso, error } = await supabase
      .from('muestra_accesos')
      .select('id, password_hash')
      .eq('id', req.acceso.id)
      .single();

    if (error) return next(error);

    const passwordOk = await bcrypt.compare(passwordActual, acceso.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const nuevoHash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
    const { error: updateError } = await supabase
      .from('muestra_accesos')
      .update({ password_hash: nuevoHash, debe_cambiar: false })
      .eq('id', acceso.id);

    if (updateError) return next(updateError);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

function me(req, res) {
  res.json({ acceso: serializeAcceso(req.acceso) });
}

module.exports = { login, logout, cambiarPassword, me };
