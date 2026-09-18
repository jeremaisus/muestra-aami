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
    acceso: null,
    config: null,
    shows: [],
    profesores: [],
    profesorFiltro: '',
    alumnos: [],
    busqueda: '',
    mostrarAsignados: false,
    clasesPorProfesor: new Map(), // profesorId -> clases[] (cache, se invalida al guardar)
    expandidoId: null,
    panelDia: null,
    panelHora: null,
    guardando: false,
  };

  const el = {
    cerradoAviso: document.getElementById('cerradoAviso'),
    campoProfesor: document.getElementById('campoProfesor'),
    selectProfesor: document.getElementById('selectProfesor'),
    buscador: document.getElementById('buscador'),
    mostrarAsignados: document.getElementById('mostrarAsignados'),
    contador: document.getElementById('contador'),
    estadoCarga: document.getElementById('estadoCarga'),
    lista: document.getElementById('lista'),
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
    return state.acceso.rol === 'admin';
  }

  function normalizar(s) {
    return (s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
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

  function hhmm(hora) {
    return (hora || '').slice(0, 5);
  }

  // --- Inicialización ----------------------------------------------------

  async function init() {
    const acceso = await window.Auth.requerirSesion();
    if (!acceso) return;
    state.acceso = acceso;
    window.Nav.render(acceso);

    try {
      const [{ config }, { shows }] = await Promise.all([api('/api/config'), api('/api/shows')]);
      state.config = config;
      state.shows = shows;

      if (esAdmin()) {
        const { profesores } = await api('/api/profesores');
        state.profesores = profesores.filter((p) => p.activo);
        renderSelectProfesor();
        el.campoProfesor.hidden = false;
        el.selectProfesor.addEventListener('change', () => {
          state.profesorFiltro = el.selectProfesor.value;
          cerrarPanel();
          cargarAlumnos();
        });
      } else if (!state.config.profesPuedenEditarHorarios) {
        el.cerradoAviso.hidden = false;
      }

      el.buscador.addEventListener('input', () => {
        state.busqueda = el.buscador.value;
        render();
      });
      el.mostrarAsignados.addEventListener('change', () => {
        state.mostrarAsignados = el.mostrarAsignados.checked;
        render();
      });

      await cargarAlumnos();
    } catch (err) {
      mostrarError(err.message);
    }
  }

  function mostrarError(mensaje) {
    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = `No se pudo cargar: ${mensaje}`;
  }

  function renderSelectProfesor() {
    state.profesores.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nombre;
      el.selectProfesor.appendChild(opt);
    });
  }

  function puedeEscribir() {
    return esAdmin() || state.config.profesPuedenEditarHorarios;
  }

  async function cargarAlumnos() {
    if (!esAdmin() && !state.acceso.profesorId) {
      state.alumnos = [];
      el.estadoCarga.hidden = false;
      el.estadoCarga.textContent =
        'Tu acceso no está vinculado a ningún profesor. Pedile a administración que lo vincule desde Accesos.';
      render();
      return;
    }

    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = 'Cargando…';

    try {
      const params = esAdmin() && state.profesorFiltro ? `?profesorId=${state.profesorFiltro}` : '';
      const { alumnos } = await api(`/api/alumnos/horarios${params}`);
      state.alumnos = alumnos;
      el.estadoCarga.hidden = true;
      render();
    } catch (err) {
      mostrarError(err.message);
    }
  }

  // --- Lista ---------------------------------------------------------

  function render() {
    const pendientes = state.alumnos.filter((a) => !a.clase);
    el.contador.textContent = `Faltan ${pendientes.length} de ${state.alumnos.length}`;

    let visibles = state.mostrarAsignados ? state.alumnos : pendientes;
    const busqueda = normalizar(state.busqueda);
    if (busqueda) {
      visibles = visibles.filter((a) => normalizar(a.persona?.nombre).includes(busqueda));
    }

    el.lista.innerHTML = '';

    if (state.alumnos.length === 0 && el.estadoCarga.hidden) {
      const vacio = document.createElement('p');
      vacio.className = 'catalogo__vacio';
      vacio.textContent = esAdmin()
        ? 'No hay alumnos cargados.'
        : 'Todavía no tenés alumnos cargados.';
      el.lista.appendChild(vacio);
      return;
    }

    if (visibles.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'catalogo__vacio';
      vacio.textContent = busqueda
        ? 'Nadie coincide con esa búsqueda.'
        : '¡Listo! No quedan alumnos pendientes de horario.';
      el.lista.appendChild(vacio);
      return;
    }

    [...visibles]
      .sort((a, b) => (a.persona?.nombre || '').localeCompare(b.persona?.nombre || ''))
      .forEach((a) => {
        el.lista.appendChild(filaAlumno(a));
        if (state.expandidoId === a.id) el.lista.appendChild(panelAsignar(a));
      });
  }

  function nombreMuestra(showId) {
    return state.shows.find((s) => s.id === showId)?.nombre || '';
  }

  function nombreDia(dia) {
    return DIAS.find((d) => d.id === dia)?.larga || `día ${dia}`;
  }

  function filaAlumno(alumno) {
    const fila = document.createElement('div');
    fila.className = 'alumno-fila';
    fila.style.setProperty('--instrumento-color', alumno.instrumento?.color || '');

    const info = document.createElement('div');
    const nombre = document.createElement('div');
    nombre.className = 'alumno-fila__nombre';
    nombre.textContent = `${alumno.persona?.nombre || 'Sin nombre'} — ${alumno.instrumento?.nombre || ''}`;
    if (!alumno.clase) {
      const badge = document.createElement('span');
      badge.className = 'alumno-fila__pendiente';
      badge.textContent = 'pendiente';
      nombre.appendChild(badge);
    }
    info.appendChild(nombre);

    const meta = document.createElement('div');
    meta.className = 'alumno-fila__meta';
    const partes = [];
    if (esAdmin()) partes.push(`profe ${alumno.profesor?.nombre || '—'}`);
    partes.push(nombreMuestra(alumno.persona?.showId));
    if (alumno.clase) {
      partes.push(`${nombreDia(alumno.clase.dia)} ${hhmm(alumno.clase.horaInicio)}–${hhmm(alumno.clase.horaFin)}`);
    }
    meta.textContent = partes.filter(Boolean).join(' · ');
    info.appendChild(meta);

    fila.appendChild(info);

    if (puedeEscribir()) {
      const acciones = document.createElement('div');
      acciones.className = 'alumno-fila__acciones';

      if (alumno.clase) {
        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.textContent = 'Quitar';
        quitar.addEventListener('click', () => quitarHorario(alumno));
        acciones.appendChild(quitar);
      } else {
        const asignar = document.createElement('button');
        asignar.type = 'button';
        asignar.textContent = 'Asignar';
        asignar.addEventListener('click', () => abrirPanel(alumno));
        acciones.appendChild(asignar);
      }

      fila.appendChild(acciones);
    }

    return fila;
  }

  // --- Panel de asignación (inline, un solo paso de día + hora) --------

  function abrirPanel(alumno) {
    state.expandidoId = state.expandidoId === alumno.id ? null : alumno.id;
    state.panelDia = null;
    state.panelHora = null;
    render();
  }

  function cerrarPanel() {
    state.expandidoId = null;
    state.panelDia = null;
    state.panelHora = null;
  }

  async function clasesDe(profesorId) {
    if (state.clasesPorProfesor.has(profesorId)) return state.clasesPorProfesor.get(profesorId);
    const { clases } = await api(`/api/clases?profesorId=${profesorId}`);
    state.clasesPorProfesor.set(profesorId, clases);
    return clases;
  }

  function panelAsignar(alumno) {
    const panel = document.createElement('div');
    panel.className = 'asignar-panel';

    const filaSelectores = document.createElement('div');
    filaSelectores.className = 'asignar-panel__fila';

    const dias = document.createElement('div');
    dias.className = 'asignar-panel__dias';
    dias.setAttribute('role', 'tablist');
    dias.setAttribute('aria-label', 'Día');
    DIAS.forEach((dia) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'tab';
      btn.textContent = dia.corta;
      btn.title = dia.larga;
      btn.setAttribute('aria-selected', String(state.panelDia === dia.id));
      btn.addEventListener('click', () => {
        state.panelDia = dia.id;
        render();
      });
      dias.appendChild(btn);
    });
    filaSelectores.appendChild(dias);

    const campoHora = document.createElement('div');
    campoHora.className = 'asignar-panel__campo';
    const labelHora = document.createElement('label');
    labelHora.setAttribute('for', 'panelHora');
    labelHora.textContent = 'Hora de inicio';
    campoHora.appendChild(labelHora);
    const selectHora = document.createElement('select');
    selectHora.id = 'panelHora';
    const optVacia = document.createElement('option');
    optVacia.value = '';
    optVacia.textContent = '—';
    selectHora.appendChild(optVacia);
    for (let min = 14 * 60; min <= VENTANA_FIN_MIN; min += 15) {
      const hh = String(Math.floor(min / 60)).padStart(2, '0');
      const mm = String(min % 60).padStart(2, '0');
      const opt = document.createElement('option');
      opt.value = `${hh}:${mm}`;
      opt.textContent = `${hh}:${mm}`;
      if (state.panelHora === opt.value) opt.selected = true;
      selectHora.appendChild(opt);
    }
    selectHora.addEventListener('change', () => {
      state.panelHora = selectHora.value || null;
      render();
    });
    campoHora.appendChild(selectHora);
    filaSelectores.appendChild(campoHora);

    panel.appendChild(filaSelectores);

    const resultado = document.createElement('div');
    resultado.className = 'asignar-panel__resultado';
    resultado.textContent = 'Elegí día y hora.';
    panel.appendChild(resultado);

    if (state.panelDia && state.panelHora) {
      resultado.textContent = 'Buscando…';
      clasesDe(alumno.profesorId).then((clases) => {
        // El panel puede haberse cerrado o cambiado de alumno mientras esperaba.
        if (state.expandidoId !== alumno.id) return;
        const existente = clases.find((c) => c.dia === state.panelDia && hhmm(c.horaInicio) === state.panelHora);
        resultado.innerHTML = '';
        resultado.appendChild(existente ? bloqueCoincide(alumno, existente) : bloqueDuracion(alumno));
      });
    }

    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'asignar-panel__cancelar';
    cancelar.textContent = 'Cancelar';
    cancelar.addEventListener('click', () => {
      cerrarPanel();
      render();
    });
    panel.appendChild(cancelar);

    const aviso = document.createElement('p');
    aviso.className = 'asignar-panel__aviso';
    aviso.id = 'panelAviso';
    aviso.hidden = true;
    panel.appendChild(aviso);

    return panel;
  }

  function bloqueCoincide(alumno, clase) {
    const wrap = document.createElement('div');
    wrap.className = 'asignar-panel__coincide';

    const texto = document.createElement('span');
    const n = clase.alumnos.length;
    texto.textContent = `Ya hay una clase de ${hhmm(clase.horaInicio)} a ${hhmm(clase.horaFin)} (${n}/3). Se suma a esa clase.`;
    wrap.appendChild(texto);

    const confirmar = document.createElement('button');
    confirmar.type = 'button';
    confirmar.textContent = 'Confirmar';
    confirmar.addEventListener('click', () => sumarAClaseExistente(alumno, clase));
    wrap.appendChild(confirmar);

    return wrap;
  }

  function bloqueDuracion(alumno) {
    const wrap = document.createElement('div');
    wrap.className = 'asignar-panel__duracion';

    const boton60 = document.createElement('button');
    boton60.type = 'button';
    boton60.textContent = '1 h';
    boton60.addEventListener('click', () => crearClaseNueva(alumno, 60));
    wrap.appendChild(boton60);

    const boton75 = document.createElement('button');
    boton75.type = 'button';
    boton75.textContent = '1 h 15';
    boton75.addEventListener('click', () => crearClaseNueva(alumno, 75));
    wrap.appendChild(boton75);

    return wrap;
  }

  // --- Guardar ---------------------------------------------------------

  function actualizarAlumnoLocal(alumnoId, clase) {
    const idx = state.alumnos.findIndex((a) => a.id === alumnoId);
    if (idx !== -1) state.alumnos[idx] = { ...state.alumnos[idx], clase };
  }

  function siguientePaso() {
    cerrarPanel();
    render();
    el.buscador.focus();
  }

  async function sumarAClaseExistente(alumno, clase) {
    if (state.guardando) return;
    state.guardando = true;
    try {
      const { aviso } = await api(`/api/clases/${clase.id}/alumnos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId: alumno.id }),
      });
      actualizarAlumnoLocal(alumno.id, { id: clase.id, dia: clase.dia, horaInicio: clase.horaInicio, horaFin: clase.horaFin });
      state.clasesPorProfesor.delete(alumno.profesorId);
      if (aviso) alert(aviso);
      siguientePaso();
    } catch (err) {
      mostrarAvisoPanel(err.message);
    } finally {
      state.guardando = false;
    }
  }

  async function crearClaseNueva(alumno, duracionMinutos) {
    if (state.guardando || !state.panelDia || !state.panelHora) return;

    const horaFin = sumarMinutos(state.panelHora, duracionMinutos);
    if (minutosDe(horaFin) > VENTANA_FIN_MIN) {
      mostrarAvisoPanel('Esa duración pasa las 21:30. Elegí una duración más corta o una hora más temprana.');
      return;
    }

    state.guardando = true;
    try {
      const { clase } = await api('/api/clases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profesorId: alumno.profesorId,
          dia: state.panelDia,
          horaInicio: state.panelHora,
          horaFin,
          alumnoIds: [alumno.id],
        }),
      });
      actualizarAlumnoLocal(alumno.id, { id: clase.id, dia: clase.dia, horaInicio: clase.horaInicio, horaFin: clase.horaFin });
      state.clasesPorProfesor.delete(alumno.profesorId);
      siguientePaso();
    } catch (err) {
      mostrarAvisoPanel(err.message);
    } finally {
      state.guardando = false;
    }
  }

  async function quitarHorario(alumno) {
    if (!confirm(`¿Quitar a ${alumno.persona?.nombre} de su horario?`)) return;
    try {
      await api(`/api/clases/${alumno.clase.id}/alumnos/${alumno.id}`, { method: 'DELETE' });
      state.clasesPorProfesor.delete(alumno.profesorId);
      actualizarAlumnoLocal(alumno.id, null);
      render();
    } catch (err) {
      alert(err.message);
    }
  }

  function mostrarAvisoPanel(mensaje) {
    const aviso = document.getElementById('panelAviso');
    if (!aviso) {
      alert(mensaje);
      return;
    }
    aviso.textContent = mensaje;
    aviso.hidden = false;
  }

  init();
})();
