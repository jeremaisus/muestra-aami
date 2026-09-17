const PDFDocument = require('pdfkit');
const supabase = require('../config/supabase');
const { idsClasesPorMuestra } = require('../services/clasesPorMuestra.service');

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

async function obtenerShow(showId) {
  const { data, error } = await supabase.from('muestra_shows').select('*').eq('id', showId).maybeSingle();
  if (error) throw error;
  return data;
}

function iniciarPdf(res, nombreArchivo) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
  doc.pipe(res);
  return doc;
}

async function programa(req, res, next) {
  try {
    const { showId } = req.query;
    if (!showId) return res.status(400).json({ error: 'showId es requerido' });

    const show = await obtenerShow(showId);
    if (!show) return res.status(404).json({ error: 'Muestra no encontrada' });

    const { data: canciones, error } = await supabase
      .from('muestra_canciones')
      .select('*')
      .eq('show_id', showId)
      .order('orden_programa', { ascending: true, nullsFirst: false })
      .order('titulo');

    if (error) return next(error);

    const doc = iniciarPdf(res, `programa-${show.nombre}.pdf`);

    doc.fontSize(20).text(`Programa — ${show.nombre}`);
    if (show.fecha) doc.fontSize(11).fillColor('#555555').text(show.fecha).fillColor('#000000');
    doc.moveDown(1.5);

    if (canciones.length === 0) {
      doc.fontSize(12).text('Todavía no hay canciones cargadas en esta muestra.');
    }

    canciones.forEach((c, i) => {
      doc.fontSize(13).text(`${i + 1}. ${c.titulo}`, { continued: false });
      const detalle = [c.artista, c.tonalidad ? `Tonalidad: ${c.tonalidad}` : null]
        .filter(Boolean)
        .join('  ·  ');
      if (detalle) doc.fontSize(10).fillColor('#555555').text(detalle).fillColor('#000000');
      doc.fontSize(10).fillColor(c.estado === 'completa' ? '#3F8F5C' : '#D98324');
      doc.text(c.estado === 'completa' ? 'Completa' : 'Incompleta');
      doc.fillColor('#000000');
      doc.moveDown(0.8);
    });

    doc.end();
  } catch (err) {
    next(err);
  }
}

async function grilla(req, res, next) {
  try {
    const { showId } = req.query;
    if (!showId) return res.status(400).json({ error: 'showId es requerido' });

    const show = await obtenerShow(showId);
    if (!show) return res.status(404).json({ error: 'Muestra no encontrada' });

    const claseIds = await idsClasesPorMuestra(showId);

    let clases = [];
    if (claseIds.length > 0) {
      const { data, error } = await supabase
        .from('muestra_clases')
        .select(
          '*, profesor:muestra_profesores(id, nombre), clase_alumnos:muestra_clase_alumnos(alumno:muestra_alumnos(persona:muestra_personas(nombre), instrumento:muestra_instrumentos(nombre)))'
        )
        .in('id', claseIds)
        .order('dia')
        .order('hora_inicio');

      if (error) return next(error);
      clases = data;
    }

    const doc = iniciarPdf(res, `grilla-${show.nombre}.pdf`);

    doc.fontSize(20).text(`Grilla semanal — ${show.nombre}`);
    doc.moveDown(1.5);

    for (let dia = 1; dia <= 6; dia++) {
      const clasesDelDia = clases.filter((c) => c.dia === dia);

      doc.fontSize(14).text(DIAS[dia]);
      doc.moveDown(0.3);

      if (clasesDelDia.length === 0) {
        doc.fontSize(10).fillColor('#555555').text('Sin clases cargadas.').fillColor('#000000');
      }

      clasesDelDia.forEach((c) => {
        const alumnos = (c.clase_alumnos || [])
          .map((ca) => ca.alumno)
          .filter(Boolean)
          .map((a) => `${a.persona?.nombre || 'Sin nombre'} (${a.instrumento?.nombre || 'sin instrumento'})`)
          .join(', ');

        doc
          .fontSize(11)
          .text(
            `${c.hora_inicio.slice(0, 5)}–${c.hora_fin.slice(0, 5)}  ·  ${alumnos || 'sin alumnos'}  ·  profe ${
              c.profesor?.nombre || '—'
            }`
          );
      });

      doc.moveDown(1);
    }

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { programa, grilla };
