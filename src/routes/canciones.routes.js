const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const {
  listar,
  obtener,
  checkDuplicado,
  crear,
  actualizar,
  actualizarEstado,
  eliminar,
} = require('../controllers/canciones.controller');
const { listarPorCancion, crear: crearLink } = require('../controllers/cancionLinks.controller');
const { listarPorCancion: listarSlots, crear: crearSlot } = require('../controllers/slots.controller');
const { listarPorCancion: listarNotas, crear: crearNota } = require('../controllers/notas.controller');

const router = express.Router();

router.get('/', requireAuth, listar);
router.get('/check-duplicado', requireAuth, checkDuplicado);
router.get('/:id', requireAuth, obtener);
router.get('/:id/links', requireAuth, listarPorCancion);
router.get('/:id/slots', requireAuth, listarSlots);
router.get('/:id/notas', requireAuth, listarNotas);
router.post('/', requireAdmin, crear);
router.post('/:id/links', requireAdmin, crearLink);
router.post('/:id/slots', requireAdmin, crearSlot);
router.post('/:id/notas', requireAuth, crearNota);
router.patch('/:id/estado', requireAdmin, actualizarEstado);
router.patch('/:id', requireAdmin, actualizar);
router.delete('/:id', requireAdmin, eliminar);

module.exports = router;
