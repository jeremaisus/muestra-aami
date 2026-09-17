const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { actualizar, eliminar } = require('../controllers/notas.controller');

const router = express.Router();

router.patch('/:id', requireAuth, actualizar);
router.delete('/:id', requireAdmin, eliminar);

module.exports = router;
