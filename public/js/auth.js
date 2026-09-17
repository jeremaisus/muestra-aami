// Sesión compartida por todas las pantallas. La cookie es httpOnly: acá solo
// consultamos /api/auth/me, nunca leemos ni escribimos la cookie directo.
window.Auth = (() => {
  async function sesionActual() {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return null;
    const { acceso } = await res.json();
    return acceso;
  }

  function redirigirALogin() {
    const destino = encodeURIComponent(location.pathname + location.search);
    location.href = `/login.html?redirect=${destino}`;
  }

  // Llamar al principio de cada pantalla protegida. Devuelve el acceso o
  // redirige (y devuelve null) si no hay sesión o si falta cambiar la clave.
  async function requerirSesion() {
    const acceso = await sesionActual();
    if (!acceso) {
      redirigirALogin();
      return null;
    }
    if (acceso.debeCambiar && !location.pathname.endsWith('/cambiar-password.html')) {
      location.href = '/cambiar-password.html';
      return null;
    }
    return acceso;
  }

  async function cerrarSesion() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    location.href = '/login.html';
  }

  return { sesionActual, requerirSesion, cerrarSesion, redirigirALogin };
})();
