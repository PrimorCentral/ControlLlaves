(function() {
  // Solo actuar en móvil
  if (window.innerWidth > 768 && !('ontouchstart' in window)) return;

  // ── Crear overlay ──
  var ov = document.createElement('div');
  ov.id = 'mob-overlay';
  ov.onclick = cerrar;
  document.body.appendChild(ov);

  // ── Crear topbar ──
  var tb = document.createElement('div');
  tb.id = 'mob-topbar';
  tb.innerHTML =
    '<button class="mob-ham" onclick="window._mobToggle()">☰</button>' +
    '<div class="mob-tit">🚛 Gestión de Flota</div>' +
    '<span class="mob-badge" id="mob-badge"></span>' +
    '<button class="mob-rel" onclick="if(window.usuarioActual) window.cargarCuadrante()" title="Recargar">↺</button>';
  // Insertar antes del sidebar
  var sidebar = document.querySelector('.sidebar');
  document.body.insertBefore(tb, sidebar);

  // ── Crear bottombar ──
  var bb = document.createElement('div');
  bb.id = 'mob-bottombar';
  bb.innerHTML =
    '<button onclick="window._mobToggle()"><span class="bbi">☰</span>Menú</button>' +
    '<button onclick="if(typeof cargarCuadrante===\'function\') cargarCuadrante()"><span class="bbi">↺</span>Recargar</button>';
  document.body.appendChild(bb);

  // Fix botón recargar topbar
  var btnRel = tb.querySelector('.mob-rel');
  if (btnRel) btnRel.onclick = function() { if (typeof cargarCuadrante === 'function') cargarCuadrante(); };

  // ── Drawer logic ──
  function abrir() {
    sidebar.classList.add('mob-abierto');
    ov.classList.add('vis');
  }
  function cerrar() {
    sidebar.classList.remove('mob-abierto');
    ov.classList.remove('vis');
  }
  window._mobToggle = function() {
    sidebar.classList.contains('mob-abierto') ? cerrar() : abrir();
  };
})();
