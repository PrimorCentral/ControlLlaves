// ════════════════════════════════════════════════════════════════════════════
// RESPONSABLES
// ════════════════════════════════════════════════════════════════════════════
let responsablesCache = [];

async function cargarResponsables() {
  if (!APPS_SCRIPT_URL) return;
  const lista = document.getElementById('admin-lista-responsables');
  if (lista) lista.innerHTML = '<div style="padding:12px;color:#8899aa;font-size:12px">⏳ Cargando responsables…</div>';
  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?accion=cargarResponsables`, { redirect:'follow' });
    const json = await resp.json();
    responsablesCache = json.responsables || [];

    renderAdminResponsables();
  } catch(e) {
    if (lista) lista.innerHTML = '<div style="padding:12px;color:#e84545;font-size:12px">⚠️ Error al cargar: ' + e.message + '</div>';
  }
}

function renderAdminResponsables() {
  const lista = document.getElementById('admin-lista-responsables');
  const filtro = (document.getElementById('resp-filtro')?.value || '').trim().toUpperCase();

  // ── Stats ──────────────────────────────────────────────────────────────────
  const statsEl = document.getElementById('resp-stats');
  if (statsEl) {
    const total   = responsablesCache.length;
    const admins  = responsablesCache.filter(r => {
      const val = r.admin ?? r.Admin ?? r.ADMIN ?? '';
      return String(val).trim().toUpperCase() === 'SI';
    }).length;
    const naves   = new Set(responsablesCache.map(r => (r.nave || r.rol || '').toUpperCase()).filter(Boolean));
    const roles   = new Set(responsablesCache.map(r => r.rol||'').filter(Boolean));
    statsEl.innerHTML = `
      <div class="admin-stat-card">
        <div class="admin-stat-icon">👥</div>
        <div class="admin-stat-num">${total}</div>
        <div class="admin-stat-label">Responsables</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon">🔐</div>
        <div class="admin-stat-num" style="color:#e84545">${admins}</div>
        <div class="admin-stat-label">Administradores</div>
        <div class="admin-stat-sub">Acceso total</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon">🏷️</div>
        <div class="admin-stat-num">${roles.size}</div>
        <div class="admin-stat-label">Naves distintas</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon">🔍</div>
        <div class="admin-stat-num" id="resp-stat-visible">${total}</div>
        <div class="admin-stat-label">Resultados</div>
        <div class="admin-stat-sub">con filtro activo</div>
      </div>`;
  }

  if (!responsablesCache.length) {
    lista.innerHTML = `<div style="padding:32px 16px;text-align:center;">
      <div style="font-size:36px;margin-bottom:10px">👥</div>
      <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:4px">Sin responsables registrados</div>
      <div style="font-size:11px;color:#8899aa">Añade el primer responsable con el botón de arriba</div>
    </div>`;
    return;
  }

  // ── Filtrado ───────────────────────────────────────────────────────────────
  const visible = responsablesCache.filter(r =>
    !filtro ||
    (r.nombre||'').toUpperCase().includes(filtro) ||
    String(r.numUsuario||'').includes(filtro) ||
    (r.rol||'').toUpperCase().includes(filtro)
  );

  const visEl = document.getElementById('resp-stat-visible');
  if (visEl) visEl.textContent = visible.length;

  if (!visible.length) {
    lista.innerHTML = `<div style="padding:32px 16px;text-align:center;">
      <div style="font-size:36px;margin-bottom:10px">🔍</div>
      <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:4px">Sin resultados</div>
      <div style="font-size:11px;color:#8899aa">No hay responsables que coincidan con la búsqueda</div>
    </div>`;
    return;
  }

  // ── Agrupar por rol ────────────────────────────────────────────────────────
  const porRol = {};
  visible.forEach(r => {
    const rol = r.rol || 'Sin rol';
    if (!porRol[rol]) porRol[rol] = [];
    porRol[rol].push(r);
  });

  // Colores por inicial
  const COLORES = ['#e84545','#3b5bdb','#16a34a','#d97706','#7c3aed','#0369a1','#b45309','#065f46'];

  lista.innerHTML = Object.entries(porRol).sort(([a],[b]) => a.localeCompare(b)).map(([rol, items]) => {
    const filas = items.map(r => {
      const idx = responsablesCache.indexOf(r);
      const partes = (r.nombre||'').trim().split(' ');
      const iniciales = ((partes[0]?.[0]||'') + (partes[1]?.[0]||'')).toUpperCase();
      const col = COLORES[((r.nombre||'').charCodeAt(0)||0) % COLORES.length];
      const esAdmin = String(r.admin ?? r.Admin ?? r.ADMIN ?? '').trim().toUpperCase() === 'SI';
      return `<div class="admin-item" style="padding:10px 14px;align-items:center;gap:12px;">
        <div style="width:38px;height:38px;border-radius:10px;background:${col};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:white;flex-shrink:0;">${iniciales||'?'}</div>
        <div style="display:flex;flex-direction:column;flex:1;min-width:0;gap:3px;">
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:900;color:#1a1a2e;">${esc(r.nombre||'—')}</span>
            ${esAdmin ? `<span style="font-size:8px;font-weight:900;color:#fff;background:#e84545;border-radius:4px;padding:2px 7px;letter-spacing:1px;">ADMIN</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-size:10px;font-weight:800;color:#3b5bdb;background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px;padding:1px 8px;">Nº ${esc(String(r.numUsuario||'—'))}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
          <button class="btn-item-action btn-bloquear" onclick="eliminarResponsable(${idx})" style="font-size:11px;padding:6px 12px;">🗑 Eliminar</button>
        </div>
      </div>`;
    }).join('');

    // Icono y color por rol
    const rolUpper = rol.toUpperCase();
    let rolColor = '#6b7a94', rolBg = '#f4f6fb', rolBorder = '#e2e8f0';
    if (rolUpper.includes('ADMIN'))      { rolColor='#b91c1c'; rolBg='#fff5f5'; rolBorder='#fecaca'; }
    else if (rolUpper.includes('RESP'))  { rolColor='#1d4ed8'; rolBg='#eff6ff'; rolBorder='#bfdbfe'; }
    else if (rolUpper.includes('COORD')) { rolColor='#7c3aed'; rolBg='#f5f3ff'; rolBorder='#ddd6fe'; }

    return `<div style="margin-bottom:6px;">
      <div style="font-size:9px;font-weight:900;letter-spacing:2px;color:${rolColor};text-transform:uppercase;padding:8px 6px 5px;display:flex;align-items:center;gap:8px;border-top:2px solid ${rolBorder};background:${rolBg};border-radius:8px 8px 0 0;margin-bottom:2px;">
        <span style="background:${rolColor};color:white;border-radius:4px;padding:2px 8px;font-size:8px;">${esc(rol.toUpperCase())}</span>
        <span style="font-size:9px;font-weight:700;color:#6b7a94;background:white;border-radius:4px;padding:1px 7px;border:1px solid ${rolBorder};">${items.length} responsable${items.length!==1?'s':''}</span>
      </div>
      ${filas}
    </div>`;
  }).join('');
}

var _adminChecked = false;
function toggleAdminSwitch() {
  _adminChecked = !_adminChecked;
  document.getElementById('modal-resp-admin-track').style.background = _adminChecked ? '#e84545' : '#ccd1db';
  document.getElementById('modal-resp-admin-knob').style.transform    = _adminChecked ? 'translateX(18px)' : 'translateX(0)';
}
function abrirModalNuevoResponsable() {
  ['modal-resp-num','modal-resp-nombre','modal-resp-clave','modal-resp-rol'].forEach(id => document.getElementById(id).value = '');
  _adminChecked = false;
  document.getElementById('modal-resp-admin-track').style.background = '#ccd1db';
  document.getElementById('modal-resp-admin-knob').style.transform    = 'translateX(0)';
  document.getElementById('modal-nuevo-responsable').style.display = 'flex';
  setTimeout(() => document.getElementById('modal-resp-num').focus(), 100);
}
function cerrarModalNuevoResponsable() {
  document.getElementById('modal-nuevo-responsable').style.display = 'none';
}
async function confirmarNuevoResponsable() {
  const num    = document.getElementById('modal-resp-num').value.trim();
  const nombre = document.getElementById('modal-resp-nombre').value.trim().toUpperCase();
  const clave  = document.getElementById('modal-resp-clave').value.trim();
  const rol    = document.getElementById('modal-resp-rol').value.trim();
  const admin  = _adminChecked ? 'SI' : '';
  if (!num)    { mostrarToast('El Nº de usuario es obligatorio', 'error'); return; }
  if (!nombre) { mostrarToast('El nombre es obligatorio', 'error'); return; }
  if (!clave)  { mostrarToast('La clave es obligatoria', 'error'); return; }
  if (!rol)    { mostrarToast('El rol es obligatorio', 'error'); return; }
  const hashClave = await hashStr(clave);
  const btnAdd = document.querySelector('[onclick="confirmarNuevoResponsable()"]');
  if (btnAdd) { btnAdd.disabled = true; btnAdd.textContent = '⏳ Guardando…'; }
  try {
    const res  = await fetch(APPS_SCRIPT_URL, { method:'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ accion:'añadirResponsable', responsable: { numUsuario: num, nombre, hashClave, rol, admin } }) });
    const json = await res.json();
    if (json.ok) {
      cerrarModalNuevoResponsable();
      registrarAccion('ADMIN', 'Añadir responsable', `${nombre} · Nº${num} · rol: ${rol}${admin==='SI'?' · ADMIN':''}`);
      mostrarToast(`✓ ${nombre} añadido`, 'success');
      // Actualizar cache local inmediatamente
      responsablesCache.push({ numUsuario: num, nombre, rol });
      renderAdminResponsables();
      // Recargar desde servidor en segundo plano
      setTimeout(() => cargarResponsables(), 2000);
    } else {
      mostrarToast(json.error || 'Error al añadir', 'error');
    }
  } catch(e) {
    mostrarToast('Error: ' + e.message, 'error');
  } finally {
    if (btnAdd) { btnAdd.disabled = false; btnAdd.textContent = '✓ Añadir responsable'; }
  }
}
  
async function añadirResponsable() {
  const num    = document.getElementById('resp-num').value.trim();
  const nombre = document.getElementById('resp-nombre').value.trim();
  const clave  = document.getElementById('resp-clave').value;
  const rol    = document.getElementById('resp-rol').value.trim() || 'Responsable';
  if (!num || !nombre || !clave) { mostrarToast('Completa número, nombre y clave', 'error'); return; }
  if (!APPS_SCRIPT_URL) { mostrarToast('Sin URL de Apps Script configurada', 'error'); return; }

  const btnAdd = document.querySelector('[onclick="añadirResponsable()"]');
  if (btnAdd) { btnAdd.disabled = true; btnAdd.textContent = '⏳ Guardando…'; }

  try {
    const hashClave = await hashStr(clave);
    const resp = await fetch(APPS_SCRIPT_URL, {
      method:'POST', headers:{'Content-Type':'text/plain'},
      body: JSON.stringify({ accion:'añadirResponsable', responsable: { numUsuario: num, nombre, hashClave, rol } }),
      redirect:'follow'
    });
    const json = await resp.json();
    if (json.ok) {
      mostrarToast(`✓ ${nombre} añadido`, 'success');
      ['resp-num','resp-nombre','resp-clave','resp-rol'].forEach(id => document.getElementById(id).value = '');
      // Actualizar cache local inmediatamente sin esperar al servidor
      responsablesCache.push({ numUsuario: num, nombre, rol });
      renderAdminResponsables();
      // Recargar desde servidor en segundo plano (silencioso)
      setTimeout(() => cargarResponsables(), 2000);
    } else {
      mostrarToast(json.error || 'Error al añadir', 'error');
    }
  } catch(e) {
    mostrarToast('Error de red: ' + e.message, 'error');
  } finally {
    if (btnAdd) { btnAdd.disabled = false; btnAdd.textContent = '+ Añadir responsable'; }
  }
}

async function eliminarResponsable(idx) {
  const r = responsablesCache[idx];
  const ok = await appConfirm(`¿Eliminar al responsable <strong>${r.nombre}</strong>?`, { titulo: 'Eliminar responsable', icono: '🗑️', labelOk: '🗑 Sí, eliminar', peligro: true });
  if (!ok) return;
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method:'POST', headers:{'Content-Type':'text/plain'},
      body: JSON.stringify({ accion:'eliminarResponsable', numUsuario: r.numUsuario }),
      redirect:'follow'
    });
    const json = await resp.json();
    if (json.ok) {
      registrarAccion('ADMIN', 'Eliminar responsable', `${r.nombre} · Nº${r.numUsuario}`);
      mostrarToast('Responsable eliminado', 'info');
      // Actualizar cache local inmediatamente
      responsablesCache.splice(idx, 1);
      renderAdminResponsables();
      // Recargar desde servidor en segundo plano (silencioso)
      setTimeout(() => cargarResponsables(), 2000);
    } else {
      mostrarToast(json.error || 'Error', 'error');
    }
  } catch(e) { mostrarToast('Error: ' + e.message, 'error'); }
}

