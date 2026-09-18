// Barra de navegación compartida. Requiere que auth.js se haya cargado antes
// y que exista <div id="navPrincipal"></div> en la página.
window.Nav = (() => {
  const PAGINAS = [
    { href: '/grilla.html', label: 'Grilla' },
    { href: '/canciones.html', label: 'Canciones' },
    { href: '/alumnos.html', label: 'Alumnos' },
    { href: '/carga-rapida.html', label: 'Carga rápida' },
    { href: '/asignar-horarios.html', label: 'Asignar horarios' },
    { href: '/dashboard.html', label: 'Faltantes' },
    { href: '/programa.html', label: 'Programa' },
    { href: '/profesores.html', label: 'Profesores', soloAdmin: true },
    { href: '/accesos.html', label: 'Accesos', soloAdmin: true },
    { href: '/config.html', label: 'Configuración', soloAdmin: true },
  ];

  function render(acceso) {
    const contenedor = document.getElementById('navPrincipal');
    if (!contenedor) return;

    const actual = location.pathname;

    contenedor.innerHTML = '';
    contenedor.className = 'nav-principal';

    const marca = document.createElement('span');
    marca.className = 'nav-principal__marca';
    marca.textContent = 'Muestra AAMI';
    contenedor.appendChild(marca);

    const links = document.createElement('div');
    links.className = 'nav-principal__links';
    PAGINAS.filter((pagina) => !pagina.soloAdmin || acceso.rol === 'admin').forEach((pagina) => {
      const a = document.createElement('a');
      a.href = pagina.href;
      a.textContent = pagina.label;
      if (actual === pagina.href) a.setAttribute('aria-current', 'page');
      links.appendChild(a);
    });
    contenedor.appendChild(links);

    const usuario = document.createElement('div');
    usuario.className = 'nav-principal__usuario';

    const etiqueta = document.createElement('span');
    etiqueta.className = 'nav-principal__etiqueta';
    etiqueta.textContent = acceso.etiqueta;
    usuario.appendChild(etiqueta);

    const salir = document.createElement('button');
    salir.type = 'button';
    salir.className = 'nav-principal__salir';
    salir.textContent = 'Salir';
    salir.addEventListener('click', () => window.Auth.cerrarSesion());
    usuario.appendChild(salir);

    contenedor.appendChild(usuario);
  }

  return { render };
})();
