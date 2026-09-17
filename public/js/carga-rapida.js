(() => {
  const DIAS = [
    { id: 1, corta: 'Lu', larga: 'Lunes' },
    { id: 2, corta: 'Ma', larga: 'Martes' },
    { id: 3, corta: 'Mi', larga: 'Miércoles' },
    { id: 4, corta: 'Ju', larga: 'Jueves' },
    { id: 5, corta: 'Vi', larga: 'Viernes' },
    { id: 6, corta: 'Sa', larga: 'Sábado' },
  ];
  const VENTANA_FIN_MIN = 21 * 60 + 30;

  const state = {
    shows: [],
    showId: null,
    dia: 1,
    profesores: [],
    profesorId: null,
    instrumentos: [],
    personas: [],
    alumnos: [],
    roster: [],
    horaInicioBloque: null,
    horaInicioSiguiente: null,
    guardando: false,
  };

  const el = {
    muestras: document.getElementById('muestras'),
    dias: document.getElementById('dias'),
    selectProfesor: document.getElementById('selectProfesor'),
    estadoCarga: document.getElementById('estadoCarga'),
    cuerpo: document.getElementById('cuerpo'),
    tituloBloque: document.getElementById('tituloBloque'),
    roster: document.getElementById('roster'),
    rosterVacio: document.getElementById('rosterVacio'),
    rosterLimite: document.getElementById('rosterLimite'),
    formAlumno: document.getElementById('formAlumno'),
    nombreAlumno: document.getElementById('nombreAlumno'),
    personasExistentes: document.getElementById('personasExistentes'),
    instrumentoAlumno: document.getElementById('instrumentoAlumno'),
    campoHoraInicio: document.getElementById('campoHoraInicio'),
    horaInicioBloque: document.getElementById('horaInicioBloque'),
    duracion: document.getElementById('duracion'),
    boton60: document.getElementById('boton60'),
    boton75: document.getElementById('boton75'),
    otraDuracion: document.getElementById('otraDuracion'),
    botonOtraDuracion: document.getElementById('botonOtraDuracion'),
    estadoGuardado: document.getElementById('estadoGuardado'),
    csvTexto: document.getElementById('csvTexto'),
    botonPreview: document.getElementById('botonPreview'),
    previewCsv: document.getElementById('previewCsv'),
  };

  async function api(path, opciones) {
    const res = await fetch(path, { credentials: 'same-origin', ...opciones });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Error ${res.status} en ${path}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function normalizar(s) {
    return s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  function sumarMinutos(hora, minutos) {
    const [h, m] = hora.split(':').map(Number);
    const total = h * 60 + m + minutos;
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function minutosDe(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  // --- Inicialización -----------------------------------------------

  async function init() {
    const acceso = await window.Auth.requerirSesion();
    if (!acceso) return;
    window.Nav.render(acceso);

    try {
      const [{ shows }, { profesores }, { instrumentos }] = await Promise.all([
        api('/api/shows'),
        api('/api/profesores'),
        api('/api/instrumentos'),
      ]);

      state.shows = shows;
      state.profesores = profesores.filter((p) => p.activo);
      state.instrumentos = instrumentos.filter((i) => i.activo);

      const guardada = window.MuestraActual.obtener();
      state.showId = shows.some((s) => s.id === guardada) ? guardada : shows[0]?.id ?? null;
      state.profesorId = state.profesores[0]?.id ?? null;

      renderMuestras();
      renderDias();
      renderProfesor();
      renderInstrumentoSelect();
      renderOtraDuracion();

      el.formAlumno.addEventListener('submit', agregarAlumno);
      el.boton60.addEventListener('click', () => guardarBloque(60));
      el.boton75.addEventListener('click', () => guardarBloque(75));
      el.botonOtraDuracion.addEventListener('click', () => guardarBloque(Number(el.otraDuracion.value)));
      el.botonPreview.addEventListener('click', previsualizarCsv);
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && el.cuerpo.contains(document.activeElement)) cancelarBloque();
      });

      await cargarPersonasYAlumnos();

      el.estadoCarga.hidden = true;
      el.cuerpo.hidden = false;
      prepararProximoBloque();
    } catch (err) {
      mostrarErrorCarga(err.message);
    }
  }

  function mostrarErrorCarga(mensaje) {
    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = `No se pudo cargar: ${mensaje}`;
  }

  async function cargarPersonasYAlumnos() {
    if (!state.showId) return;
    const [{ personas }, { alumnos }] = await Promise.all([
      api(`/api/personas?showId=${state.showId}`),
      api(`/api/alumnos?showId=${state.showId}`),
    ]);
    state.personas = personas;
    state.alumnos = alumnos;
    renderDatalist();
  }

  // --- Contexto: muestra / día / profesor -----------------------------

  function renderMuestras() {
    el.muestras.innerHTML = '';
    state.shows.forEach((show) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'tab';
      btn.textContent = show.nombre;
      btn.setAttribute('aria-selected', String(show.id === state.showId));
      btn.addEventListener('click', async () => {
        if (state.showId === show.id) return;
        state.showId = show.id;
        window.MuestraActual.guardar(show.id);
        renderMuestras();
        cancelarBloque();
        el.estadoGuardado.textContent = 'Cargando alumnos de esta muestra…';
        await cargarPersonasYAlumnos();
        el.estadoGuardado.textContent = '';
      });
      el.muestras.appendChild(btn);
    });
  }

  function renderDias() {
    el.dias.innerHTML = '';
    DIAS.forEach((dia) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'tab';
      btn.textContent = dia.corta;
      btn.title = dia.larga;
      btn.setAttribute('aria-selected', String(dia.id === state.dia));
      btn.addEventListener('click', () => {
        if (state.dia === dia.id) return;
        state.dia = dia.id;
        renderDias();
        cancelarBloque();
      });
      el.dias.appendChild(btn);
    });
  }

  function renderProfesor() {
    el.selectProfesor.innerHTML = '';
    state.profesores.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nombre;
      if (p.id === state.profesorId) opt.selected = true;
      el.selectProfesor.appendChild(opt);
    });
    el.selectProfesor.addEventListener('change', () => {
      state.profesorId = el.selectProfesor.value;
      cancelarBloque();
    });
  }

  function renderInstrumentoSelect() {
    el.instrumentoAlumno.innerHTML = '';
    state.instrumentos.forEach((i) => {
      const opt = document.createElement('option');
      opt.value = i.id;
      opt.textContent = i.nombre;
      el.instrumentoAlumno.appendChild(opt);
    });
  }

  function renderDatalist() {
    el.personasExistentes.innerHTML = '';
    state.personas.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.nombre;
      el.personasExistentes.appendChild(opt);
    });
  }

  function renderOtraDuracion() {
    el.otraDuracion.innerHTML = '';
    for (let min = 15; min <= 180; min += 15) {
      const opt = document.createElement('option');
      opt.value = min;
      opt.textContent = min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60}`;
      if (min === 75) opt.selected = true;
      el.otraDuracion.appendChild(opt);
    }
  }

  // --- Bloque en curso ------------------------------------------------

  function prepararProximoBloque() {
    state.roster = [];
    state.horaInicioBloque = null;
    el.horaInicioBloque.value = state.horaInicioSiguiente || '';
    renderRoster();
    renderBloque();
    el.nombreAlumno.focus();
  }

  function cancelarBloque() {
    const habiaAlgo = state.roster.length > 0;
    state.horaInicioSiguiente = null;
    prepararProximoBloque();
    if (habiaAlgo) el.estadoGuardado.textContent = 'Bloque cancelado.';
  }

  function renderBloque() {
    el.campoHoraInicio.hidden = state.roster.length > 0;
    el.duracion.classList.toggle('duracion--visible', state.roster.length > 0);
    el.rosterLimite.hidden = state.roster.length < 3;

    if (state.roster.length === 0) {
      el.tituloBloque.textContent = 'Bloque nuevo';
    } else {
      el.tituloBloque.textContent = `Bloque desde ${state.horaInicioBloque}`;
    }

    const sugerido = state.roster.length <= 1 ? 60 : 75;
    el.boton60.classList.toggle('duracion__boton--sugerido', sugerido === 60);
    el.boton75.classList.toggle('duracion__boton--sugerido', sugerido === 75);
  }

  function renderRoster() {
    el.roster.innerHTML = '';
    el.rosterVacio.hidden = state.roster.length > 0;

    state.roster.forEach((item, i) => {
      const fila = document.createElement('div');
      fila.className = 'roster__item';
      fila.style.setProperty('--instrumento-color', item.instrumentoColor || '');

      const span = document.createElement('span');
      span.textContent = `${item.nombre} — ${item.instrumentoNombre}`;
      fila.appendChild(span);

      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.textContent = 'Quitar';
      quitar.addEventListener('click', () => {
        state.roster.splice(i, 1);
        renderRoster();
        renderBloque();
        if (state.roster.length === 0) el.horaInicioBloque.value = state.horaInicioBloque || '';
      });
      fila.appendChild(quitar);

      el.roster.appendChild(fila);
    });
  }

  function agregarAlumno(ev) {
    ev.preventDefault();
    el.estadoGuardado.textContent = '';

    const nombre = el.nombreAlumno.value.trim();
    if (!nombre) return;

    if (state.roster.length === 0) {
      const hora = el.horaInicioBloque.value;
      if (!hora) {
        el.horaInicioBloque.reportValidity();
        return;
      }
      state.horaInicioBloque = hora;
      state.horaInicioSiguiente = null;
    }

    const instrumentoId = el.instrumentoAlumno.value;
    const instrumento = state.instrumentos.find((i) => i.id === instrumentoId);

    state.roster.push({
      nombre,
      instrumentoId,
      instrumentoNombre: instrumento?.nombre || '',
      instrumentoColor: instrumento?.color || '',
    });

    el.nombreAlumno.value = '';
    renderRoster();
    renderBloque();
    el.nombreAlumno.focus();
  }

  // --- Resolver personas/alumnos y guardar el bloque -------------------

  function buscarPersonaExistente(nombre) {
    const n = normalizar(nombre);
    return state.personas.find((p) => normalizar(p.nombre) === n);
  }

  function buscarAlumnoExistente(personaId, instrumentoId) {
    return state.alumnos.find((a) => a.personaId === personaId && a.instrumentoId === instrumentoId);
  }

  async function resolverAlumno(item) {
    let personaId = buscarPersonaExistente(item.nombre)?.id || null;

    if (personaId) {
      const alumnoExistente = buscarAlumnoExistente(personaId, item.instrumentoId);
      if (alumnoExistente) return alumnoExistente.id;
    }

    if (!personaId) {
      const { persona } = await api('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: item.nombre, showId: state.showId }),
      });
      state.personas.push(persona);
      personaId = persona.id;
    }

    const { alumno } = await api('/api/alumnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId, instrumentoId: item.instrumentoId, profesorId: state.profesorId }),
    });
    state.alumnos.push(alumno);
    return alumno.id;
  }

  async function guardarBloque(duracionMinutos) {
    if (state.roster.length === 0 || state.guardando) return;
    if (!state.profesorId) {
      el.estadoGuardado.textContent = 'Elegí un profesor primero.';
      return;
    }

    const horaFin = sumarMinutos(state.horaInicioBloque, duracionMinutos);
    if (minutosDe(horaFin) > VENTANA_FIN_MIN) {
      el.estadoGuardado.textContent = 'Esa duración pasa las 21:30. Elegí una duración más corta.';
      return;
    }

    state.guardando = true;
    el.estadoGuardado.textContent = 'Guardando…';

    try {
      const alumnoIds = [];
      for (const item of state.roster) {
        alumnoIds.push(await resolverAlumno(item));
      }

      const { clase, aviso } = await api('/api/clases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profesorId: state.profesorId,
          dia: state.dia,
          horaInicio: state.horaInicioBloque,
          horaFin,
          alumnoIds,
        }),
      });

      state.horaInicioSiguiente = clase.horaFin.slice(0, 5);
      el.estadoGuardado.textContent = aviso || `Bloque guardado: ${state.horaInicioBloque}–${state.horaInicioSiguiente} ✓`;
      prepararProximoBloque();
    } catch (err) {
      el.estadoGuardado.textContent = `No se pudo guardar: ${err.message}`;
    } finally {
      state.guardando = false;
    }
  }

  // --- Importar CSV -----------------------------------------------------

  async function previsualizarCsv() {
    const csv = el.csvTexto.value.trim();
    if (!csv) return;

    el.previewCsv.innerHTML = '<p class="import-csv__nota">Analizando…</p>';

    try {
      const { filas } = await api('/api/alumnos/importar/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId: state.showId, csv }),
      });
      renderPreviewCsv(filas);
    } catch (err) {
      el.previewCsv.innerHTML = `<p class="import-csv__nota">${err.message}</p>`;
    }
  }

  function renderPreviewCsv(filas) {
    el.previewCsv.innerHTML = '';

    const tabla = document.createElement('table');
    tabla.innerHTML = `<thead><tr><th></th><th>Nombre</th><th>Instrumento</th><th>Profesor</th><th></th></tr></thead>`;
    const tbody = document.createElement('tbody');

    filas.forEach((fila) => {
      const tr = document.createElement('tr');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = fila.errores.length === 0;
      check.disabled = fila.errores.length > 0;

      const tdCheck = document.createElement('td');
      tdCheck.appendChild(check);
      tr.appendChild(tdCheck);

      const tdNombre = document.createElement('td');
      tdNombre.textContent = fila.nombre;
      if (fila.coincidencias.length > 0) {
        const nota = document.createElement('div');
        nota.className = 'import-csv__nota';
        nota.textContent = `Ya existe: se va a reusar "${fila.coincidencias[0].nombre}"`;
        tdNombre.appendChild(nota);
      }
      tr.appendChild(tdNombre);

      const tdInstr = document.createElement('td');
      tdInstr.textContent = fila.instrumentoNombre;
      tr.appendChild(tdInstr);

      const tdProf = document.createElement('td');
      tdProf.textContent = fila.profesorNombre;
      tr.appendChild(tdProf);

      const tdErr = document.createElement('td');
      if (fila.errores.length > 0) {
        tdErr.className = 'fila-error';
        tdErr.textContent = fila.errores.join('; ');
      }
      tr.appendChild(tdErr);

      tr._checkbox = check;
      tr._filaOriginal = fila;
      tbody.appendChild(tr);
    });

    tabla.appendChild(tbody);
    el.previewCsv.appendChild(tabla);

    const resumen = document.createElement('p');
    resumen.className = 'import-csv__resumen';
    const validas = filas.filter((f) => f.errores.length === 0).length;
    resumen.textContent = `${validas} de ${filas.length} filas listas para importar.`;
    el.previewCsv.appendChild(resumen);

    if (validas > 0) {
      const confirmar = document.createElement('button');
      confirmar.type = 'button';
      confirmar.textContent = 'Confirmar importación';
      confirmar.addEventListener('click', () => confirmarImportacion(tbody));
      el.previewCsv.appendChild(confirmar);
    }
  }

  async function confirmarImportacion(tbody) {
    const filasAImportar = [...tbody.children]
      .filter((tr) => tr._checkbox.checked)
      .map((tr) => {
        const f = tr._filaOriginal;
        return {
          nombre: f.nombre,
          instrumentoId: f.instrumentoId,
          profesorId: f.profesorId,
          personaId: f.coincidencias[0]?.id || null,
        };
      });

    if (filasAImportar.length === 0) return;

    try {
      const { resultados } = await api('/api/alumnos/importar/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId: state.showId, filas: filasAImportar }),
      });
      const ok = resultados.filter((r) => r.ok).length;
      el.previewCsv.innerHTML = `<p class="import-csv__resumen">Se importaron ${ok} de ${resultados.length} alumnos.</p>`;
      el.csvTexto.value = '';
      await cargarPersonasYAlumnos();
    } catch (err) {
      el.previewCsv.innerHTML = `<p class="import-csv__nota">${err.message}</p>`;
    }
  }

  init();
})();
