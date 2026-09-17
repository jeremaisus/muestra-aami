(() => {
  const form = document.getElementById('formLogin');
  const error = document.getElementById('error');
  const boton = document.getElementById('botonEntrar');

  // Si ya hay sesión, no tiene sentido mostrar el login de nuevo.
  window.Auth.sesionActual().then((acceso) => {
    if (acceso) redirigirDespuesDeLogin(acceso);
  });

  function redirigirDespuesDeLogin(acceso) {
    if (acceso.debeCambiar) {
      location.href = '/cambiar-password.html';
      return;
    }
    const params = new URLSearchParams(location.search);
    location.href = params.get('redirect') || '/grilla.html';
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    error.hidden = true;
    boton.disabled = true;
    boton.textContent = 'Entrando…';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: form.usuario.value.trim(),
          password: form.password.value,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        error.textContent = body.error || 'No se pudo ingresar.';
        error.hidden = false;
        return;
      }

      redirigirDespuesDeLogin(body.acceso);
    } catch {
      error.textContent = 'No se pudo conectar con el servidor.';
      error.hidden = false;
    } finally {
      boton.disabled = false;
      boton.textContent = 'Entrar';
    }
  });
})();
