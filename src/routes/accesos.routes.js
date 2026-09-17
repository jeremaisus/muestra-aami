const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { listar, crear, actualizar } = require('../controllers/accesos.controller');

const router = express.Router();

router.get('/', requireAdmin, listar);
router.post('/', requireAdmin, crear);
router.patch('/:id', requireAdmin, actualizar);

module.exports = router;
