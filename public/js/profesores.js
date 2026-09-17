(() => {
  const state = { profesores: [] };

  const el = {
    formAlta: document.getElementById('formAlta'),
    nombreNuevo: document.getElementById('nombreNuevo'),
    aviso: document.getElementById('aviso'),
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

  async function init() {
    const acceso = await window.Auth.requerirSesion();
    if (!acceso) return;
    window.Nav.render(acceso);

    if (acceso.rol !== 'admin') {
      document.querySelector('.admin').innerHTML =
        '<h1 class="admin__titulo">Profesores</h1><p class="admin-vacio">Esta pantalla es solo para administración.</p>';
      return;
    }

    el.formAlta.addEventListener('submit', crearProfesor);
    await cargar();
  }

  async function cargar() {
    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = 'Cargando…';
    try {
      const { profesores } = await api('/api/profesores');
      state.profesores = profesores;
      el.estadoCarga.hidden = true;
      render();
    } catch (err) {
      el.estadoCarga.hidden = false;
      el.estadoCarga.textContent = `No se pudo cargar: ${err.message}`;
    }
  }

  async function crearProfesor(ev) {
    ev.preventDefault();
    el.aviso.hidden = true;
    const nombre = el.nombreNuevo.value.trim();
    if (!nombre) return;

    try {
      const { profesor } = await api('/api/profesores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      state.profesores.push(profesor);
      state.profesores.sort((a, b) => a.nombre.localeCompare(b.nombre));
      el.nombreNuevo.value = '';
      render();
    } catch (err) {
      el.aviso.textContent = err.message;
      el.aviso.hidden = false;
    }
  }

  function render() {
    el.lista.innerHTML = '';

    if (state.profesores.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'admin-vacio';
      vacio.textContent = 'Todavía no hay profesores cargados.';
      el.lista.appendChild(vacio);
      return;
    }

    state.profesores.forEach((profesor) => el.lista.appendChild(filaProfesor(profesor)));
  }

  function filaProfesor(profesor) {
    const fila = document.createElement('div');
    fila.className = 'admin-fila' + (profesor.activo ? '' : ' admin-fila--inactivo');

    const principal = document.createElement('div');
    principal.className = 'admin-fila__principal';
    const nombre = document.createElement('div');
    nombre.className = 'admin-fila__nombre';
    nombre.textContent = profesor.nombre;
    if (!profesor.activo) {
      const badge = document.createElement('span');
      badge.className = 'admin-fila__inactivo-etiqueta';
      badge.textContent = 'inactivo';
      nombre.appendChild(badge);
    }
    principal.appendChild(nombre);
    fila.appendChild(principal);

    const acciones = document.createElement('div');
    acciones.className = 'admin-fila__acciones';

    const renombrar = document.createElement('button');
    renombrar.type = 'button';
    renombrar.textContent = 'Renombrar';
    renombrar.addEventListener('click', () => entrarEdicion(fila, profesor));
    acciones.appendChild(renombrar);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = profesor.activo ? 'Desactivar' : 'Activar';
    toggle.addEventListener('click', () => cambiarActivo(profesor, !profesor.activo));
    acciones.appendChild(toggle);

    const borrar = document.createElement('button');
    borrar.type = 'button';
    borrar.textContent = 'Borrar';
    borrar.addEventListener('click', () => borrarProfesor(profesor));
    acciones.appendChild(borrar);

    fila.appendChild(acciones);
    return fila;
  }

  function entrarEdicion(fila, profesor) {
    const principal = fila.querySelector('.admin-fila__principal');
    const original = principal.innerHTML;

    const edicion = document.createElement('div');
    edicion.className = 'admin-fila__edicion';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = profesor.nombre;
    edicion.appendChild(input);

    const guardar = document.createElement('button');
    guardar.type = 'button';
    guardar.textContent = 'Guardar';
    guardar.addEventListener('click', async () => {
      const nuevoNombre = input.value.trim();
      if (!nuevoNombre || nuevoNombre === profesor.nombre) {
        principal.innerHTML = original;
        return;
      }
      try {
        const { profesor: actualizado } = await api(`/api/profesores/${profesor.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nuevoNombre }),
        });
        Object.assign(profesor, actualizado);
        render();
      } catch (err) {
        alert(err.message);
        principal.innerHTML = original;
      }
    });
    edicion.appendChild(guardar);

    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.textContent = 'Cancelar';
    cancelar.style.background = 'none';
    cancelar.style.border = 'none';
    cancelar.style.color = 'inherit';
    cancelar.style.textDecoration = 'underline';
    cancelar.style.cursor = 'pointer';
    cancelar.addEventListener('click', () => {
      principal.innerHTML = original;
    });
    edicion.appendChild(cancelar);

    principal.innerHTML = '';
    principal.appendChild(edicion);
    input.focus();
  }

  async function cambiarActivo(profesor, activo) {
    try {
      const { profesor: actualizado } = await api(`/api/profesores/${profesor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      });
      Object.assign(profesor, actualizado);
      render();
    } catch (err) {
      alert(err.message);
    }
  }

  async function borrarProfesor(profesor) {
    if (!confirm(`¿Borrar a ${profesor.nombre}? Esto solo funciona si no tiene clases cargadas.`)) return;
    try {
      await api(`/api/profesores/${profesor.id}`, { method: 'DELETE' });
      state.profesores = state.profesores.filter((p) => p.id !== profesor.id);
      render();
    } catch (err) {
      alert(err.message);
    }
  }

  init();
})();
