(() => {
  const el = {
    estadoCarga: document.getElementById('estadoCarga'),
    contenido: document.getElementById('contenido'),
    switchHorarios: document.getElementById('switchHorarios'),
    switchSlots: document.getElementById('switchSlots'),
    driveUrl: document.getElementById('driveUrl'),
    botonGuardarDrive: document.getElementById('botonGuardarDrive'),
    estadoGuardado: document.getElementById('estadoGuardado'),
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
    window.Nav.render(acceso);

    if (acceso.rol !== 'admin') {
      document.querySelector('.admin').innerHTML =
        '<h1 class="admin__titulo">Configuración</h1><p class="admin-vacio">Esta pantalla es solo para administración.</p>';
      return;
    }

    try {
      const { config } = await api('/api/config');
      el.switchHorarios.checked = config.profesPuedenEditarHorarios;
      el.switchSlots.checked = config.profesPuedenOcuparSlots;
      el.driveUrl.value = config.driveCarpetaUrl || '';

      el.estadoCarga.hidden = true;
      el.contenido.hidden = false;

      el.switchHorarios.addEventListener('change', () =>
        guardar({ profes_pueden_editar_horarios: el.switchHorarios.checked })
      );
      el.switchSlots.addEventListener('change', () =>
        guardar({ profes_pueden_ocupar_slots: el.switchSlots.checked })
      );
      el.botonGuardarDrive.addEventListener('click', () =>
        guardar({ drive_carpeta_url: el.driveUrl.value.trim() || null })
      );
    } catch (err) {
      el.estadoCarga.hidden = false;
      el.estadoCarga.textContent = `No se pudo cargar: ${err.message}`;
    }
  }

  async function guardar(cambios) {
    el.estadoGuardado.textContent = 'Guardando…';
    try {
      await api('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      el.estadoGuardado.textContent = 'Guardado ✓';
    } catch (err) {
      el.estadoGuardado.textContent = `No se pudo guardar: ${err.message}`;
    }
  }

  init();
})();
