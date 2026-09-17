const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { obtener, actualizar } = require('../controllers/config.controller');

const router = express.Router();

router.get('/', requireAuth, obtener);
router.patch('/', requireAdmin, actualizar);

module.exports = router;
