(() => {
  const NOMBRE_SIN_ASIGNAR = 'Sin asignar';

  const state = {
    shows: [],
    showId: null,
    acceso: null,
    config: null,
    instrumentos: [],
    alumnos: [],
    sinAsignarIds: new Set(),
    soloSinCancion: false,
    soloSinInstrumento: false,
    cancionesConSlots: null,
  };

  const el = {
    muestras: document.getElementById('muestras'),
    soloSinCancion: document.getElementById('soloSinCancion'),
    soloSinInstrumento: document.getElementById('soloSinInstrumento'),
    contador: document.getElementById('contador'),
    estadoCarga: document.getElementById('estadoCarga'),
    lista: document.getElementById('lista'),
    dialog: document.getElementById('accionesDialog'),
  };

  function esSinInstrumento(alumno) {
    return alumno.instrumento?.nombre === NOMBRE_SIN_ASIGNAR;
  }

  async function api(path, opciones) {
    const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...opciones });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Error ${res.status} en ${path}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function init() {
    const acceso = await window.Auth.requerirSesion();
    if (!acceso) return;
    state.acceso = acceso;
    window.Nav.render(acceso);

    try {
      const [{ shows }, { config }, { instrumentos }] = await Promise.all([
        api('/api/shows'),
        api('/api/config'),
        api('/api/instrumentos'),
      ]);
      state.shows = window.MuestraActual.paraSeleccion(shows);
      state.config = config;
      state.instrumentos = instrumentos.filter((i) => i.activo);
      const guardada = window.MuestraActual.obtener();
      state.showId = state.shows.some((s) => s.id === guardada) ? guardada : state.shows[0]?.id ?? null;

      renderMuestras();
      el.soloSinCancion.addEventListener('change', () => {
        state.soloSinCancion = el.soloSinCancion.checked;
        render();
      });
      el.soloSinInstrumento.addEventListener('change', () => {
        state.soloSinInstrumento = el.soloSinInstrumento.checked;
        render();
      });

      await cargar();
    } catch (err) {
      mostrarError(err.message);
    }
  }

  function renderMuestras() {
    el.muestras.innerHTML = '';
    state.shows.forEach((show) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'tab';
      btn.textContent = show.nombre;
      btn.setAttribute('aria-selected', String(show.id === state.showId));
      btn.addEventListener('click', () => {
        if (state.showId === show.id) return;
        state.showId = show.id;
        state.cancionesConSlots = null;
        window.MuestraActual.guardar(show.id);
        renderMuestras();
        cargar();
      });
      el.muestras.appendChild(btn);
    });
  }

  async function cargar() {
    if (!state.showId) return;
    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = 'Cargando…';

    try {
      const [{ alumnos }, { sinAsignar }] = await Promise.all([
        api(`/api/alumnos?showId=${state.showId}`),
        api(`/api/dashboard/sin-asignar?showId=${state.showId}`),
      ]);
      state.alumnos = alumnos;
      state.sinAsignarIds = new Set(sinAsignar.map((a) => a.alumnoId));
      el.estadoCarga.hidden = true;
      render();
    } catch (err) {
      mostrarError(err.message);
    }
  }

  function mostrarError(mensaje) {
    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = `No se pudo cargar: ${mensaje}`;
  }

  function render() {
    const total = state.alumnos.length;
    const faltan = state.sinAsignarIds.size;
    const sinInstrumento = state.alumnos.filter(esSinInstrumento).length;
    el.contador.textContent =
      `Faltan ${faltan} de ${total} sin canción asignada · ${sinInstrumento} sin instrumento asignado`;

    let visibles = state.alumnos;
    if (state.soloSinCancion) visibles = visibles.filter((a) => state.sinAsignarIds.has(a.id));
    if (state.soloSinInstrumento) visibles = visibles.filter(esSinInstrumento);

    el.lista.innerHTML = '';

    if (visibles.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'catalogo__vacio';
      vacio.textContent = state.soloSinCancion || state.soloSinInstrumento
        ? 'No hay alumnos que cumplan este filtro.'
        : 'Todavía no hay alumnos cargados en esta muestra.';
      el.lista.appendChild(vacio);
      return;
    }

    [...visibles]
      .sort((a, b) => (a.persona?.nombre || '').localeCompare(b.persona?.nombre || ''))
      .forEach((a) => el.lista.appendChild(filaAlumno(a)));
  }

  function filaAlumno(alumno) {
    const fila = document.createElement('div');
    fila.className = 'alumno-fila';
    fila.style.setProperty('--instrumento-color', alumno.instrumento?.color || '');

    const info = document.createElement('div');
    const nombre = document.createElement('div');
    nombre.className = 'alumno-fila__nombre';
    nombre.textContent = `${alumno.persona?.nombre || 'Sin nombre'} — ${alumno.instrumento?.nombre || ''}`;
    if (state.sinAsignarIds.has(alumno.id)) {
      const badge = document.createElement('span');
      badge.className = 'alumno-fila__sin-cancion';
      badge.textContent = 'sin canción';
      nombre.appendChild(badge);
    }
    if (esSinInstrumento(alumno)) {
      const badge = document.createElement('span');
      badge.className = 'alumno-fila__sin-cancion';
      badge.textContent = 'sin instrumento';
      nombre.appendChild(badge);
    }
    info.appendChild(nombre);

    const meta = document.createElement('div');
    meta.className = 'alumno-fila__meta';
    meta.textContent = `profe ${alumno.profesor?.nombre || '—'}`;
    info.appendChild(meta);

    fila.appendChild(info);

    const acciones = document.createElement('div');
    acciones.className = 'alumno-fila__acciones';

    const abrir = document.createElement('button');
    abrir.type = 'button';
    abrir.textContent = 'Acciones';
    abrir.addEventListener('click', () => abrirAcciones(alumno));
    acciones.appendChild(abrir);

    if (state.acceso.rol === 'admin') {
      const borrar = document.createElement('button');
      borrar.type = 'button';
      borrar.textContent = 'Borrar';
      borrar.addEventListener('click', async () => {
        if (!confirm(`¿Borrar a ${alumno.persona?.nombre} — ${alumno.instrumento?.nombre}?`)) return;
        try {
          await api(`/api/alumnos/${alumno.id}`, { method: 'DELETE' });
          state.alumnos = state.alumnos.filter((a) => a.id !== alumno.id);
          state.sinAsignarIds.delete(alumno.id);
          render();
        } catch (err) {
          alert(err.message);
        }
      });
      acciones.appendChild(borrar);
    }

    fila.appendChild(acciones);

    return fila;
  }

  // --- Popup de acciones rápidas -------------------------------------

  function esAdmin() {
    return state.acceso.rol === 'admin';
  }

  function puedeAsignar() {
    return esAdmin() || state.config.profesPuedenOcuparSlots;
  }

  async function cargarCancionesConSlots() {
    if (state.cancionesConSlots) return state.cancionesConSlots;
    const { canciones } = await api(`/api/canciones?showId=${state.showId}`);
    state.cancionesConSlots = await Promise.all(
      canciones.map((cancion) =>
        api(`/api/canciones/${cancion.id}/slots`).then(({ slots }) => ({ cancion, slots }))
      )
    );
    return state.cancionesConSlots;
  }

  async function abrirAcciones(alumno) {
    el.dialog.innerHTML = '';
    renderDialogHeader(alumno);
    el.dialog.showModal();

    const cargandoBandas = document.createElement('p');
    cargandoBandas.className = 'acciones-dialog__vacio';
    cargandoBandas.textContent = 'Cargando bandas…';
    el.dialog.appendChild(cargandoBandas);

    try {
      const listas = await cargarCancionesConSlots();
      if (!el.dialog.open) return;
      cargandoBandas.remove();
      renderDialogBandas(alumno, listas);
    } catch (err) {
      cargandoBandas.textContent = `No se pudo cargar: ${err.message}`;
    }
  }

  function tituloAlumno(alumno) {
    return `${alumno.persona?.nombre || 'Sin nombre'} — ${alumno.instrumento?.nombre || ''}`;
  }

  function renderDialogHeader(alumno) {
    const titulo = document.createElement('p');
    titulo.className = 'acciones-dialog__titulo';
    titulo.id = 'accionesDialogTitulo';
    titulo.textContent = tituloAlumno(alumno);
    el.dialog.appendChild(titulo);

    const meta = document.createElement('p');
    meta.className = 'acciones-dialog__meta';
    meta.textContent = `profe ${alumno.profesor?.nombre || '—'}`;
    el.dialog.appendChild(meta);

    if (puedeAsignar()) {
      const seccionInstrumento = document.createElement('div');
      seccionInstrumento.className = 'acciones-dialog__seccion';
      const tituloInstrumento = document.createElement('p');
      tituloInstrumento.className = 'acciones-dialog__seccion-titulo';
      tituloInstrumento.textContent = 'Cambiar instrumento';
      seccionInstrumento.appendChild(tituloInstrumento);

      const fila = document.createElement('div');
      fila.className = 'acciones-dialog__asignar';
      const select = document.createElement('select');
      state.instrumentos.forEach((i) => {
        const opt = document.createElement('option');
        opt.value = i.id;
        opt.textContent = i.nombre;
        if (i.id === alumno.instrumentoId) opt.selected = true;
        select.appendChild(opt);
      });
      fila.appendChild(select);

      const guardar = document.createElement('button');
      guardar.type = 'button';
      guardar.textContent = 'Guardar';
      guardar.addEventListener('click', () => cambiarInstrumento(alumno, select.value, guardar));
      fila.appendChild(guardar);

      seccionInstrumento.appendChild(fila);
      el.dialog.appendChild(seccionInstrumento);
    }

    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'acciones-dialog__cerrar';
    cerrar.id = 'accionesDialogCerrar';
    cerrar.textContent = 'Cerrar';
    cerrar.addEventListener('click', () => el.dialog.close());
    el.dialog.appendChild(cerrar);
  }

  async function cambiarInstrumento(alumno, instrumentoId, boton) {
    if (!instrumentoId || instrumentoId === alumno.instrumentoId) {
      el.dialog.close();
      return;
    }
    boton.disabled = true;
    try {
      const { alumno: actualizado } = await api(`/api/alumnos/${alumno.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instrumentoId }),
      });
      const idx = state.alumnos.findIndex((a) => a.id === alumno.id);
      if (idx !== -1) state.alumnos[idx] = actualizado;
      render();
      el.dialog.close();
    } catch (err) {
      boton.disabled = false;
      alert(err.message);
    }
  }

  function renderDialogBandas(alumno, listas) {
    const vacios = [];
    const ocupados = [];
    listas.forEach(({ cancion, slots }) => {
      slots.forEach((slot) => {
        if (slot.instrumento.id !== alumno.instrumentoId) return;
        if (slot.alumnoId === alumno.id) ocupados.push({ cancion, slot });
        else if (!slot.alumnoId && !slot.profesorId) vacios.push({ cancion, slot });
      });
    });

    const cerrar = document.getElementById('accionesDialogCerrar');
    el.dialog.querySelectorAll('.acciones-dialog__banda-seccion').forEach((n) => n.remove());

    if (esAdmin()) {
      const seccionParticipa = document.createElement('div');
      seccionParticipa.className = 'acciones-dialog__seccion acciones-dialog__banda-seccion';
      const label = document.createElement('label');
      label.className = 'acciones-dialog__toggle';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = alumno.persona?.participa !== false;
      check.addEventListener('change', () => cambiarParticipa(alumno, check.checked));
      label.appendChild(check);
      label.appendChild(document.createTextNode(' Participa de la muestra'));
      seccionParticipa.appendChild(label);
      el.dialog.insertBefore(seccionParticipa, cerrar);
    }

    const seccionOcupa = document.createElement('div');
    seccionOcupa.className = 'acciones-dialog__seccion acciones-dialog__banda-seccion';
    const tituloOcupa = document.createElement('p');
    tituloOcupa.className = 'acciones-dialog__seccion-titulo';
    tituloOcupa.textContent = 'En estas canciones';
    seccionOcupa.appendChild(tituloOcupa);

    if (ocupados.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'acciones-dialog__vacio';
      vacio.textContent = 'Todavía no está en ninguna banda.';
      seccionOcupa.appendChild(vacio);
    }

    ocupados.forEach(({ cancion, slot }) => {
      const fila = document.createElement('div');
      fila.className = 'acciones-dialog__fila';
      const texto = document.createElement('span');
      texto.textContent = `${cancion.titulo} — ${slot.instrumento.nombre} ${slot.numero}`;
      fila.appendChild(texto);

      if (esAdmin()) {
        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.textContent = 'Quitar';
        quitar.addEventListener('click', () => quitarDeSlot(alumno, slot, cancion));
        fila.appendChild(quitar);
      }

      seccionOcupa.appendChild(fila);
    });

    el.dialog.insertBefore(seccionOcupa, cerrar);

    if (puedeAsignar()) {
      const seccionAsignar = document.createElement('div');
      seccionAsignar.className = 'acciones-dialog__seccion acciones-dialog__banda-seccion';
      const tituloAsignar = document.createElement('p');
      tituloAsignar.className = 'acciones-dialog__seccion-titulo';
      tituloAsignar.textContent = 'Asignar a una banda';
      seccionAsignar.appendChild(tituloAsignar);

      if (vacios.length === 0) {
        const vacio = document.createElement('p');
        vacio.className = 'acciones-dialog__vacio';
        vacio.textContent = `No hay slots vacíos de ${alumno.instrumento?.nombre} en esta muestra.`;
        seccionAsignar.appendChild(vacio);
      } else {
        const fila = document.createElement('div');
        fila.className = 'acciones-dialog__asignar';
        const select = document.createElement('select');
        vacios.forEach(({ cancion, slot }) => {
          const opt = document.createElement('option');
          opt.value = slot.id;
          opt.textContent = `${cancion.titulo} — ${slot.instrumento.nombre} ${slot.numero}`;
          select.appendChild(opt);
        });
        fila.appendChild(select);

        const asignar = document.createElement('button');
        asignar.type = 'button';
        asignar.textContent = 'Asignar';
        asignar.addEventListener('click', () => asignarASlot(alumno, select.value, vacios));
        fila.appendChild(asignar);

        seccionAsignar.appendChild(fila);
      }

      el.dialog.insertBefore(seccionAsignar, cerrar);
    }
  }

  async function cambiarParticipa(alumno, participa) {
    try {
      await api(`/api/personas/${alumno.persona.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participa }),
      });
      if (alumno.persona) alumno.persona.participa = participa;
    } catch (err) {
      alert(err.message);
    }
  }

  async function asignarASlot(alumno, slotId, vacios) {
    if (!slotId) return;
    try {
      await api(`/api/slots/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId: alumno.id }),
      });
      state.cancionesConSlots = null;
      state.sinAsignarIds.delete(alumno.id);
      render();
      const listas = await cargarCancionesConSlots();
      renderDialogBandas(alumno, listas);
    } catch (err) {
      alert(err.message);
    }
  }

  async function quitarDeSlot(alumno, slot, cancion) {
    if (!confirm(`¿Quitar a ${alumno.persona?.nombre} de ${cancion.titulo}?`)) return;
    try {
      await api(`/api/slots/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId: null }),
      });
      state.cancionesConSlots = null;
      const { sinAsignar } = await api(`/api/dashboard/sin-asignar?showId=${state.showId}`);
      state.sinAsignarIds = new Set(sinAsignar.map((a) => a.alumnoId));
      render();
      const listas = await cargarCancionesConSlots();
      renderDialogBandas(alumno, listas);
    } catch (err) {
      alert(err.message);
    }
  }

  init();
})();
