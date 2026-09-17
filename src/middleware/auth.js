const jwt = require('jsonwebtoken');
const env = require('../config/env');
const supabase = require('../config/supabase');

const COOKIE_NAME = 'muestra_session';

// Rol y estado se leen de la base en cada request (no del JWT) para que un
// admin pueda desactivar a alguien o cambiarle el rol sin esperar a que
// expire una sesión de meses.
async function auth(req, res, next) {
  req.acceso = null;

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return next();
  }

  const { data, error } = await supabase
    .from('muestra_accesos')
    .select('id, usuario, etiqueta, rol, profesor_id, activo, debe_cambiar')
    .eq('id', payload.sub)
    .maybeSingle();

  if (error) return next(error);

  if (!data || !data.activo) {
    res.clearCookie(COOKIE_NAME);
    return next();
  }

  req.acceso = data;
  next();
}

module.exports = { auth, COOKIE_NAME };
