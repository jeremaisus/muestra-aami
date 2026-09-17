(() => {
  const state = { shows: [], showId: null, acceso: null, alumnos: [], sinAsignarIds: new Set(), soloSinCancion: false };

  const el = {
    muestras: document.getElementById('muestras'),
    soloSinCancion: document.getElementById('soloSinCancion'),
    contador: document.getElementById('contador'),
    estadoCarga: document.getElementById('estadoCarga'),
    lista: document.getElementById('lista'),
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

  async function init() {
    const acceso = await window.Auth.requerirSesion();
    if (!acceso) return;
    state.acceso = acceso;
    window.Nav.render(acceso);

    try {
      const { shows } = await api('/api/shows');
      state.shows = shows;
      const guardada = window.MuestraActual.obtener();
      state.showId = shows.some((s) => s.id === guardada) ? guardada : shows[0]?.id ?? null;

      renderMuestras();
      el.soloSinCancion.addEventListener('change', () => {
        state.soloSinCancion = el.soloSinCancion.checked;
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
    el.contador.textContent = `Faltan ${faltan} de ${total} sin canción asignada`;

    const visibles = state.soloSinCancion
      ? state.alumnos.filter((a) => state.sinAsignarIds.has(a.id))
      : state.alumnos;

    el.lista.innerHTML = '';

    if (visibles.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'catalogo__vacio';
      vacio.textContent = state.soloSinCancion
        ? 'Todos los alumnos de esta muestra ya están en alguna canción.'
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
    info.appendChild(nombre);

    const meta = document.createElement('div');
    meta.className = 'alumno-fila__meta';
    meta.textContent = `profe ${alumno.profesor?.nombre || '—'}`;
    info.appendChild(meta);

    fila.appendChild(info);

    if (state.acceso.rol === 'admin') {
      const borrar = document.createElement('button');
      borrar.type = 'button';
      borrar.className = 'alumno-fila__borrar';
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
      fila.appendChild(borrar);
    }

    return fila;
  }

  init();
})();
