(() => {
  const state = { accesos: [], profesores: [], acceso: null };

  const el = {
    formAlta: document.getElementById('formAlta'),
    nuevoUsuario: document.getElementById('nuevoUsuario'),
    nuevoPassword: document.getElementById('nuevoPassword'),
    nuevaEtiqueta: document.getElementById('nuevaEtiqueta'),
    nuevoRol: document.getElementById('nuevoRol'),
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
    state.acceso = acceso;
    window.Nav.render(acceso);

    if (acceso.rol !== 'admin') {
      document.querySelector('.admin').innerHTML =
        '<h1 class="admin__titulo">Accesos</h1><p class="admin-vacio">Esta pantalla es solo para administración.</p>';
      return;
    }

    el.formAlta.addEventListener('submit', crearAcceso);

    await cargar();
  }

  async function cargar() {
    el.estadoCarga.hidden = false;
    el.estadoCarga.textContent = 'Cargando…';
    try {
      const [{ accesos }, { profesores }] = await Promise.all([api('/api/accesos'), api('/api/profesores')]);
      state.accesos = accesos;
      state.profesores = profesores.filter((p) => p.activo);

      el.estadoCarga.hidden = true;
      render();
    } catch (err) {
      el.estadoCarga.hidden = false;
      el.estadoCarga.textContent = `No se pudo cargar: ${err.message}`;
    }
  }

  async function crearAcceso(ev) {
    ev.preventDefault();
    el.aviso.hidden = true;

    const rol = el.nuevoRol.value;
    try {
      const { acceso } = await api('/api/accesos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: el.nuevoUsuario.value.trim(),
          password: el.nuevoPassword.value,
          etiqueta: el.nuevaEtiqueta.value.trim(),
          rol,
        }),
      });
      state.accesos.push(acceso);
      if (acceso.profesorId) {
        // el backend ya creó y vinculó la fila en muestra_profesores
        const { profesores } = await api('/api/profesores');
        state.profesores = profesores.filter((p) => p.activo);
      }
      el.formAlta.reset();
      render();
    } catch (err) {
      el.aviso.textContent = err.message;
      el.aviso.hidden = false;
    }
  }

  function render() {
    el.lista.innerHTML = '';

    if (state.accesos.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'admin-vacio';
      vacio.textContent = 'Todavía no hay accesos cargados.';
      el.lista.appendChild(vacio);
      return;
    }

    [...state.accesos]
      .sort((a, b) => a.usuario.localeCompare(b.usuario))
      .forEach((acceso) => el.lista.appendChild(filaAcceso(acceso)));
  }

  function nombreProfesor(profesorId) {
    return state.profesores.find((p) => p.id === profesorId)?.nombre;
  }

  function filaAcceso(acceso) {
    const fila = document.createElement('div');
    fila.className = 'admin-fila' + (acceso.activo ? '' : ' admin-fila--inactivo');

    const principal = document.createElement('div');
    principal.className = 'admin-fila__principal';

    const nombre = document.createElement('div');
    nombre.className = 'admin-fila__nombre';
    nombre.textContent = `${acceso.usuario} — ${acceso.etiqueta}`;
    if (!acceso.activo) {
      const badge = document.createElement('span');
      badge.className = 'admin-fila__inactivo-etiqueta';
      badge.textContent = 'inactivo';
      nombre.appendChild(badge);
    }
    principal.appendChild(nombre);

    const meta = document.createElement('div');
    meta.className = 'admin-fila__meta';
    const partes = [acceso.rol === 'admin' ? 'Administración' : 'Profesor'];
    if (acceso.profesorId) partes.push(nombreProfesor(acceso.profesorId) || 'profesor no encontrado');
    if (acceso.debeCambiar) partes.push('debe cambiar contraseña');
    meta.textContent = partes.join(' · ');
    principal.appendChild(meta);

    if (acceso.rol === 'profesor' && !acceso.profesorId) {
      const avisoSinVincular = document.createElement('p');
      avisoSinVincular.className = 'admin-alta__nota';
      avisoSinVincular.textContent = 'Sin profesor vinculado: no se le van a poder cargar horarios propios.';
      principal.appendChild(avisoSinVincular);
    }

    fila.appendChild(principal);

    const acciones = document.createElement('div');
    acciones.className = 'admin-fila__acciones';

    if (acceso.rol === 'profesor' && !acceso.profesorId) {
      const vincular = document.createElement('button');
      vincular.type = 'button';
      vincular.textContent = 'Vincular profesor';
      vincular.addEventListener('click', () => vincularProfesor(acceso));
      acciones.appendChild(vincular);
    }

    const resetear = document.createElement('button');
    resetear.type = 'button';
    resetear.textContent = 'Resetear contraseña';
    resetear.addEventListener('click', () => entrarReset(fila, acceso));
    acciones.appendChild(resetear);

    const esUnoMismo = acceso.id === state.acceso.id;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = acceso.activo ? 'Desactivar' : 'Activar';
    if (esUnoMismo && acceso.activo) {
      toggle.disabled = true;
      toggle.title = 'No podés desactivar tu propia cuenta';
    }
    toggle.addEventListener('click', () => cambiarActivo(acceso, !acceso.activo));
    acciones.appendChild(toggle);

    fila.appendChild(acciones);
    return fila;
  }

  function entrarReset(fila, acceso) {
    const principal = fila.querySelector('.admin-fila__principal');
    const original = principal.innerHTML;

    const edicion = document.createElement('div');
    edicion.className = 'admin-fila__edicion';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Contraseña nueva (mín. 8 caracteres)';
    input.minLength = 8;
    edicion.appendChild(input);

    const guardar = document.createElement('button');
    guardar.type = 'button';
    guardar.textContent = 'Guardar';
    guardar.addEventListener('click', async () => {
      const nueva = input.value;
      if (!nueva || nueva.length < 8) {
        alert('La contraseña nueva debe tener al menos 8 caracteres.');
        return;
      }
      try {
        const { acceso: actualizado } = await api(`/api/accesos/${acceso.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: nueva }),
        });
        Object.assign(acceso, actualizado);
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

  async function vincularProfesor(acceso) {
    try {
      const { profesor } = await api('/api/profesores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: acceso.etiqueta }),
      });
      state.profesores.push(profesor);

      const { acceso: actualizado } = await api(`/api/accesos/${acceso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profesorId: profesor.id }),
      });
      Object.assign(acceso, actualizado);
      render();
    } catch (err) {
      alert(err.message);
    }
  }

  async function cambiarActivo(acceso, activo) {
    try {
      const { acceso: actualizado } = await api(`/api/accesos/${acceso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      });
      Object.assign(acceso, actualizado);
      render();
    } catch (err) {
      alert(err.message);
    }
  }

  init();
})();
