function abrirModalCambioClave() {
  document.getElementById('cc-actual').value = '';
  document.getElementById('cc-nueva').value = '';
  document.getElementById('cc-confirmar').value = '';
  document.getElementById('cc-error').classList.remove('visible');
  document.getElementById('cc-ok').classList.remove('visible');
  document.getElementById('cc-btn-ok').disabled = false;
  document.getElementById('cc-btn-ok').textContent = '🔑 Guardar clave';
  var loadEl = document.getElementById('cc-loading');
  loadEl.classList.remove('visible');
  loadEl.querySelector('.cc-loading-spinner').style.borderTopColor = '#e84545';
  document.getElementById('modal-cambio-clave').classList.add('visible');
  setTimeout(function(){ document.getElementById('cc-actual').focus(); }, 120);
}
function cerrarModalCambioClave() {
  document.getElementById('modal-cambio-clave').classList.remove('visible');
}
async function guardarCambioClave() {
  var actual    = document.getElementById('cc-actual').value.trim();
  var nueva     = document.getElementById('cc-nueva').value.trim();
  var confirmar = document.getElementById('cc-confirmar').value.trim();
  var errEl = document.getElementById('cc-error');
  var okEl  = document.getElementById('cc-ok');
  errEl.classList.remove('visible');
  okEl.classList.remove('visible');

  if (!actual || !nueva || !confirmar) {
    errEl.textContent = 'Rellena todos los campos';
    errEl.classList.add('visible'); return;
  }
  if (nueva.length < 4) {
    errEl.textContent = 'La nueva clave debe tener al menos 4 caracteres';
    errEl.classList.add('visible'); return;
  }
  if (nueva !== confirmar) {
    errEl.textContent = 'La nueva clave y la confirmación no coinciden';
    errEl.classList.add('visible'); return;
  }
  if (!usuarioActual) {
    errEl.textContent = 'No hay sesión activa';
    errEl.classList.add('visible'); return;
  }

  var btnOk = document.getElementById('cc-btn-ok');
  var loadEl = document.getElementById('cc-loading');
  var loadTxt = document.getElementById('cc-loading-text');
  btnOk.disabled = true;
  loadTxt.textContent = 'Comprobando clave…';
  loadEl.classList.add('visible');

  try {
    var hashActual = await hashStr(actual);
    if (hashActual !== usuarioActual.hash) {
      loadEl.classList.remove('visible');
      errEl.textContent = 'La clave actual no es correcta';
      errEl.classList.add('visible');
      btnOk.disabled = false; btnOk.textContent = '🔑 Guardar clave'; return;
    }

    loadTxt.textContent = 'Guardando nueva clave…';
    var hashNueva = await hashStr(nueva);

    var resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        accion: 'cambiarClave',
        numUsuario: usuarioActual.numUsuario,
        hashNueva: hashNueva
      })
    });
    var data = await resp.json();

    if (data.ok) {
      usuarioActual.hash = hashNueva;
      registrarAccion('ADMIN', 'Cambiar contraseña propia', `Usuario ${usuarioActual.nombre||usuarioActual.numUsuario}`);
      loadTxt.textContent = '✓ ¡Clave cambiada!';
      loadEl.querySelector('.cc-loading-spinner').style.borderTopColor = '#2ecc71';
      setTimeout(function(){ loadEl.classList.remove('visible'); cerrarModalCambioClave(); }, 1400);
    } else {
      loadEl.classList.remove('visible');
      errEl.textContent = data.error || 'Error al guardar la clave';
      errEl.classList.add('visible');
      btnOk.disabled = false; btnOk.textContent = '🔑 Guardar clave';
    }
  } catch(e) {
    loadEl.classList.remove('visible');
    errEl.textContent = 'Error de conexión. Inténtalo de nuevo.';
    errEl.classList.add('visible');
    btnOk.disabled = false; btnOk.textContent = '🔑 Guardar clave';
  }
}
document.getElementById('modal-cambio-clave').addEventListener('click', function(e){
  if (e.target === this) cerrarModalCambioClave();
});
