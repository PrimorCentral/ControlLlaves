// ════════════════════════════════════════════════════════════════════════════
// ADMIN LOGIN
// ════════════════════════════════════════════════════════════════════════════
// ¿El usuario que ha iniciado sesión tiene permiso de administrador?
function usuarioEsAdmin() {
  return !!usuarioActual && String(usuarioActual.admin || '').trim().toUpperCase() === 'SI';
}

function abrirLoginAdmin() {
  // El botón del panel solo se muestra a los usuarios con permiso de admin,
  // así que entran directamente, sin pedir contraseña.
  if (usuarioEsAdmin()) { abrirAdmin(); return; }
  // Seguridad: si alguien sin permiso llegara aquí, se sigue pidiendo la contraseña
  document.getElementById('inp-admin-password').value = '';
  document.getElementById('admin-error-msg').style.display = 'none';
  document.getElementById('modal-login-admin').classList.add('open');
  setTimeout(() => document.getElementById('inp-admin-password').focus(), 100);
}

async function verificarPasswordAdmin() {
  const val = document.getElementById('inp-admin-password').value;
  if (!val) return;

  // Mostrar estado de carga
  const btnEntrar   = document.getElementById('btn-admin-entrar');
  const btnCancelar = document.getElementById('btn-admin-cancelar');
  const loadingEl   = document.getElementById('admin-login-loading');
  const loadingMsg  = document.getElementById('admin-login-loading-msg');
  const inp         = document.getElementById('inp-admin-password');
  const subtitle    = document.getElementById('admin-login-subtitle');

  btnEntrar.disabled   = true;
  btnEntrar.textContent = '⏳ Verificando…';
  inp.disabled         = true;
  if (loadingEl) { loadingEl.style.display = 'flex'; }
  if (loadingMsg) loadingMsg.textContent = 'Consultando autorización…';
  document.getElementById('admin-error-msg').style.display = 'none';

  const hash = await hashStr(val);

  // Verificar contra Sheets primero; si falla, fallback a localStorage/hardcoded
  let hashRemoto = null;
  if (APPS_SCRIPT_URL) {
    try {
      const resp = await fetch(`${APPS_SCRIPT_URL}?accion=cargarConfigAdmin`, { redirect: 'follow' });
      const json = await resp.json();
      if (json.ok && json.adminHash) hashRemoto = json.adminHash;
    } catch(e) {
      if (loadingMsg) loadingMsg.textContent = 'Sin conexión — usando caché local…';
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Restaurar UI
  btnEntrar.disabled    = false;
  btnEntrar.textContent = 'Entrar';
  inp.disabled          = false;
  if (loadingEl) loadingEl.style.display = 'none';

  const hashEsperado = hashRemoto || localStorage.getItem('llaves_admin_hash') || ADMIN_PASS_HASH_DEFAULT;

  if (hash === hashEsperado) {
    localStorage.setItem('llaves_admin_hash', hashEsperado);
    document.getElementById('modal-login-admin').classList.remove('open');
    if (_pendingAdminCallback) {
      const cb = _pendingAdminCallback;
      _pendingAdminCallback = null;
      await cb();
    } else if (!usuarioActual) {
      // Viene del botón "Acceder como administrador" en la pantalla de login:
      // crear sesión de admin y entrar al cuadrante
      usuarioActual = { numUsuario: 'ADMIN', nombre: 'ADMINISTRADOR', rol: 'Admin' };
      actualizarHeader();
      document.getElementById('user-pill').style.display = 'flex';
      document.getElementById('user-pill-name').textContent = 'ADMINISTRADOR';
      document.getElementById('user-pill-sub').textContent  = 'Admin';
      mostrarPantallaLogin(false);
      await cargarCuadrante();
      if (typeof mantCargarResumen === 'function') mantCargarResumen();
      iniciarSync();
      iniciarTemporizadorSesion();
      abrirAdmin();
    } else {
      abrirAdmin();
    }
  } else {
    inp.classList.add('error');
    document.getElementById('admin-error-msg').style.display = 'block';
    inp.value = '';
    setTimeout(() => { inp.classList.remove('error'); inp.focus(); }, 400);
  }
}

function abrirAdmin() {
  document.getElementById('admin-config-url').value = APPS_SCRIPT_URL;
  renderAdminVehiculos();
  renderAdminStats();
  poblarSelectsMatricula();
  cambiarTab(null); // el panel se abre en blanco: el usuario elige la pestaña que quiere ver
  document.getElementById('modal-admin').classList.add('open');
}

function cerrarAdmin() {
  document.getElementById('modal-admin').classList.remove('open');
}

// ════════════════════════════════════════════════════════════════════════════
// PRESENCIA — USUARIOS ACTIVOS
// ════════════════════════════════════════════════════════════════════════════
let _heartbeatInterval = null;

/** Envía un heartbeat al Apps Script para registrar que este usuario sigue activo */
async function enviarHeartbeat() {
  if (!APPS_SCRIPT_URL || !usuarioActual) return;
  if (document.hidden) return;
  try {
    const _appVersion = document.querySelector('meta[name="app-version"]')?.getAttribute('content') || '—';
    const params = new URLSearchParams({
      accion:      'registrarPresencia',
      numUsuario:  usuarioActual.numUsuario || '',
      nombre:      usuarioActual.nombre     || '',
      rol:         usuarioActual.rol        || 'Responsable',
      version:     _appVersion,
    });
    await fetch(`${APPS_SCRIPT_URL}?${params}`, { redirect: 'follow' });
  } catch(e) {
    // silencioso — no interrumpir la app si falla
  }
}

/** Marca al usuario como desconectado en el Apps Script */
async function enviarDesconexion() {
  if (!APPS_SCRIPT_URL || !usuarioActual) return;
  try {
    const params = new URLSearchParams({
      accion:     'registrarDesconexion',
      numUsuario: usuarioActual.numUsuario || '',
    });
    await fetch(`${APPS_SCRIPT_URL}?${params}`, { redirect: 'follow' });
  } catch(e) { /* silencioso */ }
}

/** Inicia el heartbeat cada 30 segundos tras el login */
function iniciarHeartbeat() {
  detenerHeartbeat();
  enviarHeartbeat(); // inmediato al login
  _heartbeatInterval = setInterval(enviarHeartbeat, 60_000);
}

function detenerHeartbeat() {
  if (_heartbeatInterval) { clearInterval(_heartbeatInterval); _heartbeatInterval = null; }
}

/** Carga la lista de usuarios activos desde el Apps Script y la renderiza */
async function cargarUsuariosActivos() {
  const lista   = document.getElementById('activos-lista');
  const resumen = document.getElementById('activos-resumen');
  if (!lista) return;

  lista.innerHTML = `<div style="text-align:center;padding:30px 0;color:#8899aa;font-size:12px;font-weight:700">
    <div style="font-size:28px;margin-bottom:8px">⏳</div>Cargando sesiones…</div>`;

  if (!APPS_SCRIPT_URL) {
    lista.innerHTML = `<div style="text-align:center;padding:30px 0;color:#e84545;font-size:12px;font-weight:700">Sin URL de Apps Script configurada.</div>`;
    return;
  }

  try {
    const url  = `${APPS_SCRIPT_URL}?accion=cargarPresencia&_t=${Date.now()}`;
    const data = await fetch(url, { redirect: 'follow' }).then(r => r.json());
    const usuarios = data.usuarios || [];

    // ── Resumen ──
    if (resumen) {
      resumen.innerHTML = `
        <div style="background:white;border:1.5px solid #d1fae5;border-radius:10px;padding:12px 18px;display:flex;align-items:center;gap:10px">
          <div style="width:10px;height:10px;border-radius:50%;background:#2ecc71;box-shadow:0 0 0 4px rgba(46,204,113,0.2)"></div>
          <div>
            <div style="font-size:22px;font-weight:900;color:#1a1a2e">${usuarios.length}</div>
            <div style="font-size:10px;color:#6b7a94;font-weight:700;letter-spacing:0.5px">USUARIO${usuarios.length!==1?'S':''} ACTIVO${usuarios.length!==1?'S':''}</div>
          </div>
        </div>
        <div style="background:white;border:1.5px solid #dde1e8;border-radius:10px;padding:12px 18px">
          <div style="font-size:11px;color:#8899aa;font-weight:700">Última actualización</div>
          <div style="font-size:13px;font-weight:800;color:#1a1a2e">${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
        </div>`;
    }

    // ── Lista ──
    if (usuarios.length === 0) {
      lista.innerHTML = `<div style="text-align:center;padding:40px 0;color:#b0bac8;font-size:13px;font-weight:600">
        <div style="font-size:36px;margin-bottom:10px">😴</div>
        No hay usuarios con sesión iniciada en este momento</div>`;
      return;
    }

    lista.innerHTML = usuarios.map(u => {
      const hace      = u.hace || '—';
      const esReciente = (u.segundos || 999) < 60;
      const dotColor  = esReciente ? '#2ecc71' : '#f39c12';
      const dotShadow = esReciente ? 'rgba(46,204,113,0.25)' : 'rgba(243,156,18,0.25)';
      const etiqueta  = esReciente ? 'Activo ahora' : `Hace ${hace}`;
      return `
        <div style="display:flex;align-items:center;gap:12px;background:white;border:1.5px solid #e8eaf0;border-radius:10px;padding:12px 14px">
          <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};box-shadow:0 0 0 4px ${dotShadow};flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:800;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.nombre || '—'}</div>
            <div style="font-size:10px;color:#8899aa;font-weight:600;margin-top:1px">${u.rol || 'Responsable'} · Nº ${u.numUsuario || '—'}${u.version && u.version !== '—' ? ` &nbsp;<span style="display:inline-block;background:#eef2ff;color:#3b5bdb;border:1px solid #c5d0ff;border-radius:5px;padding:1px 7px;font-size:9px;font-weight:800;letter-spacing:0.5px;">${u.version}</span>` : ''}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:11px;font-weight:800;color:${dotColor}">${etiqueta}</div>
            <div style="font-size:10px;color:#b0bac8;font-weight:600;margin-top:1px">${u.ultimaVez || '—'}</div>
          </div>
        </div>`;
    }).join('');

  } catch(e) {
    lista.innerHTML = `<div style="text-align:center;padding:30px 0;color:#e84545;font-size:12px;font-weight:700">
      <div style="font-size:28px;margin-bottom:8px">⚠️</div>Error al cargar: ${e.message}</div>`;
  }
}

function cambiarTab(tab) {
  if (tab !== 'config' && typeof _rutasSinGuardar !== 'undefined' && _rutasSinGuardar) {
    _rutasPuedeSalirSinGuardar().then(puede => { if (puede) cambiarTab(tab); });
    return;
  }
  const homeWatermark = document.getElementById('admin-home-watermark');
  if (homeWatermark) homeWatermark.style.display = tab ? 'none' : 'flex';
  ['vehiculos','conductores','asignaciones','historial','log','reasignaciones','incidencias','repostajes','responsables','config','activos'].forEach(t => {
    document.getElementById('tab-btn-'+t).classList.toggle('active', t===tab);
    document.getElementById('tab-panel-'+t).classList.toggle('active', t===tab);
  });
  if (tab === 'historial') {
    if (!document.getElementById('hist-fecha-desde').value) {
      document.getElementById('hist-fecha-desde').value = fechaActual;
      document.getElementById('hist-fecha-hasta').value = fechaActual;
    }
  }
  if (tab === 'log') {
    if (!document.getElementById('log-fecha-desde').value) {
      document.getElementById('log-fecha-desde').value = fechaActual;
      document.getElementById('log-fecha-hasta').value = fechaActual;
    }
  }
  if (tab === 'reasignaciones') {
    if (!document.getElementById('reasig-fecha-desde').value) {
      document.getElementById('reasig-fecha-desde').value = fechaActual;
      document.getElementById('reasig-fecha-hasta').value = fechaActual;
    }
  }
  if (tab === 'incidencias') {
    if (!document.getElementById('incid-fecha-desde').value) {
      document.getElementById('incid-fecha-desde').value = fechaActual;
      document.getElementById('incid-fecha-hasta').value = fechaActual;
    }
  }
  if (tab === 'repostajes') {
    if (!document.getElementById('repo-tab-fecha-desde').value) {
      document.getElementById('repo-tab-fecha-desde').value = fechaActual;
      document.getElementById('repo-tab-fecha-hasta').value = fechaActual;
    }
  }
  if (tab === 'responsables') cargarResponsables();
  if (tab === 'conductores') renderAdminConductores();
  if (tab === 'asignaciones') abrirAdminAsignaciones();
  if (tab === 'config') cargarEstadoPassAdmin();
  if (tab === 'activos') cargarUsuariosActivos();
}

async function guardarConfigAdmin() {
  const url = document.getElementById('admin-config-url').value.trim();
  if (!url) { mostrarToast('Introduce la URL', 'error'); return; }
  APPS_SCRIPT_URL = url;
  localStorage.setItem('llaves_script_url', url);
  try {
    await sb.from('app_config').delete().eq('clave', 'appsScriptUrl');
    const { error } = await sb.from('app_config').insert({ clave: 'appsScriptUrl', valor: url });
    if (error) throw error;
    mostrarToast('✓ URL guardada. Reconectando…', 'success');
  } catch (e) {
    mostrarToast('URL aplicada en este navegador, pero no se pudo guardar en Supabase: ' + e.message, 'error');
  }
  verificarConfig();
  if (usuarioActual) cargarCuadrante();
}

async function cambiarPasswordAdmin() {
  const nueva   = document.getElementById('admin-pass-nueva').value;
  const confirm = document.getElementById('admin-pass-confirm').value;
  if (!nueva)            { mostrarToast('Introduce la nueva contraseña', 'error'); return; }
  if (nueva !== confirm) { mostrarToast('Las contraseñas no coinciden', 'error'); return; }
  if (nueva.length < 4)  { mostrarToast('Mínimo 4 caracteres', 'error'); return; }

  const hash = await hashStr(nueva);
  const btn = document.getElementById('btn-cambiar-pass');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

  let guardadoEnSheets = false;
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ accion: 'guardarConfigAdmin', adminHash: hash })
    });
    const json = await resp.json();
    guardadoEnSheets = json.ok;
  } catch(e) { /* sin conexión */ }

  // Guardar también en localStorage como caché offline
  localStorage.setItem('llaves_admin_hash', hash);

  document.getElementById('admin-pass-nueva').value = '';
  document.getElementById('admin-pass-confirm').value = '';
  if (btn) { btn.disabled = false; btn.textContent = '🚛 Cambiar y guardar en Sheets'; }

  if (guardadoEnSheets) {
    mostrarToast('✓ Contraseña guardada en Google Sheets', 'success');
    actualizarEstadoPassSync(true);
    registrarAccion('ADMIN', 'Cambiar contraseña de administrador', 'Contraseña actualizada en Sheets');
  } else {
    mostrarToast('⚠️ Guardado solo en local (sin conexión a Sheets)', 'error');
    actualizarEstadoPassSync(false, 'Solo en caché local — reconecta para sincronizar');
  }
}

async function cargarEstadoPassAdmin() {
  const icon = document.getElementById('admin-pass-sync-icon');
  const text = document.getElementById('admin-pass-sync-text');
  if (!icon || !text) return;
  if (!APPS_SCRIPT_URL) {
    actualizarEstadoPassSync(false, 'Sin URL de Apps Script configurada');
    return;
  }
  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?accion=cargarConfigAdmin`, { redirect: 'follow' });
    const json = await resp.json();
    if (json.ok && json.adminHash) {
      actualizarEstadoPassSync(true, 'Contraseña sincronizada en Google Sheets ✓');
    } else {
      actualizarEstadoPassSync(false, 'Sin contraseña en Sheets — se usará la predeterminada');
    }
  } catch(e) {
    actualizarEstadoPassSync(false, 'No se pudo conectar con Sheets');
  }
}

function actualizarEstadoPassSync(ok, msg) {
  const icon = document.getElementById('admin-pass-sync-icon');
  const text = document.getElementById('admin-pass-sync-text');
  if (!icon || !text) return;
  if (ok) {
    icon.textContent = '✅';
    text.textContent = msg || 'Contraseña sincronizada en Google Sheets';
    text.style.color = '#2ecc71';
  } else {
    icon.textContent = '⚠️';
    text.textContent = msg || 'Contraseña no sincronizada';
    text.style.color = '#e84545';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// DEVOLUCIONES PENDIENTES DEL TURNO ANTERIOR
// ════════════════════════════════════════════════════════════════════════════

// Llama a Sheets para buscar filas donde este responsable entregó llaves
// (resp_entrega = su nombre) en fechas anteriores a hoy, con operario relleno
// pero hora_devolucion vacía.
// Clave de localStorage donde guardamos los pendientes sin resolver
function _devolStorageKey() {
  return 'devol_pendientes_' + (usuarioActual.numUsuario || usuarioActual.nombre);
}

async function comprobarDevolPendientes() {
  if (!APPS_SCRIPT_URL || !usuarioActual) return;

  const hoy = new Date().toISOString().slice(0, 10);

  try {
    // SIEMPRE consultar el servidor primero — es la fuente de verdad.
    // El localStorage solo se usa si no hay conexión.
    const url = `${APPS_SCRIPT_URL}?accion=devolPendientes&responsable=${encodeURIComponent(usuarioActual.nombre)}&hoy=${encodeURIComponent(hoy)}`;
    const resp = await fetch(url, { redirect: 'follow' });
    const json = await resp.json();

    if (!json.ok || !json.pendientes || json.pendientes.length === 0) {
      // El servidor dice que no hay pendientes (o ya fueron resueltos desde fuera)
      // → limpiar caché local por si quedó algo antiguo
      localStorage.removeItem(_devolStorageKey());
      return;
    }

    // Hay pendientes reales según el servidor → guardar en caché y mostrar modal
    localStorage.setItem(_devolStorageKey(), JSON.stringify(json.pendientes));
    abrirModalDevolPendientes(json.pendientes);

  } catch(e) {
    // Sin conexión — usar caché local si existe para no perder el aviso
    const cached = localStorage.getItem(_devolStorageKey());
    if (cached) {
      try {
        const pendientesCached = JSON.parse(cached);
        if (pendientesCached && pendientesCached.length > 0) {
          abrirModalDevolPendientes(pendientesCached);
        }
      } catch(e2) { localStorage.removeItem(_devolStorageKey()); }
    }
  }
}

let _devolPendientesList = [];

function abrirModalDevolPendientes(pendientes) {
  _devolPendientesList = pendientes;
  const modal = document.getElementById('modal-devol-pendientes');
  const lista = document.getElementById('dp-lista');
  const sub   = document.getElementById('dp-head-sub');

  // Agrupar por turno+fecha para el subtítulo
  const resumen = [...new Set(pendientes.map(p => {
    const f = (p.fecha || '').split('-').reverse().join('/');
    const t = p.turno === 'MANANA' ? 'Mañana' : 'Tarde';
    return `${t} ${f}`;
  }))].join(', ');
  sub.textContent = resumen || 'Turno anterior';

  lista.innerHTML = pendientes.map((p, i) => {
    const f = (p.fecha || '').split('-').reverse().join('/');
    const turnoLabel = p.turno === 'MANANA' ? 'Mañana' : 'Tarde';
    return `
    <div class="dp-item">
      <div class="dp-item-mat">${p.matricula || '—'}</div>
      <div class="dp-item-info">
        <div class="dp-item-op">${p.operario || '—'}</div>
        <div class="dp-item-meta">${turnoLabel} · ${f} · Entregada a las ${p.hora_entrega || '—'}</div>
      </div>
      <div class="dp-item-hora">
        <input
          class="dp-hora-input"
          type="time"
          id="dp-hora-${i}"
          placeholder="HH:MM"
          oninput="onDpHoraInput(this)"
          title="Hora de devolución de ${p.matricula}">
      </div>
    </div>`;
  }).join('');

  modal.classList.add('visible');
}

function onDpHoraInput(el) {
  el.classList.toggle('filled', el.value !== '');
}

function cerrarModalDevolPendientes(guardado) {
  document.getElementById('modal-devol-pendientes').classList.remove('visible');
  if (guardado) {
    // Limpiar caché local y ocultar banner
    if (usuarioActual) localStorage.removeItem(_devolStorageKey());
    const banner = document.getElementById('banner-devol-pendientes');
    if (banner) banner.classList.remove('visible');
  }
  // Si no se guardó, el modal simplemente se oculta visualmente pero los datos
  // siguen en localStorage: la próxima vez que entre a la app volverá a aparecer.
}

function reabrirModalDevolPendientes() {
  if (_devolPendientesList && _devolPendientesList.length > 0) {
    document.getElementById('modal-devol-pendientes').classList.add('visible');
  }
}

async function guardarDevolPendientes() {
  const btn = document.getElementById('dp-btn-guardar');
  const pendientes = _devolPendientesList;

  // Recoger horas introducidas
  const items = pendientes.map((p, i) => {
    const inputEl = document.getElementById('dp-hora-' + i);
    return { ...p, hora_devolucion: inputEl ? inputEl.value : '' };
  });

  const sinHora = items.filter(it => !it.hora_devolucion);
  if (sinHora.length > 0) {
    mostrarToast(`Introduce la hora de devolución de ${sinHora.length} vehículo(s)`, 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Guardando…';

  let errores = 0;
  for (const item of items) {
    try {
      const fila = {
        fecha:           item.fecha,
        turno:           item.turno,
        matricula:       item.matricula,
        tipo:            item.tipo || '',
        operario:        item.operario        || '',
        resp_entrega:    item.resp_entrega     || '',
        resp_recibe:     usuarioActual ? usuarioActual.nombre : (item.resp_recibe || ''),
        hora_entrega:    item.hora_entrega     || '',
        hora_devolucion: item.hora_devolucion,
        num_tarjeta:     item.num_tarjeta      || '',
        itv:             item.itv              || '',
        incidencias:     item.incidencias      || '',
      };
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, redirect: 'follow',
        body: JSON.stringify({ accion: 'guardarFila', fila }),
      });
      const json = await resp.json();
      if (!json.ok) errores++;
    } catch(e) {
      errores++;
    }
  }

  btn.disabled = false;
  btn.textContent = '💾 Guardar devoluciones';

  if (errores === 0) {
    mostrarToast(`✓ ${items.length} devolución(es) registradas correctamente`, 'success');
    cerrarModalDevolPendientes(true);
  } else {
    mostrarToast(`⚠️ ${errores} devolución(es) no se pudieron guardar`, 'error');
  }
}


