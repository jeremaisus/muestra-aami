const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const requireConfigFlag = require('../middleware/requireConfigFlag');
const { actualizar, eliminar, listarInteres, toggleInteres } = require('../controllers/slots.controller');

const router = express.Router();
const soloOcuparSlots = requireConfigFlag('profes_pueden_ocupar_slots');

router.patch('/:id', soloOcuparSlots, actualizar);
router.delete('/:id', requireAdmin, eliminar);
router.get('/:id/interes', requireAdmin, listarInteres);
router.post('/:id/interes', requireAuth, toggleInteres);

module.exports = router;
