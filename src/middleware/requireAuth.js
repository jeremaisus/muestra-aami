function requireAuth(req, res, next) {
  if (!req.acceso) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
}

module.exports = requireAuth;
