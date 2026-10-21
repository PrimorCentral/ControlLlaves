// ════════════════════════════════════════════════════════════════════════════
// FLOTA PRIMOR · js/ficha-vehiculo.js — FICHA DEL VEHÍCULO
//
// Ventana que se abre al pulsar una matrícula. Menú lateral con:
//   Resumen · Seguro · ITV · Documentos · Averías · Mantenimiento
// · Resumen: bloqueo, tarjetas de ITV / Seguro / Mantenimiento, qué
//   documentación falta y acciones rápidas.
// · Averías y Mantenimiento: los pinta js/mantenimiento.js (mantCargarFicha).
// · Los datos del vehículo salen de GRUPOS (ya cargados); documentos,
//   kilometraje y mantenimiento se piden a Supabase al abrir la ficha.
// Funciones públicas (las usan otros archivos): abrirFichaVehiculo,
// fichaTabSwitch, cerrarFichaVehiculo, fichaRefrescar, _fichaMatReal, _fichaMat.
// ════════════════════════════════════════════════════════════════════════════

let _fichaMat = '';          // matrícula de la ficha abierta
let _fichaTab = 'resumen';   // sección activa
let _fichaDatos = null;      // { docs, docsDrive, fotos, km, averias, revisiones, incid, cargado }

// Documentos que debe tener todo vehículo (los que falten se avisan)
const FICHA_DOCS_OBLIGATORIOS = [
  { id: 'ficha_tecnica',       label: 'Ficha técnica' },
  { id: 'permiso_circulacion', label: 'Permiso de circulación' },
  { id: 'informe_itv',         label: 'Informe ITV' },
  { id: 'poliza_seguro',       label: 'Póliza de seguro' }
];
const FICHA_DOC_LABELS = {
  ficha_tecnica: 'Ficha técnica', permiso_circulacion: 'Permiso de circulación',
  informe_itv: 'Informe ITV', poliza_seguro: 'Póliza de seguro', otros: 'Otros'
};
const FICHA_SECCIONES = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'seguro',  label: 'Seguro' },
  { id: 'itv',     label: 'ITV' },
  { id: 'taco',    label: 'Tacógrafo' },
  { id: 'docs',    label: 'Documentos' },
  { id: 'averias', label: 'Averías' },
  { id: 'mant',    label: 'Mantenimiento' },
  { id: 'gestion', label: 'Gestión', admin: true }   // solo administradores
];
// Secciones que puede ver el usuario actual
function _fvSecciones() { return FICHA_SECCIONES.filter(s => !s.admin || _fvEsAdmin()); }
// Lápiz de "editar" (solo lo ven los administradores)
const _FV_LAPIZ = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>';

// ── Utilidades ───────────────────────────────────────────────────────────────
function _fichaMatReal(m) {
  const m1 = m.match(/\b(\d{4}\s?[A-Z]{3})\b/);
  if (m1) return m1[1];
  const m2 = m.match(/\b([A-Z]{1,2}\s?\d{3,4}\s?[A-Z]{1,2})\b/);
  if (m2) return m2[1];
  return m;
}
function _fvMarca(m) {
  const real = _fichaMatReal(m);
  const marca = m.replace(real, '').trim();
  return marca && /^[A-ZÁÉÍÓÚÑ ]+$/i.test(marca) ? marca : '';
}
function _fvTipo(t) {
  if (!t) return '';
  let s = String(t).toLowerCase().replace(/\bcamion\b/, 'camión').replace(/\b(\d+)\s*p\b/, '$1 palets');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function _fvCap(t) {
  t = String(t || '').toLowerCase();
  return t.replace(/(^|\s|-)([a-záéíóúñ])/g, (a, b, c) => b + c.toUpperCase());
}
function _fvGrupo(matricula) {
  for (const g of GRUPOS) if (g.vehiculos.some(x => x.matricula === matricula)) return g.nombre;
  return '';
}
function _fvDias(iso) {
  if (!iso) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(String(iso).substring(0, 10) + 'T00:00:00') - hoy) / 86400000);
}
function _fvFecha(iso) {
  if (!iso) return '—';
  const p = String(iso).substring(0, 10).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}
function _fvFechaHora(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' a las ' +
           d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}
function _fvKm(n) { return n == null ? 'Sin datos' : Math.round(n).toLocaleString('es-ES') + ' km'; }
function _fvEsAdmin() { return typeof usuarioEsAdmin === 'function' && usuarioEsAdmin(); }
function _fvTel(t) { return String(t || '').replace(/[^\d+]/g, ''); }

/** Estado de una fecha de caducidad: { cls: ok|aviso|mal|nada, txt, dias } */
function _fvVencimiento(iso, avisoDias) {
  const dias = _fvDias(iso);
  if (dias === null) return { cls: 'nada', txt: 'Sin datos', dias: null };
  if (dias < 0)  return { cls: 'mal', txt: 'Caducado', dias };
  if (dias === 0) return { cls: 'mal', txt: 'Caduca hoy', dias };
  if (dias <= (avisoDias || 30)) return { cls: 'aviso', txt: `Vence en ${dias} día${dias === 1 ? '' : 's'}`, dias };
  return { cls: 'ok', txt: 'En vigor', dias };
}

// ── Abrir / cerrar ───────────────────────────────────────────────────────────
function abrirFichaVehiculo(matricula) {
  _fichaMat = matricula;
  _fichaTab = 'resumen';
  _fichaDatos = { cargado: false, docs: [], docsDrive: [], fotos: [], km: null, averias: [], revisiones: [], incid: [] };
  const modal = document.getElementById('modal-ficha-vehiculo');
  modal.classList.add('visible');
  // La pestaña Gestión se vacía al abrir: solo se pinta si el usuario es admin
  const pGest = modal.querySelector('.fv-panel[data-tab="gestion"]');
  if (pGest) pGest.innerHTML = '';
  _fichaPintarTodo();
  _fichaCargarDatos(matricula);
  setTimeout(() => { const b = modal.querySelector('.fv-cerrar'); if (b) b.focus(); }, 50);
}

function cerrarFichaVehiculo() {
  document.getElementById('modal-ficha-vehiculo').classList.remove('visible');
  _fichaMat = '';
}

/** Repinta la ficha abierta con los datos de GRUPOS (tras editar ITV, seguro, bloqueo…). */
function fichaRepintar() {
  const modal = document.getElementById('modal-ficha-vehiculo');
  if (!_fichaMat || !modal || !modal.classList.contains('visible')) return;
  _fichaPintarTodo();
}

/** Vuelve a pedir los datos de la ficha abierta (tras una avería, un documento…). */
function fichaRefrescar(matricula) {
  if (!_fichaMat || (matricula && matricula !== _fichaMat)) return;
  _fichaCargarDatos(_fichaMat);
}

function fichaTabSwitch(tab) {
  if (!_fvSecciones().some(s => s.id === tab)) tab = 'resumen';
  _fichaTab = tab;
  document.querySelectorAll('#modal-ficha-vehiculo .fv-nav-op').forEach(b => {
    const activa = b.dataset.tab === tab;
    b.classList.toggle('activa', activa);
    b.setAttribute('aria-current', activa ? 'page' : 'false');
  });
  document.querySelectorAll('#modal-ficha-vehiculo .fv-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
  if ((tab === 'mant' || tab === 'averias') && typeof mantCargarFicha === 'function') mantCargarFicha(_fichaMat);
  else _fichaPintarPanel(tab);
}

// ── Carga de datos ───────────────────────────────────────────────────────────
async function _fichaCargarDatos(matricula) {
  const d = { cargado: true, docs: [], docsDrive: [], fotos: [], km: null, averias: [], revisiones: [], incid: [], taco: [] };
  const tareas = [];
  // Revisiones de tacógrafo ya hechas (son mantenimientos de tipo Tacógrafo)
  tareas.push((async () => {
    try {
      const r = await sb.from('mantenimientos').select('*').eq('matricula', matricula).eq('tipo', 'Tacógrafo').order('fecha', { ascending: false });
      d.taco = r.data || [];
    } catch (e) { /* sin conexión */ }
  })());
  // Documentos (Supabase) y, si sigue activo, los antiguos de Drive
  tareas.push((async () => {
    try {
      const todos = await docsListarSupabase(matricula);
      d.docs = todos.filter(x => x.categoria !== 'fotos' && x.categoria !== 'mantenimiento'); // facturas: en Mantenimiento
      d.fotos = todos.filter(x => x.categoria === 'fotos');
      if (await docsDriveActivo()) {
        try { d.docsDrive = await docsListarDrive(matricula, todos.map(x => x.drive_id).filter(Boolean)); } catch (e) {}
      }
    } catch (e) { d.errorDocs = true; }
  })());
  if (typeof _mantKmActual === 'function') tareas.push(_mantKmActual(matricula).then(km => { d.km = km; }).catch(() => {}));
  tareas.push((async () => {
    try {
      const [av, rev, inc, enl] = await Promise.all([
        sb.from('averias').select('id, descripcion, fecha, inmoviliza, estado, incidencia_id').eq('matricula', matricula).neq('estado', 'reparada').order('fecha', { ascending: false }),
        sb.from('revisiones_programadas').select('*').eq('matricula', matricula).eq('activa', true),
        sb.from('incidencias').select('id, descripcion, fecha, tipo').eq('matricula', matricula).neq('estado', 'COMPLETADO'),
        sb.from('averias').select('incidencia_id').eq('matricula', matricula).not('incidencia_id', 'is', null)
      ]);
      d.averias = av.data || [];
      d.revisiones = rev.data || [];
      const conAveria = new Set((enl.data || []).map(x => x.incidencia_id));
      d.incid = (inc.data || []).filter(i => !conAveria.has(i.id));
    } catch (e) { /* sin conexión: el resumen sale sin estos datos */ }
  })());
  await Promise.all(tareas);
  if (_fichaMat !== matricula) return; // se cerró o se cambió de vehículo
  // Estado de cada revisión (vencida / próxima) con el kilometraje actual
  if (typeof _mantEstadoRevision === 'function') {
    d.revisiones = d.revisiones.map(r => Object.assign({}, r, _mantEstadoRevision(r, d.km)));
  }
  _fichaDatos = d;
  _fichaPintarTodo();
}

// ── Pintado ──────────────────────────────────────────────────────────────────
function _fichaPintarTodo() {
  const v = _getVehiculo(_fichaMat);
  if (!v) return;
  _fichaPintarCabecera(v);
  _fichaPintarNav(v);
  // Paneles: el activo se pinta; Averías y Mantenimiento los pinta mantenimiento.js
  document.querySelectorAll('#modal-ficha-vehiculo .fv-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === _fichaTab));
  if (_fichaTab === 'mant' || _fichaTab === 'averias') {
    if (typeof mantCargarFicha === 'function' && !(typeof _mantFicha !== 'undefined' && _mantFicha && _mantFicha.matricula === _fichaMat)) mantCargarFicha(_fichaMat);
  }
  else _fichaPintarPanel(_fichaTab);
}

function _fichaEstado(v) {
  const d = _fichaDatos || {};
  const itv = _fvVencimiento(v.itv_fin, 30);
  const seg = _fvVencimiento(v.seguro_vencimiento, 30);
  const faltan = FICHA_DOCS_OBLIGATORIOS.filter(o => !(d.docs || []).concat(d.docsDrive || []).some(x => x.categoria === o.id));
  const averias = d.averias || [];
  const revs = d.revisiones || [];
  const revVencida = revs.some(r => r.estado === 'vencida');
  const revProxima = revs.some(r => r.estado === 'proxima');
  // Tacógrafo: próxima revisión programada (la más cercana)
  const revTaco = revs.filter(r => r.tipo === 'Tacógrafo' && r.fecha_limite).sort((a, b) => String(a.fecha_limite).localeCompare(String(b.fecha_limite)))[0] || null;
  const taco = !v.tacografo ? { cls: 'nada', txt: 'No lleva', dias: null, no: true }
    : (revTaco ? _fvVencimiento(revTaco.fecha_limite, 60) : { cls: d.cargado ? 'aviso' : 'nada', txt: 'Sin fecha', dias: null });
  return { itv, seg, faltan, averias, revs, revVencida, revProxima, incid: d.incid || [], taco, revTaco };
}

function _fichaPintarCabecera(v) {
  const e = _fichaEstado(v);
  const chips = [];
  const chip = (cls, txt) => `<span class="fv-chip ${cls}"><i aria-hidden="true"></i>${esc(txt)}</span>`;
  if (v.archivado) chips.push(chip('gris', 'De baja'));
  if (v.bloqueado) chips.push(chip('mal', 'No disponible'));
  if (e.itv.cls === 'mal') chips.push(chip('mal', 'ITV caducada'));
  else if (e.itv.cls === 'aviso') chips.push(chip('aviso', `ITV en ${e.itv.dias} d`));
  if (e.seg.cls === 'mal') chips.push(chip('mal', 'Seguro caducado'));
  else if (e.seg.cls === 'aviso') chips.push(chip('aviso', `Seguro en ${e.seg.dias} d`));
  if (!e.taco.no && e.taco.cls === 'mal') chips.push(chip('mal', 'Tacógrafo caducado'));
  else if (!e.taco.no && e.taco.cls === 'aviso' && e.taco.dias != null) chips.push(chip('aviso', `Tacógrafo en ${e.taco.dias} d`));
  if (e.averias.length) chips.push(chip('aviso', e.averias.length === 1 ? '1 avería abierta' : `${e.averias.length} averías abiertas`));
  if (e.incid.length) chips.push(chip('aviso', e.incid.length === 1 ? '1 incidencia pendiente' : `${e.incid.length} incidencias pendientes`));
  if (!chips.length && _fichaDatos && _fichaDatos.cargado) chips.push(chip('ok', 'Todo en regla'));

  const marca = _fvMarca(_fichaMat);
  const grupo = _fvGrupo(_fichaMat);
  const desc = [marca, _fvTipo(v.tipo)].filter(Boolean).join(' · ');
  const extra = [_fvCap(v.nota), _fvCap(grupo)].filter(Boolean).join(' · ');
  document.getElementById('fv-cabecera').innerHTML = `
    <div class="fv-placa" aria-label="Matrícula ${esc(_fichaMatReal(_fichaMat))}">
      <span class="fv-placa-eu" aria-hidden="true">★★★<b>E</b></span>
      <span class="fv-placa-txt">${esc(_fichaMatReal(_fichaMat))}</span>
    </div>
    <div class="fv-titulo">
      <span class="fv-eyebrow" id="fv-titulo">FICHA DEL VEHÍCULO</span>
      <span class="fv-desc">${esc(desc || _fichaMat)}${extra ? ` <span>· ${esc(extra)}</span>` : ''}</span>
    </div>
    ${_fvEsAdmin() ? `<button type="button" class="fv-lapiz fv-lapiz-osc" onclick="fichaEditar('datos')" title="Editar matrícula, tipo, nave, propiedad y sociedad">${_FV_LAPIZ}<span>Editar</span></button>` : ''}
    <div class="fv-chips">${chips.join('')}</div>
    <button type="button" class="fv-cerrar" onclick="cerrarFichaVehiculo()" aria-label="Cerrar la ficha">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>`;
}

function _fichaPintarNav(v) {
  const e = _fichaEstado(v);
  const d = _fichaDatos || {};
  const nDocs = (d.docs || []).concat(d.docsDrive || []).filter(x => x.categoria !== 'informe_itv').length; // la ITV va en su apartado
  const info = {
    resumen: { dot: (v.bloqueado || e.itv.cls === 'mal' || e.seg.cls === 'mal' || (!e.taco.no && e.taco.cls === 'mal')) ? 'mal' : ((e.averias.length || e.incid.length || e.itv.cls === 'aviso' || e.seg.cls === 'aviso' || e.faltan.length || (!e.taco.no && e.taco.cls === 'aviso')) ? 'aviso' : 'ok'), txt: '' },
    seguro:  { dot: e.seg.cls, txt: e.seg.cls === 'nada' ? '—' : (e.seg.cls === 'mal' ? 'Caducado' : `${e.seg.dias} d`) },
    itv:     { dot: e.itv.cls, txt: e.itv.cls === 'nada' ? '—' : (e.itv.cls === 'mal' ? 'Caducada' : `${e.itv.dias} d`) },
    taco:    { dot: e.taco.cls, txt: e.taco.no ? 'No lleva' : (e.taco.dias == null ? (d.cargado ? 'Sin fecha' : '…') : (e.taco.cls === 'mal' ? 'Caducado' : `${e.taco.dias} d`)) },
    docs:    { dot: e.faltan.length ? 'aviso' : 'ok', txt: d.cargado ? String(nDocs) : '…' },
    averias: { dot: e.averias.some(a => a.inmoviliza) ? 'mal' : ((e.averias.length || e.incid.length) ? 'aviso' : 'ok'),
               txt: e.averias.length ? String(e.averias.length) : (e.incid.length ? `${e.incid.length} pend.` : ''),
               globo: e.averias.length > 0 },
    // Mantenimiento: globo rojo con las revisiones vencidas, o ámbar con las próximas
    mant:    { dot: e.revVencida ? 'mal' : (e.revProxima ? 'aviso' : 'ok'),
               txt: e.revVencida ? String(e.revs.filter(r => r.estado === 'vencida').length)
                  : (e.revProxima ? String(e.revs.filter(r => r.estado === 'proxima').length) : ''),
               globo: e.revVencida ? true : (e.revProxima ? 'ambar' : false),
               titulo: e.revVencida ? 'Revisiones vencidas' : (e.revProxima ? 'Revisiones próximas' : '') },
    gestion: { dot: v.archivado ? 'nada' : (v.bloqueado ? 'mal' : (v.restringido ? 'aviso' : 'ok')),
               txt: v.archivado ? 'Baja' : (v.bloqueado ? 'Bloq.' : (v.restringido ? 'Restr.' : '')) }
  };
  if (!d.cargado) { info.docs.dot = 'nada'; info.averias.dot = 'nada'; info.mant.dot = 'nada'; info.resumen.dot = 'nada'; }
  if (!_fvSecciones().some(s => s.id === _fichaTab)) _fichaTab = 'resumen';
  document.getElementById('fv-nav-ops').innerHTML = _fvSecciones().map(s => `
    <button type="button" class="fv-nav-op${s.id === _fichaTab ? ' activa' : ''}" data-tab="${s.id}" aria-current="${s.id === _fichaTab ? 'page' : 'false'}" onclick="fichaTabSwitch('${s.id}')">
      <i class="fv-dot ${info[s.id].dot}" aria-hidden="true"></i>
      <span class="fv-nav-txt">${s.label}</span>
      <span class="fv-nav-info ${info[s.id].dot}${info[s.id].globo ? ' globo' : ''}${info[s.id].globo === 'ambar' ? ' ambar' : ''}"${info[s.id].titulo ? ` title="${info[s.id].titulo}"` : ''}>${esc(info[s.id].txt)}</span>
    </button>`).join('');
  document.getElementById('fv-km').innerHTML = `
    <span class="fv-km-lbl">Kilometraje</span>
    <span class="fv-km-val">${d.cargado ? _fvKm(d.km) : '…'}</span>
    <span class="fv-km-sub">Según el último repostaje</span>`;
}

function _fichaPintarPanel(tab) {
  const v = _getVehiculo(_fichaMat);
  const cont = document.querySelector(`#modal-ficha-vehiculo .fv-panel[data-tab="${tab}"]`);
  if (!v || !cont) return;
  const html = { resumen: _fichaHtmlResumen, seguro: _fichaHtmlSeguro, itv: _fichaHtmlItv, taco: _fichaHtmlTaco, docs: _fichaHtmlDocs, gestion: _fichaHtmlGestion }[tab];
  if (html) cont.innerHTML = html(v);
}

function _fvCargando() {
  return `<div class="fv-cargando"><div class="ficha-spinner"></div>Cargando…</div>`;
}

function _fvDocFila(doc, accion) {
  const pdf = (doc.formato || '').toLowerCase() === 'pdf' || /\.pdf$/i.test(doc.nombre || '');
  const ver = `abrirVisorDoc('${esc(doc.ref)}','${esc(doc.nombre || '')}','${esc(doc.formato || '')}')`;
  return `
    <div class="fv-doc">
      <span class="fv-doc-ico ${pdf ? 'pdf' : 'img'}" aria-hidden="true">${pdf ? 'PDF' : 'IMG'}</span>
      <div class="fv-doc-info">
        ${accion === 'cat' ? `<span class="fv-doc-cat">${esc(FICHA_DOC_LABELS[doc.categoria] || 'Otros')}</span>` : ''}
        <span class="fv-doc-nombre" title="${esc(doc.nombre)}">${esc(doc.nombre || 'Sin nombre')}</span>
        <span class="fv-doc-meta">${_fvFecha(doc.fecha)} · ${esc(_fvCap(doc.subido_por || '—'))}${doc.origen === 'drive' ? ' · en Drive' : ''}</span>
      </div>
      <button type="button" class="fv-btn" onclick="${ver}">Ver</button>
    </div>`;
}

// ── Resumen ──
function _fichaHtmlResumen(v) {
  const d = _fichaDatos || {};
  const e = _fichaEstado(v);
  const admin = _fvEsAdmin();
  const mat = esc(_fichaMat);
  let h = '';

  if (v.bloqueado) {
    h += `<div class="fv-bloqueo">
      <span class="fv-bloqueo-ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M7 12h10"/></svg></span>
      <div class="fv-bloqueo-txt">
        <strong>No disponible para asignar</strong>
        <span>Motivo: <b>${esc(v.motivo_bloqueo || 'sin indicar')}</b>${v.bloqueado_por ? ` · bloqueado por ${esc(_fvCap(v.bloqueado_por))}` : ''}${v.fecha_bloqueo ? ` el ${esc(_fvFechaHora(v.fecha_bloqueo))}` : ''}</span>
      </div>
      ${admin ? `<button type="button" class="fv-btn fv-btn-rojo" onclick="fichaDesbloquear()">Desbloquear</button>` : ''}
    </div>`;
  }

  // Tarjetas ITV / Seguro / Mantenimiento
  // Barra de lo que queda hasta la próxima ITV / el vencimiento del seguro (sobre un año)
  const pctItv = e.itv.dias != null && e.itv.dias > 0 ? Math.max(4, Math.min(100, Math.round(e.itv.dias / 365 * 100))) : 0;
  const pctSeg = e.seg.dias != null && e.seg.dias > 0 ? Math.max(4, Math.min(100, Math.round(e.seg.dias / 365 * 100))) : 0;
  const itvTitulo = { mal: 'Caducada', aviso: `Vence en ${e.itv.dias} d`, ok: 'En vigor', nada: 'Sin fecha' }[e.itv.cls];
  const itvSub = v.itv_fin ? (e.itv.dias < 0 ? `Venció el ${_fvFecha(v.itv_fin)}` : e.itv.dias === 0 ? `Vence hoy, ${_fvFecha(v.itv_fin)}` : `Hasta el ${_fvFecha(v.itv_fin)}`) : 'No hay fecha registrada';
  const informeItv = (d.docs || []).concat(d.docsDrive || []).filter(x => x.categoria === 'informe_itv')
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))[0]; // el más reciente
  const segTitulo = { mal: 'Caducado', aviso: `Vence en ${e.seg.dias} d`, ok: 'En vigor', nada: 'Sin datos' }[e.seg.cls];

  let mantTitulo = 'Sin pendientes', mantCls = 'ok', mantSub = 'No hay averías abiertas';
  if (!d.cargado) { mantTitulo = '…'; mantCls = 'nada'; mantSub = 'Cargando…'; }
  else if (e.averias.length) {
    mantTitulo = e.averias.length === 1 ? '1 avería' : `${e.averias.length} averías`;
    mantCls = e.averias.some(a => a.inmoviliza) ? 'mal' : 'aviso';
    const a = e.averias[0];
    const dias = -_fvDias(a.fecha);
    mantSub = `«${a.descripcion}» · ${dias <= 0 ? 'abierta desde hoy' : `abierta hace ${dias} día${dias === 1 ? '' : 's'}`}`;
  } else if (e.incid.length) {
    mantTitulo = e.incid.length === 1 ? '1 incidencia' : `${e.incid.length} incidencias`; mantCls = 'aviso';
    mantSub = `Pendiente: «${e.incid[0].descripcion}»`;
  }
  const proxRev = (e.revs || []).slice().sort((a, b) => ({ vencida: 0, proxima: 1, ok: 2 }[a.estado] - { vencida: 0, proxima: 1, ok: 2 }[b.estado]) || String(a.fecha_limite || '9').localeCompare(String(b.fecha_limite || '9')))[0];
  const revTxt = proxRev ? `${proxRev.estado === 'vencida' ? 'Revisión vencida' : 'Próxima revisión'}: ${esc(proxRev.tipo)}${proxRev.fecha_limite ? ', ' + _fvFecha(proxRev.fecha_limite) : ''}${proxRev.km_limite != null ? ' o ' + _fvKm(Number(proxRev.km_limite)) : ''}` : 'Sin revisiones programadas';

  h += `<div class="fv-grid3">
    <button type="button" class="fv-card fv-card-link" onclick="fichaTabSwitch('itv')">
      <span class="fv-card-lbl">ITV</span>
      <span class="fv-card-big ${e.itv.cls}">${itvTitulo}</span>
      <span class="fv-card-sub">${itvSub}</span>
      ${v.itv_fin ? `<span class="fv-barra"><i class="${e.itv.cls}" style="width:${pctItv}%"></i></span><span class="fv-card-pie">${e.itv.dias > 0 ? `Quedan ${e.itv.dias} días` : 'Hay que pasarla'}</span>` : ''}
      ${informeItv ? `<span class="fv-card-pie">Informe: ${esc(informeItv.nombre)}</span>` : ''}
    </button>
    <button type="button" class="fv-card fv-card-link" onclick="fichaTabSwitch('seguro')">
      <span class="fv-card-lbl">SEGURO</span>
      <span class="fv-card-big ${e.seg.cls}">${segTitulo}</span>
      <span class="fv-card-sub">${esc(_fvCap(v.seguro_aseguradora || 'Sin aseguradora'))}${v.seguro_vencimiento ? ` · vence el ${_fvFecha(v.seguro_vencimiento)}` : ''}</span>
      ${v.seguro_vencimiento ? `<span class="fv-barra"><i class="${e.seg.cls}" style="width:${pctSeg}%"></i></span><span class="fv-card-pie">${e.seg.dias > 0 ? `Quedan ${e.seg.dias} días` : 'Hay que renovarlo'}</span>` : ''}
    </button>
    <button type="button" class="fv-card fv-card-link" onclick="fichaTabSwitch('${(e.averias.length || e.incid.length) ? 'averias' : 'mant'}')">
      <span class="fv-card-lbl">MANTENIMIENTO</span>
      <span class="fv-card-big ${mantCls}">${mantTitulo}</span>
      <span class="fv-card-sub">${esc(mantSub)}</span>
      <span class="fv-card-pie">${revTxt}</span>
    </button>
  </div>`;

  // Documentación + acciones rápidas
  const docsTodos = (d.docs || []).concat(d.docsDrive || []);
  const otros = docsTodos.filter(x => !FICHA_DOCS_OBLIGATORIOS.some(o => o.id === x.categoria)).length;
  let docsHtml;
  if (!d.cargado) docsHtml = _fvCargando();
  else {
    docsHtml = `<ul class="fv-check">` + FICHA_DOCS_OBLIGATORIOS.map(o => {
      const tiene = docsTodos.some(x => x.categoria === o.id);
      return `<li class="${tiene ? 'ok' : 'falta'}"><b aria-hidden="true">${tiene ? '✓' : '!'}</b>${tiene ? o.label : 'Falta ' + o.label.toLowerCase()}</li>`;
    }).join('') + (otros ? `<li class="ok"><b aria-hidden="true">✓</b>${otros} documento${otros === 1 ? '' : 's'} más</li>` : '') +
      ((d.fotos || []).length ? `<li class="ok"><b aria-hidden="true">✓</b>${d.fotos.length} foto${d.fotos.length === 1 ? '' : 's'}</li>` : '') + `</ul>`;
  }
  const tel = _fvTel(v.seguro_tel);
  h += `<div class="fv-grid2">
    <div class="fv-card">
      <div class="fv-card-cab"><span class="fv-card-lbl">DOCUMENTACIÓN</span>${d.cargado ? `<span class="fv-card-nota">${FICHA_DOCS_OBLIGATORIOS.length - e.faltan.length} de ${FICHA_DOCS_OBLIGATORIOS.length} obligatorios</span>` : ''}</div>
      ${docsHtml}
    </div>
    <div class="fv-card">
      <span class="fv-card-lbl">ACCIONES RÁPIDAS</span>
      <div class="fv-acciones">
        <button type="button" class="fv-btn fv-btn-gr" onclick="mantAbrirFormAveria('${mat}')">Dar parte de avería</button>
        <button type="button" class="fv-btn fv-btn-gr" onclick="fichaSubirDocumento()">Subir documento</button>
        <button type="button" class="fv-btn fv-btn-gr" onclick="abrirGestorDocumentos('${mat}','fotos',{puedeBorrar:${admin}})">Añadir fotos</button>
        ${tel ? `<a class="fv-btn fv-btn-gr fv-btn-oscuro" href="tel:${esc(tel)}">Llamar asistencia</a>` : `<button type="button" class="fv-btn fv-btn-gr" disabled title="Sin teléfono de asistencia">Llamar asistencia</button>`}
      </div>
    </div>
  </div>`;
  return h;
}

// ── Seguro ──
function _fichaHtmlSeguro(v) {
  const d = _fichaDatos || {};
  const e = _fichaEstado(v);
  const campo = (lbl, val, mono) => `<div class="fv-campo"><span class="fv-campo-lbl">${lbl}</span><span class="fv-campo-val${mono ? ' mono' : ''}${val ? '' : ' vacio'}">${val ? esc(val) : 'Sin datos'}</span></div>`;
  const tel = _fvTel(v.seguro_tel);
  const pct = e.seg.dias != null && e.seg.dias > 0 ? Math.max(4, Math.min(100, Math.round(e.seg.dias / 365 * 100))) : 0;
  const polizas = (d.docs || []).concat(d.docsDrive || []).filter(x => x.categoria === 'poliza_seguro');
  let h = `<div class="fv-docs-cab">
      <h2 class="fv-h2">Seguro</h2><span class="fv-card-nota"></span>
      ${_fvEsAdmin() ? `<button type="button" class="fv-lapiz" onclick="fichaEditar('seguro')">${_FV_LAPIZ}<span>Editar seguro</span></button>` : ''}
    </div>
    <div class="fv-card fv-campos">
      ${campo('Aseguradora', _fvCap(v.seguro_aseguradora))}
      ${campo('Nº de póliza', v.seguro_poliza, true)}
      ${campo('Tomador', _fvCap(v.seguro_nombre))}
      ${campo('CIF', v.seguro_cif, true)}
    </div>
    <div class="fv-grid2">
      <div class="fv-card">
        <span class="fv-card-lbl">VENCIMIENTO</span>
        <span class="fv-card-big ${e.seg.cls}">${v.seguro_vencimiento ? _fvFecha(v.seguro_vencimiento) : 'Sin fecha'}</span>
        ${v.seguro_vencimiento ? `<span class="fv-barra grande"><i class="${e.seg.cls}" style="width:${pct}%"></i></span>` : ''}
        <span class="fv-card-sub">${e.seg.cls === 'nada' ? 'No hay fecha de vencimiento registrada' : e.seg.cls === 'mal' ? 'Caducado: hay que renovarlo' : `${e.seg.txt} · quedan ${e.seg.dias} días`}</span>
      </div>
      <div class="fv-card fv-card-oscura">
        <span class="fv-card-lbl">ASISTENCIA EN CARRETERA</span>
        <span class="fv-tel">${v.seguro_tel ? esc(v.seguro_tel) : 'Sin teléfono'}</span>
        ${tel ? `<a class="fv-btn fv-btn-rojo-lleno" href="tel:${esc(tel)}">Llamar ahora</a>` : ''}
      </div>
    </div>`;
  if (!d.cargado) h += _fvCargando();
  else if (polizas.length) h += `<div class="fv-docs-lista">${polizas.map(p => _fvDocFila(p)).join('')}</div>`;
  else h += _fvHuecoDoc('poliza_seguro', 'Póliza de seguro');
  return h;
}

// ── ITV ──
function _fichaHtmlItv(v) {
  const d = _fichaDatos || {};
  const e = _fichaEstado(v);
  const informes = (d.docs || []).concat(d.docsDrive || []).filter(x => x.categoria === 'informe_itv');
  const titulo = { mal: e.itv.dias === 0 ? 'Caduca hoy' : 'Caducada', aviso: `Vence en ${e.itv.dias} días`, ok: 'En vigor', nada: 'Sin fecha registrada' }[e.itv.cls];
  const sub = !v.itv_fin ? 'Sube el informe de ITV y la fecha se rellena sola.'
    : e.itv.dias < 0 ? `Venció el ${_fvFecha(v.itv_fin)}, hace ${-e.itv.dias} día${e.itv.dias === -1 ? '' : 's'}. El vehículo no debe circular.`
    : e.itv.dias === 0 ? `Vence hoy, ${_fvFecha(v.itv_fin)}. El vehículo no debe circular a partir de mañana.`
    : `Válida hasta el ${_fvFecha(v.itv_fin)}.`;
  let h = `<div class="fv-docs-cab">
      <h2 class="fv-h2">ITV</h2><span class="fv-card-nota"></span>
      ${_fvEsAdmin() && typeof itvEdicionManualPermitida === 'function' && itvEdicionManualPermitida(_fichaMat) ? `<button type="button" class="fv-lapiz" onclick="fichaEditar('itv')" title="El informe no se pudo leer bien: pon la fecha a mano">${_FV_LAPIZ}<span>Editar fecha</span></button>` : ''}
      <label class="fv-btn fv-btn-oscuro fv-subir-itv${_fichaSubiendoItv ? ' ocupado' : ''}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>
        <span>Subir nuevo informe</span>
        <input type="file" accept="application/pdf,image/*" class="fv-oculto" ${_fichaSubiendoItv ? 'disabled' : ''} onchange="fichaSubirInformeItv(this)">
      </label>
    </div>
    <div id="fv-itv-estado" class="fv-itv-estado-linea" role="status"${_fichaSubiendoItv ? '' : ' hidden'}>${esc(_fichaSubiendoItv || '')}</div>
    <div class="fv-card fv-itv ${e.itv.cls}">
      <span class="fv-itv-sem" aria-hidden="true"></span>
      <div class="fv-itv-txt">
        <span class="fv-card-lbl">PRÓXIMA ITV</span>
        <span class="fv-itv-fecha">${v.itv_fin ? _fvFecha(v.itv_fin) : '—'}</span>
        <span class="fv-itv-estado ${e.itv.cls}">${titulo}</span>
        <span class="fv-card-sub">${sub}</span>
      </div>
    </div>
`;
  // El informe más reciente es el actual; los anteriores van al historial (plegado)
  const ordenados = informes.slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  const anteriores = ordenados.slice(1);
  h += `<h3 class="fv-h3">Informe actual</h3>`;
  if (!d.cargado) h += _fvCargando();
  else if (ordenados.length) {
    h += `<div class="fv-docs-lista">${_fvDocFila(ordenados[0])}</div>`;
    if (anteriores.length) h += `
      <details class="fv-historial">
        <summary>Historial · ${anteriores.length} informe${anteriores.length === 1 ? '' : 's'} anterior${anteriores.length === 1 ? '' : 'es'}</summary>
        <div class="fv-docs-lista">${anteriores.map(p => _fvDocFila(p)).join('')}</div>
      </details>`;
  }
  else h += `<div class="fv-doc fv-doc-falta">
      <span class="fv-doc-ico falta" aria-hidden="true">!</span>
      <div class="fv-doc-info">
        <span class="fv-doc-cat">INFORME ITV</span>
        <span class="fv-doc-nombre">Falta subirlo</span>
        <span class="fv-doc-meta">Pulsa «Subir nuevo informe» para añadirlo</span>
      </div>
    </div>`;
  return h;
}

// ── Tacógrafo ──
function _fichaHtmlTaco(v) {
  const d = _fichaDatos || {};
  const e = _fichaEstado(v);
  const admin = _fvEsAdmin();
  const mat = esc(_fichaMat);
  if (!v.tacografo) {
    return `<h2 class="fv-h2">Tacógrafo</h2>
      <div class="fv-card fv-taco-no">
        <span class="fv-taco-no-ico" aria-hidden="true">—</span>
        <div class="fv-gest-txt">
          <span class="fv-gest-titulo">Este vehículo no lleva tacógrafo</span>
          <span class="fv-card-sub">No hace falta revisarlo y no salen avisos.</span>
        </div>
        ${admin ? `<button type="button" class="fv-btn" onclick="fichaTacografo(true)">Sí lleva tacógrafo</button>` : ''}
      </div>`;
  }
  const r = e.revTaco;
  const t = e.taco;
  const titulo = !r ? 'Sin fecha' : ({ mal: t.dias === 0 ? 'Caduca hoy' : 'Caducado', aviso: `Vence en ${t.dias} días`, ok: 'En vigor' }[t.cls] || '—');
  const sub = !r ? (admin ? 'No hay próxima revisión programada. Pulsa «Programar fecha».' : 'No hay próxima revisión programada.')
    : t.dias < 0 ? `Venció el ${_fvFecha(r.fecha_limite)}, hace ${-t.dias} día${t.dias === -1 ? '' : 's'}.`
    : `Hay que pasar la revisión antes del ${_fvFecha(r.fecha_limite)}.`;
  const pct = t.dias != null && t.dias > 0 ? Math.max(4, Math.min(100, Math.round(t.dias / 730 * 100))) : 0; // cada 2 años
  let h = `<div class="fv-docs-cab">
      <h2 class="fv-h2">Tacógrafo</h2><span class="fv-card-nota"></span>
      ${admin && !r ? `<button type="button" class="fv-lapiz" onclick="mantAbrirFormRevision('${mat}','Tacógrafo')">${_FV_LAPIZ}<span>Programar fecha</span></button>` : ''}
      ${admin ? `<button type="button" class="fv-btn fv-btn-oscuro" onclick="mantAbrirFormMantenimiento('${mat}','${r ? esc(r.id) : ''}','Tacógrafo')">✓ Registrar revisión hecha</button>` : ''}
    </div>
    <div class="fv-card fv-itv ${r ? t.cls : 'nada'}">
      <span class="fv-itv-sem" aria-hidden="true"></span>
      <div class="fv-itv-txt">
        <span class="fv-card-lbl">PRÓXIMA REVISIÓN</span>
        <span class="fv-itv-fecha">${r ? _fvFecha(r.fecha_limite) : '—'}</span>
        <span class="fv-itv-estado ${r ? t.cls : 'nada'}">${titulo}</span>
        <span class="fv-card-sub">${sub}</span>
        ${r ? `<span class="fv-barra grande fv-taco-barra"><i class="${t.cls}" style="width:${pct}%"></i></span>` : ''}
      </div>
    </div>
    <h3 class="fv-h3">Revisiones realizadas</h3>`;
  if (!d.cargado) h += _fvCargando();
  else if (!(d.taco || []).length) h += `<div class="fv-cargando">Todavía no hay revisiones registradas.</div>`;
  else {
    const ver = (path, nombre, txt) => `<button type="button" class="fv-btn" title="${esc(nombre || '')}" onclick="abrirVisorDoc('sb:${esc(path)}','${esc(nombre || 'Documento')}','${/\.pdf$/i.test(nombre || '') ? 'pdf' : 'imagen'}')">${txt}</button>`;
    h += `<div class="fv-docs-lista">` + d.taco.map(m => {
      const adj = Array.isArray(m.adjuntos) ? m.adjuntos.filter(a => a && a.path) : [];
      const docs = (m.factura_path ? [ver(m.factura_path, m.factura_nombre, adj.length ? 'Factura' : 'Ver')] : [])
        .concat(adj.map((a, i) => ver(a.path, a.nombre, adj.length > 1 ? `Doc. ${i + 1}` : 'Certificado')));
      const datos = [m.taller, m.coste != null ? Number(m.coste).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '', m.km != null ? Math.round(Number(m.km)).toLocaleString('es-ES') + ' km' : ''].filter(Boolean).join(' · ');
      return `<div class="fv-doc fv-taco-rev">
        <span class="fv-taco-fecha">${_fvFecha(m.fecha)}</span>
        <div class="fv-doc-info">
          <span class="fv-doc-nombre">${esc(m.descripcion || 'Revisión del tacógrafo')}</span>
          <span class="fv-doc-meta">${esc(datos || 'Sin taller ni coste')}</span>
        </div>
        <span class="fv-taco-docs">${docs.join('')}${admin ? `<button type="button" class="fv-btn" title="Añadir certificado u otro documento" onclick="fichaTacoAdjuntar('${esc(m.id)}')">+ Documento</button>` : ''}</span>
      </div>`;
    }).join('') + `</div>`;
  }
  if (admin) h += `<button type="button" class="fv-taco-quitar" onclick="fichaTacografo(false)">Este vehículo no lleva tacógrafo</button>`;
  return h;
}

/** Marca si el vehículo lleva tacógrafo (solo admin). */
async function fichaTacografo(lleva) {
  if (!_fvEsAdmin()) return;
  const v = _getVehiculo(_fichaMat);
  if (!v) return;
  if (!lleva) {
    const ok = await appConfirm(`<strong>${esc(v.matricula)}</strong> dejará de mostrar avisos de tacógrafo. Las revisiones ya registradas se conservan en Mantenimiento.`,
      { titulo: '¿No lleva tacógrafo?', icono: '🚚', labelOk: 'Sí, no lleva', colorOk: '#1a1a2e' });
    if (!ok) return;
  }
  v.tacografo = !!lleva;
  renderAdminVehiculos(); renderTabla();
  sincronizarVehiculosConSheets();
  registrarAccion('VEHICULO', lleva ? 'Lleva tacógrafo' : 'No lleva tacógrafo', v.matricula);
  mostrarToast(lleva ? '✓ Marcado: lleva tacógrafo' : '✓ Marcado: no lleva tacógrafo', 'success');
}

/** Añade un documento (certificado…) a una revisión de tacógrafo ya registrada. */
function fichaTacoAdjuntar(mantId) {
  const mat = _fichaMat;
  if (!_fvEsAdmin() || !mat) return;
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/pdf,image/*';
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    if (typeof DOCS_MAX_MB !== 'undefined' && file.size > DOCS_MAX_MB * 1024 * 1024) { mostrarToast(`El archivo supera los ${DOCS_MAX_MB} MB`, 'error'); return; }
    try {
      mostrarToast('Subiendo documento…', 'info');
      const mime = typeof _docsMime === 'function' ? _docsMime(file) : (file.type || '');
      const blob = file.type ? file : new Blob([file], { type: mime });
      const path = await docsSubirArchivo(mat, 'mantenimiento', blob, file.name);
      const { data: m, error: e1 } = await sb.from('mantenimientos').select('adjuntos').eq('id', mantId).maybeSingle();
      if (e1) throw e1;
      const adj = (Array.isArray(m && m.adjuntos) ? m.adjuntos : []).concat([{ path, nombre: file.name }]);
      const { error: e2 } = await sb.from('mantenimientos').update({ adjuntos: adj }).eq('id', mantId);
      if (e2) throw e2;
      registrarAccion('MANTENIMIENTO', 'Documento añadido a revisión de tacógrafo', `${mat} · ${file.name}`);
      mostrarToast('✓ Documento añadido', 'success');
      if (_fichaMat === mat) _fichaCargarDatos(mat);
    } catch (e) { mostrarToast('No se pudo añadir: ' + (e.message || 'error de conexión'), 'error'); }
  };
  inp.click();
}

function _fvHuecoDoc(cat, label) {
  const admin = _fvEsAdmin();
  return `<div class="fv-doc fv-doc-falta">
    <span class="fv-doc-ico falta" aria-hidden="true">!</span>
    <div class="fv-doc-info">
      <span class="fv-doc-cat">${esc(label.toUpperCase())}</span>
      <span class="fv-doc-nombre">Falta subirlo</span>
      <span class="fv-doc-meta">Debería estar en la ficha del vehículo</span>
    </div>
    <button type="button" class="fv-btn" onclick="fichaSubirDocumento('${esc(cat)}')">Subir</button>
  </div>`;
}

// ── Documentos ──
// Lo esencial (ficha técnica, permiso y póliza) en tarjetas grandes y, debajo,
// el resto. Los informes de ITV no salen aquí: están en el apartado ITV.
const FICHA_DOCS_ESENCIALES = FICHA_DOCS_OBLIGATORIOS.filter(o => o.id !== 'informe_itv');

function _fvFechaOrden(x) { return String(x.fecha || ''); }

function _fvDocGrande(doc, etiqueta, anteriores) {
  const pdf = (doc.formato || '').toLowerCase() === 'pdf' || /\.pdf$/i.test(doc.nombre || '');
  const ver = `abrirVisorDoc('${esc(doc.ref)}','${esc(doc.nombre || '')}','${esc(doc.formato || '')}')`;
  return `
    <div class="fv-docg">
      <div class="fv-docg-cab">
        <span class="fv-docg-ico ${pdf ? 'pdf' : 'img'}" aria-hidden="true">${pdf ? 'PDF' : 'IMG'}</span>
        <span class="fv-docg-cat">${esc(etiqueta)}</span>
      </div>
      <span class="fv-docg-nombre" title="${esc(doc.nombre)}">${esc(doc.nombre || 'Sin nombre')}</span>
      <span class="fv-docg-meta">${_fvFecha(doc.fecha)} · ${esc(_fvCap(doc.subido_por || '—'))}${doc.origen === 'drive' ? ' · en Drive' : ''}${anteriores ? ` · ${anteriores} versión${anteriores === 1 ? '' : 'es'} anterior${anteriores === 1 ? '' : 'es'}` : ''}</span>
      <button type="button" class="fv-btn fv-btn-oscuro fv-docg-ver" onclick="${ver}">Ver documento</button>
    </div>`;
}

function _fvDocGrandeFalta(label, cat) {
  const admin = _fvEsAdmin();
  return `
    <div class="fv-docg falta">
      <div class="fv-docg-cab">
        <span class="fv-docg-ico falta" aria-hidden="true">!</span>
        <span class="fv-docg-cat">${esc(label)}</span>
      </div>
      <span class="fv-docg-nombre">Falta subirlo</span>
      <span class="fv-docg-meta">Debería estar en la ficha del vehículo</span>
      <button type="button" class="fv-btn fv-docg-ver" onclick="fichaSubirDocumento('${esc(cat)}')">Subir</button>
    </div>`;
}

function _fichaHtmlDocs(v) {
  const d = _fichaDatos || {};
  const admin = _fvEsAdmin();
  const mat = esc(_fichaMat);
  const todos = (d.docs || []).concat(d.docsDrive || []).filter(x => x.categoria !== 'informe_itv');
  let h = `<div class="fv-docs-cab">
      <h2 class="fv-h2">Documentos</h2>
      <span class="fv-card-nota">${d.cargado ? `${todos.length} archivo${todos.length === 1 ? '' : 's'}${(d.fotos || []).length ? ` · ${d.fotos.length} foto${d.fotos.length === 1 ? '' : 's'}` : ''}` : ''}</span>
      <button type="button" class="fv-btn" onclick="abrirGestorDocumentos('${mat}','fotos',{puedeBorrar:${admin}})">Fotos</button>
      <button type="button" class="fv-btn fv-btn-oscuro" onclick="fichaSubirDocumento()">+ Subir documento</button>
    </div>`;
  if (!d.cargado) return h + _fvCargando();
  if (d.errorDocs) return h + `<div class="fv-cargando" style="color:#B42318">No se pudieron cargar los documentos. Revisa la conexión.</div>`;

  // Esenciales: el más reciente de cada uno (o el hueco si falta)
  h += `<h3 class="fv-h3">Documentación del vehículo</h3><div class="fv-docs-grandes">`;
  FICHA_DOCS_ESENCIALES.forEach(o => {
    const de = todos.filter(x => x.categoria === o.id).sort((a, b) => _fvFechaOrden(b).localeCompare(_fvFechaOrden(a)));
    h += de.length ? _fvDocGrande(de[0], o.label, de.length - 1) : _fvDocGrandeFalta(o.label, o.id);
  });
  h += `</div>`;

  // Otros documentos (revisión del tacógrafo, etc.)
  const otros = todos.filter(x => !FICHA_DOCS_OBLIGATORIOS.some(o => o.id === x.categoria))
    .sort((a, b) => _fvFechaOrden(b).localeCompare(_fvFechaOrden(a)));
  if (otros.length) {
    h += `<h3 class="fv-h3">Otros documentos</h3><div class="fv-docs-grandes">${otros.map(x => _fvDocGrande(x, FICHA_DOC_LABELS[x.categoria] && x.categoria !== 'otros' ? FICHA_DOC_LABELS[x.categoria] : 'Otros')).join('')}</div>`;
  }
  return h;
}

// ── Subir un documento desde la ficha (ventana pequeña: tipo + archivo) ──
const FICHA_TIPOS_SUBIDA = [
  { id: 'ficha_tecnica',       label: 'Ficha técnica' },
  { id: 'permiso_circulacion', label: 'Permiso de circulación' },
  { id: 'poliza_seguro',       label: 'Póliza de seguro' },
  { id: 'informe_itv',         label: 'Informe ITV' },
  { id: 'otros',               label: 'Otro documento' }
];

function fichaSubirDocumento(categoria) {
  const mat = _fichaMat;
  if (!mat || typeof _mantModal !== 'function') return;
  const cat = FICHA_TIPOS_SUBIDA.some(t => t.id === categoria) ? categoria : 'ficha_tecnica';
  const opciones = FICHA_TIPOS_SUBIDA.map(t => `<option value="${t.id}"${t.id === cat ? ' selected' : ''}>${t.label}</option>`).join('');
  const cuerpo =
    _mantCampo('¿Qué documento es?', `<select name="categoria">${opciones}</select>`) +
    _mantCampo('Archivo', `<input type="file" name="archivo" accept="application/pdf,image/*">`, `PDF o foto, de ${typeof DOCS_MAX_MB !== 'undefined' ? DOCS_MAX_MB : 15} MB como máximo.`);
  let itvSubido = null;
  const ov = _mantModal(`Subir documento · ${_fichaMatReal(mat)}`, '📄', cuerpo, 'Subir', async form => {
    const file = form.archivo.files && form.archivo.files[0];
    if (!file) return 'Elige el archivo que quieres subir.';
    const mime = typeof _docsMime === 'function' ? _docsMime(file) : (file.type || '');
    if (mime !== 'application/pdf' && !mime.startsWith('image/')) return 'Solo se admiten PDF o fotos.';
    if (typeof DOCS_MAX_MB !== 'undefined' && file.size > DOCS_MAX_MB * 1024 * 1024) return `El archivo supera los ${DOCS_MAX_MB} MB.`;
    const categoria = form.categoria.value;
    const etiqueta = (FICHA_TIPOS_SUBIDA.find(t => t.id === categoria) || {}).label || 'Documento';
    const blob = file.type ? file : new Blob([file], { type: mime });
    await docsSubirArchivo(mat, categoria, blob, file.name);
    registrarAccion('VEHICULO', 'Subir documento', `${mat} · ${etiqueta} · ${file.name}`);
    mostrarToast(`✓ ${etiqueta} subido`, 'success');
    if (categoria === 'informe_itv') itvSubido = file;
    if (_fichaMat === mat) _fichaCargarDatos(mat);
    return null;
  });
  // Al cerrar tras subir un informe ITV: leer la fecha y ofrecer guardarla
  const obs = new MutationObserver(() => {
    if (ov.isConnected) return;
    obs.disconnect();
    if (itvSubido && typeof itvActualizarDesdeInforme === 'function') itvActualizarDesdeInforme(mat, itvSubido, null);
  });
  obs.observe(document.body, { childList: true });
}

// ── Subir un informe ITV desde la propia ficha ──
let _fichaSubiendoItv = '';   // texto de estado mientras se sube / se lee

async function fichaSubirInformeItv(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file || _fichaSubiendoItv) return;
  const mat = _fichaMat;
  const mime = typeof _docsMime === 'function' ? _docsMime(file) : (file.type || '');
  if (mime !== 'application/pdf' && !mime.startsWith('image/')) { mostrarToast('Solo se admiten PDF o imágenes', 'error'); return; }
  if (typeof DOCS_MAX_MB !== 'undefined' && file.size > DOCS_MAX_MB * 1024 * 1024) { mostrarToast(`El archivo supera los ${DOCS_MAX_MB} MB`, 'error'); return; }
  const repintar = () => { if (_fichaMat === mat && _fichaTab === 'itv') _fichaPintarPanel('itv'); };
  _fichaSubiendoItv = `Subiendo ${file.name}…`; repintar();
  try {
    const blob = file.type ? file : new Blob([file], { type: mime });
    await docsSubirArchivo(mat, 'informe_itv', blob, file.name);
    registrarAccion('VEHICULO', 'Subir documento', `${mat} · Informe ITV · ${file.name}`);
    mostrarToast('✓ Informe ITV subido', 'success');
  } catch (e) {
    _fichaSubiendoItv = ''; repintar();
    mostrarToast('No se pudo subir: ' + e.message, 'error');
    return;
  }
  _fichaSubiendoItv = '';
  if (_fichaMat === mat) await _fichaCargarDatos(mat); // el nuevo pasa a "Informe actual"
  // Leer la fecha de la próxima ITV del informe y ofrecer guardarla (js/itv-ocr.js)
  if (typeof itvActualizarDesdeInforme === 'function') {
    await itvActualizarDesdeInforme(mat, file, document.getElementById('fv-itv-estado'));
  }
}

// ── Gestión (solo administradores) ──
function _fichaHtmlGestion(v) {
  if (!_fvEsAdmin()) return '';
  const grupo = _fvGrupo(_fichaMat);
  const nota = (v.nota || '').trim();
  const prop = nota.toUpperCase() === 'PROPIEDAD' ? 'Propia' : (nota && nota.toUpperCase() !== 'OTRO ALQUILER' ? `Alquiler · ${_fvCap(nota)}` : 'Alquiler');
  const dato = (lbl, val) => `<div class="fv-campo"><span class="fv-campo-lbl">${lbl}</span><span class="fv-campo-val">${esc(val || '—')}</span></div>`;
  const fila = (lbl, titulo, txt, boton, cls) => `
    <div class="fv-card fv-gest-fila${cls ? ' ' + cls : ''}">
      <div class="fv-gest-txt">
        <span class="fv-card-lbl">${lbl}</span>
        <span class="fv-gest-titulo">${titulo}</span>
        <span class="fv-card-sub">${txt}</span>
      </div>
      ${boton}
    </div>`;
  let h = `<h2 class="fv-h2">Gestión del vehículo</h2>
    <div class="fv-card">
      <div class="fv-card-cab"><span class="fv-card-lbl">DATOS DEL VEHÍCULO</span>
        <button type="button" class="fv-lapiz" onclick="fichaEditar('datos')">${_FV_LAPIZ}<span>Editar datos</span></button></div>
      <div class="fv-campos fv-campos-gest">
        ${dato('Matrícula', _fichaMat)}${dato('Tipo', _fvTipo(v.tipo))}${dato('Nave', _fvCap(grupo))}${dato('Propiedad', prop)}${dato('Sociedad', v.sociedad ? v.sociedad : 'Sin sociedad')}
      </div>
    </div>`;
  if (v.archivado) {
    h += fila('ESTADO', '<i class="fv-gest-dot nada"></i>Dado de baja',
      'No aparece en el cuadrante. Al darlo de alta volverá a aparecer en su nave.',
      `<button type="button" class="fv-btn fv-btn-verde" onclick="fichaEditar('alta')">Dar de alta</button>`);
    return h;
  }
  h += v.bloqueado
    ? fila('DISPONIBILIDAD', '<i class="fv-gest-dot mal"></i>Bloqueado',
        `Motivo: <b>${esc(v.motivo_bloqueo || 'sin indicar')}</b>${v.bloqueado_por ? ` · por ${esc(_fvCap(v.bloqueado_por))}` : ''}${v.fecha_bloqueo ? ` el ${esc(_fvFechaHora(v.fecha_bloqueo))}` : ''}`,
        `<button type="button" class="fv-btn fv-btn-verde" onclick="fichaEditar('desbloquear')">Desbloquear</button>`)
    : fila('DISPONIBILIDAD', '<i class="fv-gest-dot ok"></i>Libre',
        'Se puede asignar en el cuadrante. Bloquéalo si no puede circular (avería, taller…).',
        `<button type="button" class="fv-btn fv-btn-rojo" onclick="fichaEditar('bloquear')">Bloquear vehículo</button>`);
  h += v.restringido
    ? fila('ACCESO', '<i class="fv-gest-dot aviso"></i>Restringido',
        'Solo el personal autorizado puede asignarlo.',
        `<button type="button" class="fv-btn" onclick="fichaEditar('restringir')">Permitir a todos</button>`)
    : fila('ACCESO', '<i class="fv-gest-dot ok"></i>Todos',
        'Cualquier responsable puede asignarlo en el cuadrante.',
        `<button type="button" class="fv-btn" onclick="fichaEditar('restringir')">Restringir acceso</button>`);
  h += fila('BAJA', 'Dar de baja el vehículo',
    'Desaparece del cuadrante, pero se conserva en los días anteriores. Se puede volver a dar de alta.',
    `<button type="button" class="fv-btn fv-btn-rojo-lleno" onclick="fichaEditar('baja')">Dar de baja</button>`, 'peligro');
  return h;
}

// ── Acciones ──
/** Abre la ventana de edición correspondiente para el vehículo de la ficha (solo admin). */
function fichaEditar(que) {
  if (!_fvEsAdmin()) return;
  for (let gi = 0; gi < GRUPOS.length; gi++) {
    const vi = GRUPOS[gi].vehiculos.findIndex(x => x.matricula === _fichaMat);
    if (vi < 0) continue;
    const accion = {
      datos: editarVehiculo, itv: editarITV, seguro: editarSeguro,
      bloquear: abrirModalBloqueo, desbloquear: desbloquearVehiculoAdmin,
      restringir: toggleRestringido, baja: eliminarVehiculo, alta: desarchivarVehiculo
    }[que];
    if (accion) accion(gi, vi);
    return;
  }
}

function fichaDesbloquear() {
  if (!_fvEsAdmin()) return;
  for (let gi = 0; gi < GRUPOS.length; gi++) {
    const vi = GRUPOS[gi].vehiculos.findIndex(x => x.matricula === _fichaMat);
    if (vi >= 0) { desbloquearVehiculoAdmin(gi, vi); return; }
  }
}
