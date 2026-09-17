function requireAdmin(req, res, next) {
  if (!req.acceso) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (req.acceso.rol !== 'admin') {
    return res.status(403).json({ error: 'Requiere rol de administración' });
  }
  next();
}

module.exports = requireAdmin;
