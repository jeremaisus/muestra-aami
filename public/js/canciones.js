(() => {
  const NOMBRE_SIN_ASIGNAR = 'Sin asignar';

  const state = { shows: [], showId: null, canciones: [], config: null, acceso: null };

  const el = {
    muestras: document.getElementById('muestras'),
    linkDrive: document.getElementById('linkDrive'),
    formAlta: document.getElementById('formAlta'),
    titulo: document.getElementById('titulo'),
    artista: document.getElementById('artista'),
    pais: document.getElementById('pais'),
    tonalidad: document.getElementById('tonalidad'),
    botonAlta: document.getElementById('botonAlta'),
    avisoDuplicado: document.getElementById('avisoDuplicado'),
    estadoCarga: document.getElementById('estadoCarga'),
    catalogo: document.getElementById('catalogo'),
  };

  function esAdmin() {
    return state.acceso.rol === 'admin';
  }

  // "Título — Artista (País)", igual en el listado y en la ficha.
  function formatoCancion(cancion) {
    let texto = cancion.titulo;
    if (cancion.artista) texto += ` — ${cancion.artista}`;
    if (cancion.pais) texto += ` (${cancion.pais})`;
    return texto;
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
      const [{ shows }, { config }] = await Promise.all([api('/api/shows'), api('/api/config')]);
      state.shows = shows;
      state.config = config;

      const guardada = window.MuestraActual.obtener();
      state.showId = shows.some((s) => s.id === guardada) ? guardada : shows[0]?.id ?? null;

      if (config.driveCarpetaUrl) {
        el.linkDrive.href = config.driveCarpetaUrl;
        el.linkDrive.hidden = false;
      }

      if (acceso.rol === 'admin') {
        el.formAlta.hidden = false;
        el.formAlta.addEventListener('submit', crearCancion);
        el.titulo.addEventListener('blur', chequearDuplicado);
      }

      renderMuestras();
      await cargarCanciones();
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
        cargarCanciones();
      });
      el.muestras.appendChild(btn);
    });
  }

  async function chequearDuplicado() {
    const titulo = el.titulo.value.trim();
    el.avisoDuplicado.hidden = true;
    el.botonAlta.disabled = false;
    if (!titulo || !state.showId) return;

    try {
      const params = new URLSearchParams({ showId: state.showId, titulo });
      const { duplicado, cancion } = await api(`/api/canciones/check-duplicado?${params}`);
      if (duplicado) {
        el.avisoDuplicado.textContent = `Ya existe "${cancion.titulo}" en esta muestra.`;
        el.avisoDuplicado.hidden = false;
        el.botonAlta.disabled = true;
      }
    } catch {
      /* si falla el chequeo, no bloqueamos: el índice único del backend igual protege */
    }
  }

  async function crearCancion(ev) {
    ev.preventDefault();
    el.botonAlta.disabled = true;

    try {
      const { cancion } = await api('/api/canciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId: state.showId,
          titulo: el.titulo.value.trim(),
          artista: el.artista.value.trim() || null,
          pais: el.pais.value.trim() || null,
          tonalidad: el.tonalidad.value.trim() || null,
        }),
      });
      location.href = `/cancion.html?id=${cancion.id}`;
    } catch (err) {
      el.avisoDuplicado.textContent = err.message;
      el.avisoDuplicado.hidden = false;
    } finally {
      el.botonAlta.disabled = false;
    }
  }

  async function cargarCanciones() {
    if (!state.showId) return;
    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = 'Cargando…';

    try {
      const { canciones } = await api(`/api/canciones?showId=${state.showId}`);
      state.canciones = canciones;
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
    el.catalogo.innerHTML = '';

    if (state.canciones.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'catalogo__vacio';
      vacio.textContent = 'Todavía no hay canciones cargadas en esta muestra.';
      el.catalogo.appendChild(vacio);
      return;
    }

    state.canciones.forEach((cancion) => {
      const fila = document.createElement('div');
      fila.className = 'catalogo__fila';

      const info = document.createElement('a');
      info.className = 'catalogo__info';
      info.href = `/cancion.html?id=${cancion.id}`;

      const titulo = document.createElement('div');
      titulo.className = 'catalogo__titulo';
      titulo.textContent = formatoCancion(cancion);
      info.appendChild(titulo);

      const meta = document.createElement('div');
      meta.className = 'catalogo__meta';
      if (cancion.tonalidad) {
        const tonalidad = document.createElement('span');
        tonalidad.textContent = cancion.tonalidad;
        meta.appendChild(tonalidad);
      }
      const estado = document.createElement('span');
      estado.className = `catalogo__estado--${cancion.estado}`;
      estado.textContent = cancion.estado === 'completa' ? 'Completa' : 'Incompleta';
      meta.appendChild(estado);
      info.appendChild(meta);

      if (cancion.observaciones) {
        const obs = document.createElement('div');
        obs.className = 'catalogo__observaciones';
        obs.textContent = cancion.observaciones;
        info.appendChild(obs);
      }

      fila.appendChild(info);

      if (esAdmin()) fila.appendChild(selectorMover(cancion));

      el.catalogo.appendChild(fila);
    });
  }

  // --- Mover a otra muestra (solo admin) --------------------------------

  function selectorMover(cancion) {
    const wrap = document.createElement('div');
    wrap.className = 'catalogo__mover';

    const label = document.createElement('label');
    label.textContent = 'Mover a';
    label.setAttribute('for', `mover-${cancion.id}`);
    wrap.appendChild(label);

    const select = document.createElement('select');
    select.id = `mover-${cancion.id}`;

    const destinos = state.shows.filter((s) => s.nombre !== NOMBRE_SIN_ASIGNAR);
    const yaEnDestino = destinos.some((s) => s.id === cancion.showId);

    if (!yaEnDestino) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— elegir —';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
    }

    destinos.forEach((show) => {
      const opt = document.createElement('option');
      opt.value = show.id;
      opt.textContent = show.nombre;
      if (show.id === cancion.showId) opt.selected = true;
      select.appendChild(opt);
    });

    // Evita que el click dispare la navegación de .catalogo__info (son
    // hermanos, pero el select ocupa la misma fila).
    select.addEventListener('click', (ev) => ev.stopPropagation());
    select.addEventListener('change', () => moverCancion(cancion, select.value));

    wrap.appendChild(select);
    return wrap;
  }

  async function moverCancion(cancion, showId) {
    if (!showId || showId === cancion.showId) return;
    try {
      await api(`/api/canciones/${cancion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId }),
      });
      state.canciones = state.canciones.filter((c) => c.id !== cancion.id);
      render();
    } catch (err) {
      alert(err.message);
      await cargarCanciones();
    }
  }

  init();
})();
