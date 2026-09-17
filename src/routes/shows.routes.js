const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { listar, actualizar } = require('../controllers/shows.controller');
const { obtener: obtenerPrograma, reordenar: reordenarPrograma } = require('../controllers/programa.controller');

const router = express.Router();

router.get('/', requireAuth, listar);
router.get('/:id/programa', requireAuth, obtenerPrograma);
router.patch('/:id/programa', requireAdmin, reordenarPrograma);
router.patch('/:id', requireAdmin, actualizar);

module.exports = router;
