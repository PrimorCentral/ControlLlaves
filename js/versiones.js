// ════════════════════════════════════════════════════════════════════════════
// SISTEMA DE VERSIONES — Control de actualizaciones forzadas
//
// Cómo funciona:
//   1. Esta página tiene una versión definida en <meta name="app-version">
//   2. Se consulta version.json en GitHub cada 2 minutos
//   3. Si la versión remota es mayor → modal bloqueante obligatorio
//
// Cuando subas una nueva versión:
//   → Cambia el <meta name="app-version" content="X.X.X"> en este HTML
//   → Actualiza también version.json con el mismo número
// ════════════════════════════════════════════════════════════════════════════

(function() {
  // ── Configuración ─────────────────────────────────────────────────────────
  // URL del fichero version.json en tu GitHub Pages
  // Ejemplo: https://primorcentral.github.io/ControlLlaves/version.json
  const VERSION_JSON_URL = 'version.json';

  // Cada cuántos milisegundos se comprueba si hay nueva versión (2 minutos)
  const CHECK_INTERVAL_MS = 2 * 60 * 1000;

  // ── Leer versión actual del HTML ──────────────────────────────────────────
  function getVersionActual() {
    const meta = document.querySelector('meta[name="app-version"]');
    return meta ? meta.getAttribute('content') : '0.0.0';
  }

  // ── Comparar versiones semánticas (X.Y.Z) ────────────────────────────────
  // Devuelve true si remota > local
  function esVersionMayor(remota, local) {
    const parse = v => v.replace(/[^0-9.]/g, '').split('.').map(Number);
    const [rMaj, rMin, rPat] = parse(remota);
    const [lMaj, lMin, lPat] = parse(local);
    if (rMaj !== lMaj) return rMaj > lMaj;
    if (rMin !== lMin) return rMin > lMin;
    return rPat > lPat;
  }

  // ── Mostrar modal bloqueante ──────────────────────────────────────────────
  function mostrarModalActualizacion(versionRemota) {
    const modal = document.getElementById('modal-nueva-version');
    const badge = document.getElementById('nv-badge');
    if (!modal) return;
    if (badge) badge.textContent = 'v ' + versionRemota;
    modal.classList.add('visible');

    // Bloquear cualquier interacción con el fondo
    document.addEventListener('keydown', bloquearTeclado, true);
    document.addEventListener('mousedown', bloquearFondo, true);
    document.addEventListener('touchstart', bloquearFondo, true);
  }

  function bloquearTeclado(e) {
    // Permitir solo si el foco está dentro del modal
    const modal = document.getElementById('modal-nueva-version');
    if (modal && !modal.contains(e.target)) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  function bloquearFondo(e) {
    const modal = document.getElementById('modal-nueva-version');
    if (modal && !modal.contains(e.target)) {
      e.stopPropagation();
      e.preventDefault();
      // Efecto visual: agitar el modal para indicar que es obligatorio
      const box = modal.querySelector('.nv-box');
      if (box) {
        box.style.animation = 'none';
        setTimeout(() => { box.style.animation = 'nv-shake 0.4s ease'; }, 10);
      }
    }
  }

  // ── Consultar version.json ────────────────────────────────────────────────
  async function comprobarVersion() {
    try {
      // Cache-busting: añadir timestamp para evitar que el navegador
      // devuelva el version.json cacheado
      const url = VERSION_JSON_URL + '?t=' + Date.now();
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) return;
      const data = await resp.json();
      const versionRemota = data.version;
      const versionLocal  = getVersionActual();

      if (esVersionMayor(versionRemota, versionLocal)) {
        mostrarModalActualizacion(versionRemota);
        // Dejar de comprobar — el usuario tiene que actualizar
        clearInterval(checkTimer);
      }
    } catch (e) {
      // Sin conexión o error — no hacer nada, se reintentará
    }
  }

  // ── Iniciar comprobaciones periódicas ────────────────────────────────────
  // Primera comprobación nada más cargar la página (500ms para que el DOM termine de renderizar)
  setTimeout(comprobarVersion, 500);

  // Comprobaciones periódicas cada CHECK_INTERVAL_MS
  var checkTimer = setInterval(comprobarVersion, CHECK_INTERVAL_MS);

  // También comprobar cuando el usuario vuelve a la pestaña
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') comprobarVersion();
  });

})();

// ── Función global para el botón ACTUALIZAR ───────────────────────────────
function forzarActualizacion() {
  const btn = document.querySelector('#modal-nueva-version .btn-actualizar');
  if (btn) { btn.textContent = '⏳  Actualizando…'; btn.disabled = true; }

  // Limpiar caché del Service Worker si existe
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
  }

  // Limpiar caché del navegador y recargar
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(n => caches.delete(n)));
  }

  // Recargar forzando descarga desde servidor (bypass caché)
  setTimeout(() => {
    window.location.href = window.location.href.split('?')[0]
      + '?v=' + Date.now();
  }, 400);
}
