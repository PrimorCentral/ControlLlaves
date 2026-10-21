// ════════════════════════════════════════════════════════════════════════════
// GESTIÓN VEHÍCULOS
// ════════════════════════════════════════════════════════════════════════════
function moverVehiculoOrden(gi, vi, direccion) {
  const arr = GRUPOS[gi].vehiculos;
  const nvi = vi + direccion;
  if (nvi < 0 || nvi >= arr.length) return;
  // Intercambiamos el valor de 'orden' entre los dos vehículos afectados
  const ordenA = arr[vi].orden, ordenB = arr[nvi].orden;
  arr[vi].orden  = ordenB;
  arr[nvi].orden = ordenA;
  // Y su posición en el array, para que se refleje al instante
  [arr[vi], arr[nvi]] = [arr[nvi], arr[vi]];
  renderAdminVehiculos();
  sincronizarVehiculosConSheets();
}

// ── Estado de la vista (filtros) ─────────────────────────────────────────────
let _admVehNave = '';          // '' = todas las naves
let _admVehBusqueda = '';
let _admVehVerBajas = false;
let _admVehAvisoAbierto = false;

const _ADM_ICO = {
  edit:   'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  clock:  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  file:   'M6 3h8l4 4v14H6zM14 3v4h4',
  up:     'M12 19V5M6 11l6-6 6 6',
  down:   'M12 5v14M6 13l6 6 6-6',
  lock:   'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  unlock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2',
  ban:    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
  check:  'M5 12l5 5 9-10',
  archive:'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  restore:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  alert:  'M12 3l9 16H3zM12 10v4M12 17h.01',
  ok:     'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',
  dots:   'M5 12h.01M12 12h.01M19 12h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4'
};
function _admIco(n) { return `<svg class="adm-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${_ADM_ICO[n]}"/></svg>`; }

function _admItvInfo(v, hoy) {
  if (!v.itv_fin) return { cls: 'na', txt: 'Sin fecha', dias: Infinity };
  const dias = Math.ceil((new Date(v.itv_fin + 'T00:00:00') - hoy) / 86400000);
  if (dias <= 0)  return { cls: 'bad',  txt: 'Caducada · ' + fmtFechaITV(v.itv_fin), dias };
  if (dias <= 30) return { cls: 'warn', txt: `Vence en ${dias} d · ${fmtFechaITV(v.itv_fin)}`, dias };
  if (dias <= 60) return { cls: 'warn', txt: `Vence en ${dias} d · ${fmtFechaITV(v.itv_fin)}`, dias };
  return { cls: 'ok', txt: fmtFechaITV(v.itv_fin), dias };
}

function renderAdminVehiculos() {
  const lista = document.getElementById('admin-lista-vehiculos');
  if (!lista) return;
  cerrarMenuVehiculo();
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  let html = '';

  // ── Aviso de ITV (caducadas, ≤60 días o sin fecha) ─────────────────────────
  const itvAlertas = [];
  GRUPOS.forEach((grupo, gi) => grupo.vehiculos.forEach((v, vi) => {
    if (v.archivado) return;
    const info = _admItvInfo(v, hoy);
    if (info.cls !== 'ok') itvAlertas.push({ v, gi, vi, info });
  }));
  itvAlertas.sort((a, b) => a.info.dias - b.info.dias);

  if (!itvAlertas.length) {
    html += `<div class="adm-aviso ok" role="status"><div class="adm-aviso-head">${_admIco('ok')}<span>Todas las ITV están en vigor, sin vencimientos en los próximos 60 días.</span></div></div>`;
  } else {
    const n = itvAlertas.length;
    html += `<div class="adm-aviso" role="status">
      <div class="adm-aviso-head">${_admIco('alert')}
        <span><strong>${n} vehículo${n>1?'s':''}</strong> con la ITV caducada, a punto de vencer o sin fecha registrada.</span>
        <button type="button" class="adm-link" onclick="toggleAvisoITV()" aria-expanded="${_admVehAvisoAbierto}">${_admVehAvisoAbierto ? 'Ocultar' : 'Ver vencimientos'}</button>
      </div>
      ${_admVehAvisoAbierto ? `<div class="adm-aviso-lista">${itvAlertas.map(({ v, gi, vi, info }) => `
        <div class="adm-aviso-item">
          <span class="adm-mat">${esc(v.matricula)}</span>
          <span class="adm-aviso-tipo">${esc(v.tipo)} · ${esc(GRUPOS[gi].nombre)}</span>
          <span class="adm-pill ${info.cls}">${esc(info.txt)}</span>
          <button type="button" class="adm-btn adm-btn-sm" onclick="editarITV(${gi},${vi})">Actualizar ITV</button>
        </div>`).join('')}</div>` : ''}
    </div>`;
  }

  // ── Barra de filtros ──────────────────────────────────────────────────────
  const activosDe = g => g.vehiculos.filter(v => !v.archivado).length;
  const totalActivos = GRUPOS.reduce((s, g) => s + activosDe(g), 0);
  const totalBajas = GRUPOS.reduce((s, g) => s + g.vehiculos.filter(v => v.archivado).length, 0);
  if (_admVehNave && !GRUPOS.some(g => g.nombre === _admVehNave)) _admVehNave = '';
  const seg = [`<button type="button" class="${_admVehNave===''?'on':''}" onclick="filtrarNaveVehiculos('')">Todas · ${totalActivos}</button>`]
    .concat(GRUPOS.map((g, gi) => !g.vehiculos.length ? '' :
      `<button type="button" class="${_admVehNave===g.nombre?'on':''}" onclick="filtrarNaveVehiculos(GRUPOS[${gi}].nombre)">${esc(g.nombre)} · ${activosDe(g)}</button>`)).join('');

  html += `<div class="adm-card">
    <div class="adm-toolbar">
      <div class="adm-seg" role="group" aria-label="Filtrar por nave">${seg}</div>
      <div class="adm-toolbar-right">
        ${totalBajas ? `<label class="adm-check"><input type="checkbox" ${_admVehVerBajas?'checked':''} onchange="toggleVerBajasVehiculos(this.checked)"> Mostrar bajas (${totalBajas})</label>` : ''}
        <label class="adm-search">${_admIco('search')}<span class="adm-sr">Buscar vehículo</span>
          <input type="search" id="adm-veh-buscar" placeholder="Buscar matrícula, tipo o proveedor…" value="${esc(_admVehBusqueda)}" oninput="buscarVehiculosAdmin(this.value)">
        </label>
      </div>
    </div>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr>
          <th scope="col">Matrícula</th><th scope="col">Tipo</th><th scope="col">Nave</th><th scope="col">Propiedad</th>
          <th scope="col">ITV</th><th scope="col">Estado</th><th scope="col"><span class="adm-sr">Acciones</span></th>
        </tr></thead>
        <tbody id="adm-veh-tbody">${_admFilasVehiculos(hoy)}</tbody>
      </table>
    </div>
  </div>`;

  html += `<div id="adm-docs-migracion"></div>`;
  lista.innerHTML = html;
  if (typeof pintarAvisoMigracionDocs === 'function') pintarAvisoMigracionDocs();
}

function _admFilasVehiculos(hoy) {
  hoy = hoy || (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const q = _admVehBusqueda.trim().toUpperCase();
  let filas = '';
  GRUPOS.forEach((grupo, gi) => {
    if (_admVehNave && grupo.nombre !== _admVehNave) return;
    grupo.vehiculos.forEach((v, vi) => {
      if (v.archivado && !_admVehVerBajas) return;
      if (q && ![v.matricula, v.tipo, v.nota, grupo.nombre].some(x => (x||'').toUpperCase().includes(q))) return;

      const nota = (v.nota||'').trim();
      const prop = nota.toUpperCase() === 'PROPIEDAD' ? 'Propia' : (nota ? `Alquiler · ${esc(nota)}` : 'Alquiler');
      const itv = _admItvInfo(v, hoy);

      let estado;
      if (v.archivado) estado = `<span class="adm-estado"><span class="adm-dot na"></span>De baja</span>`;
      else if (v.bloqueado) {
        const quien = [v.bloqueado_por, v.fecha_bloqueo ? _fmtFechaHoraBloqueo(v.fecha_bloqueo) : ''].filter(Boolean).join(' · ');
        estado = `<span class="adm-estado"><span class="adm-dot bad"></span>Bloqueado</span>
          <span class="adm-estado-motivo">${esc(v.motivo_bloqueo||'Sin motivo')}${quien ? ' · ' + esc(quien) : ''}</span>`;
      }
      else if (v.restringido) estado = `<span class="adm-estado"><span class="adm-dot warn"></span>Restringido</span>`;
      else estado = `<span class="adm-estado"><span class="adm-dot ok"></span>Libre</span>`;

      const cls = v.archivado ? 'baja' : (v.bloqueado ? 'bloq' : '');
      filas += `<tr class="${cls}">
        <td><span class="adm-mat">${esc(v.matricula)}</span>${v.archivado ? '<span class="adm-tag baja">BAJA</span>' : ''}</td>
        <td>${esc(v.tipo)}</td>
        <td>${esc(grupo.nombre)}</td>
        <td>${prop}</td>
        <td>${v.archivado ? '—' : `<span class="adm-pill ${itv.cls}">${esc(itv.txt)}</span>`}</td>
        <td>${estado}</td>
        <td class="acciones">
          <button type="button" class="adm-btn adm-btn-sm" onclick="editarVehiculo(${gi},${vi})">Editar</button>
          <button type="button" class="adm-icon-btn" aria-label="Más acciones para ${esc(v.matricula)}" aria-haspopup="menu" aria-expanded="false" onclick="abrirMenuVehiculo(event,${gi},${vi})">${_admIco('dots')}</button>
        </td>
      </tr>`;
    });
  });
  if (!filas) filas = `<tr><td class="vacio" colspan="7">No hay vehículos que coincidan con el filtro.</td></tr>`;
  return filas;
}

function filtrarNaveVehiculos(nave) { _admVehNave = nave; renderAdminVehiculos(); }
function toggleVerBajasVehiculos(on) { _admVehVerBajas = on; renderAdminVehiculos(); }
function toggleAvisoITV() { _admVehAvisoAbierto = !_admVehAvisoAbierto; renderAdminVehiculos(); }
function buscarVehiculosAdmin(txt) {
  _admVehBusqueda = txt || '';
  cerrarMenuVehiculo();
  const tb = document.getElementById('adm-veh-tbody');
  if (tb) tb.innerHTML = _admFilasVehiculos();
}

// ── Menú de acciones (⋯) ─────────────────────────────────────────────────────
let _admMenuEl = null, _admMenuBtn = null;

function cerrarMenuVehiculo() {
  if (_admMenuEl) { _admMenuEl.remove(); _admMenuEl = null; }
  if (_admMenuBtn) { _admMenuBtn.setAttribute('aria-expanded', 'false'); _admMenuBtn = null; }
  document.removeEventListener('mousedown', _admMenuFuera, true);
  document.removeEventListener('keydown', _admMenuTeclas, true);
  window.removeEventListener('resize', cerrarMenuVehiculo);
  const wrap = document.querySelector('#tab-panel-vehiculos');
  if (wrap) wrap.removeEventListener('scroll', cerrarMenuVehiculo, true);
}
function _admMenuFuera(e) {
  if (_admMenuEl && !_admMenuEl.contains(e.target) && e.target !== _admMenuBtn && !_admMenuBtn?.contains(e.target)) cerrarMenuVehiculo();
}
function _admMenuTeclas(e) {
  if (!_admMenuEl) return;
  const items = [..._admMenuEl.querySelectorAll('button:not(:disabled)')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const b = _admMenuBtn; cerrarMenuVehiculo(); b && b.focus(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  else if (e.key === 'ArrowUp')   { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  else if (e.key === 'Tab') cerrarMenuVehiculo();
}

function abrirMenuVehiculo(ev, gi, vi) {
  ev.stopPropagation();
  const btn = ev.currentTarget;
  if (_admMenuBtn === btn) { cerrarMenuVehiculo(); return; }
  cerrarMenuVehiculo();
  const v = GRUPOS[gi].vehiculos[vi];
  const n = GRUPOS[gi].vehiculos.length;

  const items = [
    { ico: 'edit',   txt: 'Editar datos',    fn: () => editarVehiculo(gi, vi) },
    { ico: 'clock',  txt: 'Fecha de ITV',    fn: () => editarITV(gi, vi) },
    { ico: 'shield', txt: 'Seguro',          fn: () => editarSeguro(gi, vi) },
    { ico: 'file',   txt: 'Documentos',      fn: () => abrirGestorDocumentos(v.matricula) },
    'sep',
    { ico: 'up',     txt: 'Subir en la lista', fn: () => moverVehiculoOrden(gi, vi, -1), off: vi === 0 },
    { ico: 'down',   txt: 'Bajar en la lista', fn: () => moverVehiculoOrden(gi, vi, 1),  off: vi === n - 1 },
  ];
  if (!v.archivado) {
    items.push('sep',
      v.restringido
        ? { ico: 'unlock', txt: 'Permitir a todos', fn: () => toggleRestringido(gi, vi) }
        : { ico: 'lock',   txt: 'Restringir acceso', fn: () => toggleRestringido(gi, vi) },
      v.bloqueado
        ? { ico: 'check', txt: 'Desbloquear',       fn: () => desbloquearVehiculoAdmin(gi, vi), cls: 'exito' }
        : { ico: 'ban',   txt: 'Bloquear vehículo', fn: () => abrirModalBloqueo(gi, vi), cls: 'peligro' },
      'sep',
      { ico: 'archive', txt: 'Dar de baja', fn: () => eliminarVehiculo(gi, vi), cls: 'peligro' });
  } else {
    items.push('sep', { ico: 'restore', txt: 'Dar de alta', fn: () => desarchivarVehiculo(gi, vi), cls: 'exito' });
  }

  const menu = document.createElement('div');
  menu.className = 'adm-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', `Acciones para ${v.matricula}`);
  items.forEach(it => {
    if (it === 'sep') { const s = document.createElement('div'); s.className = 'adm-menu-sep'; menu.appendChild(s); return; }
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    if (it.cls) b.className = it.cls;
    b.disabled = !!it.off;
    b.innerHTML = _admIco(it.ico) + `<span>${it.txt}</span>`;
    b.onclick = () => { cerrarMenuVehiculo(); it.fn(); };
    menu.appendChild(b);
  });
  document.body.appendChild(menu);

  // Posición: debajo del botón, alineado a la derecha; si no cabe, encima
  const r = btn.getBoundingClientRect();
  const mh = menu.offsetHeight, mw = menu.offsetWidth;
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  const left = Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8));
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';

  _admMenuEl = menu; _admMenuBtn = btn;
  btn.setAttribute('aria-expanded', 'true');
  document.addEventListener('mousedown', _admMenuFuera, true);
  document.addEventListener('keydown', _admMenuTeclas, true);
  window.addEventListener('resize', cerrarMenuVehiculo);
  const wrap = document.querySelector('#tab-panel-vehiculos');
  if (wrap) wrap.addEventListener('scroll', cerrarMenuVehiculo, true);
  const primero = menu.querySelector('button:not(:disabled)');
  if (primero) primero.focus();
}

function renderAdminStats() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  let total=0, restringidos=0, alquiler=0, bloqueados=0, itvAlerta=0, bajas=0;
  const proveedores = new Set();
  GRUPOS.forEach(g => g.vehiculos.forEach(v => {
    if (v.archivado) { bajas++; return; }
    total++;
    if (v.restringido) restringidos++;
    if (v.bloqueado) bloqueados++;
    const nota = (v.nota||'').trim().toUpperCase();
    if (nota !== 'PROPIEDAD') { alquiler++; if (nota) proveedores.add(nota); }
    if (v.itv_fin) {
      const dias = Math.ceil((new Date(v.itv_fin + 'T00:00:00') - hoy) / 86400000);
      if (dias <= 60) itvAlerta++;
    }
  }));
  const prov = [...proveedores].slice(0, 3).join(', ') + (proveedores.size > 3 ? '…' : '');
  document.getElementById('admin-stats').innerHTML = `
    <div class="adm-kpi"><span class="adm-kpi-label">Vehículos activos</span><span class="adm-kpi-num">${total}</span>
      <span class="adm-kpi-sub">${bloqueados ? bloqueados + ' bloqueado' + (bloqueados>1?'s':'') : 'Ninguno bloqueado'}${bajas ? ' · ' + bajas + ' de baja' : ''}</span></div>
    <div class="adm-kpi"><span class="adm-kpi-label">En alquiler</span><span class="adm-kpi-num">${alquiler}</span>
      <span class="adm-kpi-sub">${esc(prov || '—')}</span></div>
    <div class="adm-kpi"><span class="adm-kpi-label">Restringidos</span><span class="adm-kpi-num">${restringidos}</span>
      <span class="adm-kpi-sub">Solo personal autorizado</span></div>
    <div class="adm-kpi"><span class="adm-kpi-label">ITV próximas</span><span class="adm-kpi-num ${itvAlerta?'aviso':''}">${itvAlerta}</span>
      <span class="adm-kpi-sub">Vencen en 60 días o menos</span></div>`;
}

function toggleRestringido(gi, vi) {
  GRUPOS[gi].vehiculos[vi].restringido = !GRUPOS[gi].vehiculos[vi].restringido;
  renderAdminVehiculos(); renderAdminStats(); renderTabla();
  sincronizarVehiculosConSheets();
  mostrarToast('Restricción actualizada', 'success');
}

function abrirModalBloqueo(gi, vi) {
  const v = GRUPOS[gi].vehiculos[vi];
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:4000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:28px 24px 22px;width:400px;box-shadow:0 24px 64px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;">
      <div style="font-size:36px;text-align:center;margin-bottom:10px;">⛔</div>
      <div style="font-size:16px;font-weight:900;color:#e84545;text-align:center;margin-bottom:4px;">Bloquear vehículo</div>
      <div style="font-size:12px;color:#8899aa;text-align:center;margin-bottom:18px;">Vehículo: <strong style="color:#1a1a2e">${esc(v.matricula)}</strong></div>
      <label style="font-size:10px;font-weight:800;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:5px;">Motivo del bloqueo *</label>
      <textarea id="bloqueo-motivo-input" rows="3" placeholder="Ej: Avería motor, en taller desde hoy…"
        style="width:100%;padding:10px;border:1.5px solid #dde1ea;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;color:#1a1a2e;outline:none;resize:vertical;margin-bottom:18px;box-sizing:border-box;"></textarea>
      <div style="display:flex;gap:8px;">
        <button id="btn-bloqueo-cancel" style="flex:1;padding:11px;background:#f0f2f5;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">Cancelar</button>
        <button id="btn-bloqueo-ok" style="flex:1;padding:11px;background:#e84545;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">⛔ Bloquear</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-bloqueo-cancel').onclick = () => document.body.removeChild(overlay);
  overlay.querySelector('#btn-bloqueo-ok').onclick = async () => {
    const motivo = overlay.querySelector('#bloqueo-motivo-input').value.trim();
    if (!motivo) { overlay.querySelector('#bloqueo-motivo-input').style.borderColor='#e84545'; return; }
    const bloqueado_por = usuarioActual?.nombre || 'Admin';
    try {
      const resp = await fetch(APPS_SCRIPT_URL, {
        method:'POST', headers:{'Content-Type':'text/plain'},
        body: JSON.stringify({ accion:'bloquearVehiculo', matricula: v.matricula, motivo, bloqueado_por }),
        redirect:'follow'
      });
      const json = await resp.json();
      if (json.ok) {
        GRUPOS[gi].vehiculos[vi].bloqueado     = true;
        GRUPOS[gi].vehiculos[vi].motivo_bloqueo = motivo;
        GRUPOS[gi].vehiculos[vi].bloqueado_por  = bloqueado_por;
        GRUPOS[gi].vehiculos[vi].fecha_bloqueo  = json.fecha_bloqueo || new Date().toISOString();
        document.body.removeChild(overlay);
        renderAdminVehiculos(); renderAdminStats(); renderTabla();
        registrarAccion('VEHICULO', 'Bloquear vehículo', `${v.matricula} · ${motivo.substring(0,80)}`);
        mostrarToast(`⛔ ${v.matricula} bloqueado`, 'error');
        if (json.emailError) {
          appAlert(`El vehículo se ha bloqueado correctamente, pero no se pudo enviar el correo de aviso.<br><br><span style="color:#8899aa;font-size:12px">${json.emailError}</span>`, { titulo: 'Fallo al enviar correo electrónico', icono: '✉️⚠️' });
        }
      } else {
        mostrarToast('Error al bloquear: ' + (json.error||''), 'error');
      }
    } catch(e) { mostrarToast('Error de conexión', 'error'); }
  };
}

function desbloquearVehiculoAdmin(gi, vi) {
  const v = GRUPOS[gi].vehiculos[vi];
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10600;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:28px 24px 22px;width:400px;box-shadow:0 24px 64px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;">
      <div style="font-size:36px;text-align:center;margin-bottom:10px;">🔓</div>
      <div style="font-size:16px;font-weight:900;color:#1a1a2e;text-align:center;margin-bottom:4px;">Desbloquear vehículo</div>
      <div style="font-size:12px;color:#8899aa;text-align:center;margin-bottom:14px;">Vehículo: <strong style="color:#1a1a2e">${esc(v.matricula)}</strong></div>
      <div style="font-size:12px;color:#556;line-height:1.6;margin-bottom:14px;">Esto también marcará como <strong>resuelta</strong> la incidencia pendiente asociada a este vehículo.</div>
      <label style="font-size:10px;font-weight:800;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:5px;">Motivo del desbloqueo *</label>
      <textarea id="desbloqueo-admin-motivo-input" rows="3" placeholder="Ej: Reparado en taller, vehículo revisado…"
        style="width:100%;padding:10px;border:1.5px solid #dde1ea;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;color:#1a1a2e;outline:none;resize:vertical;margin-bottom:18px;box-sizing:border-box;"></textarea>
      <div style="display:flex;gap:8px;">
        <button id="btn-desbloqueo-admin-cancel" style="flex:1;padding:11px;background:#f0f2f5;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">Cancelar</button>
        <button id="btn-desbloqueo-admin-ok" style="flex:1;padding:11px;background:#2ecc71;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">✓ Desbloquear</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-desbloqueo-admin-cancel').onclick = () => document.body.removeChild(overlay);
  overlay.querySelector('#btn-desbloqueo-admin-ok').onclick = async () => {
    const motivoInput = overlay.querySelector('#desbloqueo-admin-motivo-input');
    const motivo = motivoInput.value.trim();
    if (!motivo) { motivoInput.style.borderColor = '#e84545'; motivoInput.focus(); return; }

    const resueltoPor = usuarioActual?.nombre || 'Admin';
    const btnOk = overlay.querySelector('#btn-desbloqueo-admin-ok');
    btnOk.textContent = '⏳ Desbloqueando…'; btnOk.disabled = true;
    try {
      const resp = await fetch(APPS_SCRIPT_URL, {
        method:'POST', headers:{'Content-Type':'text/plain'},
        body: JSON.stringify({ accion:'desbloquearVehiculo', matricula: v.matricula, motivo, resueltoPor }),
        redirect:'follow'
      });
      const json = await resp.json();
      if (json.ok) {
        GRUPOS[gi].vehiculos[vi].bloqueado      = false;
        GRUPOS[gi].vehiculos[vi].motivo_bloqueo = '';
        GRUPOS[gi].vehiculos[vi].bloqueado_por  = '';
        GRUPOS[gi].vehiculos[vi].fecha_bloqueo  = '';
        if (json.incidenciaResuelta && typeof incidenciasCache !== 'undefined' && incidenciasCache.length) {
          const inc = incidenciasCache.find(f => f.timestamp === json.incidenciaResuelta && f.matricula === v.matricula);
          if (inc) { inc.estado = 'COMPLETADO'; inc.resuelto_por = resueltoPor; inc.comentario_resolucion = motivo; }
        }
        document.body.removeChild(overlay);
        renderAdminVehiculos(); renderAdminStats(); renderTabla();
        actualizarBotonIncidenciasPendientes();
        registrarAccion('VEHICULO', 'Desbloquear vehículo', `${v.matricula} · ${motivo.substring(0,80)}`);
        mostrarToast(`✓ ${v.matricula} desbloqueado`, 'success');
        if (typeof fichaRefrescar === 'function') fichaRefrescar(v.matricula);
        if (typeof mantCargarResumen === 'function') mantCargarResumen(); // su avería también se cierra
      } else {
        mostrarToast('Error al desbloquear: ' + (json.error||''), 'error');
        btnOk.textContent = '✓ Desbloquear'; btnOk.disabled = false;
      }
    } catch(e) {
      mostrarToast('Error de conexión', 'error');
      btnOk.textContent = '✓ Desbloquear'; btnOk.disabled = false;
    }
  };
  // Un clic fuera NO cierra la ventana: solo la ✕ o su botón de cerrar.
}

function editarITV(gi, vi) {
  const v = GRUPOS[gi].vehiculos[vi];
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:3000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:14px;padding:28px 28px 22px;width:360px;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;">
      <div style="font-size:22px;margin-bottom:8px;">📋</div>
      <div style="font-size:15px;font-weight:900;color:#1a1a2e;margin-bottom:4px;">Fecha fin de ITV</div>
      <div style="font-size:12px;color:#8899aa;margin-bottom:16px;">Vehículo: <strong>${esc(v.matricula)}</strong></div>
      <label style="font-size:10px;font-weight:700;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:5px;">Fin de ITV</label>
      <input type="date" id="itv-fecha-input" value="${v.itv_fin||''}"
        style="width:100%;padding:10px;border:1.5px solid #dde1ea;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:600;color:#1a1a2e;outline:none;margin-bottom:18px;">
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="this.closest('.itv-overlay').remove()" style="padding:9px 18px;background:#f4f5f8;color:#556;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">Cancelar</button>
        <button id="btn-guardar-itv" style="padding:9px 20px;background:#3b5bdb;color:white;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">Guardar ITV</button>
      </div>
    </div>`;
  overlay.classList.add('itv-overlay');
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-guardar-itv').onclick = () => {
    const fecha = document.getElementById('itv-fecha-input').value;
    GRUPOS[gi].vehiculos[vi].itv_fin = fecha;
    document.body.removeChild(overlay);
    renderAdminVehiculos(); renderTabla();
    sincronizarVehiculosConSheets();
    mostrarToast('✓ Fecha ITV guardada', 'success');
  };
}

// ── EDITAR VEHÍCULO (nombre/matrícula, tipo, nave, propiedad) ────────────────
function _vehiculoTieneMovimientoActivo(mat) {
  // Asignaciones del cuadrante cargadas en memoria (clave: matricula|turno|fecha)
  const enCuadrante = Object.keys(datos || {}).some(k => {
    if (!k.startsWith(mat + '|')) return false;
    const d = datos[k] || {};
    return Object.values(d).some(val => val !== '' && val !== null && val !== undefined && val !== false);
  });
  const enRepostaje = (typeof _repostajesPendientesMat !== 'undefined' && _repostajesPendientesMat[mat]);
  return enCuadrante || !!enRepostaje;
}

function editarVehiculo(gi, vi) {
  const v = GRUPOS[gi].vehiculos[vi];
  const tiposBase = ['FURGONETA', 'CAMION 8P', 'CAMION 15P', 'CAMION 24P'];
  const tipos = tiposBase.includes(v.tipo) ? tiposBase : [v.tipo, ...tiposBase];
  const naves = GRUPOS.map(g => g.nombre);
  const lbl = 'font-size:10px;font-weight:700;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:4px;';
  const inp = 'width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #dde1e8;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;outline:none;';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:5000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:14px;padding:28px;width:440px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;">
      <div style="font-size:15px;font-weight:900;color:#1a1a2e;margin-bottom:4px;">✏️ Editar vehículo</div>
      <div style="font-size:12px;color:#8899aa;margin-bottom:18px;">Actual: <strong>${esc(v.matricula)}</strong> · ${esc(GRUPOS[gi].nombre)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="grid-column:1/-1">
          <label style="${lbl}">Nombre / Matrícula *</label>
          <input id="edv-mat" value="${esc(v.matricula)}" oninput="this.value=this.value.toUpperCase()" style="${inp}">
        </div>
        <div>
          <label style="${lbl}">Tipo</label>
          <select id="edv-tipo" style="${inp}">
            ${tipos.map(t => `<option value="${esc(t)}" ${t===v.tipo?'selected':''}>${esc(t)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="${lbl}">Nave / Ubicación *</label>
          <input id="edv-nave" list="edv-naves" value="${esc(GRUPOS[gi].nombre)}" oninput="this.value=this.value.toUpperCase()" style="${inp}">
          <datalist id="edv-naves">${naves.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        </div>
        <div style="grid-column:1/-1">
          <label style="${lbl}">Propiedad / Nota</label>
          <input id="edv-nota" value="${esc(v.nota||'')}" placeholder="Ej: Propiedad, PINVECO…" style="${inp}">
        </div>
      </div>
      <div id="edv-aviso" style="display:none;margin-top:12px;font-size:11px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;line-height:1.5;">
        ⚠️ El nombre solo se puede cambiar si el vehículo todavía no tiene registros (cuadrante, incidencias, repostajes o reasignaciones). Los documentos subidos seguirán guardados con el nombre antiguo.
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;">
        <button id="edv-cancel" style="padding:9px 18px;background:#f4f5f8;color:#556;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">Cancelar</button>
        <button id="edv-guardar" style="padding:9px 20px;background:#3b5bdb;color:white;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">💾 Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const matInput = overlay.querySelector('#edv-mat');
  const aviso = overlay.querySelector('#edv-aviso');
  matInput.addEventListener('input', () => {
    aviso.style.display = matInput.value.trim() !== v.matricula ? 'block' : 'none';
  });
  overlay.querySelector('#edv-cancel').onclick = () => overlay.remove();
  // Un clic fuera NO cierra la ventana: solo la ✕ o su botón de cerrar.

  overlay.querySelector('#edv-guardar').onclick = async () => {
    const nuevaMat  = matInput.value.trim().toUpperCase();
    const nuevoTipo = overlay.querySelector('#edv-tipo').value;
    const nuevaNave = overlay.querySelector('#edv-nave').value.trim().toUpperCase();
    const nuevaNota = overlay.querySelector('#edv-nota').value.trim();

    if (!nuevaMat)  { mostrarToast('El nombre/matrícula es obligatorio', 'error'); return; }
    if (!nuevaNave) { mostrarToast('La nave es obligatoria', 'error'); return; }

    const cambiaMat = nuevaMat !== v.matricula;
    if (cambiaMat) {
      if (GRUPOS.some(g => g.vehiculos.some(x => x !== v && x.matricula === nuevaMat))) {
        mostrarToast('Ya existe un vehículo con ese nombre', 'error'); return;
      }
      if (_vehiculoTieneMovimientoActivo(v.matricula)) {
        appAlert(`<strong>${esc(v.matricula)}</strong> tiene una asignación o repostaje en curso en el cuadrante.<br><br>Libéralo primero y vuelve a intentar el cambio de nombre.`,
          { titulo: 'No se puede renombrar ahora', icono: '⚠️' });
        return;
      }
    }

    const btnG = overlay.querySelector('#edv-guardar');
    btnG.disabled = true; btnG.textContent = 'Guardando…';
    const restaurarBtn = () => { btnG.disabled = false; btnG.textContent = '💾 Guardar'; };

    // El cambio de matrícula se hace primero en la base de datos (es la clave del vehículo)
    if (cambiaMat) {
      try {
        const resp = await fetch(APPS_SCRIPT_URL, {
          method: 'POST', headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ accion: 'renombrarVehiculo', anterior: v.matricula, nueva: nuevaMat }), redirect: 'follow'
        });
        const json = await resp.json();
        if (!json.ok) {
          restaurarBtn();
          appAlert(esc(json.error || 'Error desconocido'), { titulo: 'No se pudo cambiar el nombre', icono: '⚠️' });
          return;
        }
      } catch (e) {
        restaurarBtn();
        mostrarToast('Error de conexión al cambiar el nombre', 'error');
        return;
      }
    }

    const antes = `${v.matricula} · ${v.tipo} · ${GRUPOS[gi].nombre}`;
    const matAnterior = v.matricula;
    v.matricula = nuevaMat;
    v.tipo      = nuevoTipo;
    v.nota      = nuevaNota;

    // Cambio de nave: sacar del grupo actual y añadir al final del nuevo
    const naveActual = GRUPOS[gi].nombre;
    if (nuevaNave !== naveActual.toUpperCase()) {
      GRUPOS[gi].vehiculos.splice(vi, 1);
      let g = GRUPOS.find(x => x.nombre.toUpperCase() === nuevaNave);
      if (!g) { g = { nombre: nuevaNave, vehiculos: [] }; GRUPOS.push(g); }
      const maxOrden = g.vehiculos.reduce((m, x) => Math.max(m, Number(x.orden) || 0), 0);
      v.orden = maxOrden + 1;
      g.vehiculos.push(v);
    }

    // Mover también las claves del cuadrante en memoria (matricula|turno|fecha)
    if (cambiaMat) {
      Object.keys(datos || {}).forEach(k => {
        if (k.startsWith(matAnterior + '|')) { datos[nuevaMat + k.slice(matAnterior.length)] = datos[k]; delete datos[k]; }
      });
    }

    const ok = await sincronizarVehiculosConSheets();
    if (!ok) { restaurarBtn(); renderAdminVehiculos(); renderAdminStats(); renderTabla(); return; }
    overlay.remove();
    renderAdminVehiculos(); renderAdminStats(); renderTabla();
    registrarAccion('VEHICULO', 'Editar vehículo', `${antes} → ${v.matricula} · ${v.tipo} · ${nuevaNave}`);
    mostrarToast(`✓ ${v.matricula} actualizado`, 'success');
  };
}

// Comprueba si la ITV de un vehículo está caducada hoy
// Convierte YYYY-MM-DD a DD-MM-AAAA para mostrar al usuario
function fmtFechaITV(iso) {
  if (!iso || iso.length < 10) return iso || '';
  const [y, m, d] = iso.substring(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

function itvCaducada(matricula) {
  for (const g of GRUPOS) {
    const v = g.vehiculos.find(x => x.matricula === matricula);
    if (v && v.itv_fin) {
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const fin = new Date(v.itv_fin + 'T00:00:00');
      if (fin <= hoy) return { caducada: true, fecha: v.itv_fin };
    }
  }
  return { caducada: false };
}

function mostrarModalITVCaducada(matricula, fechaITV) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:5000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:36px 32px 28px;width:380px;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;animation:nv-in 0.3s cubic-bezier(.34,1.56,.64,1)">
      <div style="font-size:52px;margin-bottom:10px;">⛔</div>
      <div style="font-size:18px;font-weight:900;color:#e84545;margin-bottom:8px;">ITV CADUCADA</div>
      <div style="font-size:13px;color:#1a1a2e;font-weight:700;margin-bottom:6px;">${esc(matricula)}</div>
      <div style="font-size:12px;color:#8899aa;margin-bottom:18px;">La ITV de este vehículo caducó el <strong style="color:#e84545">${fmtFechaITV(fechaITV)}</strong>.<br>No se puede asignar hasta renovarla.</div>
      <button onclick="this.closest('div[style*=fixed]').remove()"
        style="width:100%;padding:13px;background:#1a1a2e;color:white;border:none;border-radius:10px;font-family:Barlow,sans-serif;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:1px;">
        Entendido
      </button>
    </div>`;
  document.body.appendChild(overlay);
}

function eliminarVehiculo(gi, vi) {
  const v = GRUPOS[gi].vehiculos[vi];
  appConfirm(`El vehículo <strong>${v.matricula}</strong> desaparecerá del cuadrante activo pero seguirá visible en históricos anteriores.`, {
    titulo: `¿Dar de baja ${v.matricula}?`, icono: '🚫', labelOk: 'Sí, dar de baja', colorOk: '#e84545', peligro: false
  }).then(ok => {
    if (!ok) return;
    GRUPOS[gi].vehiculos[vi].archivado = true;
    GRUPOS[gi].vehiculos[vi].fecha_archivado = fechaActual;
    renderAdminVehiculos(); renderAdminStats(); renderTabla();
    sincronizarVehiculosConSheets();
    registrarAccion('VEHICULO', 'Dar de baja (archivar) vehículo', v.matricula);
    mostrarToast(`✓ ${v.matricula} dado de baja`, 'info');
  });
}

function desarchivarVehiculo(gi, vi) {
  const v = GRUPOS[gi].vehiculos[vi];
  appConfirm(`<strong>${v.matricula}</strong> volverá a aparecer en el cuadrante activo.`, {
    titulo: `¿Dar de alta ${v.matricula}?`, icono: '✅', labelOk: 'Sí, dar de alta', colorOk: '#16a34a'
  }).then(ok => {
    if (!ok) return;
    GRUPOS[gi].vehiculos[vi].archivado = false;
    GRUPOS[gi].vehiculos[vi].fecha_archivado = '';
    renderAdminVehiculos(); renderAdminStats(); renderTabla();
    sincronizarVehiculosConSheets();
    registrarAccion('VEHICULO', 'Dar de alta (restaurar) vehículo', v.matricula);
    mostrarToast(`✓ ${v.matricula} dado de alta`, 'success');
  });
}

function abrirModalNuevoVehiculo() {
  ['modal-add-matricula','modal-add-nota','modal-add-itv-fin',
   'modal-add-seguro-nombre','modal-add-seguro-cif','modal-add-seguro-poliza',
   'modal-add-seguro-vencimiento','modal-add-seguro-tel'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('modal-add-tipo').value = 'FURGONETA';
  document.getElementById('modal-add-grupo').value = '';
  document.getElementById('modal-nuevo-vehiculo').style.display = 'flex';
  setTimeout(() => document.getElementById('modal-add-matricula').focus(), 100);
}
function cerrarModalNuevoVehiculo() {
  document.getElementById('modal-nuevo-vehiculo').style.display = 'none';
}
async function confirmarNuevoVehiculo() {
  const mat     = document.getElementById('modal-add-matricula').value.trim().toUpperCase();
  const tipo    = document.getElementById('modal-add-tipo').value;
  const grupo   = document.getElementById('modal-add-grupo').value.trim().toUpperCase();
  const nota    = document.getElementById('modal-add-nota').value.trim();
  const itv_fin = document.getElementById('modal-add-itv-fin').value.trim();
  const seguro_aseguradora = (document.getElementById('modal-add-seguro-aseguradora')||{value:''}).value.trim();
  const seguro_nombre      = document.getElementById('modal-add-seguro-nombre').value.trim();
  const seguro_cif         = document.getElementById('modal-add-seguro-cif').value.trim().toUpperCase();
  const seguro_poliza      = document.getElementById('modal-add-seguro-poliza').value.trim();
  const seguro_vencimiento = document.getElementById('modal-add-seguro-vencimiento').value.trim();
  const seguro_tel         = document.getElementById('modal-add-seguro-tel').value.trim();
  if (!mat)     { mostrarToast('La matrícula es obligatoria', 'error'); return; }
  if (!grupo)   { mostrarToast('La nave es obligatoria', 'error'); return; }
  if (!itv_fin) { mostrarToast('La fecha de ITV es obligatoria', 'error'); return; }
  if (GRUPOS.some(g => g.vehiculos.some(v => v.matricula === mat))) { mostrarToast('Esa matrícula ya existe', 'error'); return; }
  let g = GRUPOS.find(g => g.nombre.toUpperCase() === grupo);
  const grupoNuevo = !g;
  if (!g) { g = { nombre: grupo, vehiculos: [] }; GRUPOS.push(g); }
  const maxOrden = g.vehiculos.reduce((m, x) => Math.max(m, Number(x.orden) || 0), 0);
  const nuevo = { matricula: mat, tipo, nota, orden: maxOrden + 1, restringido: false, itv_fin, seguro_aseguradora, seguro_nombre, seguro_cif, seguro_poliza, seguro_vencimiento, seguro_tel };
  g.vehiculos.push(nuevo);

  const btn = document.querySelector('#modal-nuevo-vehiculo button[onclick*="confirmarNuevoVehiculo"]');
  const txtBtn = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  const ok = await sincronizarVehiculosConSheets();
  if (btn) { btn.disabled = false; btn.textContent = txtBtn; }

  if (!ok) {
    // No se guardó: lo quitamos para no mostrar un vehículo que no existe
    g.vehiculos.splice(g.vehiculos.indexOf(nuevo), 1);
    if (grupoNuevo && !g.vehiculos.length) GRUPOS.splice(GRUPOS.indexOf(g), 1);
    return; // el modal sigue abierto con los datos para reintentar
  }
  cerrarModalNuevoVehiculo();
  renderAdminVehiculos(); renderAdminStats(); renderTabla();
  registrarAccion('VEHICULO', 'Añadir vehículo', `${mat} · ${tipo} · ${grupo}`);
  mostrarToast(`✓ ${mat} añadido`, 'success');
}
function añadirVehiculo() { abrirModalNuevoVehiculo(); }

// ── FICHA VEHÍCULO (modal solo lectura desde mat-badge) ──────────────────────
function _getVehiculo(matricula) {
  for (const g of GRUPOS) {
    const v = g.vehiculos.find(x => x.matricula === matricula);
    if (v) return v;
  }
  return null;
}
function _tieneSeguro(matricula) {
  const v = _getVehiculo(matricula);
  return v && (v.seguro_aseguradora || v.seguro_nombre || v.seguro_tel || v.seguro_poliza);
}
function _seguroVencido(matricula) {
  const v = _getVehiculo(matricula);
  if (!v || !v.seguro_vencimiento) return false;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const venc = new Date(v.seguro_vencimiento); venc.setHours(0,0,0,0);
  return venc < hoy;
}
// Estado combinado (seguro + ITV) para el icono junto a la matrícula:
// 'expirado' → algo ya caducado · 'aviso' → algo vence en ≤30 días · 'ok' → hay datos, todo en regla · 'none' → sin datos
function _matBadgeEstado(matricula) {
  const v = _getVehiculo(matricula);
  if (!v) return 'none';
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  let expirado = false, aviso = false;

  if (v.seguro_vencimiento) {
    const dias = Math.ceil((new Date(v.seguro_vencimiento + 'T00:00:00') - hoy) / 86400000);
    if (dias <= 0) expirado = true; else if (dias <= 30) aviso = true;
  }
  if (v.itv_fin) {
    const dias = Math.ceil((new Date(v.itv_fin + 'T00:00:00') - hoy) / 86400000);
    if (dias <= 0) expirado = true; else if (dias <= 30) aviso = true;
  }

  if (expirado) return 'expirado';
  if (aviso) return 'aviso';
  if (_tieneSeguro(matricula) || v.itv_fin) return 'ok';
  return 'none';
}
function _matBadgeInfoHtml(matricula) {
  const mant = (typeof mantIconoCuadrante === 'function') ? mantIconoCuadrante(matricula) : '';
  return _matBadgeInfoHtmlBase(matricula) + mant;
}
function _matBadgeInfoHtmlBase(matricula) {
  const estado = _matBadgeEstado(matricula);
  if (estado === 'expirado') return `<span class="mat-badge-info has-alerta-expirado" title="Seguro o ITV caducados">!</span>`;
  if (estado === 'aviso')    return `<span class="mat-badge-info has-alerta-aviso" title="Seguro o ITV vencen en menos de 30 días">!</span>`;
  if (estado === 'ok')       return `<span class="mat-badge-info has-data" title="Ver ficha del vehículo">i</span>`;
  return `<span class="mat-badge-info" title="Ver ficha del vehículo">i</span>`;
}
// ── FICHA DEL VEHÍCULO: ahora en js/ficha-vehiculo.js ─────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // Primero cierra el visor si está abierto, luego la ficha
    const visor = document.getElementById('modal-visor-doc');
    if (visor && visor.classList.contains('visible')) {
      cerrarVisorDoc();
    } else if (!document.getElementById('overlay-docs')) {
      cerrarFichaVehiculo();
    }
  }
});

// ── VISOR DE DOCUMENTOS — PDF.js embebido ────────────────────────────────────
let _visorPdfDoc   = null;   // PDFDocumentProxy activo
let _visorRotDeg   = 0;      // rotación acumulada (0,90,180,270)
let _visorZoom     = 1.0;    // escala actual
let _visorIsPdf    = false;  // modo actual
let _visorImgDeg   = 0;      // rotación acumulada para imágenes
let _visorPrintUrl = '';     // URL para imprimir / descargar

async function abrirVisorDoc(url, nombre, formato) {
  _visorLiberar();
  const isPdf = formato === 'pdf' || (nombre || '').toLowerCase().endsWith('.pdf');
  _visorIsPdf  = isPdf;
  _visorRotDeg = 0;
  _visorZoom   = 1.0;
  _visorImgDeg = 0;
  _visorPrintUrl = url;

  // Elementos
  const modal       = document.getElementById('modal-visor-doc');
  const titulo      = document.getElementById('visor-doc-titulo');
  const pdfCont     = document.getElementById('visor-pdf-container');
  const imgEl       = document.getElementById('visor-doc-img');
  const loading     = document.getElementById('visor-loading');
  const pdfControls = document.getElementById('visor-pdf-controls');
  const imgControls = document.getElementById('visor-img-controls');
  const btnDl       = document.getElementById('visor-doc-descargar');
  const zoomLabel   = document.getElementById('visor-zoom-label');

  titulo.textContent = nombre || 'Documento';

  // ── Documento en Supabase: enlace firmado directo (rápido) ──
  const esSupabase = String(url).startsWith('sb:');
  let fileId = null, urlDirecta = null;
  if (esSupabase) {
    const path = url.slice(3);
    loading.classList.add('active');
    modal.classList.add('visible');
    try {
      [urlDirecta, btnDl.href] = await Promise.all([docsUrlFirmada(path), docsUrlFirmada(path, nombre || 'documento')]);
    } catch (e) {
      loading.classList.remove('active');
      pdfCont.innerHTML = '';
      _visorMostrarErrorPdf('No se pudo abrir el documento: ' + esc(e.message), '#', null);
      return;
    }
    _visorPrintUrl = urlDirecta;
  } else {
    // URL de descarga directa (Drive)
    const fileIdMatch = url.match(/\/file\/d\/([^/]+)/);
    fileId      = fileIdMatch ? fileIdMatch[1] : null;
    btnDl.href  = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : url;
  }
  btnDl.download    = nombre || 'documento';

  // Resetear UI
  pdfCont.innerHTML = '';
  pdfCont.classList.remove('active');
  imgEl.classList.remove('active');
  imgEl.style.transform = 'none';
  pdfControls.style.display = 'none';
  imgControls.style.display = 'none';
  loading.classList.add('active');
  modal.classList.add('visible');

  if (isPdf) {
    pdfControls.style.display = 'flex';
    if (zoomLabel) zoomLabel.textContent = '100%';
    await _visorRenderPdf(url, fileId, urlDirecta);
  } else {
    imgControls.style.display = 'flex';
    imgEl.classList.add('active');
    imgEl.src = urlDirecta || (fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200` : url);
    imgEl.onload  = () => loading.classList.remove('active');
    imgEl.onerror = () => loading.classList.remove('active');
  }
}

async function _visorRenderPdf(url, fileId, urlDirecta) {
  const loading = document.getElementById('visor-loading');
  const pdfCont = document.getElementById('visor-pdf-container');

  // Esperar a que PDF.js esté disponible (carga async)
  for (let i = 0; i < 25 && !window._pdfjs; i++) await new Promise(r => setTimeout(r, 200));
  if (!window._pdfjs) {
    _visorMostrarErrorPdf('PDF.js no disponible. Recarga la página e inténtalo de nuevo.', url, fileId);
    return;
  }

  const pdfjsLib = window._pdfjs;

  // ── Supabase: PDF.js descarga el archivo directamente, por partes ──
  if (urlDirecta) {
    try {
      _visorPdfDoc = await pdfjsLib.getDocument({ url: urlDirecta }).promise;
      if (!document.getElementById('modal-visor-doc').classList.contains('visible')) { _visorLiberar(); return; }
      pdfCont.innerHTML = '';
      pdfCont.classList.add('active');
      await _visorRenderPaginas();
      loading.classList.remove('active');
    } catch (err) {
      console.warn('[Visor PDF.js] Supabase:', err);
      _visorMostrarErrorPdf('Error al abrir el PDF.', urlDirecta, null);
    }
    return;
  }

  // ── Obtener el PDF a través del proxy GAS ──────────────────────────────────
  // El GAS corre con credenciales de desarrollador y tiene acceso a DriveApp,
  // por lo que puede leer cualquier archivo de la carpeta de flota y devolverlo
  // como base64, evitando completamente el problema de CORS con Drive.
  if (!fileId) {
    _visorMostrarErrorPdf('No se pudo identificar el archivo (fileId ausente).', url, fileId);
    return;
  }

  let arrayBuffer = null;
  try {
    const proxyUrl = `${APPS_SCRIPT_URL}?accion=proxyDoc&fileId=${encodeURIComponent(fileId)}`;
    const resp     = await fetch(proxyUrl, { redirect: 'follow' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const json = await resp.json();
    if (!json.ok || !json.base64) throw new Error(json.error || 'Sin datos');

    // Convertir base64 → ArrayBuffer
    const binary = atob(json.base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    arrayBuffer = bytes.buffer;
  } catch(e) {
    console.warn('[Visor PDF.js] proxy GAS fallido:', e.message);
    _visorMostrarErrorPdf('No se pudo cargar el documento a través del servidor.', url, fileId);
    return;
  }

  try {
    _visorPdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      if (!document.getElementById('modal-visor-doc').classList.contains('visible')) { _visorLiberar(); return; }
    pdfCont.innerHTML = '';
    pdfCont.classList.add('active');
    await _visorRenderPaginas();
    loading.classList.remove('active');
  } catch(err) {
    console.warn('[Visor PDF.js] render error:', err);
    _visorMostrarErrorPdf('Error al renderizar el PDF.', url, fileId);
  }
}

function _visorMostrarErrorPdf(msg, url, fileId) {
  const loading = document.getElementById('visor-loading');
  const pdfCont = document.getElementById('visor-pdf-container');
  const dlUrl   = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : url;
  const viewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : url;
  loading.classList.remove('active');
  pdfCont.innerHTML = `
    <div style="color:#e84545;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;
                text-align:center;padding:40px 24px;background:#2a1a1a;border-radius:14px;
                margin:24px;max-width:420px;">
      <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
      <div style="margin-bottom:10px;">${msg}</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap;">
        <a href="${viewUrl}" target="_blank"
           style="color:#fff;background:#3b5bdb;border-radius:8px;padding:8px 16px;
                  text-decoration:none;font-size:12px;font-weight:800;">
          🔗 Abrir en Drive
        </a>
        <a href="${dlUrl}" target="_blank" download
           style="color:#fff;background:#16a34a;border-radius:8px;padding:8px 16px;
                  text-decoration:none;font-size:12px;font-weight:800;">
          ⬇ Descargar
        </a>
      </div>
    </div>`;
  pdfCont.classList.add('active');
}

// Dibujo perezoso: se crean los huecos de todas las páginas, pero solo se
// pintan las que están (o están a punto de estar) en pantalla. Al cerrar o
// cambiar de documento se cancela todo y se libera la memoria.
let _visorGen      = 0;           // sube cada vez que el contenido deja de ser válido
let _visorObserver = null;
let _visorTareas   = new Set();   // renderTask de PDF.js en curso

function _visorCancelarDibujo() {
  _visorGen++;
  if (_visorObserver) { _visorObserver.disconnect(); _visorObserver = null; }
  _visorTareas.forEach(t => { try { t.cancel(); } catch (e) {} });
  _visorTareas.clear();
  const pdfCont = document.getElementById('visor-pdf-container');
  if (pdfCont) {
    // Vaciar los canvas libera su memoria de inmediato
    pdfCont.querySelectorAll('canvas').forEach(c => { c.width = 0; c.height = 0; });
    pdfCont.innerHTML = '';
  }
}

function _visorLiberar() {
  _visorCancelarDibujo();
  if (_visorPdfDoc) { try { _visorPdfDoc.destroy(); } catch (e) {} }
  _visorPdfDoc = null;
}

async function _visorRenderPaginas() {
  const pdfCont = document.getElementById('visor-pdf-container');
  if (!_visorPdfDoc) return;
  _visorCancelarDibujo();
  const gen = _visorGen;
  const doc = _visorPdfDoc;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);   // nítido sin disparar memoria
  const scroller = document.getElementById('visor-body');

  _visorObserver = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const c = en.target;
      _visorObserver && _visorObserver.unobserve(c);
      _visorPintarPagina(doc, c, gen, dpr);
    });
  }, { root: scroller, rootMargin: '800px 0px' });

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    if (gen !== _visorGen) return;
    const vp = page.getViewport({ scale: _visorZoom, rotation: (page.rotate + _visorRotDeg) % 360 });
    const canvas = document.createElement('canvas');
    canvas.className = 'visor-pdf-page';
    canvas.dataset.page = p;
    canvas.style.width  = Math.floor(vp.width) + 'px';
    canvas.style.height = Math.floor(vp.height) + 'px';
    pdfCont.appendChild(canvas);
    _visorObserver.observe(canvas);
    if (p === 1) await _visorPintarPagina(doc, canvas, gen, dpr); // la primera, ya
  }
}

async function _visorPintarPagina(doc, canvas, gen, dpr) {
  if (canvas.dataset.pintada || gen !== _visorGen) return;
  canvas.dataset.pintada = '1';
  try {
    const page = await doc.getPage(Number(canvas.dataset.page));
    if (gen !== _visorGen) return;
    const vp = page.getViewport({ scale: _visorZoom * dpr, rotation: (page.rotate + _visorRotDeg) % 360 });
    canvas.width  = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const tarea = page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport: vp });
    _visorTareas.add(tarea);
    await tarea.promise.catch(() => {});
    _visorTareas.delete(tarea);
  } catch (e) { /* documento cerrado o cancelado */ }
}

async function rotarVisorDoc() {
  if (_visorIsPdf) {
    _visorRotDeg = (_visorRotDeg + 90) % 360;
    const loading = document.getElementById('visor-loading');
    loading.classList.add('active');
    await _visorRenderPaginas();
    loading.classList.remove('active');
  } else {
    _visorImgDeg = (_visorImgDeg + 90) % 360;
    const imgEl = document.getElementById('visor-doc-img');
    if (imgEl) imgEl.style.transform = `rotate(${_visorImgDeg}deg)`;
  }
}

async function visorZoom(delta) {
  _visorZoom = Math.max(0.25, Math.min(4, _visorZoom + delta));
  const zoomLabel = document.getElementById('visor-zoom-label');
  if (zoomLabel) zoomLabel.textContent = Math.round(_visorZoom * 100) + '%';
  if (!_visorIsPdf || !_visorPdfDoc) return;
  const loading = document.getElementById('visor-loading');
  loading.classList.add('active');
  await _visorRenderPaginas();
  loading.classList.remove('active');
}

function cerrarVisorDoc() {
  const modal   = document.getElementById('modal-visor-doc');
  const pdfCont = document.getElementById('visor-pdf-container');
  const imgEl   = document.getElementById('visor-doc-img');
  const loading = document.getElementById('visor-loading');
  modal.classList.remove('visible');
  _visorLiberar();
  pdfCont.classList.remove('active');
  imgEl.classList.remove('active');
  imgEl.removeAttribute('src');
  imgEl.style.transform = 'none';
  loading.classList.remove('active');
  _visorRotDeg = 0;
  _visorZoom   = 1.0;
  _visorImgDeg = 0;
}

function imprimirVisorDoc() {
  if (_visorIsPdf) {
    // Abrir en nueva pestaña para imprimir (el navegador tiene su propio diálogo)
    const win = window.open(_visorPrintUrl, '_blank');
    win && win.addEventListener('load', () => { try { win.print(); } catch(e) {} });
  } else {
    const imgEl = document.getElementById('visor-doc-img');
    if (imgEl && imgEl.src) {
      const w = window.open(imgEl.src, '_blank');
      w && w.addEventListener('load', () => w.print());
    }
  }
}

// ── EDITAR SEGURO DESDE ADMIN PANEL ──────────────────────────────────────────
function editarSeguro(gi, vi) {
  const v = GRUPOS[gi].vehiculos[vi];
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:5000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:14px;padding:28px;width:440px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;">
      <div style="font-size:15px;font-weight:900;color:#1a1a2e;margin-bottom:4px;">🛡️ Datos del seguro</div>
      <div style="font-size:12px;color:#8899aa;margin-bottom:18px;">Vehículo: <strong>${esc(v.matricula)}</strong></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label style="font-size:10px;font-weight:700;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:4px;">Aseguradora</label>
          <input id="seg-aseguradora" value="${esc(v.seguro_aseguradora||'')}" placeholder="Ej: Mapfre"
            style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #dde1e8;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:600;outline:none;">
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:4px;">Tomador</label>
          <input id="seg-nombre" value="${esc(v.seguro_nombre||'')}" placeholder="Nombre del tomador"
            style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #dde1e8;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:600;outline:none;">
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:4px;">CIF</label>
          <input id="seg-cif" value="${esc(v.seguro_cif||'')}" placeholder="Ej: A12345678"
            style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #dde1e8;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:600;outline:none;">
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:4px;">Nº Póliza</label>
          <input id="seg-poliza" value="${esc(v.seguro_poliza||'')}" placeholder="POL-2024-XXXX"
            style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #dde1e8;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:600;outline:none;">
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:4px;">Vencimiento</label>
          <input type="date" id="seg-vencimiento" value="${esc(v.seguro_vencimiento||'')}"
            style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #dde1e8;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:600;outline:none;">
        </div>
        <div style="grid-column:1/-1">
          <label style="font-size:10px;font-weight:700;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:4px;">📞 Tel. Asistencia / Grúa</label>
          <input id="seg-tel" type="tel" value="${esc(v.seguro_tel||'')}" placeholder="900 123 456"
            style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #dde1e8;border-radius:8px;font-family:Barlow,sans-serif;font-size:14px;font-weight:800;color:#e84545;outline:none;">
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;">
        <button id="seg-cancel" style="padding:9px 18px;background:#f4f5f8;color:#556;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">Cancelar</button>
        <button id="seg-guardar" style="padding:9px 20px;background:#3b5bdb;color:white;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">💾 Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#seg-cancel').onclick  = () => overlay.remove();
  overlay.querySelector('#seg-guardar').onclick = () => {
    GRUPOS[gi].vehiculos[vi].seguro_aseguradora = overlay.querySelector('#seg-aseguradora').value.trim();
    GRUPOS[gi].vehiculos[vi].seguro_nombre      = overlay.querySelector('#seg-nombre').value.trim();
    GRUPOS[gi].vehiculos[vi].seguro_cif         = overlay.querySelector('#seg-cif').value.trim().toUpperCase();
    GRUPOS[gi].vehiculos[vi].seguro_poliza      = overlay.querySelector('#seg-poliza').value.trim();
    GRUPOS[gi].vehiculos[vi].seguro_vencimiento = overlay.querySelector('#seg-vencimiento').value.trim();
    GRUPOS[gi].vehiculos[vi].seguro_tel         = overlay.querySelector('#seg-tel').value.trim();
    overlay.remove();
    renderAdminVehiculos(); renderTabla();
    sincronizarVehiculosConSheets();
    mostrarToast('✓ Datos del seguro guardados', 'success');
    registrarAccion('VEHICULO', 'Editar datos seguro', GRUPOS[gi].vehiculos[vi].matricula);
  };
}

