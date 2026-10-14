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

function ocultarSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const bar = document.getElementById('splash-bar');
  if (bar) { bar.style.width = '100%'; bar.style.transition = 'width 0.3s ease'; }
  setTimeout(() => { if (splash) splash.classList.add('oculto'); }, 300);
  setTimeout(() => { if (splash && splash.parentNode) splash.remove(); }, 750);
}

function setSplashMsg(msg) {
  const el = document.getElementById('splash-msg');
  if (el) el.textContent = msg;
}

async function hashStr(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

