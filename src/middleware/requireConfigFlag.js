const supabase = require('../config/supabase');

// Admin nunca depende de los interruptores de muestra_config: solo gatean
// permisos extra para profesores. La verificación de que un profesor solo
// toca SUS propios horarios/slots queda en el controller de cada recurso,
// porque ese chequeo necesita el id del recurso, no solo el flag global.
function requireConfigFlag(flag) {
  return async function (req, res, next) {
    if (!req.acceso) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (req.acceso.rol === 'admin') {
      return next();
    }

    const { data, error } = await supabase
      .from('muestra_config')
      .select(flag)
      .eq('id', true)
      .single();

    if (error) return next(error);

    if (!data?.[flag]) {
      return res.status(403).json({ error: 'La carga está cerrada por administración' });
    }

    next();
  };
}

module.exports = requireConfigFlag;
