(() => {
  const state = { shows: [], showId: null, acceso: null, programa: [] };

  const el = {
    muestras: document.getElementById('muestras'),
    linkExportar: document.getElementById('linkExportar'),
    estadoCarga: document.getElementById('estadoCarga'),
    programa: document.getElementById('programa'),
  };

  async function api(path, opciones) {
    const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...opciones });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Error ${res.status} en ${path}`);
    }
    return res.json();
  }

  async function init() {
    const acceso = await window.Auth.requerirSesion();
    if (!acceso) return;
    state.acceso = acceso;
    window.Nav.render(acceso);

    try {
      const { shows } = await api('/api/shows');
      state.shows = window.MuestraActual.paraSeleccion(shows);
      const guardada = window.MuestraActual.obtener();
      state.showId = state.shows.some((s) => s.id === guardada) ? guardada : state.shows[0]?.id ?? null;

      renderMuestras();
      actualizarLinkExportar();
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
        actualizarLinkExportar();
        cargar();
      });
      el.muestras.appendChild(btn);
    });
  }

  function actualizarLinkExportar() {
    if (!state.showId) return;
    el.linkExportar.href = `/api/export/programa?showId=${state.showId}`;
  }

  async function cargar() {
    if (!state.showId) return;
    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = 'Cargando…';

    try {
      const { programa } = await api(`/api/shows/${state.showId}/programa`);
      state.programa = programa;
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
    el.programa.innerHTML = '';

    if (state.programa.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'catalogo__vacio';
      vacio.textContent = 'Todavía no hay canciones en esta muestra.';
      el.programa.appendChild(vacio);
      return;
    }

    const esAdmin = state.acceso.rol === 'admin';

    state.programa.forEach((cancion, i) => {
      const fila = document.createElement('div');
      fila.className = 'programa__item';

      const numero = document.createElement('span');
      numero.className = 'programa__numero';
      numero.textContent = i + 1;
      fila.appendChild(numero);

      const info = document.createElement('div');
      info.className = 'programa__info';
      const titulo = document.createElement('div');
      titulo.className = 'programa__titulo';
      titulo.textContent = cancion.titulo;
      info.appendChild(titulo);

      const meta = document.createElement('div');
      meta.className = 'programa__meta';
      if (cancion.artista) {
        const artista = document.createElement('span');
        artista.textContent = cancion.artista;
        meta.appendChild(artista);
      }
      const estado = document.createElement('span');
      estado.className = `catalogo__estado--${cancion.estado}`;
      estado.textContent = cancion.estado === 'completa' ? 'Completa' : 'Incompleta';
      meta.appendChild(estado);
      info.appendChild(meta);
      fila.appendChild(info);

      if (esAdmin) {
        const acciones = document.createElement('div');
        acciones.className = 'programa__acciones';

        const subir = document.createElement('button');
        subir.type = 'button';
        subir.textContent = 'Subir';
        subir.disabled = i === 0;
        subir.addEventListener('click', () => mover(i, i - 1));
        acciones.appendChild(subir);

        const bajar = document.createElement('button');
        bajar.type = 'button';
        bajar.textContent = 'Bajar';
        bajar.disabled = i === state.programa.length - 1;
        bajar.addEventListener('click', () => mover(i, i + 1));
        acciones.appendChild(bajar);

        fila.appendChild(acciones);
      }

      el.programa.appendChild(fila);
    });
  }

  async function mover(desde, hasta) {
    const copia = [...state.programa];
    const [item] = copia.splice(desde, 1);
    copia.splice(hasta, 0, item);
    state.programa = copia;
    render();

    try {
      const { programa } = await api(`/api/shows/${state.showId}/programa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancionIds: copia.map((c) => c.id) }),
      });
      state.programa = programa;
      render();
    } catch (err) {
      alert(err.message);
      cargar();
    }
  }

  init();
})();
