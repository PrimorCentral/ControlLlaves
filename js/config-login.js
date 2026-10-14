// ── Estado: si la sesión de Config está desbloqueada en esta sesión ──
let _configDesbloqueado = false;
let _configHashRemoto   = null; // hash cargado desde Sheets

// Carga el configHash desde Sheets (se llama al abrir el panel admin)
async function cargarConfigHashRemoto() {
  if (!APPS_SCRIPT_URL) return;
  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?accion=cargarConfigHash`, { redirect: 'follow' });
    const json = await resp.json();
    if (json.ok) _configHashRemoto = json.configHash || null;
    // Actualizar estado del sync en la sección de Config
    actualizarEstadoConfigPassSync(!!_configHashRemoto);
  } catch(e) {}
}

function abrirLoginConfig() {
  // Si no hay contraseña de Config configurada, acceso directo
  if (!_configHashRemoto) {
    _configDesbloqueado = true;
    mostrarContenidoConfig();
    cambiarTabConfig();
    return;
  }
  // Si ya estaba desbloqueado en esta sesión, acceso directo
  if (_configDesbloqueado) {
    mostrarContenidoConfig();
    cambiarTabConfig();
    return;
  }
  // Mostrar modal
  const modal = document.getElementById('modal-login-config');
  const inp   = document.getElementById('inp-config-password');
  const err   = document.getElementById('config-login-error');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  if (inp) inp.value = '';
  modal.style.display = 'flex';
  setTimeout(() => { if (inp) inp.focus(); }, 120);
}

function cerrarLoginConfig() {
  document.getElementById('modal-login-config').style.display = 'none';
  document.getElementById('inp-config-password').value = '';
  const err = document.getElementById('config-login-error');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
}

async function verificarPasswordConfig() {
  const inp = document.getElementById('inp-config-password');
  const err = document.getElementById('config-login-error');
  const pass = inp ? inp.value.trim() : '';
  if (!pass) {
    err.textContent = 'Introduce la contraseña';
    err.style.display = 'block'; return;
  }
  const hash = await hashStr(pass);
  if (hash !== _configHashRemoto) {
    err.textContent = 'Contraseña incorrecta';
    err.style.display = 'block';
    inp.value = '';
    inp.focus(); return;
  }
  // Correcto
  _configDesbloqueado = true;
  cerrarLoginConfig();
  mostrarContenidoConfig();
  cambiarTabConfig();
  cargarEstadoPassAdmin(); // refresca estado pass admin dentro del tab
  cargarConfigPassSyncStatus();
}

function mostrarContenidoConfig() {
  const lockScreen = document.getElementById('config-lock-screen');
  const content    = document.getElementById('config-content');
  if (lockScreen) lockScreen.style.display = 'none';
  if (content)    content.style.display    = 'flex';
}

function cambiarTabConfig() {
  // Activar visualmente la pestaña config sin pasar por abrirLoginConfig de nuevo
  const homeWatermark = document.getElementById('admin-home-watermark');
  if (homeWatermark) homeWatermark.style.display = 'none';
  ['vehiculos','conductores','historial','log','reasignaciones','incidencias','repostajes','responsables','config','activos'].forEach(t => {
    document.getElementById('tab-btn-'+t).classList.toggle('active', t==='config');
    document.getElementById('tab-panel-'+t).classList.toggle('active', t==='config');
  });
  volverConfigMenu();
}

// Al cerrar el panel admin, resetear el desbloqueo de Config
const _origCerrarAdmin = window.cerrarAdmin;
window.cerrarAdmin = function() {
  _rutasPuedeSalirSinGuardar().then(puede => {
    if (!puede) return;
    _configDesbloqueado = false;
    // Restaurar pantalla de bloqueo
    const lockScreen = document.getElementById('config-lock-screen');
    const content    = document.getElementById('config-content');
    if (lockScreen) lockScreen.style.display = 'flex';
    if (content)    content.style.display    = 'none';
    if (typeof _origCerrarAdmin === 'function') _origCerrarAdmin();
  });
};

// ── Cambiar contraseña de Config ──
async function cambiarPasswordConfig() {
  const nueva   = document.getElementById('config-pass-nueva').value;
  const confirm = document.getElementById('config-pass-confirm').value;
  if (!nueva)            { mostrarToast('Introduce la nueva contraseña', 'error'); return; }
  if (nueva !== confirm) { mostrarToast('Las contraseñas no coinciden', 'error'); return; }
  if (nueva.length < 4)  { mostrarToast('Mínimo 4 caracteres', 'error'); return; }

  const hash = await hashStr(nueva);
  const btn  = document.getElementById('btn-cambiar-config-pass');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'guardarConfigHash', configHash: hash })
    });
    const json = await resp.json();
    if (json.ok) {
      _configHashRemoto = hash;
      document.getElementById('config-pass-nueva').value = '';
      document.getElementById('config-pass-confirm').value = '';
      registrarAccion('ADMIN', 'Cambiar contraseña de Config', 'Contraseña de Config actualizada en Sheets');
      mostrarToast('✓ Contraseña de Config guardada en Sheets', 'success');
      actualizarEstadoConfigPassSync(true);
    } else {
      mostrarToast('Error al guardar: ' + (json.error || ''), 'error');
    }
  } catch(e) {
    mostrarToast('Error de conexión', 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔐 Cambiar contraseña de Config'; }
}

async function cargarConfigPassSyncStatus() {
  actualizarEstadoConfigPassSync(!!_configHashRemoto);
  // Si todavía no lo hemos cargado, lo cargamos ahora
  if (_configHashRemoto === null) await cargarConfigHashRemoto();
  actualizarEstadoConfigPassSync(!!_configHashRemoto);
}

function actualizarEstadoConfigPassSync(ok) {
  const icon = document.getElementById('config-pass-sync-icon');
  const text = document.getElementById('config-pass-sync-text');
  if (!icon || !text) return;
  if (ok) {
    icon.textContent = '✅';
    text.textContent = 'Contraseña de Config activa en Google Sheets ✓';
    text.style.color = '#2ecc71';
  } else {
    icon.textContent = '⚠️';
    text.textContent = 'Sin contraseña configurada — cualquiera con acceso admin puede entrar';
    text.style.color = '#e84545';
  }
}

// Cargar el hash de Config al abrir el panel admin
const _origAbrirAdmin = window.abrirAdmin;
window.abrirAdmin = function() {
  if (typeof _origAbrirAdmin === 'function') _origAbrirAdmin();
  cargarConfigHashRemoto();
};

// ════════════════════════════════════════════════════════════════════════════
// CONFIG: MENÚ DE SECCIONES (Conexión / Seguridad / Destinatarios / Diagnóstico)
// ════════════════════════════════════════════════════════════════════════════
function abrirConfigSeccion(id) {
  const menu = document.getElementById('config-menu');
  if (menu) menu.style.display = 'none';
  document.querySelectorAll('.config-section-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('config-section-' + id);
  if (panel) panel.classList.add('active');

  if (id === 'seguridad') {
    cargarEstadoPassAdmin();
    cargarConfigPassSyncStatus();
  }
  if (id === 'destinatarios') cargarDestinatariosUI();
  if (id === 'rutas') rutasRenderAll();
  if (id === 'logacciones') {
    // Prefill con hoy
    const hoy = new Date().toISOString().substring(0,10);
    const dEl = document.getElementById('logac-desde');
    const hEl = document.getElementById('logac-hasta');
    if (dEl && !dEl.value) dEl.value = hoy;
    if (hEl && !hEl.value) hEl.value = hoy;
    cargarLogAcciones();
  }
}

/** Si hay cambios de Rutas/Empresas/Ubicaciones sin guardar, pregunta antes de
 *  descartarlos. Devuelve true si se puede continuar (no había cambios, o el
 *  usuario confirmó que quiere salir sin guardar); false si hay que quedarse. */
async function _rutasPuedeSalirSinGuardar() {
  if (!_rutasSinGuardar) return true;
  const ok = await appConfirm(
    'Tienes cambios en Ubicaciones o Empresas/Rutas que todavía no se han guardado. Si continúas, se perderán.',
    { titulo: '⚠️ Cambios sin guardar', icono: '💾', labelOk: 'Salir sin guardar', peligro: true }
  );
  if (ok) _rutasSinGuardar = false;
  return ok;
}

function volverConfigMenu() {
  _rutasPuedeSalirSinGuardar().then(puede => {
    if (!puede) return;
    const menu = document.getElementById('config-menu');
    if (menu) menu.style.display = 'grid';
    document.querySelectorAll('.config-section-panel').forEach(p => p.classList.remove('active'));
  });
}

// ════════════════════════════════════════════════════════════════════════════
// CONFIG: RUTAS Y EMPRESAS
// ════════════════════════════════════════════════════════════════════════════

// Estado temporal de edición (se sincroniza con EMPRESAS/UBIC al guardar)
let _rutasEmp  = {};
let _rutasUbic = {};
// Se pone a true en cuanto se toca algo (añadir/editar/borrar ubicación,
// empresa o ruta) y a false al recargar datos frescos o al guardar con éxito.
// Se usa para avisar si el usuario intenta salir sin haber pulsado "Guardar".
let _rutasSinGuardar = false;

function rutasRenderAll() {
  _rutasEmp  = JSON.parse(JSON.stringify(EMPRESAS));
  _rutasUbic = JSON.parse(JSON.stringify(UBIC));
  _rutasSinGuardar = false;
  _rutasRenderUbic();
  _rutasRenderEmp();
}

/* ── UBICACIONES ── */
function _rutasRenderUbic() {
  const lista = document.getElementById('rutas-ubic-lista');
  if (!lista) return;
  const keys = Object.keys(_rutasUbic);
  if (!keys.length) {
    lista.innerHTML = '<div style="font-size:12px;color:#b0bac8;padding:8px 0">No hay ubicaciones definidas</div>';
    return;
  }
  lista.innerHTML = keys.map(k => {
    const u = _rutasUbic[k];
    return `<div style="display:grid;grid-template-columns:90px 1fr 1fr 90px 110px auto;gap:6px;align-items:center;background:#f7f8fa;border:1px solid #dde1e8;border-radius:8px;padding:8px 10px;">
      <div style="font-size:11px;font-weight:900;color:#1a1a2e;letter-spacing:1px;">${k}</div>
      <input value="${u.dir||''}" placeholder="Dirección" oninput="_rutasUbicEdit('${k}','dir',this.value)"
        style="padding:6px 8px;border:1.5px solid #dde1ea;border-radius:6px;font-family:Barlow,sans-serif;font-size:12px;color:#1a1a2e;outline:none;">
      <input value="${u.pob||''}" placeholder="Población" oninput="_rutasUbicEdit('${k}','pob',this.value)"
        style="padding:6px 8px;border:1.5px solid #dde1ea;border-radius:6px;font-family:Barlow,sans-serif;font-size:12px;color:#1a1a2e;outline:none;">
      <input value="${u.cp||''}" placeholder="C.P." oninput="_rutasUbicEdit('${k}','cp',this.value)"
        style="padding:6px 8px;border:1.5px solid #dde1ea;border-radius:6px;font-family:Barlow,sans-serif;font-size:12px;color:#1a1a2e;outline:none;">
      <input value="${u.tel||''}" placeholder="Teléfono" oninput="_rutasUbicEdit('${k}','tel',this.value)"
        style="padding:6px 8px;border:1.5px solid #dde1ea;border-radius:6px;font-family:Barlow,sans-serif;font-size:12px;color:#1a1a2e;outline:none;">
      <button onclick="_rutasDeleteUbic('${k}')" title="Eliminar ubicación"
        style="padding:6px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-weight:900;">✕</button>
    </div>`;
  }).join('');
}

function _rutasUbicEdit(key, field, val) {
  if (_rutasUbic[key]) { _rutasUbic[key][field] = val.trim(); _rutasSinGuardar = true; }
}

function _rutasDeleteUbic(key) {
  appConfirm(`Las rutas que usen <strong>${key}</strong> quedarán incompletas.`, {
    titulo: `¿Eliminar ubicación "${key}"?`, icono: '📍', labelOk: '🗑 Sí, eliminar', peligro: true
  }).then(ok => {
    if (!ok) return;
    delete _rutasUbic[key];
    _rutasSinGuardar = true;
    _rutasRenderUbic();
  });
}

async function rutasAddUbic() {
  const codigo = await appPrompt('Introduce el código de la nueva ubicación:', { titulo: 'Nueva ubicación', icono: '📍', placeholder: 'Ej: GAITE, PTA, CARTAMA', mayusculas: true });
  if (!codigo) return;
  const key = codigo.trim().toUpperCase().replace(/\s+/g,'_');
  if (_rutasUbic[key]) { await appAlert(`Ya existe una ubicación con el código <strong>${key}</strong>.`, { titulo: 'Ubicación duplicada', icono: '⚠️' }); return; }
  _rutasUbic[key] = { dir: '', pob: '', cp: '', tel: '' };
  _rutasSinGuardar = true;
  _rutasRenderUbic();
}

/* ── EMPRESAS ── */
function _rutasRenderEmp() {
  const lista = document.getElementById('rutas-emp-lista');
  if (!lista) return;
  const keys = Object.keys(_rutasEmp);
  if (!keys.length) {
    lista.innerHTML = '<div style="font-size:12px;color:#b0bac8;padding:8px 0">No hay empresas definidas</div>';
    return;
  }
  lista.innerHTML = keys.map(empKey => {
    const emp = _rutasEmp[empKey];
    const rutasHTML = (emp.rutas||[]).map((r, ri) => {
      const orOpts = Object.keys(_rutasUbic).map(k => `<option value="${k}" ${r.origen===k?'selected':''}>${k}</option>`).join('');
      const dstOpts = Object.keys(_rutasUbic).map(k => `<option value="${k}" ${r.destino===k?'selected':''}>${k}</option>`).join('');
      return `<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;align-items:center;padding:6px 8px;background:#fff;border:1px solid #e8eaf0;border-radius:7px;">
        <select onchange="_rutasRutaEdit('${empKey}',${ri},'origen',this.value)"
          style="padding:6px 8px;border:1.5px solid #dde1ea;border-radius:6px;font-family:Barlow,sans-serif;font-size:12px;color:#1a1a2e;outline:none;">
          ${orOpts}
        </select>
        <select onchange="_rutasRutaEdit('${empKey}',${ri},'destino',this.value)"
          style="padding:6px 8px;border:1.5px solid #dde1ea;border-radius:6px;font-family:Barlow,sans-serif;font-size:12px;color:#1a1a2e;outline:none;">
          ${dstOpts}
        </select>
        <input value="${r.label||''}" placeholder="Etiqueta (ej: GAITE → PTA)"
          oninput="_rutasRutaEdit('${empKey}',${ri},'label',this.value)"
          style="padding:6px 8px;border:1.5px solid #dde1ea;border-radius:6px;font-family:Barlow,sans-serif;font-size:12px;color:#1a1a2e;outline:none;">
        <button onclick="_rutasDeleteRuta('${empKey}',${ri})"
          style="padding:6px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-weight:900;">✕</button>
      </div>`;
    }).join('');

    return `<div style="border:1.5px solid #dde1e8;border-radius:10px;overflow:hidden;">
      <!-- Cabecera empresa -->
      <div style="background:#1a1a2e;padding:10px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="font-size:11px;font-weight:900;color:rgba(255,255,255,0.4);letter-spacing:1.5px;text-transform:uppercase;min-width:32px;">${empKey}</div>
        <input value="${emp.label||''}" placeholder="Nombre empresa" oninput="_rutasEmpEdit('${empKey}','label',this.value)"
          style="flex:1;padding:6px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;color:#fff;outline:none;">
        <input value="${emp.razon||''}" placeholder="Razón social" oninput="_rutasEmpEdit('${empKey}','razon',this.value)"
          style="flex:1;padding:6px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;font-family:Barlow,sans-serif;font-size:12px;color:#ccd;outline:none;">
        <input value="${emp.nif||''}" placeholder="NIF" oninput="_rutasEmpEdit('${empKey}','nif',this.value)"
          style="width:130px;padding:6px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;font-family:Barlow,sans-serif;font-size:12px;color:#ccd;outline:none;">
        <button onclick="_rutasDeleteEmp('${empKey}')"
          style="padding:6px 12px;background:#dc2626;color:white;border:none;border-radius:6px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;">✕ Borrar</button>
      </div>
      <!-- Rutas de esta empresa -->
      <div style="padding:10px 12px;display:flex;flex-direction:column;gap:6px;background:#fafbfc;">
        <div style="font-size:10px;font-weight:800;color:#8899aa;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px;">Rutas — Origen / Destino / Etiqueta</div>
        ${rutasHTML || '<div style="font-size:12px;color:#b0bac8;padding:4px 0">Sin rutas</div>'}
        <button onclick="_rutasAddRuta('${empKey}')"
          style="margin-top:4px;padding:7px 14px;background:#e0e7ff;color:#3730a3;border:none;border-radius:7px;font-family:Barlow,sans-serif;font-size:11px;font-weight:800;cursor:pointer;align-self:flex-start;">+ Añadir ruta</button>
      </div>
    </div>`;
  }).join('');
}

function _rutasEmpEdit(empKey, field, val) {
  if (_rutasEmp[empKey]) { _rutasEmp[empKey][field] = val.trim(); _rutasSinGuardar = true; }
}
function _rutasRutaEdit(empKey, ri, field, val) {
  if (_rutasEmp[empKey] && _rutasEmp[empKey].rutas[ri]) {
    _rutasEmp[empKey].rutas[ri][field] = val.trim();
    _rutasSinGuardar = true;
    // Auto-actualizar label si cambian origen/destino y el label coincide con el patrón auto
    if (field === 'origen' || field === 'destino') {
      const r = _rutasEmp[empKey].rutas[ri];
      if (!r.label || r.label.match(/^[A-Z_]+ → [A-Z_]+$/)) {
        r.label = `${r.origen} → ${r.destino}`;
        _rutasRenderEmp(); // re-render para actualizar el input de label
      }
    }
  }
}
function _rutasDeleteRuta(empKey, ri) {
  if (!_rutasEmp[empKey]) return;
  _rutasEmp[empKey].rutas.splice(ri, 1);
  _rutasSinGuardar = true;
  _rutasRenderEmp();
}
function _rutasDeleteEmp(empKey) {
  appConfirm(`Se eliminarán la empresa y todas sus rutas asociadas.`, {
    titulo: `¿Eliminar "${_rutasEmp[empKey]?.label || empKey}"?`, icono: '🏢', labelOk: '🗑 Sí, eliminar', peligro: true
  }).then(ok => {
    if (!ok) return;
    delete _rutasEmp[empKey];
    _rutasSinGuardar = true;
    _rutasRenderEmp();
  });
}
function _rutasAddRuta(empKey) {
  if (!_rutasEmp[empKey]) return;
  const ubics = Object.keys(_rutasUbic);
  if (ubics.length < 2) { appAlert('Necesitas al menos 2 ubicaciones para poder crear una ruta.', { titulo: 'Sin ubicaciones suficientes', icono: '📍' }); return; }
  const origen = ubics[0], destino = ubics[1];
  const id = empKey.toLowerCase() + '-' + Date.now();
  _rutasEmp[empKey].rutas.push({ id, origen, destino, label: `${origen} → ${destino}` });
  _rutasSinGuardar = true;
  _rutasRenderEmp();
}

async function rutasAddEmpresa() {
  const codigo = await appPrompt('Introduce el código de la nueva empresa:', { titulo: 'Nueva empresa', icono: '🏢', placeholder: 'Ej: JD, LD, MN', mayusculas: true });
  if (!codigo) return;
  const key = codigo.trim().toUpperCase().replace(/\s+/g,'_');
  if (_rutasEmp[key]) { await appAlert(`Ya existe una empresa con el código <strong>${key}</strong>.`, { titulo: 'Empresa duplicada', icono: '⚠️' }); return; }
  _rutasEmp[key] = { label: '', razon: '', nif: '', rutas: [] };
  _rutasSinGuardar = true;
  _rutasRenderEmp();
}

async function rutasGuardar() {
  // Validaciones básicas
  for (const [k, u] of Object.entries(_rutasUbic)) {
    if (!u.dir || !u.pob || !u.cp) {
      await appAlert(`La ubicación <strong>${k}</strong> tiene campos vacíos (dirección, población o CP).`, { titulo: 'Campos incompletos', icono: '⚠️' }); return;
    }
  }
  for (const [k, e] of Object.entries(_rutasEmp)) {
    if (!e.label) { await appAlert(`La empresa con código <strong>${k}</strong> no tiene nombre.`, { titulo: 'Empresa sin nombre', icono: '⚠️' }); return; }
  }
  if (!APPS_SCRIPT_URL) { mostrarToast('⚠️ Sin URL de Apps Script configurada', 'error'); return; }
  const btnGuardar = document.querySelector('[onclick="rutasGuardar()"]');
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = '⏳ Guardando…'; }
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'guardarRutas', empresas: _rutasEmp, ubicaciones: _rutasUbic })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'Error desconocido');
    // Actualizar variables en memoria
    EMPRESAS = JSON.parse(JSON.stringify(_rutasEmp));
    UBIC     = JSON.parse(JSON.stringify(_rutasUbic));
    _rutasSinGuardar = false;
    mostrarToast('✓ Rutas y empresas guardadas en Sheets', 'ok');
  } catch(e) {
    mostrarToast('❌ Error al guardar: ' + e.message, 'error');
  } finally {
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = '💾 Guardar cambios'; }
  }
}

async function rutasCargarDesdeSheets() {
  if (!APPS_SCRIPT_URL) return false;
  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?accion=cargarRutas`, { redirect: 'follow' });
    const json = await resp.json();
    if (!json.ok) {
      console.warn('[Rutas] Error al cargar desde Supabase:', json.error);
      return false;
    }
    // Sin datos por defecto: si las tablas están vacías, EMPRESAS/UBIC quedan
    // vacíos y se rellenan desde Panel Admin → Config → Rutas.
    EMPRESAS = json.empresas    || {};
    UBIC     = json.ubicaciones || {};
    return true;
  } catch(e) {
    console.warn('[Rutas] Error al cargar desde Supabase:', e);
    return false;
  }
}


// ════════════════════════════════════════════════════════════════════════════
// CONFIG: DESTINATARIOS DE CORREO (incidencias y bloqueos)
// ════════════════════════════════════════════════════════════════════════════
let destinatariosCache = { incidencias: [], bloqueos: [], itv: [] };

async function cargarDestinatariosUI() {
  actualizarEstadoDestSync('cargando');
  if (!APPS_SCRIPT_URL) { actualizarEstadoDestSync('error', 'Sin URL de Apps Script configurada'); return; }
  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?accion=cargarDestinatarios&_t=${Date.now()}`, { redirect: 'follow' });
    const json = await resp.json();
    if (json.ok) {
      destinatariosCache.incidencias = json.incidencias || [];
      destinatariosCache.bloqueos    = json.bloqueos    || [];
      destinatariosCache.itv         = json.itv         || [];
      renderDestinatariosListas();
      actualizarEstadoDestSync('ok');
    } else {
      actualizarEstadoDestSync('error', 'No se pudieron cargar los destinatarios');
    }
  } catch(e) {
    actualizarEstadoDestSync('error', 'Sin conexión con Sheets');
  }
}

function renderDestinatariosListas() {
  const renderLista = (lista, tipo) => {
    if (!lista.length) {
      return `<div style="text-align:center;padding:14px 0;color:#b0bac8;font-size:11px;font-weight:600">Sin destinatarios añadidos</div>`;
    }
    return lista.map((email, idx) => `
      <div class="dest-item">
        <span style="font-size:14px">📩</span>
        <span class="dest-item-email">${esc(email)}</span>
        <button class="btn-item-action btn-bloquear" onclick="eliminarDestinatario('${tipo}', ${idx})" style="font-size:11px;padding:5px 11px;">🗑</button>
      </div>`).join('');
  };
  const elIncid = document.getElementById('dest-lista-incidencias');
  const elBloq  = document.getElementById('dest-lista-bloqueos');
  const elItv   = document.getElementById('dest-lista-itv');
  if (elIncid) elIncid.innerHTML = renderLista(destinatariosCache.incidencias, 'incidencias');
  if (elBloq)  elBloq.innerHTML  = renderLista(destinatariosCache.bloqueos, 'bloqueos');
  if (elItv)   elItv.innerHTML   = renderLista(destinatariosCache.itv, 'itv');
}

function _emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function añadirDestinatario(tipo) {
  const inputId = tipo === 'incidencias' ? 'dest-incid-nuevo' : (tipo === 'bloqueos' ? 'dest-bloq-nuevo' : 'dest-itv-nuevo');
  const input   = document.getElementById(inputId);
  const email   = (input ? input.value : '').trim().toLowerCase();
  if (!email)              { mostrarToast('Introduce un correo', 'error'); return; }
  if (!_emailValido(email)) { mostrarToast('Correo no válido', 'error'); return; }
  if (destinatariosCache[tipo].includes(email)) { mostrarToast('Ese correo ya está en la lista', 'error'); return; }

  destinatariosCache[tipo].push(email);
  renderDestinatariosListas();
  if (input) input.value = '';
  await persistirDestinatarios();
}

async function eliminarDestinatario(tipo, idx) {
  destinatariosCache[tipo].splice(idx, 1);
  renderDestinatariosListas();
  await persistirDestinatarios();
}

async function persistirDestinatarios() {
  if (!APPS_SCRIPT_URL) { actualizarEstadoDestSync('error', 'Sin URL de Apps Script configurada'); return; }
  actualizarEstadoDestSync('cargando', 'Guardando en Sheets…');
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'guardarDestinatarios', destinatarios: destinatariosCache })
    });
    const json = await resp.json();
    if (json.ok) {
      const nInc = (destinatariosCache.incidencias||[]).length;
      const nBloq = (destinatariosCache.bloqueos||[]).length;
      const nItv = (destinatariosCache.itv||[]).length;
      registrarAccion('ADMIN', 'Cambiar destinatarios de correo', `Incidencias: ${nInc} · Bloqueos: ${nBloq} · ITV: ${nItv}`);
      mostrarToast('✓ Destinatarios guardados en Sheets', 'success');
      actualizarEstadoDestSync('ok');
    } else {
      mostrarToast('Error al guardar: ' + (json.error || ''), 'error');
      actualizarEstadoDestSync('error', 'No se pudo guardar en Sheets');
    }
  } catch(e) {
    mostrarToast('Error de conexión al guardar', 'error');
    actualizarEstadoDestSync('error', 'Sin conexión con Sheets');
  }
}

function actualizarEstadoDestSync(estado, msg) {
  const icon = document.getElementById('dest-sync-icon');
  const text = document.getElementById('dest-sync-text');
  if (!icon || !text) return;
  if (estado === 'ok') {
    icon.textContent = '✅';
    text.textContent = msg || 'Sincronizado con Google Sheets';
    text.style.color = '#2ecc71';
  } else if (estado === 'cargando') {
    icon.textContent = '⏳';
    text.textContent = msg || 'Cargando destinatarios…';
    text.style.color = '#8899aa';
  } else {
    icon.textContent = '⚠️';
    text.textContent = msg || 'Error de sincronización';
    text.style.color = '#e84545';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CONFIG: DIAGNÓSTICO / SALUD DEL SISTEMA
// ════════════════════════════════════════════════════════════════════════════
async function verificarDiagnostico() {
  const btn = document.getElementById('btn-verificar-diagnostico');
  const cont = document.getElementById('diagnostico-resultado');
  if (!APPS_SCRIPT_URL) { mostrarToast('Sin URL de Apps Script configurada', 'error'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Verificando…'; }
  if (cont) cont.innerHTML = `<div style="text-align:center;padding:24px 0;color:#8899aa;font-size:12px;font-weight:600">Consultando Supabase…</div>`;

  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?accion=diagnosticoHojas&_t=${Date.now()}`, { redirect: 'follow' });
    const json = await resp.json();
    if (json.ok && json.hojas) {
      renderDiagnosticoResultado(json.hojas, json.timestamp);
    } else {
      if (cont) cont.innerHTML = `<div style="text-align:center;padding:24px 0;color:#e84545;font-size:12px;font-weight:700">No se pudo obtener el diagnóstico</div>`;
    }
  } catch(e) {
    if (cont) cont.innerHTML = `<div style="text-align:center;padding:24px 0;color:#e84545;font-size:12px;font-weight:700">Sin conexión con Supabase</div>`;
  }
  if (btn) { btn.disabled = false; btn.textContent = '🩺 Verificar'; }
}

function renderDiagnosticoResultado(hojas, timestamp) {
  const cont = document.getElementById('diagnostico-resultado');
  if (!cont) return;

  const filas = hojas.map(h => {
    let badge, badgeTexto;
    if (!h.existe) {
      badge = 'faltante'; badgeTexto = 'No existe';
    } else if (h.filas === 0) {
      badge = 'vacia'; badgeTexto = 'Vacía';
    } else if (h.filas > 3000) {
      badge = 'grande'; badgeTexto = h.filas.toLocaleString('es-ES') + ' filas — revisar';
    } else {
      badge = 'ok'; badgeTexto = h.filas.toLocaleString('es-ES') + ' filas';
    }
    return `<div class="diag-row">
      <div style="flex:1;min-width:0">
        <div class="diag-row-nombre">${esc(h.nombre)}</div>
        <div class="diag-row-tecnico">Tabla "${esc(h.hoja)}" · ${h.columnas||0} columnas</div>
      </div>
      <span class="diag-badge ${badge}">${badgeTexto}</span>
    </div>`;
  }).join('');

  const hora = timestamp ? new Date(timestamp).toLocaleTimeString('es-ES') : '';
  cont.innerHTML = `
    <div style="font-size:10px;color:#b0bac8;font-weight:600;margin-bottom:4px">Última verificación: ${hora}</div>
    ${filas}`;
}

// ════════════════════════════════════════════════════════════════════════════
// LOG DE ACCIONES
// ════════════════════════════════════════════════════════════════════════════

// Disparo silencioso: registra una acción en la hoja LogAcciones del backend
function registrarAccion(categoria, accion, detalle) {
  if (!APPS_SCRIPT_URL || !usuarioActual) return;
  const ahora  = new Date();
  const fecha  = ahora.toISOString().substring(0, 10);
  const hora   = String(ahora.getHours()).padStart(2,'0') + ':' + String(ahora.getMinutes()).padStart(2,'0') + ':' + String(ahora.getSeconds()).padStart(2,'0');
  fetch(APPS_SCRIPT_URL, {
    method: 'POST', redirect: 'follow',
    body: JSON.stringify({
      accion:      'registrarAccion',
      entrada: {
        timestamp:    ahora.toISOString(),
        fecha,
        hora,
        numUsuario:   usuarioActual.num || usuarioActual.numUsuario || '',
        nombre:       usuarioActual.nombre || '',
        categoria,          // SESION | CUADRANTE | INCIDENCIA | VEHICULO | REPOSTAJE | ADMIN
        accion:       accion,
        detalle:      detalle || ''
      }
    })
  }).catch(() => {}); // silencioso
}

// Mapa de colores por categoría
const _LOGAC_COLOR = {
  SESION:     { bg:'#f0f4ff', border:'#c5d0ff', text:'#3b5bdb', icon:'🔑' },
  CUADRANTE:  { bg:'#f0fdf4', border:'#bbf7d0', text:'#15803d', icon:'📅' },
  INCIDENCIA: { bg:'#fff8f0', border:'#fed7aa', text:'#c2410c', icon:'⚠️' },
  VEHICULO:   { bg:'#fdf4ff', border:'#e9d5ff', text:'#7e22ce', icon:'🚛' },
  REPOSTAJE:  { bg:'#fffbeb', border:'#fde68a', text:'#b45309', icon:'⛽' },
  ADMIN:      { bg:'#f0f9ff', border:'#bae6fd', text:'#0369a1', icon:'👤' },
};

async function cargarLogAcciones() {
  if (!APPS_SCRIPT_URL) { mostrarToast('Sin URL de Apps Script configurada', 'error'); return; }
  const cont  = document.getElementById('logac-resultado');
  const desde = document.getElementById('logac-desde').value;
  const hasta = document.getElementById('logac-hasta').value;
  const usu   = (document.getElementById('logac-usuario').value || '').trim();
  const cat   = document.getElementById('logac-categoria').value;
  const btn   = cont.previousElementSibling?.querySelector?.('[onclick="cargarLogAcciones()"]');

  if (cont) cont.innerHTML = `<div style="text-align:center;padding:24px 0;color:#8899aa;font-size:12px;font-weight:600">⏳ Cargando…</div>`;

  try {
    let url = `${APPS_SCRIPT_URL}?accion=cargarLogAcciones&_t=${Date.now()}`;
    if (desde) url += `&desde=${encodeURIComponent(desde)}`;
    if (hasta) url += `&hasta=${encodeURIComponent(hasta)}`;
    if (usu)   url += `&filtroUsuario=${encodeURIComponent(usu)}`;
    if (cat)   url += `&categoria=${encodeURIComponent(cat)}`;

    const json = await fetch(url, { redirect: 'follow' }).then(r => r.json());

    if (!json.ok) {
      if (cont) cont.innerHTML = `<div style="text-align:center;padding:24px 0;color:#e84545;font-size:12px;font-weight:700">Error: ${esc(json.error||'Sin respuesta')}</div>`;
      return;
    }

    const filas = json.filas || [];
    if (filas.length === 0) {
      if (cont) cont.innerHTML = `<div style="text-align:center;padding:24px 0;color:#b0bac8;font-size:12px;font-weight:600">Sin resultados para los filtros indicados</div>`;
      return;
    }

    const rows = filas.map((f, idx) => {
      const c = _LOGAC_COLOR[f.categoria] || { bg:'#f4f5f8', border:'#dde1e8', text:'#556', icon:'•' };
      const ts = f.timestamp ? new Date(f.timestamp) : null;
      const fechaHora = ts
        ? ts.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }) + ' ' +
          ts.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
        : (f.fecha ? f.fecha.split('-').reverse().join('-') + ' ' + (f.hora||'') : '—');

      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-bottom:1px solid #f0f2f5;background:white;" onmouseover="this.style.background='#fafbfc'" onmouseout="this.style.background='white'">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:${c.bg};border:1px solid ${c.border};border-radius:7px;font-size:14px;flex-shrink:0;margin-top:1px">${c.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
            <span style="font-size:12px;font-weight:800;color:#1a1a2e">${esc(f.accion)}</span>
            <span style="font-size:10px;font-weight:700;color:${c.text};background:${c.bg};border:1px solid ${c.border};border-radius:4px;padding:1px 6px;letter-spacing:0.5px">${esc(f.categoria)}</span>
          </div>
          ${f.detalle ? `<div style="font-size:11px;color:#6b7a94;margin-top:2px;line-height:1.5">${esc(f.detalle)}</div>` : ''}
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap">
            <span style="font-size:10px;color:#8899aa;font-weight:600">👤 ${esc(f.nombre||f.numUsuario||'—')}</span>
            <span style="font-size:10px;color:#b0bac8">·</span>
            <span style="font-size:10px;color:#8899aa;font-weight:600">🕐 ${esc(fechaHora)}</span>
          </div>
        </div>
        <button onclick="eliminarLogAccion(${idx})" title="Eliminar entrada"
          style="flex-shrink:0;padding:4px 8px;background:#fff0f0;border:1px solid #fecaca;border-radius:6px;color:#e84545;font-size:11px;cursor:pointer;font-weight:700;margin-top:1px"
          onmouseover="this.style.background='#e84545';this.style.color='white'" onmouseout="this.style.background='#fff0f0';this.style.color='#e84545'">🗑</button>
      </div>`;
    });

    if (cont) cont.innerHTML =
      `<div style="font-size:10px;color:#b0bac8;font-weight:600;padding:6px 12px;background:#f7f8fa;border-bottom:1px solid #eee">${filas.length} registro${filas.length!==1?'s':''} encontrado${filas.length!==1?'s':''}</div>` +
      `<div style="border:1.5px solid #dde1e8;border-radius:8px;overflow:hidden">${rows.join('')}</div>`;

    // Cache local para poder eliminar por timestamp
    cont._logacData = filas;

  } catch(e) {
    if (cont) cont.innerHTML = `<div style="text-align:center;padding:24px 0;color:#e84545;font-size:12px;font-weight:700">Sin conexión con Google Sheets</div>`;
  }
}

async function eliminarLogAccion(idx) {
  const cont  = document.getElementById('logac-resultado');
  if (!cont || !cont._logacData) return;
  const f = cont._logacData[idx];
  if (!f || !f.timestamp) return;
  const ok = await appConfirm(`<strong>${f.accion}</strong><br><span style="color:#8899aa">${f.nombre||f.numUsuario||''}</span>`, {
    titulo: '¿Eliminar esta entrada del log?', icono: '🗑️', labelOk: '🗑 Sí, eliminar', peligro: true
  });
  if (!ok) return;

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ accion: 'eliminarLogAccion', timestamp: f.timestamp })
    });
    const json = await resp.json();
    if (json.ok) {
      mostrarToast('✓ Entrada eliminada', 'success');
      cargarLogAcciones();
    } else {
      mostrarToast('Error: ' + (json.error||''), 'error');
    }
  } catch(e) { mostrarToast('Error de conexión', 'error'); }
}
