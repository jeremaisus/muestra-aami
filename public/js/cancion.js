(() => {
  const cancionId = new URLSearchParams(location.search).get('id');

  const state = {
    acceso: null,
    config: null,
    cancion: null,
    links: [],
    slots: [],
    notas: [],
    instrumentos: [],
    alumnos: [],
    profesores: [],
    interesados: {}, // slotId -> [{acceso: {etiqueta}}], solo para admin
  };

  const el = {
    estadoCarga: document.getElementById('estadoCarga'),
    contenido: document.getElementById('contenido'),
    titulo: document.getElementById('titulo'),
    artista: document.getElementById('artista'),
    estadoBotones: document.getElementById('estadoBotones'),
    estadoTexto: document.getElementById('estadoTexto'),
    metaTonalidad: document.getElementById('metaTonalidad'),
    metaObservaciones: document.getElementById('metaObservaciones'),
    metaLectura: document.getElementById('metaLectura'),
    botonEditarMeta: document.getElementById('botonEditarMeta'),
    formMeta: document.getElementById('formMeta'),
    inputTonalidad: document.getElementById('inputTonalidad'),
    inputObservaciones: document.getElementById('inputObservaciones'),
    botonCancelarMeta: document.getElementById('botonCancelarMeta'),
    listaLinks: document.getElementById('listaLinks'),
    formLink: document.getElementById('formLink'),
    linkEtiqueta: document.getElementById('linkEtiqueta'),
    linkUrl: document.getElementById('linkUrl'),
    avisoPermiso: document.getElementById('avisoPermiso'),
    listaSlots: document.getElementById('listaSlots'),
    agregarSlot: document.getElementById('agregarSlot'),
    selectInstrumento: document.getElementById('selectInstrumento'),
    botonAgregarSlot: document.getElementById('botonAgregarSlot'),
    listaNotas: document.getElementById('listaNotas'),
    formNota: document.getElementById('formNota'),
    notaTexto: document.getElementById('notaTexto'),
    notaSlot: document.getElementById('notaSlot'),
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

  // Admin siempre puede tocar cualquier slot. Un profesor, cuando el
  // interruptor está prendido, solo puede asignarse a un slot vacío: ni
  // reasignar ni vaciar uno ya ocupado (por él o por otra persona), eso
  // sigue siendo exclusivo de administración.
  function puedeOcuparSlot(slot) {
    if (esAdmin()) return true;
    if (!state.config.profesPuedenOcuparSlots) return false;
    return !slot.alumno && !slot.profesor;
  }

  async function init() {
    if (!cancionId) {
      mostrarError('Falta el id de la canción en la URL.');
      return;
    }

    const acceso = await window.Auth.requerirSesion();
    if (!acceso) return;
    state.acceso = acceso;
    window.Nav.render(acceso);

    try {
      const [{ cancion }, { config }, { instrumentos }] = await Promise.all([
        api(`/api/canciones/${cancionId}`),
        api('/api/config'),
        api('/api/instrumentos'),
      ]);
      state.cancion = cancion;
      state.config = config;
      state.instrumentos = instrumentos.filter((i) => i.activo);

      const [{ links }, { slots }, { notas }, { alumnos }, { profesores }] = await Promise.all([
        api(`/api/canciones/${cancionId}/links`),
        api(`/api/canciones/${cancionId}/slots`),
        api(`/api/canciones/${cancionId}/notas`),
        api(`/api/alumnos?showId=${cancion.showId}`),
        api('/api/profesores'),
      ]);
      state.links = links;
      state.slots = slots;
      state.notas = notas;
      state.alumnos = alumnos;
      state.profesores = profesores.filter((p) => p.activo);

      if (esAdmin()) await cargarInteresados();

      el.estadoCarga.hidden = true;
      el.contenido.hidden = false;
      renderTodo();
    } catch (err) {
      mostrarError(err.message);
    }
  }

  function mostrarError(mensaje) {
    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = `No se pudo cargar: ${mensaje}`;
  }

  // Solo admin: quién se ofreció para cada slot vacío ("puedo cubrir esto").
  async function cargarInteresados() {
    const vacios = state.slots.filter((s) => !s.alumno && !s.profesor);
    const listas = await Promise.all(
      vacios.map((s) => api(`/api/slots/${s.id}/interes`).then(({ interesados }) => [s.id, interesados]))
    );
    state.interesados = Object.fromEntries(listas);
  }

  function renderTodo() {
    renderEncabezado();
    renderMeta();
    renderLinks();
    renderSlots();
    renderNotas();
  }

  // --- Encabezado + estado -------------------------------------------

  function renderEncabezado() {
    el.titulo.textContent = state.cancion.titulo;
    el.artista.textContent = state.cancion.artista || '';
    el.artista.hidden = !state.cancion.artista;

    if (esAdmin()) {
      el.estadoBotones.hidden = false;
      el.estadoBotones.querySelectorAll('button').forEach((btn) => {
        const activo = btn.dataset.estado === state.cancion.estado;
        btn.setAttribute('aria-pressed', String(activo));
        btn.onclick = () => cambiarEstado(btn.dataset.estado);
      });
    } else {
      el.estadoTexto.hidden = false;
      el.estadoTexto.textContent = state.cancion.estado === 'completa' ? 'Banda completa' : 'Banda incompleta';
      el.estadoTexto.className = `ficha__estado-texto ficha__estado-texto--${state.cancion.estado}`;
    }
  }

  async function cambiarEstado(estado) {
    if (estado === state.cancion.estado) return;
    try {
      const { cancion } = await api(`/api/canciones/${cancionId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      state.cancion = cancion;
      renderEncabezado();
    } catch (err) {
      alertar(err.message);
    }
  }

  // --- Meta: tonalidad / observaciones ---------------------------------

  function renderMeta() {
    el.metaTonalidad.textContent = state.cancion.tonalidad || '—';
    el.metaObservaciones.textContent = state.cancion.observaciones || '—';

    if (!esAdmin()) return;

    el.botonEditarMeta.hidden = false;
    el.botonEditarMeta.onclick = () => {
      el.inputTonalidad.value = state.cancion.tonalidad || '';
      el.inputObservaciones.value = state.cancion.observaciones || '';
      el.metaLectura.hidden = true;
      el.botonEditarMeta.hidden = true;
      el.formMeta.hidden = false;
    };

    el.botonCancelarMeta.onclick = () => {
      el.formMeta.hidden = true;
      el.metaLectura.hidden = false;
      el.botonEditarMeta.hidden = false;
    };

    el.formMeta.onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        const { cancion } = await api(`/api/canciones/${cancionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tonalidad: el.inputTonalidad.value.trim() || null,
            observaciones: el.inputObservaciones.value.trim() || null,
          }),
        });
        state.cancion = cancion;
        el.formMeta.hidden = true;
        el.metaLectura.hidden = false;
        el.botonEditarMeta.hidden = false;
        renderMeta();
      } catch (err) {
        alertar(err.message);
      }
    };
  }

  // --- Links de Drive --------------------------------------------------

  function renderLinks() {
    el.listaLinks.innerHTML = '';

    if (state.links.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'ficha__aviso-permiso';
      vacio.textContent = 'Todavía no hay links cargados.';
      el.listaLinks.appendChild(vacio);
    }

    state.links.forEach((link) => {
      const fila = document.createElement('div');
      fila.className = 'links__item';

      const a = document.createElement('a');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = link.etiqueta;
      fila.appendChild(a);

      if (esAdmin()) {
        const borrar = document.createElement('button');
        borrar.type = 'button';
        borrar.textContent = 'Borrar';
        borrar.addEventListener('click', () => borrarLink(link.id));
        fila.appendChild(borrar);
      }

      el.listaLinks.appendChild(fila);
    });

    if (esAdmin()) {
      el.formLink.hidden = false;
      el.formLink.onsubmit = crearLink;
    }
  }

  async function crearLink(ev) {
    ev.preventDefault();
    try {
      const { link } = await api(`/api/canciones/${cancionId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etiqueta: el.linkEtiqueta.value.trim(), url: el.linkUrl.value.trim() }),
      });
      state.links.push(link);
      el.linkEtiqueta.value = '';
      el.linkUrl.value = '';
      renderLinks();
    } catch (err) {
      alertar(err.message);
    }
  }

  async function borrarLink(id) {
    if (!confirm('¿Borrar este link?')) return;
    try {
      await api(`/api/cancion-links/${id}`, { method: 'DELETE' });
      state.links = state.links.filter((l) => l.id !== id);
      renderLinks();
    } catch (err) {
      alertar(err.message);
    }
  }

  // --- Slots de la banda -------------------------------------------------

  function renderSlots() {
    if (!esAdmin()) {
      el.avisoPermiso.hidden = false;
      el.avisoPermiso.textContent = state.config.profesPuedenOcuparSlots
        ? 'La carga de slots está abierta: podés sumar alumnos a instrumentos vacíos.'
        : 'La carga de slots está cerrada por administración. Podés avisar interés en los vacíos.';
    }

    el.listaSlots.innerHTML = '';

    const porInstrumento = new Map();
    state.slots.forEach((slot) => {
      const key = slot.instrumento.id;
      if (!porInstrumento.has(key)) porInstrumento.set(key, { instrumento: slot.instrumento, slots: [] });
      porInstrumento.get(key).slots.push(slot);
    });

    if (porInstrumento.size === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'ficha__aviso-permiso';
      vacio.textContent = 'Todavía no se armó la banda de esta canción.';
      el.listaSlots.appendChild(vacio);
    }

    [...porInstrumento.values()]
      .sort((a, b) => a.instrumento.nombre.localeCompare(b.instrumento.nombre))
      .forEach((grupo) => {
        const bloque = document.createElement('div');
        bloque.className = 'slots__instrumento';

        const titulo = document.createElement('p');
        titulo.className = 'slots__instrumento-nombre';
        titulo.textContent = grupo.instrumento.nombre;
        bloque.appendChild(titulo);

        grupo.slots
          .sort((a, b) => a.numero - b.numero)
          .forEach((slot) => bloque.appendChild(filaSlot(slot)));

        el.listaSlots.appendChild(bloque);
      });

    renderAgregarSlot();
  }

  function filaSlot(slot) {
    const fila = document.createElement('div');
    fila.className = 'slot';
    fila.style.setProperty('--instrumento-color', slot.instrumento.color);

    const info = document.createElement('span');
    info.className = 'slot__info';
    const etiquetaNumero = `${slot.instrumento.nombre} ${slot.numero}`;
    if (slot.alumno) {
      info.textContent = `${etiquetaNumero} — ${slot.alumno.persona?.nombre || 'Sin nombre'}`;
    } else if (slot.profesor) {
      info.textContent = `${etiquetaNumero} — profe ${slot.profesor.nombre}`;
    } else {
      info.innerHTML = '';
      info.textContent = `${etiquetaNumero} — `;
      const vacio = document.createElement('span');
      vacio.className = 'slot__vacio';
      vacio.textContent = 'vacío';
      info.appendChild(vacio);
    }
    if (slot.seBusca) {
      const badge = document.createElement('span');
      badge.className = 'slot__se-busca';
      badge.textContent = 'se busca';
      info.appendChild(badge);
    }
    fila.appendChild(info);

    if (esAdmin() && !slot.alumno && !slot.profesor) {
      const interesados = state.interesados[slot.id] || [];
      if (interesados.length > 0) {
        const linea = document.createElement('p');
        linea.className = 'slot__interesados';
        linea.textContent = `Se ofrecieron: ${interesados.map((i) => i.acceso?.etiqueta || i.acceso?.usuario).join(', ')}`;
        fila.appendChild(linea);
      }
    }

    const acciones = document.createElement('div');
    acciones.className = 'slot__acciones';

    if (puedeOcuparSlot(slot)) {
      const selectAlumno = document.createElement('select');
      selectAlumno.setAttribute('aria-label', `Asignar alumno a ${etiquetaNumero}`);
      const optVacio = document.createElement('option');
      optVacio.value = '';
      optVacio.textContent = '— vacío —';
      selectAlumno.appendChild(optVacio);
      // Solo alumnos del mismo instrumento que el slot: es el filtro que
      // ahorra pasos a la hora de asignar.
      state.alumnos
        .filter((a) => a.instrumento?.id === slot.instrumento.id || a.id === slot.alumnoId)
        .forEach((a) => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = a.persona?.nombre || 'Sin nombre';
          if (slot.alumnoId === a.id) opt.selected = true;
          selectAlumno.appendChild(opt);
        });
      selectAlumno.addEventListener('change', () => asignarAlumno(slot.id, selectAlumno.value || null));
      acciones.appendChild(selectAlumno);
    }

    if (esAdmin()) {
      const selectProfesor = document.createElement('select');
      selectProfesor.setAttribute('aria-label', `Asignar profesor a ${etiquetaNumero}`);
      const optVacio = document.createElement('option');
      optVacio.value = '';
      optVacio.textContent = '— sin profesor —';
      selectProfesor.appendChild(optVacio);
      state.profesores.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre;
        if (slot.profesorId === p.id) opt.selected = true;
        selectProfesor.appendChild(opt);
      });
      selectProfesor.addEventListener('change', () => asignarProfesor(slot.id, selectProfesor.value || null));
      acciones.appendChild(selectProfesor);

      const labelBusca = document.createElement('label');
      labelBusca.style.fontSize = '13px';
      const checkBusca = document.createElement('input');
      checkBusca.type = 'checkbox';
      checkBusca.checked = slot.seBusca;
      checkBusca.addEventListener('change', () => marcarSeBusca(slot.id, checkBusca.checked));
      labelBusca.appendChild(checkBusca);
      labelBusca.appendChild(document.createTextNode(' se busca'));
      acciones.appendChild(labelBusca);

      const borrar = document.createElement('button');
      borrar.type = 'button';
      borrar.textContent = 'Borrar slot';
      borrar.addEventListener('click', () => borrarSlot(slot.id));
      acciones.appendChild(borrar);
    } else if (!slot.alumno && !slot.profesor) {
      const interes = document.createElement('button');
      interes.type = 'button';
      interes.className = 'slot__interes';
      interes.textContent = 'Avisar que puedo cubrir esto';
      interes.addEventListener('click', async () => {
        try {
          const { interesado } = await api(`/api/slots/${slot.id}/interes`, { method: 'POST' });
          interes.classList.toggle('slot__interes--activo', interesado);
          interes.textContent = interesado ? 'Ya avisaste que podés cubrir esto' : 'Avisar que puedo cubrir esto';
        } catch (err) {
          alertar(err.message);
        }
      });
      acciones.appendChild(interes);
    }

    fila.appendChild(acciones);
    return fila;
  }

  async function asignarAlumno(slotId, alumnoId) {
    try {
      const { slot } = await api(`/api/slots/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId }),
      });
      reemplazarSlot(slot);
    } catch (err) {
      alertar(err.message);
      renderSlots();
    }
  }

  async function asignarProfesor(slotId, profesorId) {
    try {
      const { slot } = await api(`/api/slots/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profesorId }),
      });
      reemplazarSlot(slot);
    } catch (err) {
      alertar(err.message);
      renderSlots();
    }
  }

  async function marcarSeBusca(slotId, seBusca) {
    try {
      const { slot } = await api(`/api/slots/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seBusca }),
      });
      reemplazarSlot(slot);
    } catch (err) {
      alertar(err.message);
      renderSlots();
    }
  }

  async function borrarSlot(slotId) {
    if (!confirm('¿Borrar este slot de la banda?')) return;
    try {
      await api(`/api/slots/${slotId}`, { method: 'DELETE' });
      state.slots = state.slots.filter((s) => s.id !== slotId);
      renderSlots();
      renderNotas();
    } catch (err) {
      alertar(err.message);
    }
  }

  function reemplazarSlot(slot) {
    const i = state.slots.findIndex((s) => s.id === slot.id);
    if (i >= 0) state.slots[i] = slot;
    renderSlots();
  }

  function renderAgregarSlot() {
    if (!esAdmin()) return;

    el.agregarSlot.hidden = false;
    el.selectInstrumento.innerHTML = '';
    state.instrumentos.forEach((i) => {
      const opt = document.createElement('option');
      opt.value = i.id;
      opt.textContent = i.nombre;
      el.selectInstrumento.appendChild(opt);
    });

    el.botonAgregarSlot.onclick = async () => {
      const instrumentoId = el.selectInstrumento.value;
      const instrumento = state.instrumentos.find((i) => i.id === instrumentoId);
      const existentes = state.slots.filter((s) => s.instrumento.id === instrumentoId);

      if (existentes.length > 0) {
        const siguiente = Math.max(...existentes.map((s) => s.numero)) + 1;
        const ok = confirm(
          `Ya hay alguien en ${instrumento.nombre} en esta canción. ¿Agregar como ${instrumento.nombre} ${siguiente}?`
        );
        if (!ok) return;
      }

      try {
        const { slot } = await api(`/api/canciones/${cancionId}/slots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instrumentoId }),
        });
        state.slots.push(slot);
        renderSlots();
        renderNotas();
      } catch (err) {
        alertar(err.message);
      }
    };
  }

  // --- Notas -------------------------------------------------------------

  function renderNotas() {
    el.listaNotas.innerHTML = '';

    if (state.notas.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'ficha__aviso-permiso';
      vacio.textContent = 'Todavía no hay notas.';
      el.listaNotas.appendChild(vacio);
    }

    state.notas.forEach((nota) => el.listaNotas.appendChild(filaNota(nota)));

    el.notaSlot.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
    state.slots.forEach((slot) => {
      const opt = document.createElement('option');
      opt.value = slot.id;
      const ocupante = slot.alumno?.persona?.nombre || (slot.profesor ? `profe ${slot.profesor.nombre}` : 'vacío');
      opt.textContent = `${slot.instrumento.nombre} ${slot.numero} — ${ocupante}`;
      el.notaSlot.appendChild(opt);
    });

    el.formNota.onsubmit = crearNota;
  }

  function filaNota(nota) {
    const div = document.createElement('div');
    div.className = 'nota';

    const cabecera = document.createElement('div');
    cabecera.className = 'nota__cabecera';
    cabecera.innerHTML = `<span>${nota.autor}</span><span>${tiempoRelativo(nota.creadaEn)}</span>`;
    div.appendChild(cabecera);

    const texto = document.createElement('p');
    texto.className = 'nota__texto';
    texto.textContent = nota.texto;
    div.appendChild(texto);

    const acciones = document.createElement('div');
    acciones.className = 'nota__acciones';

    const esPropia = nota.accesoId === state.acceso.id;
    const dentroDeVentana = Date.now() - new Date(nota.creadaEn).getTime() < 15 * 60 * 1000;

    if (esPropia && dentroDeVentana) {
      const editar = document.createElement('button');
      editar.type = 'button';
      editar.textContent = 'Editar';
      editar.addEventListener('click', () => editarNota(div, nota, texto));
      acciones.appendChild(editar);
    }

    if (esAdmin()) {
      const borrar = document.createElement('button');
      borrar.type = 'button';
      borrar.textContent = 'Borrar';
      borrar.addEventListener('click', () => borrarNota(nota.id));
      acciones.appendChild(borrar);
    }

    if (acciones.children.length > 0) div.appendChild(acciones);
    return div;
  }

  function editarNota(contenedor, nota, textoEl) {
    const textarea = document.createElement('textarea');
    textarea.value = nota.texto;
    textarea.style.width = '100%';
    textarea.style.minHeight = '64px';
    textoEl.replaceWith(textarea);

    const guardar = document.createElement('button');
    guardar.type = 'button';
    guardar.textContent = 'Guardar';
    guardar.addEventListener('click', async () => {
      try {
        const { nota: actualizada } = await api(`/api/notas/${nota.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: textarea.value.trim() }),
        });
        const i = state.notas.findIndex((n) => n.id === nota.id);
        if (i >= 0) state.notas[i] = actualizada;
        renderNotas();
      } catch (err) {
        alertar(err.message);
      }
    });
    contenedor.appendChild(guardar);
  }

  async function borrarNota(id) {
    if (!confirm('¿Borrar esta nota?')) return;
    try {
      await api(`/api/notas/${id}`, { method: 'DELETE' });
      state.notas = state.notas.filter((n) => n.id !== id);
      renderNotas();
    } catch (err) {
      alertar(err.message);
    }
  }

  async function crearNota(ev) {
    ev.preventDefault();
    try {
      const { nota } = await api(`/api/canciones/${cancionId}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: el.notaTexto.value.trim(),
          slotId: el.notaSlot.value || undefined,
        }),
      });
      state.notas.unshift(nota);
      el.notaTexto.value = '';
      el.notaSlot.value = '';
      renderNotas();
    } catch (err) {
      alertar(err.message);
    }
  }

  function tiempoRelativo(iso) {
    const segundos = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (segundos < 60) return 'recién';
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    return `hace ${dias} d`;
  }

  function alertar(mensaje) {
    window.alert(mensaje);
  }

  init();
})();
