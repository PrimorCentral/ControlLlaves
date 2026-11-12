// ════════════════════════════════════════════════════════════════════════════
// MÓVIL — teclado y posición de la página (igual que SALIDAS)
// ════════════════════════════════════════════════════════════════════════════

/* Login con el teclado abierto (sobre todo iPhone): el teclado tapaba la
   mitad de abajo de la tarjeta. Mientras está abierto, la pantalla del login
   se ajusta justo al hueco que queda visible encima del teclado (se esconde
   la marca de arriba para que quepa la tarjeta entera) y, al cerrarlo,
   vuelve a su sitio. Solo en pantallas estrechas. */
(function () {
  const vv = window.visualViewport;
  const pantalla = document.getElementById('pantalla-login');
  if (!vv || !pantalla) return;
  function ajustar() {
    const teclado = window.innerWidth <= 820 && (window.innerHeight - vv.height) > 120;
    pantalla.classList.toggle('teclado-abierto', teclado);
    if (teclado) {
      pantalla.style.top = vv.offsetTop + 'px';
      pantalla.style.bottom = 'auto';
      pantalla.style.height = vv.height + 'px';
    } else {
      pantalla.style.top = '';
      pantalla.style.bottom = '';
      pantalla.style.height = '';
    }
  }
  vv.addEventListener('resize', ajustar);
  vv.addEventListener('scroll', ajustar);
})();

/* Móvil: la página entera nunca se desplaza (solo el cuadrante de debajo de
   la barra). Aun así, el iPhone la sube al abrir el teclado para enseñar la
   casilla y a veces no la devuelve al cerrarlo: la barra de arriba se quedaba
   medio escondida bajo la hora. Si pasa sin estar escribiendo, se devuelve a
   su sitio. En el PC no hace nada. */
(function () {
  const esMovil = window.matchMedia('(max-width: 768px)');
  function escribiendo() {
    const a = document.activeElement;
    return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable));
  }
  function recolocar() {
    if (!esMovil.matches || escribiendo()) return;
    const raiz = document.scrollingElement || document.documentElement;
    if (window.scrollY || raiz.scrollTop || document.body.scrollTop) {
      window.scrollTo(0, 0);
      raiz.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }
  let t = null;
  function luego() { clearTimeout(t); t = setTimeout(recolocar, 250); }
  window.addEventListener('scroll', luego, { passive: true });
  document.addEventListener('focusout', luego);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', luego);
  window.addEventListener('orientationchange', luego);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) luego(); });
})();
