const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { faltantes, sinAsignar } = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/faltantes', requireAuth, faltantes);
router.get('/sin-asignar', requireAuth, sinAsignar);

module.exports = router;
