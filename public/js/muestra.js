// Recuerda la última muestra elegida entre pantallas. Conveniencia de
// navegador por usuario, no estado compartido: si falla o viene vacío no
// pasa nada, se vuelve a elegir la primera muestra disponible.
window.MuestraActual = (() => {
  const CLAVE = 'muestra-aami:showId';

  function obtener() {
    try {
      return localStorage.getItem(CLAVE);
    } catch {
      return null;
    }
  }

  function guardar(showId) {
    try {
      localStorage.setItem(CLAVE, showId);
    } catch {
      /* noop */
    }
  }

  // "Sin asignar" es el destino de canciones sin clasificar: no tiene
  // alumnos ni horarios, así que no se ofrece como pestaña en ninguna
  // pantalla organizada por alumnos (grilla, carga rápida, alumnos,
  // dashboard, programa). Solo Canciones la muestra, sin este filtro.
  function paraSeleccion(shows) {
    return shows.filter((s) => s.nombre !== 'Sin asignar');
  }

  return { obtener, guardar, paraSeleccion };
})();
