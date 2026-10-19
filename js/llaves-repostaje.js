// ════════════════════════════════════════════════════════════════════════════
// RECIBIR LLAVES
// ════════════════════════════════════════════════════════════════════════════
function abrirModalRecibirLlaves() {
  if (!usuarioActual) {
    mostrarToast('Debes iniciar sesión para recibir llaves', 'error');
    return;
  }
  document.getElementById('modal-recibir-llaves').classList.add('open');
  renderListaRecibirLlaves();
}

function cerrarModalRecibirLlaves() {
  document.getElementById('modal-recibir-llaves').classList.remove('open');
}

function renderListaRecibirLlaves() {
  const lista = document.getElementById('recibir-llaves-lista');

  // Vehículos con operario asignado y sin resp_recibe aún
  const pendientes = [];
  GRUPOS.forEach(g => g.vehiculos.forEach(v => {
    const d = getDato(v.matricula);
    if (d.operario && d.operario.trim() && !(d.resp_recibe && d.resp_recibe.trim())) {
      pendientes.push({ v, d });
    }
  }));

  if (!pendientes.length) {
    lista.innerHTML = `
      <div style="text-align:center;padding:50px 20px;color:#8899aa">
        <div style="font-size:36px;margin-bottom:12px">✅</div>
        <div style="font-size:15px;font-weight:800;color:#1a1a2e">Todo recibido</div>
        <div style="font-size:12px;margin-top:6px">No hay vehículos pendientes de recibir llaves en este turno.</div>
      </div>`;
    return;
  }

  lista.innerHTML = pendientes.map(({ v, d }) => `
    <div style="display:flex;align-items:center;gap:12px;background:#f7f8fa;border:1.5px solid #dde1e8;border-radius:10px;padding:12px 14px;" id="rl-row-${CSS.escape(v.matricula)}">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:12px;font-weight:800;color:#1a1a2e;background:#e8eaef;border-radius:5px;padding:2px 8px;white-space:nowrap">${esc(v.matricula)}</span>
          <span style="font-size:10px;color:#8899aa;font-weight:700">${esc(v.tipo)}</span>
        </div>
        <div style="font-size:12px;color:#334;font-weight:700">👤 ${esc(d.operario)}</div>
        <div style="font-size:10px;color:#8899aa;margin-top:2px">Entregado por: <strong>${esc(d.resp_entrega||'—')}</strong></div>
      </div>
      <button onclick="confirmarRecibirLlave('${esc(v.matricula)}')"
        style="flex-shrink:0;padding:9px 18px;background:#1a3a2a;color:#4ade80;border:1.5px solid #2a5a3a;border-radius:9px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;transition:all .15s;white-space:nowrap"
        onmouseover="this.style.background='#15532e';this.style.color='#86efac'"
        onmouseout="this.style.background='#1a3a2a';this.style.color='#4ade80'">
        ✓ Recibir llave
      </button>
    </div>`).join('');
}

function pedirConfirmacionRecibirLlave(matricula) {
  const modal = document.getElementById('modal-confirmar-recibir-llaves');
  const label = document.getElementById('confirmar-recibir-matricula');
  const btn   = document.getElementById('btn-confirmar-recibir-ok');
  if (label) label.textContent = matricula;
  if (btn)   btn.onclick = () => {
    modal.classList.remove('open');
    confirmarRecibirLlave(matricula);
  };
  if (modal) modal.classList.add('open');
}

async function confirmarRecibirLlave(matricula) {
  if (!usuarioActual) return;

  // Mostrar modal de confirmando recepción
  const modalConf = document.getElementById('modal-confirmando-recepcion');
  const matLabel  = document.getElementById('confirmando-recepcion-matricula');
  if (matLabel) matLabel.textContent = matricula;
  if (modalConf) modalConf.classList.add('open');

  const ahora = new Date();
  const horaStr = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const valorRecibe = usuarioActual.nombre || usuarioActual.numUsuario;

  // Guardar en datos locales
  setDato(matricula, 'resp_recibe', valorRecibe);
  setDato(matricula, 'hora_devolucion', horaStr); // hora de devolución

  // Actualizar la fila del modal visualmente (eliminarla de pendientes)
  const rowId = 'rl-row-' + CSS.escape(matricula);
  const rowEl = document.getElementById(rowId);
  if (rowEl) {
    rowEl.style.opacity = '0.4';
    rowEl.style.pointerEvents = 'none';
    rowEl.querySelector('button').textContent = '✓ Recibido';
    rowEl.style.borderColor = '#2ecc71';
    rowEl.style.background = '#f0fff4';
  }

  // Guardar inmediatamente en Sheets
  await guardarTodo();

  // Cerrar modal de confirmando y mostrar resultado
  if (modalConf) modalConf.classList.remove('open');

  mostrarToast(`✓ Llaves de ${matricula} recibidas — ${horaStr}`, 'success');
  renderTabla(); // reflejar resp_recibe en la tabla principal

  // Después de un momento, re-renderizar lista para quitar el vehículo
  setTimeout(() => renderListaRecibirLlaves(), 600);
}

// ════════════════════════════════════════════════════════════════════════════
// REPOSTAJE
// ════════════════════════════════════════════════════════════════════════════

// Devuelve una lista plana { matricula, tipo } de todos los vehículos de la flota
function listaMatriculasRepostaje() {
  const lista = [];
  GRUPOS.forEach(g => g.vehiculos.forEach(v => lista.push({ matricula: v.matricula, tipo: v.tipo })));
  return lista;
}

// Abre el modal de repostaje preseleccionando la matrícula indicada
function abrirModalRepostajeConMat(matricula) {
  abrirModalRepostaje();
  const sel = document.getElementById('repo-matricula');
  if (sel) { sel.value = matricula; onCambioMatriculaRepostaje(); }
}

// ── Dropdown operarios para el campo chofer del modal de repostaje ────────────
let _repoDropdownAbierto = false;
let _repoDropdownInput   = null;

function abrirBuscadorOperarioRepo(input) {
  _repoDropdownInput = input;
  _repoDropdownAbierto = true;
  filtrarBuscadorOperarioRepo(input);
}

function filtrarBuscadorOperarioRepo(input) {
  const q = (input.value || '').trim().toUpperCase();
  const dd = document.getElementById('operario-dropdown-repo');
  if (!dd) return;
  const lista = CONDUCTORES.filter(c =>
    !q ||
    c.nombre.toUpperCase().includes(q) ||
    (c.dni||'').toUpperCase().includes(q) ||
    String(c.numUsuario||'').includes(q)
  );
  const list = dd.querySelector('.operario-dropdown-list');
  list.innerHTML = lista.length
    ? lista.map(c => `<div class="operario-dropdown-item" onmousedown="seleccionarConductorRepo('${esc(c.nombre)}')">
        <span class="operario-item-nombre">${esc(c.nombre)}</span>
        <span class="operario-item-meta">${esc(c.sociedad||'')} · DNI ${esc(c.dni)} · Nº ${esc(String(c.numUsuario))}</span>
      </div>`).join('')
    : '<div class="operario-dropdown-empty">Sin resultados</div>';
  // Posicionar el dropdown: abajo si hay espacio, si no, arriba
  const rect = input.getBoundingClientRect();
  const ddH2 = 260;
  const spaceBelow2 = window.innerHeight - rect.bottom - 4;
  const spaceAbove2 = rect.top - 4;
  if (spaceBelow2 >= ddH2 || spaceBelow2 >= spaceAbove2) {
    dd.style.top    = (rect.bottom + 4) + 'px';
    dd.style.bottom = 'auto';
  } else {
    dd.style.top    = 'auto';
    dd.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
  }
  dd.style.left   = rect.left + 'px';
  dd.style.width  = Math.max(280, rect.width) + 'px';
  dd.classList.add('open');
}

function seleccionarConductorRepo(nombre) {
  const input = document.getElementById('repo-chofer');
  if (input) input.value = nombre;
  const dd = document.getElementById('operario-dropdown-repo');
  if (dd) dd.classList.remove('open');
  _repoDropdownAbierto = false;
}

document.addEventListener('click', (e) => {
  if (!_repoDropdownAbierto) return;
  const dd = document.getElementById('operario-dropdown-repo');
  const input = document.getElementById('repo-chofer');
  if (dd && !dd.contains(e.target) && e.target !== input) {
    dd.classList.remove('open');
    _repoDropdownAbierto = false;
  }
});

// ── Selector de nivel GASOIL ──────────────────────────────────────────────────
function abrirSelectorGasoil(event) {
  event.stopPropagation();
  const dd = document.getElementById('dropdown-gasoil');
  const ddA = document.getElementById('dropdown-adblue');
  if (ddA) ddA.style.display = 'none';
  if (!dd) return;
  if (dd.style.display === 'block') { dd.style.display = 'none'; return; }
  const rect = event.currentTarget.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 6) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.display = 'block';
}

function setGasoil(pct) {
  document.getElementById('dropdown-gasoil').style.display = 'none';
  document.getElementById('repo-gasoil-antes').value = pct;

  // Actualizar aguja del velocímetro
  const needle = document.getElementById('needle-gasoil');
  const arcFill = document.getElementById('arc-fill-gasoil');
  const pctLabel = document.getElementById('pct-gasoil');

  if (needle) {
    // La aguja parte apuntando a la izquierda (E), 0%=0deg, 100%=180deg
    const deg = (pct / 100) * 180;
    needle.style.transform = 'rotate(' + deg + 'deg)';
  }

  if (arcFill) {
    // Con pathLength=100, stroke-dasharray trabaja directamente en %
    let color = '#ef4444';
    if (pct >= 50) color = '#22c55e';
    else if (pct >= 25) color = '#f97316';
    arcFill.setAttribute('stroke-dasharray', pct + ' ' + (100 - pct));
    arcFill.setAttribute('stroke', color);
    arcFill.style.opacity = '1';
  }

  if (pctLabel) pctLabel.textContent = pct + '%';
}

function toggleSinAdblue(sinAdblue) {
  const gauge = document.getElementById('wrap-adblue-gauge');
  const badge = document.getElementById('wrap-sin-adblue');
  const hidden = document.getElementById('repo-adblue-antes');
  const dd = document.getElementById('dropdown-adblue');
  if (sinAdblue) {
    gauge.style.display = 'none';
    badge.style.display = 'block';
    dd.style.display = 'none';
    hidden.value = 'N/A';
  } else {
    gauge.style.display = 'block';
    badge.style.display = 'none';
    hidden.value = '';
  }
}
  
// ── Selector de nivel ADBLUE ──────────────────────────────────────────────────
function abrirSelectorAdblue(event) {
  event.stopPropagation();
  const dd = document.getElementById('dropdown-adblue');
  const ddG = document.getElementById('dropdown-gasoil');
  if (ddG) ddG.style.display = 'none';
  if (!dd) return;
  if (dd.style.display === 'block') { dd.style.display = 'none'; return; }
  const rect = event.currentTarget.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 6) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.display = 'block';
}

function setAdblue(pct) {
  document.getElementById('dropdown-adblue').style.display = 'none';
  document.getElementById('repo-adblue-antes').value = pct;

  // Actualizar barra horizontal
  const fill = document.getElementById('fill-adblue');
  const pctLabel = document.getElementById('pct-adblue');

  if (fill) {
    // Barra: x=12, ancho máximo=96
    const w = (pct / 100) * 96;
    fill.setAttribute('width', w);
  }

  if (pctLabel) pctLabel.textContent = pct > 0 ? pct + '%' : '—';
}

// Cerrar dropdowns al hacer clic fuera
document.addEventListener('click', function() {
  const ddG = document.getElementById('dropdown-gasoil');
  const ddA = document.getElementById('dropdown-adblue');
  const ddDG = document.getElementById('dropdown-dev-gasoil');
  const ddDA = document.getElementById('dropdown-dev-adblue');
  if (ddG)  ddG.style.display  = 'none';
  if (ddA)  ddA.style.display  = 'none';
  if (ddDG) ddDG.style.display = 'none';
  if (ddDA) ddDA.style.display = 'none';
});

function abrirModalRepostaje() {
  if (!usuarioActual) {
    mostrarToast('Debes iniciar sesión para registrar un repostaje', 'error');
    return;
  }

  // El campo matrícula es de solo lectura, se rellena en abrirModalRepostajeConMat()
  document.getElementById('repo-matricula').value = '';

  // Fecha y hora automáticas
  const ahora = new Date();
  const fecha = fechaActual || (ahora.getFullYear() + '-' + String(ahora.getMonth()+1).padStart(2,'0') + '-' + String(ahora.getDate()).padStart(2,'0'));
  const hora  = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  // Mostrar fecha en formato DD-MM-AAAA
  const fechaDisplay = fecha ? fecha.split('-').reverse().join('-') : fecha;

  // Actualizar pills de cabecera
  const pillFecha = document.getElementById('repo-pill-fecha');
  const pillTurno = document.getElementById('repo-pill-turno');
  const pillHora  = document.getElementById('repo-pill-hora');
  if (pillFecha) pillFecha.textContent = '📅 ' + fechaDisplay;
  if (pillHora)  pillHora.textContent  = '🕐 ' + hora;
  if (pillTurno) {
    const esMañana = turnoActual === 'MANANA';
    pillTurno.textContent = '● ' + (esMañana ? 'Mañana' : 'Tarde');
    pillTurno.style.background    = esMañana ? '#fffbeb' : '#fff5f0';
    pillTurno.style.borderColor   = esMañana ? '#fde68a' : '#fecaca';
    pillTurno.style.color         = esMañana ? '#92600a' : '#9a3412';
  }

  // Valores por defecto
  document.getElementById('repo-tarjeta').value = ''; document.getElementById('repo-tarjeta').style.color = '#b0bac8';
  document.getElementById('repo-km').value            = '';
  document.getElementById('repo-gasoil-antes').value   = '';
  document.getElementById('repo-adblue-antes').value   = '';

  // Resetear visualmente el velocímetro gasoil
  const needle = document.getElementById('needle-gasoil');
  const arcFill = document.getElementById('arc-fill-gasoil');
  const pctGasoil = document.getElementById('pct-gasoil');
  if (needle)   { needle.style.transform = 'rotate(-90deg)'; }
  if (arcFill)  { arcFill.setAttribute('stroke-dasharray', '0 100'); arcFill.setAttribute('stroke', '#dde1ea'); arcFill.style.opacity = '0'; }
  if (pctGasoil){ pctGasoil.textContent = '—'; }

  // Resetear visualmente la barra adblue
  const fillAdblue = document.getElementById('fill-adblue');
  const pctAdblue  = document.getElementById('pct-adblue');
  if (fillAdblue) fillAdblue.setAttribute('width', '0');
  if (pctAdblue)  pctAdblue.textContent = '—';
  // Resetear checkbox "Sin AdBlue"
  const chkSinAdblue = document.getElementById('chk-sin-adblue');
  if (chkSinAdblue) chkSinAdblue.checked = false;
  const wrapGauge = document.getElementById('wrap-adblue-gauge');
  const wrapBadge = document.getElementById('wrap-sin-adblue');
  if (wrapGauge) wrapGauge.style.display = 'block';
  if (wrapBadge) wrapBadge.style.display = 'none';
  document.getElementById('repo-chofer').value         = '';

  // Resetear botón por si quedó en estado de carga
  const btnEnviar = document.getElementById('btn-enviar-repostaje');
  if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.textContent = '⛽ Entregar tarjeta y registrar'; }

  onCambioMatriculaRepostaje();

  document.getElementById('modal-registrar-repostaje').classList.add('open');
}

function cerrarModalRepostaje() {
  document.getElementById('modal-registrar-repostaje').classList.remove('open');
}

// Al elegir la matrícula, autocompleta el chofer si ya hay un conductor asignado en el cuadrante
function onCambioMatriculaRepostaje() {
  const matricula = document.getElementById('repo-matricula').value;
  const choferInput = document.getElementById('repo-chofer');
  if (!matricula) return;
  const d = getDato(matricula);
  if (d && d.operario && d.operario.trim() && !choferInput.value.trim()) {
    choferInput.value = d.operario;
  }
}

// Fuerza a que el campo de kilometraje solo admita dígitos (sin puntos, comas ni otros caracteres)
// para evitar que se interprete un punto de miles como decimal.
function soloDigitosKm(input) {
  const limpio = input.value.replace(/[^0-9]/g, '');
  if (limpio !== input.value) input.value = limpio;
}

// Resalta en rojo un campo de kilometraje cuando el backend rechaza el valor introducido
// (kilometraje menor al último registrado, o salto de más de 800 km respecto al anterior)
function resaltarCampoErrorKm(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.style.borderColor = '#e84545';
  input.style.boxShadow = '0 0 0 3px rgba(232,69,69,0.15)';
  input.focus();
  input.select();
  setTimeout(() => { input.style.borderColor = '#dde1ea'; input.style.boxShadow = 'none'; }, 2500);
}

// Modal centrado (no toast) para avisar de un kilometraje no válido
function mostrarModalErrorKm(mensaje) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:6000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:34px 30px;width:380px;max-width:92vw;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1)">
      <div style="font-size:44px;margin-bottom:14px;">⚠️</div>
      <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:10px;">Kilometraje no válido</div>
      <div style="font-size:13px;color:#5a6478;line-height:1.6;margin-bottom:24px;">${esc(mensaje)}</div>
      <button id="btn-cerrar-modal-km" style="background:#e84545;color:#fff;border:none;border-radius:10px;padding:11px 30px;font-size:13px;font-weight:800;font-family:Barlow,sans-serif;cursor:pointer;">Entendido</button>
    </div>`;
  document.body.appendChild(modal);
  const cerrar = () => { if (document.body.contains(modal)) document.body.removeChild(modal); };
  modal.querySelector('#btn-cerrar-modal-km').addEventListener('click', cerrar);
  modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); });
}

async function enviarRegistroRepostaje() {
  if (!usuarioActual) return;

  const matricula     = document.getElementById('repo-matricula').value;
  const chofer        = document.getElementById('repo-chofer').value.trim();
  const km            = document.getElementById('repo-km').value.trim();
  const tarjeta       = document.getElementById('repo-tarjeta').value;
  const gasoilAntes   = document.getElementById('repo-gasoil-antes').value;
  const adblueAntes   = document.getElementById('repo-adblue-antes').value;

  if (!matricula)   { mostrarToast('Selecciona la matrícula', 'error'); return; }
  if (!tarjeta)     { const sel = document.getElementById('repo-tarjeta'); sel.style.borderColor='#e84545'; sel.style.boxShadow='0 0 0 3px rgba(232,69,69,0.15)'; mostrarToast('Selecciona el número de tarjeta', 'error'); sel.focus(); setTimeout(()=>{sel.style.borderColor='#dde1ea';sel.style.boxShadow='none';},2500); return; }
  if (!chofer)      { mostrarToast('Indica el usuario/chofer', 'error'); return; }
  if (km === '')    { mostrarToast('Indica el kilometraje', 'error'); return; }
  if (gasoilAntes === '' || adblueAntes === '') {
    mostrarToast('Indica los depósitos antes de repostar', 'error');
    return;
  }

  const ahora = new Date();
  const fecha = fechaActual || (ahora.getFullYear() + '-' + String(ahora.getMonth()+1).padStart(2,'0') + '-' + String(ahora.getDate()).padStart(2,'0'));
  const hora  = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const repostaje = {
    fecha,
    matricula,
    usuario_chofer:  chofer,
    kilometraje:     km,
    num_tarjeta:     tarjeta,
    hora_entrega:    hora,
    gasoil_antes:    gasoilAntes,
    adblue_antes:    adblueAntes,
    resp_entrega:    usuarioActual.nombre || usuarioActual.numUsuario,
  };

  const btn = document.getElementById('btn-enviar-repostaje');
  const txtOriginal = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

  // Modal de progreso (igual que incidencias)
  const modalProgreso = document.createElement('div');
  modalProgreso.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:5000;display:flex;align-items:center;justify-content:center;';
  modalProgreso.innerHTML = `
    <div style="background:white;border-radius:16px;padding:36px 32px;width:360px;max-width:94vw;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1)">
      <div style="font-size:44px;margin-bottom:14px;">⛽</div>
      <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:8px;">Registrando repostaje</div>
      <div id="modal-progreso-msg" style="font-size:12px;color:#8899aa;line-height:1.6;margin-bottom:22px;">Guardando en el sistema…<br>Por favor, espere un momento.</div>
      <div style="display:flex;justify-content:center;gap:7px;align-items:center;">
        <div style="width:9px;height:9px;border-radius:50%;background:#e8a23d;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0s"></div>
        <div style="width:9px;height:9px;border-radius:50%;background:#e8a23d;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0.2s"></div>
        <div style="width:9px;height:9px;border-radius:50%;background:#e8a23d;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0.4s"></div>
      </div>
    </div>`;
  document.body.appendChild(modalProgreso);

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'registrarRepostaje', repostaje }),
      redirect: 'follow'
    });
    const json = await resp.json();
    if (json.ok) {
      cerrarModalRepostaje();
      // Escribir num_tarjeta en el cuadrante para que se guarde en la hoja Registros
      setDato(matricula, 'num_tarjeta', tarjeta);
      programarGuardado();
      // Actualizar badge en el cuadrante — mantener modal hasta que todo esté listo
      const msgEl = document.getElementById('modal-progreso-msg');
      if (msgEl) msgEl.innerHTML = 'Sincronizando repostajes…<br>Un momento.';
      await sincronizarRepostajesPendientes();
      await sincronizarRepostajesFecha();
      if (msgEl) msgEl.innerHTML = 'Actualizando cuadrante…';
      renderTabla();
      document.body.removeChild(modalProgreso);
      registrarAccion('REPOSTAJE', 'Registrar repostaje (entrega tarjeta)', `${matricula} · tarjeta ${tarjeta} · km ${km}`);
      mostrarToast(`⛽ Tarjeta GASOIL entregada para ${matricula} — ${hora}`, 'success');
    } else {
      document.body.removeChild(modalProgreso);
      if ((json.error||'').toLowerCase().includes('kilometraje')) {
        resaltarCampoErrorKm('repo-km');
        mostrarModalErrorKm(json.error);
      } else {
        mostrarToast('⚠️ No se pudo registrar el repostaje: ' + (json.error||'error'), 'error');
      }
    }
  } catch (e) {
    if (document.body.contains(modalProgreso)) document.body.removeChild(modalProgreso);
    mostrarToast('⚠️ Error de conexión al registrar el repostaje', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txtOriginal; }
  }
}

function abrirModalRepostajesPendientes() {
  if (!usuarioActual) {
    mostrarToast('Debes iniciar sesión para ver los repostajes pendientes', 'error');
    return;
  }
  document.getElementById('modal-repostajes-pendientes').classList.add('open');
  cargarRepostajesPendientes();
}

function cerrarModalRepostajesPendientes() {
  document.getElementById('modal-repostajes-pendientes').classList.remove('open');
}

async function cargarRepostajesPendientes() {
  const lista = document.getElementById('repostajes-pendientes-lista');
  lista.innerHTML = `<div style="text-align:center;padding:40px;color:#8899aa;font-size:13px">⏳ Cargando datos un momento por favor…</div>`;
  try {
    const resp = await fetch(APPS_SCRIPT_URL + '?accion=cargarRepostajesPendientes&_t=' + Date.now(), { redirect: 'follow', cache: 'no-store' });
    const json = await resp.json();
    renderListaRepostajesPendientes(json.ok ? (json.filas||[]) : []);
  } catch (e) {
    lista.innerHTML = `<div style="text-align:center;padding:40px;color:#e84545;font-size:13px">⚠️ Error al cargar los repostajes pendientes</div>`;
  }
}

function renderListaRepostajesPendientes(filas) {
  const lista = document.getElementById('repostajes-pendientes-lista');

  if (!filas.length) {
    lista.innerHTML = `
      <div style="text-align:center;padding:50px 20px;color:#8899aa">
        <div style="font-size:36px;margin-bottom:12px">✅</div>
        <div style="font-size:15px;font-weight:800;color:#1a1a2e">Sin repostajes pendientes</div>
        <div style="font-size:12px;margin-top:6px">Todas las tarjetas GASOIL han sido devueltas.</div>
      </div>`;
    return;
  }

  lista.innerHTML = filas.map(f => `
    <div class="repo-pend-row" id="rp-row-${esc(f.id)}" data-gasoil-antes="${esc(f.gasoil_antes)}" data-adblue-antes="${esc(f.adblue_antes)}">
      <div class="repo-pend-info">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:800;color:#1a1a2e;background:#e8eaef;border-radius:5px;padding:2px 8px;white-space:nowrap">${esc(f.matricula)}</span>
          <span style="font-size:10px;color:#8899aa;font-weight:700">🪪 ${esc(f.num_tarjeta)}</span>
          <span style="font-size:10px;color:#8899aa;font-weight:700">🛣️ ${esc(f.kilometraje)} km</span>
        </div>
        <div style="font-size:12px;color:#334;font-weight:700">👤 ${esc(f.usuario_chofer)}</div>
        <div style="font-size:10px;color:#8899aa;margin-top:2px">
          Entregada por <strong>${esc(f.resp_entrega||'—')}</strong> a las <strong>${esc(f.hora_entrega||'—')}</strong>
          &nbsp;·&nbsp; Antes: ⛽ ${esc(f.gasoil_antes)}% &nbsp; 🧪 AdBlue ${esc(f.adblue_antes)}%
        </div>
      </div>
      <div class="repo-pend-inputs">
        <div class="repo-field">
          <label>Gasoil después (%)</label>
          <input type="number" min="0" max="100" placeholder="0-100" id="rp-gasoil-${esc(f.id)}">
        </div>
        <div class="repo-field">
          <label>AdBlue después (%)</label>
          <input type="number" min="0" max="100" placeholder="0-100" id="rp-adblue-${esc(f.id)}">
        </div>
        <div class="repo-field">
          <label>Referencia ticket <span style="color:#e84545">*</span></label>
          <input type="text" placeholder="Nº de ticket" id="rp-ticket-ref-${esc(f.id)}">
        </div>
        <div class="repo-field">
          <label>Importe € <span style="color:#e84545">*</span></label>
          <input type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" id="rp-ticket-importe-${esc(f.id)}">
        </div>
        <button class="btn-confirmar-repo" onclick="confirmarDevolucionRepostaje('${esc(f.id)}','${esc(f.matricula)}')">✓ Confirmar devolución</button>
      </div>
    </div>`).join('');
}

// ── MODAL: INCIDENCIAS PENDIENTES ───────────────────────────────────────────
async function actualizarBotonIncidenciasPendientes() {
  if (!APPS_SCRIPT_URL || !usuarioActual) return;
  const btn = document.getElementById('btn-incidencias-pendientes');
  if (!btn) return;
  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?accion=cargarIncidencias&_t=${Date.now()}`, { redirect: 'follow', cache: 'no-store' });
    const json = await resp.json();
    const pendientes = (json.ok ? (json.filas||[]) : []).filter(f => (f.estado||'').toUpperCase() !== 'COMPLETADO');
    if (pendientes.length > 0) {
      btn.classList.add('btn-incidencias-alerta');
      btn.textContent = `⚠️ ${pendientes.length} incidencia${pendientes.length === 1 ? '' : 's'} pendiente${pendientes.length === 1 ? '' : 's'}`;
    } else {
      btn.classList.remove('btn-incidencias-alerta');
      btn.textContent = '✅ Sin incidencias pendientes';
    }
  } catch(e) { /* si falla, se deja el último estado conocido */ }
}

let incidPendModalState = { verResueltas: false };

function abrirModalIncidenciasPendientes() {
  if (!usuarioActual) {
    mostrarToast('Debes iniciar sesión para ver las incidencias pendientes', 'error');
    return;
  }
  incidPendModalState.verResueltas = false;
  const btnToggle = document.getElementById('btn-toggle-incid-resueltas');
  if (btnToggle) {
    btnToggle.textContent = '📋 Ver incidencias resueltas';
    btnToggle.style.background = '#eafaf1';
    btnToggle.style.color = '#1a6635';
    btnToggle.style.borderColor = '#a9dfbf';
  }
  const fMat = document.getElementById('incid-pend-filtro-matricula');
  const fDesde = document.getElementById('incid-pend-filtro-desde');
  const fHasta = document.getElementById('incid-pend-filtro-hasta');
  if (fMat) fMat.value = '';
  if (fDesde) fDesde.value = '';
  if (fHasta) fHasta.value = '';
  const subt = document.getElementById('incid-pend-subtitulo');
  if (subt) subt.textContent = 'Incidencias de flota que aún no se han resuelto';
  document.getElementById('modal-incidencias-pendientes').classList.add('open');
  cargarIncidenciasPendientesModal();
}

function cerrarModalIncidenciasPendientes() {
  document.getElementById('modal-incidencias-pendientes').classList.remove('open');
}

function limpiarFiltroIncidenciasPendientesModal() {
  const fMat = document.getElementById('incid-pend-filtro-matricula');
  const fDesde = document.getElementById('incid-pend-filtro-desde');
  const fHasta = document.getElementById('incid-pend-filtro-hasta');
  if (fMat) fMat.value = '';
  if (fDesde) fDesde.value = '';
  if (fHasta) fHasta.value = '';
  cargarIncidenciasPendientesModal();
}

function toggleIncidenciasResueltasModal() {
  incidPendModalState.verResueltas = !incidPendModalState.verResueltas;
  const btn = document.getElementById('btn-toggle-incid-resueltas');
  if (btn) {
    if (incidPendModalState.verResueltas) {
      btn.textContent = '⬅ Ver pendientes';
      btn.style.background = '#eef0f5';
      btn.style.color = '#1a1a2e';
      btn.style.borderColor = '#d5d9e2';
    } else {
      btn.textContent = '📋 Ver incidencias resueltas';
      btn.style.background = '#eafaf1';
      btn.style.color = '#1a6635';
      btn.style.borderColor = '#a9dfbf';
    }
  }
  cargarIncidenciasPendientesModal();
}

let incidPendModalFilas = [];

function buscarVehiculoPorMatricula(matricula) {
  if (!matricula || typeof GRUPOS === 'undefined') return null;
  for (const g of GRUPOS) {
    const v = (g.vehiculos || []).find(v => v.matricula === matricula);
    if (v) return v;
  }
  return null;
}

async function cargarIncidenciasPendientesModal() {
  const lista = document.getElementById('incidencias-pendientes-lista');
  lista.innerHTML = `<div style="text-align:center;padding:40px;color:#8899aa;font-size:13px">⏳ Cargando datos un momento por favor…</div>`;

  const matricula = (document.getElementById('incid-pend-filtro-matricula')?.value || '').trim();
  const desde     = document.getElementById('incid-pend-filtro-desde')?.value || '';
  const hasta     = document.getElementById('incid-pend-filtro-hasta')?.value || '';

  try {
    let url = `${APPS_SCRIPT_URL}?accion=cargarIncidencias&_t=${Date.now()}`;
    if (desde)     url += `&desde=${encodeURIComponent(desde)}`;
    if (hasta)     url += `&hasta=${encodeURIComponent(hasta)}`;
    if (matricula) url += `&matricula=${encodeURIComponent(matricula)}`;

    const resp = await fetch(url, { redirect: 'follow', cache: 'no-store' });
    const json = await resp.json();
    const todas = json.ok ? (json.filas||[]) : [];
    const filtradas = incidPendModalState.verResueltas
      ? todas.filter(f => (f.estado||'').toUpperCase() === 'COMPLETADO')
      : todas.filter(f => (f.estado||'').toUpperCase() !== 'COMPLETADO');
    // Averías enlazadas (js/mantenimiento.js) para mostrar su estado en cada tarjeta
    let averiasMap = {};
    try {
      if (typeof mantAveriasPorIncidencia === 'function') averiasMap = await mantAveriasPorIncidencia(filtradas.map(f => f.id));
    } catch (e) { /* sin enlace de averías: la lista se muestra igual */ }
    renderListaIncidenciasPendientes(filtradas, incidPendModalState.verResueltas, averiasMap);
  } catch (e) {
    lista.innerHTML = `<div style="text-align:center;padding:40px;color:#e84545;font-size:13px">⚠️ Error al cargar las incidencias</div>`;
  }
}

function renderListaIncidenciasPendientes(filas, modoResueltas, averiasMap) {
  averiasMap = averiasMap || {};
  const lista = document.getElementById('incidencias-pendientes-lista');
  const subt  = document.getElementById('incid-pend-subtitulo');

  filas.sort((a, b) => (b.timestamp||'').localeCompare(a.timestamp||''));
  incidPendModalFilas = filas;

  if (subt) {
    subt.textContent = modoResueltas
      ? `${filas.length} incidencia${filas.length===1?'':'s'} resuelta${filas.length===1?'':'s'}`
      : `${filas.length} incidencia${filas.length===1?'':'s'} pendiente${filas.length===1?'':'s'} de resolver`;
  }

  if (!filas.length) {
    lista.innerHTML = modoResueltas ? `
      <div style="text-align:center;padding:50px 20px;color:#8899aa">
        <div style="font-size:36px;margin-bottom:12px">📋</div>
        <div style="font-size:15px;font-weight:800;color:#1a1a2e">Sin incidencias resueltas</div>
        <div style="font-size:12px;margin-top:6px">No hay incidencias que coincidan con el filtro.</div>
      </div>` : `
      <div style="text-align:center;padding:50px 20px;color:#8899aa">
        <div style="font-size:36px;margin-bottom:12px">✅</div>
        <div style="font-size:15px;font-weight:800;color:#1a1a2e">Sin incidencias pendientes</div>
        <div style="font-size:12px;margin-top:6px">No hay incidencias de flota por resolver.</div>
      </div>`;
    return;
  }

  const hoy = new Date(); hoy.setHours(0,0,0,0);

  lista.innerHTML = filas.map((f, idx) => {
    let fechaLabel = f.fecha || '—';
    try { fechaLabel = new Date(f.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }); } catch(e){}

    const vehiculo = buscarVehiculoPorMatricula(f.matricula);
    const tipoPill = vehiculo && vehiculo.tipo
      ? `<span style="background:#eef0f5;color:#556;border-radius:6px;padding:2px 9px;font-size:10.5px;font-weight:700;white-space:nowrap;">${esc(vehiculo.tipo)}</span>`
      : '';

    let badgeAntig = '', cardBorder = '#e8eaf0', cardBg = '#ffffff';
    if (!modoResueltas) {
      let dias = null;
      try { dias = Math.floor((hoy - new Date(f.fecha + 'T00:00:00')) / 86400000); } catch(e){}
      if (dias !== null && !isNaN(dias)) {
        let color = '#1a6635', bg = '#eafaf1', bd = '#a9dfbf', txt = dias <= 0 ? 'Hoy' : `Hace ${dias} día${dias===1?'':'s'}`;
        if (dias >= 1 && dias <= 3) { color = '#b07040'; bg = '#fff8f0'; bd = '#fde8d0'; }
        if (dias > 3) { color = '#b91c1c'; bg = '#fff0f0'; bd = '#fecaca'; cardBorder = '#fecaca'; }
        badgeAntig = `<span style="background:${bg};color:${color};border:1.5px solid ${bd};border-radius:7px;padding:3px 10px;font-size:10.5px;font-weight:800;white-space:nowrap;">${txt}</span>`;
      }
    }

    const turnoLabel = f.turno === 'MANANA' ? 'Mañana' : (f.turno || '—');

    // Tipo de incidencia (editable mientras está pendiente) y avería enlazada
    const tiposIncid = (typeof MANT_TIPOS_INCID !== 'undefined') ? MANT_TIPOS_INCID : {};
    let tipoIncidHtml = '';
    if (!modoResueltas && f.id) {
      tipoIncidHtml = `<select class="incid-tipo-sel${f.tipo ? '' : ' sin-tipo'}" aria-label="Tipo de incidencia" data-tipo="${esc(f.tipo || '')}"
          onchange="this.classList.toggle('sin-tipo', !this.value); mantCambiarTipoIncidencia('${esc(f.id)}', this.value, this)">
          <option value=""${f.tipo ? '' : ' selected'}>Sin tipo</option>
          ${Object.keys(tiposIncid).map(k => `<option value="${k}"${f.tipo === k ? ' selected' : ''}>${tiposIncid[k].emoji} ${tiposIncid[k].txt}</option>`).join('')}
        </select>`;
    } else if (f.tipo && tiposIncid[f.tipo]) {
      tipoIncidHtml = `<span class="incid-tipo-pill">${tiposIncid[f.tipo].emoji} ${tiposIncid[f.tipo].txt}</span>`;
    }
    const av = averiasMap[f.id];
    const estadosAv = { abierta: 'Abierta', en_taller: 'En taller', reparada: 'Reparada' };
    const averiaHtml = av ? `<button type="button" class="incid-averia-pill est-${esc(av.estado)}" title="Ver en Mantenimiento"
        onclick="abrirFichaVehiculo('${esc(f.matricula)}');fichaTabSwitch('mant')">🔧 Avería · ${estadosAv[av.estado] || 'Abierta'}</button>` : '';

    let footer;
    if (modoResueltas) {
      let fechaResLabel = '—';
      try { fechaResLabel = new Date(f.fecha_resolucion).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }); } catch(e){}
      footer = `
        <div style="font-size:11px;color:#8899aa;margin-top:10px;">
          ✅ Resuelto por <strong style="color:#1a6635">${esc(f.resuelto_por||'—')}</strong> · ${fechaResLabel}
        </div>
        ${f.comentario_resolucion ? `
        <div style="margin-top:8px;padding:9px 12px;background:#f4f6fb;border:1px solid #e3e8f5;border-radius:9px;font-size:11.5px;color:#334;line-height:1.5;">
          <strong style="color:#556">Comentario de resolución:</strong> ${esc(f.comentario_resolucion)}
        </div>` : ''}`;
    } else {
      footer = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:10px;flex-wrap:wrap;">
          <div style="font-size:11px;color:#8899aa;">Registrada por: <strong style="color:#556">${esc(f.responsable||'—')}</strong></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${!av && f.id && typeof mantPasarIncidenciaAAveria === 'function' ? `<button type="button" class="incid-btn-averia" onclick="mantPasarIncidenciaAAveria(incidPendModalFilas[${idx}])">🔧 Pasar a avería</button>` : ''}
            <button id="btn-resolver-${idx}" onclick="mostrarFormResolverModal(${idx})"
              style="padding:7px 16px;background:#eafaf1;color:#1a6635;border:1.5px solid #a9dfbf;border-radius:8px;font-family:Barlow,sans-serif;font-size:11.5px;font-weight:800;cursor:pointer;white-space:nowrap;">✓ Resolver</button>
          </div>
        </div>
        <div id="form-resolver-${idx}" style="display:none;margin-top:10px;padding:12px;background:#f9faff;border:1.5px solid #e3e8f5;border-radius:10px;">
          ${av && av.estado !== 'reparada' ? `<div style="font-size:11.5px;color:#7A4800;background:#FFF4DD;border-radius:7px;padding:7px 10px;margin-bottom:8px;font-weight:600;">La avería enlazada seguirá abierta en Mantenimiento. Lo normal es marcarla como reparada allí: así esta incidencia se resuelve sola.</div>` : ''}
          <textarea id="comentario-resolver-${idx}" rows="2" placeholder="Comentario opcional al resolver la incidencia…"
            style="width:100%;border:1.5px solid #e0e4ee;border-radius:8px;padding:8px 10px;font-family:Barlow,sans-serif;font-size:12px;color:#1a1a2e;resize:vertical;box-sizing:border-box;"></textarea>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
            <button onclick="ocultarFormResolverModal(${idx})"
              style="padding:7px 14px;background:#f4f5f8;color:#556;border:none;border-radius:7px;font-family:Barlow,sans-serif;font-size:11.5px;font-weight:700;cursor:pointer;">Cancelar</button>
            <button id="btn-confirmar-resolver-${idx}" onclick="confirmarResolverModal(${idx})"
              style="padding:7px 16px;background:#2ecc71;color:white;border:none;border-radius:7px;font-family:Barlow,sans-serif;font-size:11.5px;font-weight:800;cursor:pointer;">✓ Confirmar resolución</button>
          </div>
        </div>`;
    }

    return `
      <div style="border:1.5px solid ${cardBorder};background:${cardBg};border-radius:13px;padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="background:#1a1a2e;color:#fff;border-radius:7px;padding:3px 11px;font-size:12.5px;font-weight:900;letter-spacing:0.3px;">${esc(f.matricula||'—')}</span>
            ${tipoPill}
            ${tipoIncidHtml}
            ${averiaHtml}
            <span style="font-size:11px;color:#8899aa;font-weight:600;">${esc(fechaLabel)} · Turno ${esc(turnoLabel)}</span>
          </div>
          ${badgeAntig}
        </div>
        <div style="margin-top:10px;font-size:13px;color:#334;line-height:1.55;word-break:break-word;">${esc(f.descripcion||'—')}</div>
        ${footer}
      </div>`;
  }).join('');
}

function mostrarFormResolverModal(idx) {
  const form = document.getElementById(`form-resolver-${idx}`);
  const btn  = document.getElementById(`btn-resolver-${idx}`);
  if (form) form.style.display = 'block';
  if (btn)  btn.style.display  = 'none';
}

function ocultarFormResolverModal(idx) {
  const form = document.getElementById(`form-resolver-${idx}`);
  const btn  = document.getElementById(`btn-resolver-${idx}`);
  if (form) form.style.display = 'none';
  if (btn)  btn.style.display  = 'inline-block';
}

async function confirmarResolverModal(idx) {
  const inc = incidPendModalFilas[idx];
  if (!inc || !APPS_SCRIPT_URL) return;

  const comentario = (document.getElementById(`comentario-resolver-${idx}`)?.value || '').trim();
  const btnConfirmar = document.getElementById(`btn-confirmar-resolver-${idx}`);
  if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.textContent = 'Guardando…'; }

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        accion: 'resolverIncidencia',
        timestamp: inc.timestamp,
        matricula: inc.matricula,
        resueltoPor: usuarioActual ? (usuarioActual.nombre || usuarioActual.numUsuario) : '—',
        comentario: comentario
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'Error en Sheets');

    // Sincronizar con la caché del panel admin si está cargada
    if (typeof incidenciasCache !== 'undefined' && incidenciasCache.length) {
      const i2 = incidenciasCache.findIndex(x => x.timestamp === inc.timestamp && x.matricula === inc.matricula);
      if (i2 >= 0) {
        incidenciasCache[i2].estado = 'COMPLETADO';
        incidenciasCache[i2].resuelto_por = usuarioActual ? (usuarioActual.nombre || usuarioActual.numUsuario) : '—';
        incidenciasCache[i2].comentario_resolucion = comentario;
      }
    }

    mostrarToast(`✅ Incidencia de ${inc.matricula} marcada como resuelta`, 'success');
    registrarAccion('INCIDENCIA', 'Resolver incidencia', `${inc.matricula} · ${(inc.descripcion||'').substring(0,60)}`);
    actualizarBotonIncidenciasPendientes();
    cargarIncidenciasPendientesModal();
  } catch (e) {
    mostrarToast('Error al resolver la incidencia: ' + e.message, 'error');
    if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.textContent = '✓ Confirmar resolución'; }
  }
}

// ── Devolución directa desde badge del cuadrante ────────────────────────────
let _devDirRepostaje = null; // repostaje activo para devolución directa

// ── Selectores DEVOLUCIÓN: Gasoil ────────────────────────────────────────────
function abrirSelectorDevGasoil(event) {
  event.stopPropagation();
  const dd = document.getElementById('dropdown-dev-gasoil');
  const ddA = document.getElementById('dropdown-dev-adblue');
  if (ddA) ddA.style.display = 'none';
  if (!dd) return;
  if (dd.style.display === 'block') { dd.style.display = 'none'; return; }
  const rect = event.currentTarget.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 6) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.display = 'block';
}

function setDevGasoil(pct) {
  document.getElementById('dropdown-dev-gasoil').style.display = 'none';
  document.getElementById('devdir-gasoil').value = pct;
  const needle   = document.getElementById('needle-dev-gasoil');
  const arcFill  = document.getElementById('arc-fill-dev-gasoil');
  const pctLabel = document.getElementById('pct-dev-gasoil');
  if (needle) needle.style.transform = 'rotate(' + (pct / 100) * 180 + 'deg)';
  if (arcFill) {
    let color = '#ef4444';
    if (pct >= 50) color = '#22c55e';
    else if (pct >= 25) color = '#f97316';
    arcFill.setAttribute('stroke-dasharray', pct + ' ' + (100 - pct));
    arcFill.setAttribute('stroke', color);
    arcFill.style.opacity = '1';
  }
  if (pctLabel) pctLabel.textContent = pct + '%';
}

// ── Selectores DEVOLUCIÓN: AdBlue ────────────────────────────────────────────
function abrirSelectorDevAdblue(event) {
  event.stopPropagation();
  const dd = document.getElementById('dropdown-dev-adblue');
  const ddG = document.getElementById('dropdown-dev-gasoil');
  if (ddG) ddG.style.display = 'none';
  if (!dd) return;
  if (dd.style.display === 'block') { dd.style.display = 'none'; return; }
  const rect = event.currentTarget.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 6) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.display = 'block';
}

function setDevAdblue(pct) {
  document.getElementById('dropdown-dev-adblue').style.display = 'none';
  document.getElementById('devdir-adblue').value = pct;
  const fill     = document.getElementById('fill-dev-adblue');
  const pctLabel = document.getElementById('pct-dev-adblue');
  if (fill) fill.setAttribute('width', (pct / 100) * 96);
  if (pctLabel) pctLabel.textContent = pct > 0 ? pct + '%' : '—';
}

function abrirDevolucionDirecta(repo) {
  _devDirRepostaje = repo;
  document.getElementById('devdir-matricula').textContent = repo.matricula || '—';
  document.getElementById('devdir-tarjeta').textContent   = repo.num_tarjeta || 'GASOIL';
  document.getElementById('devdir-chofer').textContent    = repo.usuario_chofer || '—';
  document.getElementById('devdir-sub').textContent       = `Matrícula ${repo.matricula} · entregada a las ${repo.hora_entrega||'—'}`;
  // Badges "antes" con colorcito
  const gAntes = parseFloat(repo.gasoil_antes);
  const aAntes = parseFloat(repo.adblue_antes);
  const antesDiv = document.getElementById('devdir-antes');
  if (antesDiv) {
    const gColor = isNaN(gAntes) ? '#aab' : (gAntes < 25 ? '#ef4444' : gAntes < 50 ? '#f97316' : '#22c55e');
    const aColor = isNaN(aAntes) ? '#aab' : (aAntes < 25 ? '#ef4444' : aAntes < 50 ? '#60a5fa' : '#1d4ed8');
    antesDiv.innerHTML =
      `<span style="font-size:9px;font-weight:800;color:#8899aa;letter-spacing:1px;text-transform:uppercase;margin-right:4px;">Antes:</span>` +
      `<span style="display:inline-flex;align-items:center;gap:4px;background:#f4f5f8;border:1px solid #dde1e8;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:800;color:${gColor};">⛽ ${isNaN(gAntes)?'—':gAntes+'%'}</span>` +
      (repo.adblue_antes === 'N/A' ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#f1f5f9;border:1px solid #94a3b8;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:800;color:#64748b;">🚫 Sin AdBlue</span>` : `<span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:800;color:${aColor};">🧪 AdBlue ${isNaN(aAntes)?'—':aAntes+'%'}</span>`);
  }
  // Dibujar arco fantasma gasoil "antes"
  const arcAntes = document.getElementById('arc-antes-dev-gasoil');
  if (arcAntes && !isNaN(gAntes)) {
    arcAntes.setAttribute('stroke-dasharray', gAntes + ' ' + (100 - gAntes));
  } else if (arcAntes) {
    arcAntes.setAttribute('stroke-dasharray', '0 100');
  }
  // Dibujar barra fantasma adblue "antes"
  const fillAntes = document.getElementById('fill-antes-dev-adblue');
  if (fillAntes) fillAntes.setAttribute('width', isNaN(aAntes) ? 0 : (aAntes / 100) * 96);

  document.getElementById('devdir-gasoil').value = '';
  document.getElementById('devdir-adblue').value = '';
  document.getElementById('devdir-ticket-ref').value = '';
  document.getElementById('devdir-ticket-importe').value = '';
  // Resetear dibujos gasoil
  const dneedle = document.getElementById('needle-dev-gasoil');
  const darcFill = document.getElementById('arc-fill-dev-gasoil');
  const dpctG = document.getElementById('pct-dev-gasoil');
  if (dneedle)  dneedle.style.transform = 'rotate(0deg)';
  if (darcFill) { darcFill.setAttribute('stroke-dasharray','0 100'); darcFill.setAttribute('stroke','#dde1ea'); darcFill.style.opacity='0'; }
  if (dpctG)    dpctG.textContent = '—';
  // Resetear barra adblue
  const dfillA = document.getElementById('fill-dev-adblue');
  const dpctA  = document.getElementById('pct-dev-adblue');
  if (dfillA) dfillA.setAttribute('width','0');
  if (dpctA)  dpctA.textContent = '—';
  // Ocultar gauge AdBlue si el vehículo no tiene depósito
  const wrapDevAdblue = document.getElementById('wrap-dev-adblue-gauge');
  const badgeDevAdblue = document.getElementById('wrap-dev-sin-adblue');
  const sinAdblue = repo.adblue_antes === 'N/A';
  if (wrapDevAdblue) wrapDevAdblue.style.display = sinAdblue ? 'none' : 'block';
  if (badgeDevAdblue) badgeDevAdblue.style.display = sinAdblue ? 'block' : 'none';
  document.getElementById('devdir-adblue').value = sinAdblue ? 'N/A' : '';
  const btn = document.getElementById('btn-devdir-confirmar');
  if (btn) { btn.disabled = false; btn.textContent = '✓ Confirmar devolución'; }
  document.getElementById('modal-devolucion-directa').classList.add('open');
  setTimeout(() => document.getElementById('devdir-gasoil').focus(), 120);
}

function cerrarDevolucionDirecta() {
  document.getElementById('modal-devolucion-directa').classList.remove('open');
  _devDirRepostaje = null;
}

// Muestra un modal de aviso/confirmación cuando el nivel "después" es menor que el "antes"
// Devuelve una Promise<boolean> -> true si el usuario quiere continuar igualmente
function preguntarNivelMenorQueAntes({ gasoilAntes, gasoilDespues, adblueAntes, adblueDespues }) {
  return new Promise((resolve) => {
    let overlay = document.getElementById('confirmar-nivel-menor-overlay');
    if (overlay) overlay.remove();

    const filas = [];
    if (!isNaN(gasoilAntes) && !isNaN(gasoilDespues) && gasoilDespues <= gasoilAntes) {
      filas.push(`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:800;color:#92600a;">
        <span>⛽ Gasoil</span><span>${gasoilAntes}% → ${gasoilDespues}%</span>
      </div>`);
    }
    if (!isNaN(adblueAntes) && !isNaN(adblueDespues) && adblueDespues <= adblueAntes) {
      filas.push(`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:800;color:#1d4ed8;">
        <span>🧪 AdBlue</span><span>${adblueAntes}% → ${adblueDespues}%</span>
      </div>`);
    }

    overlay = document.createElement('div');
    overlay.id = 'confirmar-nivel-menor-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:5500;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:16px;padding:30px 32px;width:380px;max-width:94vw;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1)">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:8px;">Nivel igual o inferior al registrado al entregar</div>
        <div style="font-size:12px;color:#8899aa;line-height:1.6;margin-bottom:16px;">
          Has indicado un nivel igual o menor al que ya teníamos anotado cuando se entregó la tarjeta. Revisa los datos antes de continuar:
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:22px;">${filas.join('')}</div>
        <div style="display:flex;justify-content:center;gap:10px;">
          <button id="btn-nivel-menor-cancelar"
            style="padding:10px 22px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;transition:background .15s;"
            onmouseover="this.style.background='#e8eaf0'" onmouseout="this.style.background='#f4f5f8'">Revisar</button>
          <button id="btn-nivel-menor-continuar"
            style="padding:10px 26px;background:#e8a23d;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:12px;font-weight:900;cursor:pointer;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(232,162,61,0.35);transition:background .15s;"
            onmouseover="this.style.background='#c8821d'" onmouseout="this.style.background='#e8a23d'">Sí, continuar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('btn-nivel-menor-cancelar').onclick = () => { overlay.remove(); resolve(false); };
    document.getElementById('btn-nivel-menor-continuar').onclick = () => { overlay.remove(); resolve(true); };
  });
}

// Muestra un modal preguntando si se quiere imprimir el informe PDF del repostaje
function preguntarImprimirInformeRepostaje(repo) {
  let overlay = document.getElementById('confirmar-imprimir-repostaje-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'confirmar-imprimir-repostaje-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:5000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:30px 32px;width:380px;max-width:94vw;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1)">
      <div style="font-size:40px;margin-bottom:12px;">📄</div>
      <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:8px;">¿Imprimir informe de repostaje?</div>
      <div style="font-size:12px;color:#8899aa;line-height:1.6;margin-bottom:22px;">Se generará el PDF de la solicitud de repostaje de <strong>${esc(repo.matricula || '')}</strong>.</div>
      <div style="display:flex;justify-content:center;gap:10px;">
        <button onclick="document.getElementById('confirmar-imprimir-repostaje-overlay').remove();"
          style="padding:10px 22px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;transition:background .15s;"
          onmouseover="this.style.background='#e8eaf0'" onmouseout="this.style.background='#f4f5f8'">No</button>
        <button onclick="document.getElementById('confirmar-imprimir-repostaje-overlay').remove();generarPDFRepostajeDirecto(${JSON.stringify(repo).replace(/"/g,'&quot;')})"
          style="padding:10px 26px;background:#e8a23d;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:12px;font-weight:900;cursor:pointer;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(232,162,61,0.35);transition:background .15s;"
          onmouseover="this.style.background='#c8821d'" onmouseout="this.style.background='#e8a23d'">Sí, imprimir</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function confirmarDevolucionDirecta() {
  if (!usuarioActual || !_devDirRepostaje) return;
  const repo = _devDirRepostaje;

  const gasoilDespues = document.getElementById('devdir-gasoil').value;
  const adblueDespues = document.getElementById('devdir-adblue').value;
  const ticketRef     = document.getElementById('devdir-ticket-ref').value.trim();
  const ticketImporte = document.getElementById('devdir-ticket-importe').value;

  if (gasoilDespues === '' || adblueDespues === '') {
    mostrarToast('Indica los depósitos después de repostar', 'error');
    return;
  }

  if (!ticketRef) {
    mostrarToast('El número de referencia del ticket es obligatorio', 'error');
    document.getElementById('devdir-ticket-ref').focus();
    return;
  }
  if (ticketImporte === '' || isNaN(parseFloat(ticketImporte)) || parseFloat(ticketImporte) <= 0) {
    mostrarToast('El importe del ticket es obligatorio y debe ser mayor que 0', 'error');
    document.getElementById('devdir-ticket-importe').focus();
    return;
  }

  // Aviso si el nivel indicado es menor al registrado al entregar la tarjeta
  const gAntesNum = parseFloat(repo.gasoil_antes);
  const aAntesNum = parseFloat(repo.adblue_antes);
  const gDespuesNum = parseFloat(gasoilDespues);
  const aDespuesNum = parseFloat(adblueDespues);
  const hayNivelMenor =
    (!isNaN(gAntesNum) && !isNaN(gDespuesNum) && gDespuesNum <= gAntesNum) ||
    (!isNaN(aAntesNum) && !isNaN(aDespuesNum) && aDespuesNum <= aAntesNum);
  if (hayNivelMenor) {
    const continuar = await preguntarNivelMenorQueAntes({
      gasoilAntes: gAntesNum, gasoilDespues: gDespuesNum,
      adblueAntes: aAntesNum, adblueDespues: aDespuesNum
    });
    if (!continuar) return;
  }

  const ahora = new Date();
  const hora  = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const btn = document.getElementById('btn-devdir-confirmar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

  // Cerrar modal de devolución y mostrar modal de progreso
  cerrarDevolucionDirecta();

  const modalProgreso = document.createElement('div');
  modalProgreso.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:5000;display:flex;align-items:center;justify-content:center;';
  modalProgreso.innerHTML = `
    <div style="background:white;border-radius:16px;padding:36px 32px;width:360px;max-width:94vw;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1)">
      <div style="font-size:44px;margin-bottom:14px;">⛽</div>
      <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:8px;">Registrando devolución</div>
      <div id="devdir-progreso-msg" style="font-size:12px;color:#8899aa;line-height:1.6;margin-bottom:22px;">Guardando en el sistema…<br>Por favor, espere un momento.</div>
      <div style="display:flex;justify-content:center;gap:7px;align-items:center;">
        <div style="width:9px;height:9px;border-radius:50%;background:#e8a23d;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0s"></div>
        <div style="width:9px;height:9px;border-radius:50%;background:#e8a23d;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0.2s"></div>
        <div style="width:9px;height:9px;border-radius:50%;background:#e8a23d;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0.4s"></div>
      </div>
    </div>`;
  document.body.appendChild(modalProgreso);

  try {
    let repoId = repo.id;

    // Si no tenemos id (fallback desde hoja Registros), buscar el id real en los pendientes
    if (!repoId) {
      const msgEl2 = document.getElementById('devdir-progreso-msg');
      if (msgEl2) msgEl2.innerHTML = 'Buscando registro activo…';
      const respBuscar = await fetch(
        `${APPS_SCRIPT_URL}?accion=cargarRepostajesPendientes&_t=${Date.now()}`, { redirect: 'follow', cache: 'no-store' }
      );
      const jsonBuscar = await respBuscar.json();
      if (jsonBuscar.ok && jsonBuscar.filas) {
        const mat = (repo.matricula || '').trim().toUpperCase();
        const encontrado = jsonBuscar.filas.find(
          f => (f.matricula||'').trim().toUpperCase() === mat
        );
        if (encontrado) {
          repoId = encontrado.id;
        } else {
          // No está pendiente — ya fue completado, refrescar y avisar
          document.body.removeChild(modalProgreso);
          await sincronizarRepostajesPendientes();
          await sincronizarRepostajesFecha();
          renderTabla();
          mostrarToast(`ℹ️ La tarjeta de ${repo.matricula} ya fue devuelta anteriormente`, 'info');
          return;
        }
      }
    }

    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'completarRepostaje', repostaje: {
        id:              repoId,
        hora_devolucion: hora,
        gasoil_despues:  gasoilDespues,
        adblue_despues:  adblueDespues,
        ticket_ref:      ticketRef,
        ticket_importe:  ticketImporte,
        resp_recibe:     usuarioActual.nombre || usuarioActual.numUsuario,
      }}),
      redirect: 'follow'
    });
    const json = await resp.json();
    if (json.ok) {
      const msgEl = document.getElementById('devdir-progreso-msg');
      if (msgEl) msgEl.innerHTML = 'Sincronizando repostajes…<br>Un momento.';

      // Actualizar mapas locales al instante (no esperar a que Sheets refleje el cambio)
      const matKey = (repo.matricula || '').trim().toUpperCase();
      const repoCompletoInmediato = {
        ...repo,
        id:              repoId,
        hora_devolucion: hora,
        gasoil_despues:  gasoilDespues,
        adblue_despues:  adblueDespues,
        ticket_ref:      ticketRef,
        ticket_importe:  ticketImporte,
        resp_recibe:     usuarioActual.nombre || usuarioActual.numUsuario,
      };
      if (matKey) {
        delete _repostajesPendientesMat[matKey];
        _repostajesFechaMat[matKey] = repoCompletoInmediato;
      }
      renderTabla();

      await sincronizarRepostajesPendientes();
      await sincronizarRepostajesFecha();
      if (msgEl) msgEl.innerHTML = 'Actualizando cuadrante…';
      renderTabla();
      document.body.removeChild(modalProgreso);
      registrarAccion('REPOSTAJE', 'Completar repostaje (devolución tarjeta)', `${repo.matricula} · tarjeta ${repo.num_tarjeta||'—'}`);
      mostrarToast(`✓ Tarjeta GASOIL de ${repo.matricula} devuelta — ${hora}`, 'success');

      // Preguntar si se quiere imprimir el informe de repostaje
      const repoCompleto = repoCompletoInmediato;
      preguntarImprimirInformeRepostaje(repoCompleto);
    } else {
      document.body.removeChild(modalProgreso);
      mostrarToast('⚠️ No se pudo confirmar la devolución: ' + (json.error||'error'), 'error');
    }
  } catch (e) {
    if (document.body.contains(modalProgreso)) document.body.removeChild(modalProgreso);
    mostrarToast('⚠️ Error de conexión al confirmar la devolución', 'error');
  }
}

async function confirmarDevolucionRepostaje(id, matricula) {
  if (!usuarioActual) return;

  const gasoilDespues = document.getElementById(`rp-gasoil-${id}`).value;
  const adblueDespues = document.getElementById(`rp-adblue-${id}`).value;
  const ticketRef     = document.getElementById(`rp-ticket-ref-${id}`).value.trim();
  const ticketImporte = document.getElementById(`rp-ticket-importe-${id}`).value;

  if (gasoilDespues === '' || adblueDespues === '') {
    mostrarToast('Indica los depósitos después de repostar', 'error');
    return;
  }

  if (!ticketRef) {
    mostrarToast('El número de referencia del ticket es obligatorio', 'error');
    document.getElementById(`rp-ticket-ref-${id}`).focus();
    return;
  }
  if (ticketImporte === '' || isNaN(parseFloat(ticketImporte)) || parseFloat(ticketImporte) <= 0) {
    mostrarToast('El importe del ticket es obligatorio y debe ser mayor que 0', 'error');
    document.getElementById(`rp-ticket-importe-${id}`).focus();
    return;
  }

  const rowEl = document.getElementById(`rp-row-${id}`);

  // Aviso si el nivel indicado es menor al registrado al entregar la tarjeta
  const gAntesNum = rowEl ? parseFloat(rowEl.dataset.gasoilAntes) : NaN;
  const aAntesNum = rowEl ? parseFloat(rowEl.dataset.adblueAntes) : NaN;
  const gDespuesNum = parseFloat(gasoilDespues);
  const aDespuesNum = parseFloat(adblueDespues);
  const hayNivelMenor =
    (!isNaN(gAntesNum) && !isNaN(gDespuesNum) && gDespuesNum <= gAntesNum) ||
    (!isNaN(aAntesNum) && !isNaN(aDespuesNum) && aDespuesNum <= aAntesNum);
  if (hayNivelMenor) {
    const continuar = await preguntarNivelMenorQueAntes({
      gasoilAntes: gAntesNum, gasoilDespues: gDespuesNum,
      adblueAntes: aAntesNum, adblueDespues: aDespuesNum
    });
    if (!continuar) return;
  }

  const ahora = new Date();
  const hora  = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const btn   = rowEl ? rowEl.querySelector('.btn-confirmar-repo') : null;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

  // Cerrar la lista y mostrar modal de progreso
  cerrarModalRepostajesPendientes();

  const modalProgreso = document.createElement('div');
  modalProgreso.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:5000;display:flex;align-items:center;justify-content:center;';
  modalProgreso.innerHTML = `
    <div style="background:white;border-radius:16px;padding:36px 32px;width:360px;max-width:94vw;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1)">
      <div style="font-size:44px;margin-bottom:14px;">⛽</div>
      <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:8px;">Registrando devolución</div>
      <div id="repo-devol-progreso-msg" style="font-size:12px;color:#8899aa;line-height:1.6;margin-bottom:22px;">Guardando en el sistema…<br>Por favor, espere un momento.</div>
      <div style="display:flex;justify-content:center;gap:7px;align-items:center;">
        <div style="width:9px;height:9px;border-radius:50%;background:#e8a23d;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0s"></div>
        <div style="width:9px;height:9px;border-radius:50%;background:#e8a23d;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0.2s"></div>
        <div style="width:9px;height:9px;border-radius:50%;background:#e8a23d;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0.4s"></div>
      </div>
    </div>`;
  document.body.appendChild(modalProgreso);

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'completarRepostaje', repostaje: {
        id,
        hora_devolucion: hora,
        gasoil_despues:  gasoilDespues,
        adblue_despues:  adblueDespues,
        ticket_ref:      ticketRef,
        ticket_importe:  ticketImporte,
        resp_recibe:     usuarioActual.nombre || usuarioActual.numUsuario,
      }}),
      redirect: 'follow'
    });
    const json = await resp.json();
    if (json.ok) {
      const msgEl = document.getElementById('repo-devol-progreso-msg');
      if (msgEl) msgEl.innerHTML = 'Sincronizando repostajes…<br>Un momento.';

      // Actualizar mapas locales al instante (no esperar a que Sheets refleje el cambio)
      const matKey = (matricula || '').trim().toUpperCase();
      if (matKey) {
        const previo = _repostajesPendientesMat[matKey] || {};
        _repostajesFechaMat[matKey] = {
          ...previo,
          id,
          matricula,
          hora_devolucion: hora,
          gasoil_despues:  gasoilDespues,
          adblue_despues:  adblueDespues,
          ticket_ref:      ticketRef,
          ticket_importe:  ticketImporte,
          resp_recibe:     usuarioActual.nombre || usuarioActual.numUsuario,
        };
        delete _repostajesPendientesMat[matKey];
      }
      renderTabla();

      await sincronizarRepostajesPendientes();
      await sincronizarRepostajesFecha();
      if (msgEl) msgEl.innerHTML = 'Actualizando cuadrante…';
      renderTabla();
      document.body.removeChild(modalProgreso);
      registrarAccion('REPOSTAJE', 'Completar repostaje (devolución tarjeta)', `${matricula}`);
      mostrarToast(`✓ Tarjeta GASOIL de ${matricula} devuelta — ${hora}`, 'success');
    } else {
      document.body.removeChild(modalProgreso);
      mostrarToast('⚠️ No se pudo confirmar la devolución: ' + (json.error||'error'), 'error');
    }
  } catch (e) {
    if (document.body.contains(modalProgreso)) document.body.removeChild(modalProgreso);
    mostrarToast('⚠️ Error de conexión al confirmar la devolución', 'error');
  }
}


