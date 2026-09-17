const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireConfigFlag = require('../middleware/requireConfigFlag');
const {
  listar,
  crear,
  actualizar,
  eliminar,
  agregarAlumno,
  quitarAlumno,
} = require('../controllers/clases.controller');

const router = express.Router();
const soloEdicionHorarios = requireConfigFlag('profes_pueden_editar_horarios');

router.get('/', requireAuth, listar);
router.post('/', soloEdicionHorarios, crear);
router.patch('/:id', soloEdicionHorarios, actualizar);
router.delete('/:id', soloEdicionHorarios, eliminar);
router.post('/:id/alumnos', soloEdicionHorarios, agregarAlumno);
router.delete('/:id/alumnos/:alumnoId', soloEdicionHorarios, quitarAlumno);

module.exports = router;
