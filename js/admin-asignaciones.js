// ════════════════════════════════════════════════════════════════════════════
// ASIGNACIONES HABITUALES
// - Cada conductor pertenece a un equipo: turno 1, turno 2 o sin turno
//   (columna conductores.turno).
// - Cada matrícula tiene sus choferes habituales (tabla conductores_habituales).
// - Los equipos rotan cada lunes: una semana el turno 1 está de mañana y el
//   turno 2 de tarde, y la siguiente al revés. La referencia se guarda en
//   app_config, clave 'rotacion_turnos' → {"lunes":"AAAA-MM-DD","manana":1|2}.
// - En el cuadrante se resaltan los habituales del equipo que está en el turno
//   abierto (Mañana / Tarde) para la fecha del cuadrante.
// ════════════════════════════════════════════════════════════════════════════

let HABITUALES = [];               // [{ matricula, num_usuario }]
let ROTACION_TURNOS = null;        // { lunes: 'AAAA-MM-DD', manana: 1|2 } o null
let _habitualesTablaOk = true;     // false si la tabla aún no existe en Supabase
let _asigFiltro = 'todas';         // 'todas' | 'con' | 'sin'
let _asigAñadiendo = null;         // { matricula, turno } fila con el buscador abierto

// ── Utilidades de fecha (siempre en hora local) ──────────────────────────────
function _asigFechaLocal(str) {
  const [y, m, d] = String(str || '').split('-').map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : new Date();
}
function _asigFechaStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function _asigLunesDe(fecha) {
  const d = (fecha instanceof Date) ? new Date(fecha) : _asigFechaLocal(fecha);
  d.setHours(12, 0, 0, 0);                  // mediodía: evita saltos por cambio de hora
  const dia = (d.getDay() + 6) % 7;         // 0 = lunes … 6 = domingo
  d.setDate(d.getDate() - dia);
  return d;
}
function _asigHoyStr() { return _asigFechaStr(new Date()); }

// ── Rotación: qué equipo está de mañana la semana de una fecha ──────────────
function equipoDeMananaEnFecha(fecha) {
  if (!ROTACION_TURNOS || !ROTACION_TURNOS.lunes) return null;
  const ref = _asigLunesDe(ROTACION_TURNOS.lunes);
  const lun = _asigLunesDe(fecha);
  const semanas = Math.round((lun - ref) / (7 * 24 * 3600 * 1000));
  const par = ((semanas % 2) + 2) % 2 === 0;
  return par ? ROTACION_TURNOS.manana : (ROTACION_TURNOS.manana === 1 ? 2 : 1);
}

// Equipo (1 / 2) que trabaja en el cuadrante abierto: fecha + turno actuales
function equipoDelCuadrante(fecha, turno) {
  const manana = equipoDeMananaEnFecha(fecha || fechaActual || _asigHoyStr());
  if (!manana) return null;
  return (turno || turnoActual) === 'MANANA' ? manana : (manana === 1 ? 2 : 1);
}

// ── Consultas ────────────────────────────────────────────────────────────────
function _asigConductor(numUsuario) {
  return CONDUCTORES.find(c => String(c.numUsuario) === String(numUsuario)) || null;
}
function habitualesDeMatricula(matricula) {
  const m = String(matricula || '').trim().toUpperCase();
  return HABITUALES.filter(h => h.matricula === m)
    .map(h => _asigConductor(h.num_usuario))
    .filter(Boolean);
}
// numUsuario de los habituales de una matrícula para el turno abierto del cuadrante
function habitualesCuadrante(matricula) {
  const equipo = equipoDelCuadrante();
  if (!equipo) return new Set();
  return new Set(habitualesDeMatricula(matricula)
    .filter(c => c.turno === equipo)
    .map(c => String(c.numUsuario)));
}

// ── Carga desde Supabase ─────────────────────────────────────────────────────
async function cargarHabituales() {
  try {
    const [rh, rc] = await Promise.all([
      sb.from('conductores_habituales').select('matricula,num_usuario'),
      sb.from('app_config').select('valor').eq('clave', 'rotacion_turnos').maybeSingle()
    ]);
    if (rh.error) {
      _habitualesTablaOk = false;
      HABITUALES = [];
      console.warn('Habituales no disponibles:', rh.error.message);
    } else {
      _habitualesTablaOk = true;
      HABITUALES = (rh.data || []).map(h => ({
        matricula: String(h.matricula || '').trim().toUpperCase(),
        num_usuario: String(h.num_usuario)
      }));
    }
    ROTACION_TURNOS = null;
    if (!rc.error && rc.data && rc.data.valor) {
      try {
        const v = JSON.parse(rc.data.valor);
        if (v && v.lunes && (v.manana === 1 || v.manana === 2)) ROTACION_TURNOS = v;
      } catch (e) {}
    }
  } catch (e) {
    console.warn('No se pudieron cargar los habituales:', e);
  }
  return true;
}

// ── Guardado ─────────────────────────────────────────────────────────────────
async function guardarTurnoConductor(numUsuario, turno) {
  const c = _asigConductor(numUsuario);
  if (!c) return false;
  const nuevo = (turno === 1 || turno === 2) ? turno : null;
  if (c.turno === nuevo) return true;
  const anterior = c.turno ?? null;
  c.turno = nuevo; // optimista
  const { error } = await sb.from('conductores').update({ turno: nuevo }).eq('num_usuario', c.numUsuario);
  if (error) {
    c.turno = anterior;
    mostrarToast(_asigErrorTabla(error) || '⚠️ No se pudo guardar el turno', 'error');
    return false;
  }
  if (typeof registrarAccion === 'function') {
    registrarAccion('ADMIN', 'Turno conductor', `${c.nombre} → ${nuevo ? 'Turno ' + nuevo : 'Sin turno'}`);
  }
  return true;
}

async function guardarRotacionTurnos(mananaEstaSemana) {
  const valor = JSON.stringify({ lunes: _asigFechaStr(_asigLunesDe(new Date())), manana: mananaEstaSemana });
  const { error } = await sb.from('app_config').upsert({ clave: 'rotacion_turnos', valor }, { onConflict: 'clave' });
  if (error) { mostrarToast('⚠️ No se pudo guardar la rotación: ' + error.message, 'error'); return false; }
  ROTACION_TURNOS = JSON.parse(valor);
  if (typeof registrarAccion === 'function') {
    registrarAccion('ADMIN', 'Rotación de turnos', `Esta semana Turno ${mananaEstaSemana} de mañana`);
  }
  return true;
}

function _asigErrorTabla(error) {
  const msg = (error && error.message) || '';
  if (/conductores_habituales|column .*turno|turno.*does not exist|schema cache/i.test(msg)) {
    return '⚠️ Falta preparar Supabase para las asignaciones (ejecuta el SQL de Asignaciones)';
  }
  return '';
}

async function añadirHabitual(matricula, numUsuario, turnoColumna) {
  const m = String(matricula).trim().toUpperCase();
  const c = _asigConductor(numUsuario);
  if (!c) return;
  if (HABITUALES.some(h => h.matricula === m && h.num_usuario === String(c.numUsuario))) {
    mostrarToast(`${c.nombre} ya es habitual de ${m}`, 'info');
    return;
  }
  const { error } = await sb.from('conductores_habituales').insert({
    matricula: m, num_usuario: String(c.numUsuario), creado_por: usuarioActual?.nombre || 'Admin'
  });
  if (error) { mostrarToast(_asigErrorTabla(error) || '⚠️ No se pudo añadir: ' + error.message, 'error'); return; }
  HABITUALES.push({ matricula: m, num_usuario: String(c.numUsuario) });
  // Un conductor sin turno pasa al equipo de la columna donde se ha añadido
  if (!c.turno && (turnoColumna === 1 || turnoColumna === 2)) {
    if (await guardarTurnoConductor(c.numUsuario, turnoColumna)) {
      mostrarToast(`✓ ${c.nombre} añadido a ${m} y puesto en Turno ${turnoColumna}`, 'success');
    }
  } else {
    mostrarToast(`✓ ${c.nombre} añadido a ${m}`, 'success');
  }
  if (typeof registrarAccion === 'function') registrarAccion('ADMIN', 'Añadir habitual', `${m} · ${c.nombre}`);
}

async function quitarHabitual(matricula, numUsuario) {
  const m = String(matricula).trim().toUpperCase();
  const { error } = await sb.from('conductores_habituales').delete()
    .eq('matricula', m).eq('num_usuario', String(numUsuario));
  if (error) { mostrarToast('⚠️ No se pudo quitar: ' + error.message, 'error'); return; }
  HABITUALES = HABITUALES.filter(h => !(h.matricula === m && h.num_usuario === String(numUsuario)));
  const c = _asigConductor(numUsuario);
  if (typeof registrarAccion === 'function') registrarAccion('ADMIN', 'Quitar habitual', `${m} · ${c ? c.nombre : numUsuario}`);
  renderAdminAsignaciones();
}

// ════════════════════════════════════════════════════════════════════════════
// PANEL ADMIN — sección Asignaciones
// ════════════════════════════════════════════════════════════════════════════
function _asigVehiculos() {
  const lista = [];
  GRUPOS.forEach(g => g.vehiculos.forEach(v => {
    if (!v.archivado) lista.push({ matricula: String(v.matricula).toUpperCase(), tipo: v.tipo || '', grupo: g.nombre || '', restringido: !!v.restringido, bloqueado: !!v.bloqueado });
  }));
  return lista;
}

async function abrirAdminAsignaciones() {
  renderAdminAsignaciones();
  await cargarHabituales();
  renderAdminAsignaciones();
}

function asigCambiarFiltro(f) { _asigFiltro = f; renderAdminAsignaciones(); }

function renderAdminAsignaciones() {
  const cont = document.getElementById('admin-lista-asignaciones');
  if (!cont) return;
  const statsEl = document.getElementById('asig-stats');
  const rotEl   = document.getElementById('asig-rotacion');
  const vehiculos = _asigVehiculos();
  const q = (document.getElementById('asig-filtro')?.value || '').trim().toUpperCase();

  // Indicadores
  const conHab = vehiculos.filter(v => habitualesDeMatricula(v.matricula).length > 0).length;
  const sinTurno = CONDUCTORES.filter(c => !c.turno).length;
  if (statsEl) statsEl.innerHTML = `
    <div class="adm-kpi"><span class="adm-kpi-label">Matrículas</span><span class="adm-kpi-num">${vehiculos.length}</span><span class="adm-kpi-sub">activas en la flota</span></div>
    <div class="adm-kpi"><span class="adm-kpi-label">Con habituales</span><span class="adm-kpi-num">${conHab}</span><span class="adm-kpi-sub">en algún turno</span></div>
    <div class="adm-kpi"><span class="adm-kpi-label">Sin habituales</span><span class="adm-kpi-num${vehiculos.length - conHab ? ' aviso' : ''}">${vehiculos.length - conHab}</span><span class="adm-kpi-sub">pendientes de asignar</span></div>
    <div class="adm-kpi"><span class="adm-kpi-label">Conductores sin turno</span><span class="adm-kpi-num${sinTurno ? ' aviso' : ''}">${sinTurno}</span><span class="adm-kpi-sub">${sinTurno ? 'márcalos en Conductores' : 'todos tienen equipo'}</span></div>`;

  // Rotación de esta semana
  if (rotEl) {
    const lunes = _asigLunesDe(new Date());
    const domingo = new Date(lunes); domingo.setDate(domingo.getDate() + 6);
    const fmt = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const manana = equipoDeMananaEnFecha(_asigHoyStr());
    if (!manana) {
      rotEl.className = 'adm-aviso asig-rot';
      rotEl.innerHTML = `<div class="adm-aviso-head">
        <svg class="adm-ico" viewBox="0 0 24 24"><path d="M12 3l9 16H3zM12 10v4M12 17h.01"/></svg>
        <span><strong>¿Qué equipo está de mañana esta semana?</strong> (${fmt(lunes)} – ${fmt(domingo)}). A partir de aquí la app lo alterna sola cada lunes.</span>
        <button class="adm-btn adm-btn-sm" onclick="asigFijarRotacion(1)">Turno 1 de mañana</button>
        <button class="adm-btn adm-btn-sm" onclick="asigFijarRotacion(2)">Turno 2 de mañana</button>
      </div>`;
    } else {
      const tarde = manana === 1 ? 2 : 1;
      rotEl.className = 'adm-aviso ok asig-rot';
      rotEl.innerHTML = `<div class="adm-aviso-head">
        <svg class="adm-ico" viewBox="0 0 24 24"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>
        <span>Esta semana (${fmt(lunes)} – ${fmt(domingo)}): <strong>Turno ${manana} de mañana</strong> · <strong>Turno ${tarde} de tarde</strong>. Cambia solo cada lunes.</span>
        <button class="adm-link" onclick="asigFijarRotacion(${tarde})">Intercambiar esta semana</button>
      </div>`;
    }
  }

  // Segmento de filtro
  document.querySelectorAll('#asig-seg button').forEach(b => b.classList.toggle('on', b.dataset.f === _asigFiltro));

  if (!_habitualesTablaOk) {
    cont.innerHTML = `<div class="adm-aviso" style="margin:16px"><div class="adm-aviso-head">
      <svg class="adm-ico" viewBox="0 0 24 24"><path d="M12 3l9 16H3zM12 10v4M12 17h.01"/></svg>
      <span><strong>Falta preparar Supabase.</strong> Ejecuta el SQL de Asignaciones en el SQL Editor de Supabase y vuelve a abrir esta sección.</span></div></div>`;
    return;
  }

  // Filtrado
  const filas = vehiculos.filter(v => {
    const habs = habitualesDeMatricula(v.matricula);
    if (_asigFiltro === 'con' && !habs.length) return false;
    if (_asigFiltro === 'sin' && habs.length) return false;
    if (!q) return true;
    return v.matricula.includes(q) || v.tipo.toUpperCase().includes(q) || habs.some(c => c.nombre.toUpperCase().includes(q));
  });

  if (!filas.length) {
    cont.innerHTML = `<table class="adm-table asig-table"><tbody><tr><td class="vacio">No hay matrículas que coincidan con el filtro</td></tr></tbody></table>`;
    return;
  }

  const chip = (m, c, cls = '') => `<span class="hab-chip ${cls}" title="${esc(c.nombre)} · Nº ${esc(String(c.numUsuario))}">${esc(c.nombre)}<button class="hab-x" title="Quitar" onclick="quitarHabitual('${esc(m)}','${esc(String(c.numUsuario))}')">✕</button></span>`;

  const celda = (v, turno, habs) => {
    const delTurno = habs.filter(c => c.turno === turno);
    const abierto = _asigAñadiendo && _asigAñadiendo.matricula === v.matricula && _asigAñadiendo.turno === turno;
    return `<td class="asig-celda">
      <div class="hab-chips">
        ${delTurno.map(c => chip(v.matricula, c)).join('')}
        ${abierto
          ? `<input class="hab-input" id="asig-buscador" placeholder="Nombre, DNI o Nº…" autocomplete="off"
               oninput="asigFiltrarBuscador()" onkeydown="asigTeclaBuscador(event)">`
          : `<button class="hab-add" onclick="asigAbrirBuscador('${esc(v.matricula)}',${turno})">+ Añadir</button>`}
      </div>
      ${abierto ? `<div class="operario-dropdown open asig-dd" id="asig-dd"><div class="operario-dropdown-header" id="asig-dd-header"></div><div class="operario-dropdown-list" id="asig-dd-list"></div></div>` : ''}
    </td>`;
  };

  cont.innerHTML = `<table class="adm-table asig-table">
    <thead><tr>
      <th style="width:170px">Matrícula</th>
      <th style="width:120px">Tipo</th>
      <th><span class="turno-th t1">Turno 1</span></th>
      <th><span class="turno-th t2">Turno 2</span></th>
    </tr></thead>
    <tbody>${filas.map(v => {
      const habs = habitualesDeMatricula(v.matricula);
      const sinT = habs.filter(c => !c.turno);
      return `<tr>
        <td><span class="adm-mat">${esc(v.matricula)}</span>${v.restringido ? '<span class="adm-tag restr">Restringido</span>' : ''}
          ${v.grupo ? `<span class="adm-sub">${esc(v.grupo)}</span>` : ''}
          ${sinT.length ? `<div class="hab-chips" style="margin-top:6px">${sinT.map(c => chip(v.matricula, c, 'sin-turno')).join('')}</div>` : ''}</td>
        <td>${esc(v.tipo)}</td>
        ${celda(v, 1, habs)}
        ${celda(v, 2, habs)}
      </tr>`;
    }).join('')}</tbody></table>`;

  if (_asigAñadiendo) {
    const inp = document.getElementById('asig-buscador');
    if (inp) { inp.focus(); asigFiltrarBuscador(); }
  }
}

async function asigFijarRotacion(mananaEstaSemana) {
  if (await guardarRotacionTurnos(mananaEstaSemana)) {
    mostrarToast(`✓ Esta semana: Turno ${mananaEstaSemana} de mañana`, 'success');
    renderAdminAsignaciones();
    if (typeof renderTabla === 'function' && fechaActual) renderTabla();
  }
}

// ── Buscador para añadir habituales ──────────────────────────────────────────
let _asigResultados = [];
let _asigIdx = 0;

function asigAbrirBuscador(matricula, turno) {
  _asigAñadiendo = { matricula, turno };
  renderAdminAsignaciones();
}
function asigCerrarBuscador() {
  if (!_asigAñadiendo) return;
  _asigAñadiendo = null;
  renderAdminAsignaciones();
}
function asigFiltrarBuscador() {
  if (!_asigAñadiendo) return;
  const inp = document.getElementById('asig-buscador');
  const list = document.getElementById('asig-dd-list');
  const hdr = document.getElementById('asig-dd-header');
  if (!inp || !list) return;
  const { matricula, turno } = _asigAñadiendo;
  const query = inp.value.trim();
  const q = query.toUpperCase();
  const ya = new Set(HABITUALES.filter(h => h.matricula === matricula).map(h => h.num_usuario));
  _asigResultados = CONDUCTORES
    .filter(c => (c.turno === turno || !c.turno) && !ya.has(String(c.numUsuario)))
    .filter(c => !q || c.nombre.toUpperCase().includes(q) || (c.dni || '').toUpperCase().includes(q) || String(c.numUsuario || '').includes(q))
    .sort((a, b) => (a.turno ? 0 : 1) - (b.turno ? 0 : 1) || a.nombre.localeCompare(b.nombre))
    .slice(0, 40);
  _asigIdx = 0;
  hdr.textContent = q
    ? `Turno ${turno} y sin turno · ${_asigResultados.length} resultado${_asigResultados.length !== 1 ? 's' : ''}`
    : `Conductores de turno ${turno} y sin turno`;
  const hl = (t) => (typeof highlight === 'function') ? highlight(t, query) : esc(t);
  list.innerHTML = _asigResultados.length ? _asigResultados.map((c, i) => `
    <div class="operario-dropdown-item${i === 0 ? ' highlighted' : ''}" data-idx="${i}" onmousedown="event.preventDefault();asigElegir(${i})">
      <div class="operario-item-nombre">${hl(c.nombre)}${c.turno ? '' : ' <span class="tag-sin-turno">Sin turno</span>'}</div>
      <div class="operario-item-meta">DNI: ${hl(c.dni || '—')} &nbsp;·&nbsp; Nº ${hl(String(c.numUsuario || '—'))}${c.sociedad ? ' &nbsp;·&nbsp; ' + esc(c.sociedad) : ''}</div>
    </div>`).join('')
    : `<div class="operario-dropdown-empty">Sin resultados${query ? ` para "${esc(query)}"` : ''}</div>`;
}
function asigTeclaBuscador(e) {
  const items = document.querySelectorAll('#asig-dd-list .operario-dropdown-item');
  if (e.key === 'Escape') { e.preventDefault(); asigCerrarBuscador(); return; }
  if (e.key === 'Enter') { e.preventDefault(); if (_asigResultados[_asigIdx]) asigElegir(_asigIdx); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    _asigIdx = (_asigIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((it, i) => it.classList.toggle('highlighted', i === _asigIdx));
    items[_asigIdx].scrollIntoView({ block: 'nearest' });
  }
}
async function asigElegir(i) {
  const c = _asigResultados[i];
  if (!c || !_asigAñadiendo) return;
  const { matricula, turno } = _asigAñadiendo;
  _asigAñadiendo = null;
  await añadirHabitual(matricula, c.numUsuario, turno);
  renderAdminAsignaciones();
}
document.addEventListener('mousedown', (e) => {
  if (!_asigAñadiendo) return;
  if (e.target.closest('#asig-dd, #asig-buscador')) return;
  asigCerrarBuscador();
});

// ── PDF (como el folio) ──────────────────────────────────────────────────────
function exportarAsignacionesPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ML = 14, PW = 210, CW = PW - 2 * ML;
  const cols = [{ t: 'MATRÍCULA', w: 32 }, { t: 'TIPO', w: 26 }, { t: 'TURNO 1', w: (CW - 58) / 2 }, { t: 'TURNO 2', w: (CW - 58) / 2 }];
  let y = 16;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(26, 26, 46);
  doc.text('Asignaciones habituales', ML, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(91, 100, 117);
  const manana = equipoDeMananaEnFecha(_asigHoyStr());
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}${manana ? ` - Esta semana: Turno ${manana} de mañana, Turno ${manana === 1 ? 2 : 1} de tarde` : ''}`, ML, y + 6);
  y += 13;
  const cabecera = () => {
    doc.setFillColor(26, 26, 46); doc.rect(ML, y, CW, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
    let x = ML; cols.forEach(c => { doc.text(c.t, x + 2.5, y + 5.4); x += c.w; });
    y += 8;
  };
  cabecera();
  doc.setFontSize(9);
  _asigVehiculos().forEach((v, i) => {
    const habs = habitualesDeMatricula(v.matricula);
    const t1 = habs.filter(c => c.turno === 1).map(c => c.nombre);
    const t2 = habs.filter(c => c.turno === 2).map(c => c.nombre);
    const st = habs.filter(c => !c.turno).map(c => c.nombre + ' (sin turno)');
    const l1 = doc.splitTextToSize([...t1, ...st].join('\n') || '—', cols[2].w - 5);
    const l2 = doc.splitTextToSize(t2.join('\n') || '—', cols[3].w - 5);
    const h = Math.max(l1.length, l2.length, 1) * 4.4 + 4;
    if (y + h > 285) { doc.addPage(); y = 16; cabecera(); doc.setFontSize(9); }
    if (i % 2) { doc.setFillColor(246, 247, 249); doc.rect(ML, y, CW, h, 'F'); }
    doc.setDrawColor(227, 230, 235); doc.line(ML, y + h, ML + CW, y + h);
    let x = ML;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 26, 46); doc.text(v.matricula, x + 2.5, y + 5.2); x += cols[0].w;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(51, 59, 74); doc.text(v.tipo || '', x + 2.5, y + 5.2); x += cols[1].w;
    doc.text(l1, x + 2.5, y + 5.2); x += cols[2].w;
    doc.text(l2, x + 2.5, y + 5.2);
    y += h;
  });
  doc.save(`Asignaciones_habituales_${_asigHoyStr()}.pdf`);
  if (typeof registrarAccion === 'function') registrarAccion('ADMIN', 'Exportar PDF', 'Asignaciones habituales');
}
