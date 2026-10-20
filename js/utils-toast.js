// ════════════════════════════════════════════════════════════════════════════
// TOAST, SPLASH, UTILS
// ════════════════════════════════════════════════════════════════════════════
let toastTimer;
function mostrarToast(msg, tipo='info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${tipo} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ── SPLASH ANIMADO ──────────────────────────────────────────────────────────
// Momento en que empezó a verse el splash (para garantizar una duración mínima)
const SPLASH_INICIO = Date.now();
let _splashSaliendo = false;

// Mueve la barra y el camión al porcentaje indicado (0–100)
function setSplashProgreso(pct) {
  pct = Math.max(0, Math.min(100, pct));
  const bar    = document.getElementById('splash-bar');
  const camion = document.getElementById('splash-camion');
  if (bar)    bar.style.width = pct + '%';
  if (camion) camion.style.left = `calc(${pct}% - ${pct * 0.28}px)`; // 28px = ancho del camión
}

// Marca un paso del splash: 'config' | 'servidor' | 'version' | 'acceso'
// estado: 'hecho' (check verde) o 'aviso' (amarillo, p.ej. sin conexión)
function marcarSplashPaso(paso, estado = 'hecho') {
  const el = document.getElementById('splash-paso-' + paso);
  if (el) { el.classList.remove('hecho', 'aviso'); el.classList.add(estado); }
}

function ocultarSplash() {
  const splash = document.getElementById('splash');
  if (!splash || _splashSaliendo) return;
  _splashSaliendo = true;
  setSplashProgreso(100);

  const login = document.getElementById('pantalla-login');
  const brand = login && !login.classList.contains('oculto') ? login.querySelector('.login-brand') : null;
  const anchoBrand = brand ? brand.getBoundingClientRect().width : 0;

  // 1) Desvanece el contenido del splash
  setTimeout(() => splash.classList.add('saliendo'), 250);

  if (anchoBrand > 0 && window.innerWidth > 768) {  // sin mirar "reducir movimiento": en los PCs del trabajo viene activado y no se animaba
    // 2) El fondo azul se encoge hasta ocupar exactamente el panel de marca del login
    setTimeout(() => { splash.style.width = anchoBrand + 'px'; }, 550);
    // 3) Se funde con el panel (mismo color) y desaparece
    setTimeout(() => splash.classList.add('oculto'), 1250);
    setTimeout(() => { if (splash.parentNode) splash.remove(); }, 1600);
  } else {
    setTimeout(() => splash.classList.add('oculto'), 550);
    setTimeout(() => { if (splash.parentNode) splash.remove(); }, 900);
  }
}

function setSplashMsg(msg, ok = false) {
  const el = document.getElementById('splash-msg');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('ok', !!ok);
}

async function hashStr(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

