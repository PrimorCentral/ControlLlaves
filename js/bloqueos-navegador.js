// Bloquear clic derecho
document.addEventListener('contextmenu', function(e) { e.preventDefault(); });

// Bloquear zoom con Ctrl+rueda del ratón
window.addEventListener('wheel', function(e) {
  if (e.ctrlKey) e.preventDefault();
}, { passive: false });

// Bloquear Ctrl++ y Ctrl+- y Ctrl+0
window.addEventListener('keydown', function(e) {
  if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
    e.preventDefault();
  }
});
