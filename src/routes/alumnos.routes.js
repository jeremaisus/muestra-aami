const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  importarPreview,
  importarConfirmar,
} = require('../controllers/alumnos.controller');

const router = express.Router();

router.get('/', requireAuth, listar);
router.get('/:id', requireAuth, obtener);
router.post('/', requireAdmin, crear);
router.post('/importar/preview', requireAdmin, importarPreview);
router.post('/importar/confirmar', requireAdmin, importarConfirmar);
router.patch('/:id', requireAdmin, actualizar);
router.delete('/:id', requireAdmin, eliminar);

module.exports = router;
