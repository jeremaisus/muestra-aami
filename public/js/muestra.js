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

  return { obtener, guardar };
})();
