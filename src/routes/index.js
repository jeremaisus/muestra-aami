const express = require('express');

const authRoutes = require('./auth.routes');
const accesosRoutes = require('./accesos.routes');
const configRoutes = require('./config.routes');
const showsRoutes = require('./shows.routes');
const instrumentosRoutes = require('./instrumentos.routes');
const profesoresRoutes = require('./profesores.routes');
const personasRoutes = require('./personas.routes');
const alumnosRoutes = require('./alumnos.routes');
const clasesRoutes = require('./clases.routes');
const cancionesRoutes = require('./canciones.routes');
const cancionLinksRoutes = require('./cancionLinks.routes');
const slotsRoutes = require('./slots.routes');
const notasRoutes = require('./notas.routes');
const dashboardRoutes = require('./dashboard.routes');
const exportRoutes = require('./export.routes');
const logRoutes = require('./log.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/accesos', accesosRoutes);
router.use('/config', configRoutes);
router.use('/shows', showsRoutes);
router.use('/instrumentos', instrumentosRoutes);
router.use('/profesores', profesoresRoutes);
router.use('/personas', personasRoutes);
router.use('/alumnos', alumnosRoutes);
router.use('/clases', clasesRoutes);
router.use('/canciones', cancionesRoutes);
router.use('/cancion-links', cancionLinksRoutes);
router.use('/slots', slotsRoutes);
router.use('/notas', notasRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/export', exportRoutes);
router.use('/log', logRoutes);

module.exports = router;
