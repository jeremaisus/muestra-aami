(() => {
  const VENTANA_INICIO_MIN = 14 * 60; // 14:00
  const VENTANA_FIN_MIN = 21 * 60 + 30; // 21:30
  const ZOOM_NIVELES = [0.8, 1.1, 1.6, 2.2, 3];
  const ZOOM_CLAVE = 'muestra-aami:grilla-zoom';
  const ZOOM_INDICE_DEFAULT = 2; // 1.6, el valor original

  const DIAS = [
    { id: 1, corta: 'Lu', larga: 'Lunes' },
    { id: 2, corta: 'Ma', larga: 'Martes' },
    { id: 3, corta: 'Mi', larga: 'Miércoles' },
    { id: 4, corta: 'Ju', larga: 'Jueves' },
    { id: 5, corta: 'Vi', larga: 'Viernes' },
    { id: 6, corta: 'Sa', larga: 'Sábado' },
  ];

  const state = {
    acceso: null,
    config: null,
    shows: [],
    showId: null,
    profesores: [],
    instrumentos: [],
    clases: [],
    diaSeleccionado: 1,
    profesorFiltro: '',
    instrumentoFiltro: '',
    cargando: false,
    zoomIndice: leerZoomGuardado(),
    cancionesConSlots: null, // cache de /api/canciones + sus slots, por muestra
  };

  function leerZoomGuardado() {
    try {
      const crudo = sessionStorage.getItem(ZOOM_CLAVE);
      if (crudo === null) return ZOOM_INDICE_DEFAULT;
      const guardado = Number(crudo);
      if (Number.isInteger(guardado) && ZOOM_NIVELES[guardado] !== undefined) return guardado;
    } catch {
      /* noop */
    }
    return ZOOM_INDICE_DEFAULT;
  }

  function pxPorMin() {
    return ZOOM_NIVELES[state.zoomIndice];
  }

  const el = {
    muestras: document.getElementById('muestras'),
    dias: document.getElementById('dias'),
    zoomOut: document.getElementById('zoomOut'),
    zoomIn: document.getElementById('zoomIn'),
    zoomLabel: document.getElementById('zoomLabel'),
    filtroProfesor: document.getElementById('filtroProfesor'),
    filtroInstrumento: document.getElementById('filtroInstrumento'),
    estadoCarga: document.getElementById('estadoCarga'),
    listaMobile: document.getElementById('listaMobile'),
    encabezadosDias: document.getElementById('encabezadosDias'),
    horasEje: document.getElementById('horasEje'),
    columnasDias: document.getElementById('columnasDias'),
    linkExportar: document.getElementById('linkExportar'),
    dialogClase: document.getElementById('dialogClase'),
  };

  async function api(path, opciones) {
    const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...opciones });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Error ${res.status} en ${path}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function esAdmin() {
    return state.acceso?.rol === 'admin';
  }

  // Mismo criterio que en la ficha de canción: admin siempre puede asignar;
  // un profesor con el interruptor prendido solo puede ocupar un slot vacío
  // que ya existe, nunca crear uno nuevo (eso queda para administración).
  function puedeOcuparSlotVacio() {
    return esAdmin() || state.config?.profesPuedenOcuparSlots;
  }

  function horaAMinutos(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  function formatearHora(hora) {
    return hora.slice(0, 5);
  }

  function nombreCompleto(persona) {
    return persona ? persona.nombre : 'Sin nombre';
  }

  // --- Carga inicial -------------------------------------------------

  async function init() {
    const acceso = await window.Auth.requerirSesion();
    if (!acceso) return;
    state.acceso = acceso;
    window.Nav.render(acceso);

    try {
      const [{ shows }, { profesores }, { instrumentos }, { config }] = await Promise.all([
        api('/api/shows'),
        api('/api/profesores'),
        api('/api/instrumentos'),
        api('/api/config'),
      ]);

      state.shows = window.MuestraActual.paraSeleccion(shows);
      state.profesores = profesores;
      state.instrumentos = instrumentos.filter((i) => i.activo);
      state.config = config;

      const guardada = window.MuestraActual.obtener();
      state.showId = state.shows.some((s) => s.id === guardada) ? guardada : state.shows[0]?.id ?? null;

      renderMuestras();
      renderDias();
      renderFiltros();
      renderZoom();
      actualizarLinkExportar();
      await cargarClases();
    } catch (err) {
      mostrarError(err.message);
    }
  }

  function actualizarLinkExportar() {
    if (!state.showId) return;
    el.linkExportar.href = `/api/export/grilla?showId=${state.showId}`;
  }

  async function cargarClases() {
    if (!state.showId) return;
    state.cargando = true;
    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = 'Cargando…';

    try {
      const params = new URLSearchParams({ showId: state.showId });
      if (state.profesorFiltro) params.set('profesorId', state.profesorFiltro);

      const { clases } = await api(`/api/clases?${params}`);
      state.clases = clases;
      el.estadoCarga.hidden = true;
      render();
    } catch (err) {
      mostrarError(err.message);
    } finally {
      state.cargando = false;
    }
  }

  function mostrarError(mensaje) {
    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = `No se pudo cargar: ${mensaje}`;
  }

  // --- Controles: muestra / día / filtros ----------------------------

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
        actualizarLinkExportar();
        cargarClases();
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
      btn.setAttribute('aria-selected', String(dia.id === state.diaSeleccionado));
      btn.addEventListener('click', () => {
        if (state.diaSeleccionado === dia.id) return;
        state.diaSeleccionado = dia.id;
        renderDias();
        renderListaMobile();
      });
      el.dias.appendChild(btn);
    });
  }

  function renderFiltros() {
    el.filtroProfesor.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
    state.profesores.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nombre;
      el.filtroProfesor.appendChild(opt);
    });

    el.filtroInstrumento.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
    state.instrumentos.forEach((i) => {
      const opt = document.createElement('option');
      opt.value = i.id;
      opt.textContent = i.nombre;
      el.filtroInstrumento.appendChild(opt);
    });

    el.filtroProfesor.addEventListener('change', () => {
      state.profesorFiltro = el.filtroProfesor.value;
      cargarClases();
    });

    el.filtroInstrumento.addEventListener('change', () => {
      state.instrumentoFiltro = el.filtroInstrumento.value;
      render();
    });
  }

  function renderZoom() {
    el.zoomLabel.textContent = `${Math.round((pxPorMin() / ZOOM_NIVELES[ZOOM_INDICE_DEFAULT]) * 100)}%`;
    el.zoomOut.disabled = state.zoomIndice === 0;
    el.zoomIn.disabled = state.zoomIndice === ZOOM_NIVELES.length - 1;

    el.zoomOut.onclick = () => cambiarZoom(-1);
    el.zoomIn.onclick = () => cambiarZoom(1);
  }

  function cambiarZoom(delta) {
    const nuevo = state.zoomIndice + delta;
    if (nuevo < 0 || nuevo >= ZOOM_NIVELES.length) return;
    state.zoomIndice = nuevo;
    try {
      sessionStorage.setItem(ZOOM_CLAVE, String(nuevo));
    } catch {
      /* noop */
    }
    renderZoom();
    renderGrillaSemana();
  }

  // --- Datos filtrados -------------------------------------------------

  function clasesFiltradas() {
    if (!state.instrumentoFiltro) return state.clases;
    return state.clases.filter((c) =>
      c.alumnos.some((a) => a.instrumento?.id === state.instrumentoFiltro)
    );
  }

  // --- Render ------------------------------------------------------

  function render() {
    renderListaMobile();
    renderGrillaSemana();
  }

  function renderListaMobile() {
    const clases = clasesFiltradas()
      .filter((c) => c.dia === state.diaSeleccionado)
      .sort((a, b) => horaAMinutos(a.horaInicio) - horaAMinutos(b.horaInicio));

    el.listaMobile.innerHTML = '';

    if (clases.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'lista-mobile__vacio';
      vacio.textContent = 'No hay clases cargadas para este día.';
      el.listaMobile.appendChild(vacio);
      return;
    }

    clases.forEach((clase) => {
      el.listaMobile.appendChild(bloqueMobile(clase));
    });
  }

  function bloqueMobile(clase) {
    const bloque = document.createElement('article');
    bloque.className = 'bloque';
    bloque.setAttribute('role', 'button');
    bloque.setAttribute('tabindex', '0');
    bloque.addEventListener('click', () => abrirDialogClase(clase));
    bloque.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        abrirDialogClase(clase);
      }
    });

    const hora = document.createElement('p');
    hora.className = 'bloque__hora';
    hora.textContent = `${formatearHora(clase.horaInicio)} – ${formatearHora(clase.horaFin)}`;
    bloque.appendChild(hora);

    if (clase.alumnos.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'bloque__profesor';
      vacio.textContent = 'Sin alumnos asignados';
      bloque.appendChild(vacio);
    }

    clase.alumnos.forEach((alumno) => {
      const fila = document.createElement('div');
      fila.className = 'bloque__alumno';
      fila.style.setProperty('--instrumento-color', alumno.instrumento?.color || '');

      const nombre = document.createElement('span');
      nombre.className = 'bloque__alumno-nombre';
      nombre.textContent = nombreCompleto(alumno.persona);
      fila.appendChild(nombre);

      const instrumento = document.createElement('span');
      instrumento.className = 'bloque__alumno-instrumento';
      instrumento.textContent = alumno.instrumento?.nombre || '';
      fila.appendChild(instrumento);

      bloque.appendChild(fila);
    });

    const profesor = document.createElement('p');
    profesor.className = 'bloque__profesor';
    profesor.textContent = `profe ${clase.profesor?.nombre || '—'}`;
    bloque.appendChild(profesor);

    return bloque;
  }

  function renderGrillaSemana() {
    const alturaTotal = (VENTANA_FIN_MIN - VENTANA_INICIO_MIN) * pxPorMin();

    // Encabezados de día.
    el.encabezadosDias.innerHTML = '<span></span>';
    DIAS.forEach((dia) => {
      const span = document.createElement('span');
      span.textContent = dia.larga;
      el.encabezadosDias.appendChild(span);
    });

    // Eje de horas, marcado cada 30 minutos.
    el.horasEje.innerHTML = '';
    el.horasEje.style.height = `${alturaTotal}px`;
    for (let min = VENTANA_INICIO_MIN; min <= VENTANA_FIN_MIN; min += 30) {
      const marca = document.createElement('span');
      marca.className = 'grilla-semana__hora-marca';
      marca.style.top = `${(min - VENTANA_INICIO_MIN) * pxPorMin()}px`;
      const h = String(Math.floor(min / 60)).padStart(2, '0');
      const m = String(min % 60).padStart(2, '0');
      marca.textContent = `${h}:${m}`;
      el.horasEje.appendChild(marca);
    }

    // Columnas de día.
    el.columnasDias.innerHTML = '';
    el.columnasDias.style.height = `${alturaTotal}px`;

    const clases = clasesFiltradas();

    DIAS.forEach((dia) => {
      const columna = document.createElement('div');
      columna.className = 'grilla-semana__dia-columna';
      columna.style.height = `${alturaTotal}px`;

      for (let min = VENTANA_INICIO_MIN; min <= VENTANA_FIN_MIN; min += 30) {
        const linea = document.createElement('div');
        linea.className = 'grilla-semana__linea-hora';
        linea.style.top = `${(min - VENTANA_INICIO_MIN) * pxPorMin()}px`;
        columna.appendChild(linea);
      }

      clases
        .filter((c) => c.dia === dia.id)
        .forEach((clase) => columna.appendChild(bloqueDesktop(clase)));

      el.columnasDias.appendChild(columna);
    });
  }

  function bloqueDesktop(clase) {
    const inicio = horaAMinutos(clase.horaInicio);
    const fin = horaAMinutos(clase.horaFin);

    const bloque = document.createElement('article');
    bloque.className = 'clase-bloque';
    bloque.style.top = `${(inicio - VENTANA_INICIO_MIN) * pxPorMin()}px`;
    bloque.style.height = `${(fin - inicio) * pxPorMin()}px`;
    bloque.setAttribute('role', 'button');
    bloque.setAttribute('tabindex', '0');
    bloque.addEventListener('click', () => abrirDialogClase(clase));
    bloque.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        abrirDialogClase(clase);
      }
    });

    const hora = document.createElement('p');
    hora.className = 'clase-bloque__hora';
    hora.textContent = `${formatearHora(clase.horaInicio)}–${formatearHora(clase.horaFin)}`;
    bloque.appendChild(hora);

    if (clase.alumnos.length === 0) {
      const p = document.createElement('p');
      p.className = 'clase-bloque__alumno';
      p.textContent = 'Sin alumnos';
      bloque.appendChild(p);
    }

    clase.alumnos.forEach((alumno) => {
      const p = document.createElement('p');
      p.className = 'clase-bloque__alumno';
      p.style.setProperty('--instrumento-color', alumno.instrumento?.color || '');
      p.textContent = `${nombreCompleto(alumno.persona)} — ${alumno.instrumento?.nombre || ''}`;
      bloque.appendChild(p);
    });

    const profesor = document.createElement('p');
    profesor.className = 'clase-bloque__profesor';
    profesor.textContent = `profe ${clase.profesor?.nombre || '—'}`;
    bloque.appendChild(profesor);

    return bloque;
  }

  // --- Asignar canción desde un bloque de la grilla -----------------------

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

  async function abrirDialogClase(clase) {
    el.dialogClase.innerHTML = '';
    const cargando = document.createElement('p');
    cargando.textContent = 'Cargando…';
    el.dialogClase.appendChild(cargando);
    el.dialogClase.showModal();

    try {
      const listas = await cargarCancionesConSlots();
      renderDialogClase(clase, listas);
    } catch (err) {
      el.dialogClase.innerHTML = '';
      const error = document.createElement('p');
      error.textContent = `No se pudo cargar: ${err.message}`;
      el.dialogClase.appendChild(error);
    }
  }

  function renderDialogClase(clase, listas) {
    el.dialogClase.innerHTML = '';

    const titulo = document.createElement('p');
    titulo.className = 'acciones-dialog__titulo';
    const diaInfo = DIAS.find((d) => d.id === clase.dia);
    titulo.textContent = `${diaInfo?.larga || ''} ${formatearHora(clase.horaInicio)}–${formatearHora(clase.horaFin)}`;
    el.dialogClase.appendChild(titulo);

    const meta = document.createElement('p');
    meta.className = 'acciones-dialog__meta';
    meta.textContent = `profe ${clase.profesor?.nombre || '—'}`;
    el.dialogClase.appendChild(meta);

    if (clase.alumnos.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'acciones-dialog__vacio';
      vacio.textContent = 'Este bloque todavía no tiene alumnos.';
      el.dialogClase.appendChild(vacio);
    }

    clase.alumnos.forEach((alumno, indice) => {
      const seccion = document.createElement('div');
      seccion.className = 'acciones-dialog__seccion';

      const nombreBloque = document.createElement('p');
      nombreBloque.className = 'acciones-dialog__seccion-titulo acciones-dialog__alumno-bloque';
      nombreBloque.style.setProperty('--instrumento-color', alumno.instrumento?.color || '');
      nombreBloque.textContent = `${nombreCompleto(alumno.persona)} — ${alumno.instrumento?.nombre || ''}`;
      seccion.appendChild(nombreBloque);

      const fila = document.createElement('div');
      fila.className = 'acciones-dialog__asignar';

      const select = document.createElement('select');
      select.setAttribute('aria-label', `Asignar canción a ${nombreCompleto(alumno.persona)}`);
      const optDefault = document.createElement('option');
      optDefault.value = '';
      optDefault.textContent = listas.length ? 'Elegir canción…' : 'No hay canciones en esta muestra';
      select.appendChild(optDefault);
      listas.forEach(({ cancion }) => {
        const opt = document.createElement('option');
        opt.value = cancion.id;
        opt.textContent = cancion.titulo;
        select.appendChild(opt);
      });
      fila.appendChild(select);

      const resultadoId = `dialogClaseResultado${indice}`;

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = 'Asignar';
      boton.addEventListener('click', () => asignarAlumnoACancion(alumno, select.value, resultadoId));
      fila.appendChild(boton);

      seccion.appendChild(fila);

      const resultado = document.createElement('p');
      resultado.className = 'acciones-dialog__resultado';
      resultado.id = resultadoId;
      seccion.appendChild(resultado);

      el.dialogClase.appendChild(seccion);
    });

    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'acciones-dialog__cerrar';
    cerrar.textContent = 'Cerrar';
    cerrar.addEventListener('click', () => el.dialogClase.close());
    el.dialogClase.appendChild(cerrar);
  }

  async function asignarAlumnoACancion(alumno, cancionId, resultadoId) {
    const resultado = document.getElementById(resultadoId);
    if (!cancionId) {
      if (resultado) resultado.textContent = 'Elegí una canción primero.';
      return;
    }

    const listas = state.cancionesConSlots || [];
    const entrada = listas.find((l) => l.cancion.id === cancionId);
    if (!entrada) return;

    const slotsInstrumento = entrada.slots.filter((s) => s.instrumento.id === alumno.instrumento.id);
    const vacio = slotsInstrumento.find((s) => !s.alumnoId && !s.profesorId);

    try {
      let slotAsignado;

      if (vacio) {
        if (!puedeOcuparSlotVacio()) {
          if (resultado) resultado.textContent = 'La carga de slots está cerrada por administración.';
          return;
        }
        const { slot } = await api(`/api/slots/${vacio.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alumnoId: alumno.id }),
        });
        slotAsignado = slot;
      } else {
        if (!esAdmin()) {
          if (resultado) resultado.textContent = 'Ya está ocupado: hace falta administración para sumar otro.';
          return;
        }
        if (slotsInstrumento.length > 0) {
          const siguienteNumero = Math.max(...slotsInstrumento.map((s) => s.numero)) + 1;
          const ok = confirm(
            `Ya hay alguien en ${alumno.instrumento.nombre} en "${entrada.cancion.titulo}". ¿Agregar como ${alumno.instrumento.nombre} ${siguienteNumero}?`
          );
          if (!ok) return;
        }
        const { slot: nuevo } = await api(`/api/canciones/${cancionId}/slots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instrumentoId: alumno.instrumento.id }),
        });
        const { slot } = await api(`/api/slots/${nuevo.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alumnoId: alumno.id }),
        });
        slotAsignado = slot;
      }

      // Actualiza la cache en memoria (no la invalida) para que asignar a
      // otro alumno del mismo bloque, en el mismo popup, vea el estado nuevo.
      const idx = entrada.slots.findIndex((s) => s.id === slotAsignado.id);
      if (idx >= 0) entrada.slots[idx] = slotAsignado;
      else entrada.slots.push(slotAsignado);

      if (resultado) {
        resultado.textContent = `Asignado a "${entrada.cancion.titulo}" — ${slotAsignado.instrumento.nombre} ${slotAsignado.numero} ✓`;
      }
    } catch (err) {
      if (resultado) resultado.textContent = err.message;
    }
  }

  init();
})();
