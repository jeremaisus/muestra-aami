(() => {
  const VENTANA_INICIO_MIN = 14 * 60; // 14:00
  const VENTANA_FIN_MIN = 21 * 60 + 30; // 21:30
  const PX_POR_MIN = 1.6;

  const DIAS = [
    { id: 1, corta: 'Lu', larga: 'Lunes' },
    { id: 2, corta: 'Ma', larga: 'Martes' },
    { id: 3, corta: 'Mi', larga: 'Miércoles' },
    { id: 4, corta: 'Ju', larga: 'Jueves' },
    { id: 5, corta: 'Vi', larga: 'Viernes' },
    { id: 6, corta: 'Sa', larga: 'Sábado' },
  ];

  const state = {
    shows: [],
    showId: null,
    profesores: [],
    instrumentos: [],
    clases: [],
    diaSeleccionado: 1,
    profesorFiltro: '',
    instrumentoFiltro: '',
    cargando: false,
  };

  const el = {
    muestras: document.getElementById('muestras'),
    dias: document.getElementById('dias'),
    filtroProfesor: document.getElementById('filtroProfesor'),
    filtroInstrumento: document.getElementById('filtroInstrumento'),
    estadoCarga: document.getElementById('estadoCarga'),
    listaMobile: document.getElementById('listaMobile'),
    encabezadosDias: document.getElementById('encabezadosDias'),
    horasEje: document.getElementById('horasEje'),
    columnasDias: document.getElementById('columnasDias'),
    linkExportar: document.getElementById('linkExportar'),
  };

  async function api(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Error ${res.status} en ${path}`);
    }
    return res.json();
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
    window.Nav.render(acceso);

    try {
      const [{ shows }, { profesores }, { instrumentos }] = await Promise.all([
        api('/api/shows'),
        api('/api/profesores'),
        api('/api/instrumentos'),
      ]);

      state.shows = shows;
      state.profesores = profesores;
      state.instrumentos = instrumentos.filter((i) => i.activo);

      const guardada = window.MuestraActual.obtener();
      state.showId = shows.some((s) => s.id === guardada) ? guardada : shows[0]?.id ?? null;

      renderMuestras();
      renderDias();
      renderFiltros();
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
    const alturaTotal = (VENTANA_FIN_MIN - VENTANA_INICIO_MIN) * PX_POR_MIN;

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
      marca.style.top = `${(min - VENTANA_INICIO_MIN) * PX_POR_MIN}px`;
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
        linea.style.top = `${(min - VENTANA_INICIO_MIN) * PX_POR_MIN}px`;
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
    bloque.style.top = `${(inicio - VENTANA_INICIO_MIN) * PX_POR_MIN}px`;
    bloque.style.height = `${(fin - inicio) * PX_POR_MIN}px`;

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

  init();
})();
