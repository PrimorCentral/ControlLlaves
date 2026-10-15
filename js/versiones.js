// ════════════════════════════════════════════════════════════════════════════
// SISTEMA DE VERSIONES — Control de actualizaciones forzadas
//
// La versión SOLO se escribe en version.json. Nada más.
//
// Cómo funciona:
//   1. Al abrir la app se lee version.json: esa es la versión de esta página
//      (se guarda en window.APP_VERSION y en <meta name="app-version">).
//   2. Cada 2 minutos (y al volver a la pestaña) se vuelve a leer version.json.
//   3. Si el número publicado es mayor → aviso obligatorio de actualizar.
//
// Para publicar una versión: sube primero los archivos cambiados y, al final,
// version.json con el número nuevo. Los archivos llegan siempre frescos porque
// el service worker (sw.js) pregunta al servidor si han cambiado; ya no hace
// falta poner "?v=" en index.html.
// ════════════════════════════════════════════════════════════════════════════

(function() {
  const VERSION_JSON_URL = 'version.json';
  const CHECK_INTERVAL_MS = 2 * 60 * 1000;   // cada 2 minutos

  let versionLocal = null;   // versión publicada cuando se abrió esta página

  async function leerVersionPublicada() {
    try {
      const resp = await fetch(VERSION_JSON_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data && data.version ? String(data.version).trim() : null;
    } catch (e) { return null; }
  }

  function fijarVersionLocal(v) {
    versionLocal = v;
    window.APP_VERSION = v;
    let meta = document.querySelector('meta[name="app-version"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'app-version'; document.head.appendChild(meta); }
    meta.setAttribute('content', v);
    const badge = document.getElementById('login-version-badge');
    if (badge) badge.textContent = 'v ' + v;
    document.dispatchEvent(new CustomEvent('app-version', { detail: v }));
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

  // ── Comprobar si hay versión nueva ───────────────────────────────────────
  async function comprobarVersion() {
    const versionRemota = await leerVersionPublicada();
    if (!versionRemota) return;                 // sin conexión: se reintentará
    if (!versionLocal) { fijarVersionLocal(versionRemota); return; }
    if (esVersionMayor(versionRemota, versionLocal)) {
      mostrarModalActualizacion(versionRemota);
      clearInterval(checkTimer);                // ya solo queda actualizar
    }
  }

  // Al abrir: la versión publicada en este momento es la de esta página
  comprobarVersion();
  var checkTimer = setInterval(comprobarVersion, CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') comprobarVersion();
  });

})();

// ── Función global para el botón ACTUALIZAR ───────────────────────────────
async function forzarActualizacion() {
  const btn = document.querySelector('#modal-nueva-version .btn-actualizar');
  if (btn) { btn.textContent = '⏳  Actualizando…'; btn.disabled = true; }

  try {
    // Pedir al navegador que revise también el service worker
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.update().catch(() => {})));
    }
    // Refrescar en la caché del navegador los archivos propios de la app
    const urls = [...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')]
      .map(el => el.src || el.href)
      .filter(u => u && new URL(u, location.href).origin === location.origin);
    await Promise.all(urls.map(u => fetch(u, { cache: 'reload' }).catch(() => {})));
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch (e) { /* recargamos igualmente */ }

  window.location.href = window.location.href.split('?')[0].split('#')[0] + '?v=' + Date.now();
}
