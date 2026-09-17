const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { listar, crear, actualizar, eliminar } = require('../controllers/profesores.controller');

const router = express.Router();

router.get('/', requireAuth, listar);
router.post('/', requireAdmin, crear);
router.patch('/:id', requireAdmin, actualizar);
router.delete('/:id', requireAdmin, eliminar);

module.exports = router;
