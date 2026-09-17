const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { programa, grilla } = require('../controllers/export.controller');

const router = express.Router();

router.get('/programa', requireAuth, programa);
router.get('/grilla', requireAuth, grilla);

module.exports = router;
