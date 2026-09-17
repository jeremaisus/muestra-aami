(() => {
  const form = document.getElementById('formCambiar');
  const error = document.getElementById('error');
  const intro = document.getElementById('intro');
  const boton = document.getElementById('botonGuardar');

  window.Auth.sesionActual().then((acceso) => {
    if (!acceso) {
      window.Auth.redirigirALogin();
      return;
    }
    if (!acceso.debeCambiar) {
      intro.textContent = 'Cambiá tu contraseña cuando quieras.';
    }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    error.hidden = true;

    const nueva = form.passwordNueva.value;
    const confirmar = form.passwordConfirmar.value;
    if (nueva !== confirmar) {
      error.textContent = 'La contraseña nueva no coincide en los dos campos.';
      error.hidden = false;
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Guardando…';

    try {
      const res = await fetch('/api/auth/cambiar-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passwordActual: form.passwordActual.value,
          passwordNueva: nueva,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        error.textContent = body.error || 'No se pudo cambiar la contraseña.';
        error.hidden = false;
        return;
      }

      location.href = '/grilla.html';
    } catch {
      error.textContent = 'No se pudo conectar con el servidor.';
      error.hidden = false;
    } finally {
      boton.disabled = false;
      boton.textContent = 'Guardar y continuar';
    }
  });
})();
