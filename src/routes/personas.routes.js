const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { listar, obtener, crear, actualizar, eliminar } = require('../controllers/personas.controller');

const router = express.Router();

router.get('/', requireAuth, listar);
router.get('/:id', requireAuth, obtener);
router.post('/', requireAdmin, crear);
router.patch('/:id', requireAdmin, actualizar);
router.delete('/:id', requireAdmin, eliminar);

module.exports = router;
