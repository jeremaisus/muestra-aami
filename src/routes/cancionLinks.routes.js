const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { actualizar, eliminar } = require('../controllers/cancionLinks.controller');

const router = express.Router();

router.patch('/:id', requireAdmin, actualizar);
router.delete('/:id', requireAdmin, eliminar);

module.exports = router;
