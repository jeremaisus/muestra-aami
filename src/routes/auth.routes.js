const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { login, logout, cambiarPassword, me } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/cambiar-password', requireAuth, cambiarPassword);
router.get('/me', requireAuth, me);

module.exports = router;
