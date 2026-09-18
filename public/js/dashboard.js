(() => {
  const state = { shows: [], showId: null, instrumentos: [], faltantes: [], sinAsignar: [] };

  const el = {
    muestras: document.getElementById('muestras'),
    estadoCarga: document.getElementById('estadoCarga'),
    listaFaltantes: document.getElementById('listaFaltantes'),
    contadorFaltantes: document.getElementById('contadorFaltantes'),
    listaSinAsignar: document.getElementById('listaSinAsignar'),
    contadorSinAsignar: document.getElementById('contadorSinAsignar'),
  };

  async function api(path) {
    const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Error ${res.status} en ${path}`);
    }
    return res.json();
  }

  async function init() {
    const acceso = await window.Auth.requerirSesion();
    if (!acceso) return;
    window.Nav.render(acceso);

    try {
      const { shows } = await api('/api/shows');
      state.shows = window.MuestraActual.paraSeleccion(shows);
      const guardada = window.MuestraActual.obtener();
      state.showId = state.shows.some((s) => s.id === guardada) ? guardada : state.shows[0]?.id ?? null;

      renderMuestras();
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
      const [{ faltantes }, { sinAsignar }] = await Promise.all([
        api(`/api/dashboard/faltantes?showId=${state.showId}`),
        api(`/api/dashboard/sin-asignar?showId=${state.showId}`),
      ]);
      state.faltantes = faltantes;
      state.sinAsignar = sinAsignar;
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
    el.contadorFaltantes.textContent = `(${state.faltantes.length})`;
    el.listaFaltantes.innerHTML = '';

    if (state.faltantes.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'seccion__vacio';
      vacio.textContent = 'No falta nada: todas las bandas de esta muestra tienen sus instrumentos cubiertos.';
      el.listaFaltantes.appendChild(vacio);
    }

    [...state.faltantes]
      .sort((a, b) => a.titulo.localeCompare(b.titulo) || a.instrumento.localeCompare(b.instrumento))
      .forEach((f) => {
        const fila = document.createElement('a');
        fila.className = 'faltante';
        fila.href = `/cancion.html?id=${f.cancionId}`;
        fila.style.setProperty('--instrumento-color', f.instrumentoColor || '');

        const titulo = document.createElement('div');
        titulo.className = 'faltante__titulo';
        titulo.textContent = f.titulo;
        if (f.seBusca) {
          const badge = document.createElement('span');
          badge.className = 'faltante__se-busca';
          badge.textContent = 'se busca';
          titulo.appendChild(badge);
        }
        fila.appendChild(titulo);

        const detalle = document.createElement('div');
        detalle.className = 'faltante__detalle';
        detalle.textContent = `Falta: ${f.instrumento} ${f.numero}`;
        fila.appendChild(detalle);

        el.listaFaltantes.appendChild(fila);
      });

    el.contadorSinAsignar.textContent = `(${state.sinAsignar.length})`;
    el.listaSinAsignar.innerHTML = '';

    if (state.sinAsignar.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'seccion__vacio';
      vacio.textContent = 'Todos los alumnos de esta muestra ya están en alguna canción.';
      el.listaSinAsignar.appendChild(vacio);
    }

    [...state.sinAsignar]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .forEach((a) => {
        const fila = document.createElement('div');
        fila.className = 'sin-asignar-fila';
        fila.innerHTML = `<span>${a.nombre} — ${a.instrumento}</span><span>profe ${a.profesor}</span>`;
        el.listaSinAsignar.appendChild(fila);
      });
  }

  init();
})();
