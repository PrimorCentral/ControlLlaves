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

function renderAdminVehiculos() {
  const lista = document.getElementById('admin-lista-vehiculos');
  let html = '';
  const hoy = new Date(); hoy.setHours(0,0,0,0);

  // ── ITV Control Panel ──────────────────────────────────────────────────────
  const itvAlertas = [];
  GRUPOS.forEach((grupo, gi) => {
    grupo.vehiculos.forEach((v, vi) => {
      if (v.archivado) return;
      if (v.itv_fin) {
        const fin = new Date(v.itv_fin + 'T00:00:00');
        const dias = Math.ceil((fin - hoy) / 86400000);
        if (dias <= 60) itvAlertas.push({ v, gi, vi, dias });
      } else {
        itvAlertas.push({ v, gi, vi, dias: Infinity, sinFecha: true });
      }
    });
  });
  itvAlertas.sort((a, b) => a.dias - b.dias);

  let itvPanelHtml = '';
  if (itvAlertas.length === 0) {
    itvPanelHtml = `<div class="itv-empty-ok">✅ Todas las ITV están en vigor — sin vencimientos en los próximos 60 días.</div>`;
  } else {
    itvAlertas.forEach(({ v, gi, vi, dias, sinFecha }) => {
      let cls, badge;
      if (sinFecha) { cls='proxima60'; badge=`<span class="itv-alert-badge proxima60">⚠️ Sin fecha registrada</span>`; }
      else if (dias <= 0)  { cls='caducada';  badge=`<span class="itv-alert-badge caducada">⛔ CADUCADA · ${fmtFechaITV(v.itv_fin)}</span>`; }
      else if (dias <= 30) { cls='proxima30'; badge=`<span class="itv-alert-badge proxima30">⚠️ Vence en ${dias}d · ${fmtFechaITV(v.itv_fin)}</span>`; }
      else                 { cls='proxima60'; badge=`<span class="itv-alert-badge proxima60">🔵 Vence en ${dias}d · ${fmtFechaITV(v.itv_fin)}</span>`; }
      itvPanelHtml += `<div class="itv-alert-item ${cls}">
        <div class="itv-alert-mat">${esc(v.matricula)}</div>
        <div class="itv-alert-tipo">${esc(v.tipo)}${v.nota?' · '+esc(v.nota):''}</div>
        ${badge}
        <button class="btn-item-action btn-itv" onclick="editarITV(${gi},${vi})" style="font-size:10px;padding:4px 9px;">📋 Actualizar ITV</button>
      </div>`;
    });
  }
  html += `<div class="itv-control-panel">
    <div class="itv-control-header">
      <span style="font-size:20px">🔧</span>
      <div>
        <div class="itv-control-title">Control de ITV · Próximos vencimientos</div>
        <div style="font-size:10px;color:#8899aa;font-weight:600;margin-top:1px;">Vehículos con ITV caducada o que vence en los próximos 60 días</div>
      </div>
    </div>
    <div class="itv-control-list">${itvPanelHtml}</div>
  </div>`;

  // ── Lista de vehículos por grupo ───────────────────────────────────────────
  GRUPOS.forEach((grupo, gi) => {
    const activos = grupo.vehiculos.filter(v => !v.archivado);
    const bajas   = grupo.vehiculos.filter(v => v.archivado);
    if (!grupo.vehiculos.length) return;

    html += `<div style="font-size:9px;font-weight:900;letter-spacing:2.5px;color:#8899aa;text-transform:uppercase;padding:10px 4px 5px;border-top:${gi>0?'2px solid #f0f3f8':'none'};display:flex;align-items:center;gap:8px;">
      📍 ${grupo.nombre}
      <span style="font-size:9px;font-weight:700;background:#f0f2f5;color:#6b7a94;border-radius:4px;padding:1px 7px;border:1px solid #e2e8f0;">${activos.length} activos${bajas.length?' · '+bajas.length+' de baja':''}</span>
    </div>`;

    grupo.vehiculos.forEach((v, vi) => {
      // ITV badge
      let itvBadge = '';
      if (v.itv_fin) {
        const fin = new Date(v.itv_fin + 'T00:00:00');
        const diffDias = Math.ceil((fin - hoy) / 86400000);
        let itvColor, itvBg, itvLabel;
        if (diffDias <= 0)       { itvColor = '#b91c1c'; itvBg = '#fee2e2'; itvLabel = `⛔ ITV CADUCADA · ${fmtFechaITV(v.itv_fin)}`; }
        else if (diffDias <= 30) { itvColor = '#d97706'; itvBg = '#fef3c7'; itvLabel = `⚠️ Vence en ${diffDias}d · ${fmtFechaITV(v.itv_fin)}`; }
        else if (diffDias <= 60) { itvColor = '#0369a1'; itvBg = '#e0f2fe'; itvLabel = `🔵 Vence en ${diffDias}d · ${fmtFechaITV(v.itv_fin)}`; }
        else                     { itvColor = '#16a34a'; itvBg = '#f0fdf4'; itvLabel = `✅ En vigor · ${fmtFechaITV(v.itv_fin)}`; }
        itvBadge = `<span style="font-size:9px;font-weight:800;color:${itvColor};background:${itvBg};border:1px solid ${itvColor}33;border-radius:5px;padding:2px 9px;">${itvLabel}</span>`;
      } else {
        itvBadge = `<span style="font-size:9px;font-weight:800;color:#94a3b8;background:#f8f9fc;border:1px solid #e2e8f0;border-radius:5px;padding:2px 9px;">📋 Sin fecha ITV</span>`;
      }

      // Propiedad badge
      const nota = (v.nota||'').trim().toUpperCase();
      const esPropia = nota === 'PROPIEDAD';
      const propBadge = esPropia
        ? `<span class="admin-item-propiedad propia">🏢 Propiedad</span>`
        : `<span class="admin-item-propiedad alquiler">🔑 Alquiler · ${esc(v.nota||'—')}</span>`;

      // Estado del vehículo
      let itemStyle = '';
      if (v.archivado) itemStyle = 'opacity:0.55;background:#f8f8f8;';
      else if (v.bloqueado) itemStyle = 'background:#fff5f5;border-color:#fecaca;';

      html += `<div class="admin-item" style="${itemStyle}">
        <div class="admin-item-left">
          <div class="admin-item-mat ${v.restringido?'restringido':''}">${esc(v.matricula)}${v.archivado ? ' <span style="font-size:8px;font-weight:800;color:#fff;background:#94a3b8;border-radius:4px;padding:1px 6px;vertical-align:middle;">BAJA</span>' : ''}${v.bloqueado ? ' <span style="font-size:8px;font-weight:800;color:#fff;background:#dc2626;border-radius:4px;padding:1px 6px;vertical-align:middle;">⛔ BLOQ.</span>' : ''}</div>
          ${propBadge}
        </div>
        <div class="admin-item-tipo">${esc(v.tipo)}</div>
        <div class="admin-item-center">
          ${itvBadge}
          ${v.bloqueado ? `<span style="font-size:9px;color:#b91c1c;font-weight:700;background:#fee2e2;border-radius:4px;padding:2px 8px;border:1px solid #fecaca;">Motivo: ${esc(v.motivo_bloqueo||'—')} · ${esc(v.bloqueado_por||'—')}${v.fecha_bloqueo ? ' · '+esc(_fmtFechaHoraBloqueo(v.fecha_bloqueo)) : ''}</span>` : ''}
        </div>
        <div class="admin-item-actions">
          <button class="btn-item-action" onclick="moverVehiculoOrden(${gi},${vi},-1)" title="Subir orden" ${vi===0?'disabled style="opacity:.35;cursor:not-allowed;"':''}>⬆️</button>
          <button class="btn-item-action" onclick="moverVehiculoOrden(${gi},${vi},1)" title="Bajar orden" ${vi===grupo.vehiculos.length-1?'disabled style="opacity:.35;cursor:not-allowed;"':''}>⬇️</button>
          <button class="btn-item-action" onclick="editarVehiculo(${gi},${vi})" title="Editar nombre, tipo, nave y propiedad" style="background:#fff7ed;color:#c2410c;border-color:#fed7aa;">✏️ Editar</button>
          <button class="btn-item-action btn-itv" onclick="editarITV(${gi},${vi})" title="Editar fecha ITV">📋 ITV</button>
          <button class="btn-item-action" onclick="editarSeguro(${gi},${vi})" title="Datos del seguro" style="background:#eef2ff;color:#3b5bdb;border-color:#c5d0ff;">🛡️ Seguro</button>
          <button class="btn-item-action" onclick="abrirGestorDocumentos('${esc(v.matricula)}')" title="Gestionar documentos" style="background:#f0fdf4;color:#16a34a;border-color:#bbf7d0;">📂 Docs</button>
          ${!v.archivado ? `<button class="btn-item-action ${v.restringido?'btn-restringido':'btn-libre'}" onclick="toggleRestringido(${gi},${vi})">
            ${v.restringido?'🔒 Restringido':'🔓 Libre'}
          </button>` : ''}
          ${!v.archivado ? (v.bloqueado
            ? `<button class="btn-item-action btn-desbloquear" onclick="desbloquearVehiculoAdmin(${gi},${vi})">✅ Desbloquear</button>`
            : `<button class="btn-item-action btn-bloquear" onclick="abrirModalBloqueo(${gi},${vi})">⛔ Bloquear</button>`
          ) : ''}
          ${v.archivado
            ? `<button class="btn-item-action btn-alta" onclick="desarchivarVehiculo(${gi},${vi})">↩ Dar de alta</button>`
            : `<button class="btn-item-action btn-baja" onclick="eliminarVehiculo(${gi},${vi})" title="Dar de baja el vehículo">✕ Dar de baja</button>`
          }
        </div>
      </div>`;
    });
  });
  lista.innerHTML = html;
}

function renderAdminStats() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  let total=0, restringidos=0, alquiler=0, bloqueados=0, itvAlerta=0;
  GRUPOS.forEach(g => g.vehiculos.forEach(v => {
    if (v.archivado) return;
    total++;
    if (v.restringido) restringidos++;
    if (v.bloqueado) bloqueados++;
    const nota = (v.nota||'').trim().toUpperCase();
    if (nota !== 'PROPIEDAD') alquiler++;
    if (v.itv_fin) {
      const fin = new Date(v.itv_fin + 'T00:00:00');
      const dias = Math.ceil((fin - hoy) / 86400000);
      if (dias <= 60) itvAlerta++;
    }
  }));
  document.getElementById('admin-stats').innerHTML = `
    <div class="admin-stat-card">
      <div class="admin-stat-icon">🚛</div>
      <div class="admin-stat-num">${total}</div>
      <div class="admin-stat-label">Vehículos activos</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-icon">🔑</div>
      <div class="admin-stat-num">${alquiler}</div>
      <div class="admin-stat-label">En alquiler</div>
      <div class="admin-stat-sub">PINVECO, DFM, etc.</div>
    </div>
    <div class="admin-stat-card">
      <div class="admin-stat-icon">🔒</div>
      <div class="admin-stat-num red">${restringidos}</div>
      <div class="admin-stat-label">Restringidos</div>
      <div class="admin-stat-sub">Solo pers. autorizado</div>
    </div>
    <div class="admin-stat-card" style="${itvAlerta>0?'border-color:#fde68a;background:#fffbeb':''}">
      <div class="admin-stat-icon">🔧</div>
      <div class="admin-stat-num" style="${itvAlerta>0?'color:#d97706':''}">${itvAlerta}</div>
      <div class="admin-stat-label">ITV próximas</div>
      <div class="admin-stat-sub">Vencen en ≤60 días</div>
    </div>`;
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
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:4000;display:flex;align-items:center;justify-content:center;';
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
      } else {
        mostrarToast('Error al desbloquear: ' + (json.error||''), 'error');
        btnOk.textContent = '✓ Desbloquear'; btnOk.disabled = false;
      }
    } catch(e) {
      mostrarToast('Error de conexión', 'error');
      btnOk.textContent = '✓ Desbloquear'; btnOk.disabled = false;
    }
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
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
        ⚠️ Al cambiar el nombre, los registros de días anteriores (historial, incidencias, documentos) seguirán guardados con el nombre antiguo.
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
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#edv-guardar').onclick = () => {
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

    const antes = `${v.matricula} · ${v.tipo} · ${GRUPOS[gi].nombre}`;
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

    overlay.remove();
    renderAdminVehiculos(); renderAdminStats(); renderTabla();
    sincronizarVehiculosConSheets();
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
function confirmarNuevoVehiculo() {
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
  if (!g) { g = { nombre: grupo, vehiculos: [] }; GRUPOS.push(g); }
  g.vehiculos.push({ matricula: mat, tipo, nota, restringido: false, itv_fin, seguro_aseguradora, seguro_nombre, seguro_cif, seguro_poliza, seguro_vencimiento, seguro_tel });
  cerrarModalNuevoVehiculo();
  renderAdminVehiculos(); renderAdminStats(); renderTabla();
  sincronizarVehiculosConSheets();
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
  const estado = _matBadgeEstado(matricula);
  if (estado === 'expirado') return `<span class="mat-badge-info has-alerta-expirado" title="Seguro o ITV caducados">!</span>`;
  if (estado === 'aviso')    return `<span class="mat-badge-info has-alerta-aviso" title="Seguro o ITV vencen en menos de 30 días">!</span>`;
  if (estado === 'ok')       return `<span class="mat-badge-info has-data" title="Ver ficha del vehículo">i</span>`;
  return `<span class="mat-badge-info" title="Ver ficha del vehículo">i</span>`;
}
// ── FICHA TÉCNICA PRO ────────────────────────────────────────────────────────
// Google Drive — documentos gestionados via GAS

const FICHA_DOC_CATEGORIAS = [
  { id: 'ficha_tecnica',       label: 'Ficha técnica',         icon: '📄' },
  { id: 'permiso_circulacion', label: 'Permiso de circulación',icon: '🎟' },
  { id: 'informe_itv',         label: 'Informe ITV',           icon: '🔧' },
  { id: 'poliza_seguro',       label: 'Póliza de seguro',      icon: '🛡️' },
  { id: 'otros',               label: 'Otros',                 icon: '📎' },
];

let _fichaMat = ''; // matrícula activa en la ficha

function _fichaMatReal(m) {
  const m1 = m.match(/\b(\d{4}\s?[A-Z]{3})\b/);
  if (m1) return m1[1];
  const m2 = m.match(/\b([A-Z]{1,2}\s?\d{3,4}\s?[A-Z]{1,2})\b/);
  if (m2) return m2[1];
  return m;
}

function fichaTabSwitch(tab) {
  document.querySelectorAll('.ficha-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ficha-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.ficha-tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`ficha-panel-${tab}`).classList.add('active');
  if (tab === 'docs') _fichaCargarDocs(_fichaMat);
}

function abrirFichaVehiculo(matricula) {
  _fichaMat = matricula;
  const v = _getVehiculo(matricula);
  const matReal = _fichaMatReal(matricula);

  // ── HEADER ──
  document.getElementById('ficha-mat').textContent = matReal;
  const tipoEl = document.getElementById('ficha-tipo');
  tipoEl.textContent = v ? (v.tipo + (v.nota ? ' · ' + v.nota : '')) : '—';

  // Pills de estado
  const badgesEl = document.getElementById('ficha-header-badges');
  badgesEl.innerHTML = '';
  if (v?.bloqueado) {
    badgesEl.innerHTML += `<span class="ficha-meta-badge bloqueado">⛔ Bloqueado</span>`;
  }
  if (v?.archivado) {
    badgesEl.innerHTML += `<span class="ficha-meta-badge archivado">📦 Archivado</span>`;
  }
  // ITV badge en header
  const itv = v?.itv_fin || '';
  if (itv) {
    const hoy  = new Date(); hoy.setHours(0,0,0,0);
    const dias = Math.ceil((new Date(itv + 'T00:00:00') - hoy) / 86400000);
    if (dias <= 0)       badgesEl.innerHTML += `<span class="ficha-meta-badge itv-bad">⛔ ITV Caducada</span>`;
    else if (dias <= 30) badgesEl.innerHTML += `<span class="ficha-meta-badge itv-warn">⚠️ ITV ${dias}d</span>`;
  }

  // ── PANEL SEGURO ──
  function setVal(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    if (val && String(val).trim()) {
      el.textContent = val; el.className = 'ficha-val';
    } else {
      el.textContent = 'Sin datos'; el.className = 'ficha-val vacio';
    }
  }
  setVal('ficha-seg-aseguradora', v?.seguro_aseguradora);
  setVal('ficha-seg-nombre',      v?.seguro_nombre);
  setVal('ficha-seg-cif',         v?.seguro_cif);
  setVal('ficha-seg-poliza',      v?.seguro_poliza);

  // Vencimiento seguro
  const vencEl = document.getElementById('ficha-seg-vencimiento');
  const venc   = v?.seguro_vencimiento || '';
  const alertaEl = document.getElementById('ficha-seg-alerta');
  alertaEl.style.display = 'none';
  if (venc) {
    const hoy  = new Date(); hoy.setHours(0,0,0,0);
    const dias = Math.ceil((new Date(venc + 'T00:00:00') - hoy) / 86400000);
    const txt  = venc.split('-').reverse().join('/');
    if (dias <= 0) {
      vencEl.textContent = txt + ' ⛔'; vencEl.className = 'ficha-val itv-bad';
      alertaEl.style.display = 'flex'; alertaEl.className = 'ficha-alert bad';
      alertaEl.innerHTML = `<span class="ficha-alert-icon">⛔</span><span class="ficha-alert-text">El seguro está <strong>vencido</strong>. Contacta con la aseguradora.</span>`;
    } else if (dias <= 30) {
      vencEl.textContent = txt + ` ⚠️ ${dias}d`; vencEl.className = 'ficha-val itv-warn';
      alertaEl.style.display = 'flex'; alertaEl.className = 'ficha-alert warn';
      alertaEl.innerHTML = `<span class="ficha-alert-icon">⚠️</span><span class="ficha-alert-text">El seguro vence en <strong>${dias} días</strong>. Renuévalo pronto.</span>`;
    } else {
      vencEl.textContent = txt; vencEl.className = 'ficha-val itv-ok';
    }
  } else {
    vencEl.textContent = 'Sin datos'; vencEl.className = 'ficha-val vacio';
  }

  // Tel
  const telEl = document.getElementById('ficha-seg-tel');
  const tel   = v?.seguro_tel || '';
  if (tel) {
    telEl.innerHTML = `<a class="ficha-tel-link" href="tel:${tel.replace(/\s/g,'')}" onclick="event.stopPropagation()">📞 ${tel}</a>`;
    telEl.className = 'ficha-val';
  } else {
    telEl.textContent = 'Sin datos'; telEl.className = 'ficha-val vacio';
  }

  // ── PANEL ITV ──
  const itvBig = document.getElementById('ficha-itv-big');
  if (itv) {
    const hoy  = new Date(); hoy.setHours(0,0,0,0);
    const dias = Math.ceil((new Date(itv + 'T00:00:00') - hoy) / 86400000);
    const txt  = itv.split('-').reverse().join('/');
    let semaforoClass = 'ok', semaforoEmoji = '✅', diasClass = 'ok', diasTxt = `${dias} días restantes`;
    if (dias <= 0)       { semaforoClass = 'bad';  semaforoEmoji = '⛔'; diasClass = 'bad';  diasTxt = 'CADUCADA'; }
    else if (dias <= 30) { semaforoClass = 'warn'; semaforoEmoji = '⚠️'; diasClass = 'warn'; diasTxt = `${dias} días restantes`; }
    itvBig.innerHTML = `
      <div class="ficha-itv-semaforo ${semaforoClass}">${semaforoEmoji}</div>
      <div class="ficha-itv-info">
        <div class="ficha-itv-fecha">${txt}</div>
        <div class="ficha-itv-desc">Próxima ITV</div>
        <div class="ficha-itv-dias ${diasClass}">${diasTxt}</div>
      </div>`;
  } else {
    itvBig.innerHTML = `
      <div class="ficha-itv-semaforo bad">—</div>
      <div class="ficha-itv-info">
        <div class="ficha-itv-fecha" style="color:#b0bac8;font-size:15px;font-style:italic">Sin registrar</div>
        <div class="ficha-itv-desc">No hay fecha de ITV en el sistema</div>
      </div>`;
  }

  // ── PANEL DOCS — se carga al abrir la pestaña ──
  document.getElementById('ficha-docs-content').innerHTML =
    `<div class="ficha-docs-loading"><div class="ficha-spinner"></div>Carga la pestaña para ver los documentos</div>`;

  // Activar primera pestaña (seguro)
  document.querySelectorAll('.ficha-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ficha-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.ficha-tab[data-tab="seguro"]').classList.add('active');
  document.getElementById('ficha-panel-seguro').classList.add('active');

  document.getElementById('modal-ficha-vehiculo').classList.add('visible');
}

async function _fichaCargarDocs(matricula) {
  const cont = document.getElementById('ficha-docs-content');
  cont.innerHTML = `<div class="ficha-docs-loading"><div class="ficha-spinner"></div>Cargando documentos…</div>`;
  try {
    const r = await fetch(`${APPS_SCRIPT_URL}?accion=cargarDocumentos&matricula=${encodeURIComponent(matricula)}`);
    const d = await r.json();
    _fichaRenderDocs(d.docs || []);
  } catch(e) {
    cont.innerHTML = `<div class="ficha-docs-loading" style="color:#e84545">Error al cargar documentos</div>`;
  }
}

function _fichaRenderDocs(docs) {
  const cont = document.getElementById('ficha-docs-content');
  cont.innerHTML = '';
  // Agrupar por categoría
  FICHA_DOC_CATEGORIAS.forEach(cat => {
    const catDocs = docs.filter(d => d.categoria === cat.id);
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="ficha-docs-cat-title">${cat.icon} ${cat.label}</div>`;
    if (catDocs.length === 0) {
      wrap.innerHTML += `<div class="ficha-doc-empty">Sin documentos en esta categoría</div>`;
    } else {
      catDocs.forEach(doc => {
        const isPdf = (doc.formato || '').toLowerCase() === 'pdf' || (doc.nombre || '').toLowerCase().endsWith('.pdf');
        const icono = isPdf ? '📄' : '🖼️';
        const fecha = doc.fecha ? new Date(doc.fecha).toLocaleDateString('es-ES', {day:'2-digit',month:'short',year:'numeric'}) : '—';
        wrap.innerHTML += `
          <div class="ficha-doc-card">
            <div class="ficha-doc-icon">${icono}</div>
            <div class="ficha-doc-info">
              <div class="ficha-doc-nombre" title="${esc(doc.nombre)}">${esc(doc.nombre || 'Sin nombre')}</div>
              <div class="ficha-doc-fecha">Subido: ${fecha} · ${esc(doc.subido_por || '—')}</div>
            </div>
            <button class="ficha-doc-btn ver" onclick="event.stopPropagation();abrirVisorDoc('${esc(doc.url)}','${esc(doc.nombre||'')}','${esc(doc.formato||'')}')">👁 Ver</button>
          </div>`;
      });
    }
    cont.appendChild(wrap);
  });
  if (docs.length === 0) {
    cont.innerHTML = `<div class="ficha-doc-empty" style="padding:28px;font-size:13px">
      <div style="font-size:32px;margin-bottom:8px">📂</div>
      No hay documentos asociados a este vehículo.<br>
      <span style="font-size:11px;color:#c0cad8">Puedes añadirlos desde el Panel Admin.</span>
    </div>`;
  }
}

function cerrarFichaVehiculo() {
  document.getElementById('modal-ficha-vehiculo').classList.remove('visible');
  _fichaMat = '';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // Primero cierra el visor si está abierto, luego la ficha
    const visor = document.getElementById('modal-visor-doc');
    if (visor && visor.classList.contains('visible')) {
      cerrarVisorDoc();
    } else {
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

  // URL de descarga directa (Drive)
  const fileIdMatch = url.match(/\/file\/d\/([^/]+)/);
  const fileId      = fileIdMatch ? fileIdMatch[1] : null;
  btnDl.href        = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : url;
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
    await _visorRenderPdf(url, fileId);
  } else {
    imgControls.style.display = 'flex';
    imgEl.classList.add('active');
    imgEl.src = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200` : url;
    imgEl.onload  = () => loading.classList.remove('active');
    imgEl.onerror = () => loading.classList.remove('active');
  }
}

async function _visorRenderPdf(url, fileId) {
  const loading = document.getElementById('visor-loading');
  const pdfCont = document.getElementById('visor-pdf-container');

  // Esperar a que PDF.js esté disponible (carga async)
  if (!window._pdfjs) {
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!window._pdfjs) {
    _visorMostrarErrorPdf('PDF.js no disponible. Recarga la página e inténtalo de nuevo.', url, fileId);
    return;
  }

  const pdfjsLib = window._pdfjs;

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

async function _visorRenderPaginas() {
  const pdfCont = document.getElementById('visor-pdf-container');
  if (!_visorPdfDoc) return;
  pdfCont.innerHTML = '';
  const totalPages = _visorPdfDoc.numPages;
  for (let p = 1; p <= totalPages; p++) {
    const page   = await _visorPdfDoc.getPage(p);
    const rotacionTotal = (page.rotate + _visorRotDeg) % 360;
    const vp     = page.getViewport({ scale: _visorZoom, rotation: rotacionTotal });
    const canvas = document.createElement('canvas');
    canvas.className = 'visor-pdf-page';
    canvas.width  = vp.width;
    canvas.height = vp.height;
    pdfCont.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  }
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
  setTimeout(() => {
    pdfCont.innerHTML = '';
    pdfCont.classList.remove('active');
    imgEl.classList.remove('active');
    imgEl.src = '';
    imgEl.style.transform = 'none';
    loading.classList.remove('active');
    _visorPdfDoc = null;
    _visorRotDeg = 0;
    _visorZoom   = 1.0;
    _visorImgDeg = 0;
  }, 300);
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

