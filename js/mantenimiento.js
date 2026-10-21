// ════════════════════════════════════════════════════════════════════════════
// FLOTA PRIMOR · js/mantenimiento.js — MANTENIMIENTOS Y AVERÍAS
//
// · Pestaña "Mantenimiento" de la ficha del vehículo (junto a Seguro, ITV y
//   Documentos) con tres bloques: Averías, Próximas revisiones y
//   Mantenimientos realizados.
// · Permisos:
//     - Cualquier responsable puede DAR PARTE de una avería.
//     - Solo los administradores pueden cambiar su estado (en taller /
//       reparada), registrar mantenimientos y programar revisiones.
// · Una avería marcada como "no puede circular" pone el vehículo en
//   NO DISPONIBLE (con el correo de aviso de siempre). Al marcarla como
//   reparada se vuelve a dejar disponible, salvo que otra avería abierta
//   también lo inmovilice.
// · Aviso en el cuadrante: llave junto a la matrícula cuando hay una avería
//   abierta o una revisión vencida / próxima (ver mantIconoCuadrante).
// · Tablas en Supabase: averias, mantenimientos, revisiones_programadas.
//   La factura de un mantenimiento se guarda como documento del vehículo
//   (categoría "Otros"), así que también aparece en la pestaña Documentos.
// ════════════════════════════════════════════════════════════════════════════

const MANT_TIPOS = ['Revisión general', 'Aceite y filtros', 'Neumáticos', 'Frenos', 'Batería',
                    'Aire acondicionado', 'Tacógrafo', 'Carrocería', 'Otro'];
const MANT_AVISO_DIAS = 15;    // una revisión está "próxima" si faltan 15 días o menos
const MANT_AVISO_KM   = 1000;  // … o 1.000 km o menos
const MANT_ESTADOS = {
  abierta:   { txt: 'Abierta',   cls: 'abierta' },
  en_taller: { txt: 'En taller', cls: 'taller' },
  reparada:  { txt: 'Reparada',  cls: 'reparada' }
};

// Resumen por matrícula para el aviso del cuadrante:
// { 'IVECO 5118 JZC': { averias: 1, inmoviliza: true, revVencida: false, revProxima: true } }
let mantResumen = {};
let _mantIncidsFicha = []; // incidencias pendientes mostradas en la ficha abierta

/** Abre "Incidencias pendientes" filtrado por la matrícula. */
function mantVerIncidenciasDe(matricula) {
  if (typeof abrirModalIncidenciasPendientes !== 'function') return;
  cerrarFichaVehiculo();
  abrirModalIncidenciasPendientes();
  const f = document.getElementById('incid-pend-filtro-matricula');
  if (f) { f.value = matricula; if (typeof cargarIncidenciasPendientesModal === 'function') cargarIncidenciasPendientesModal(); }
}

// ── Utilidades ───────────────────────────────────────────────────────────────
function _mantEsAdmin() {
  return typeof usuarioEsAdmin === 'function' ? usuarioEsAdmin() : false;
}
function _mantHoyISO() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}
function _mantFecha(iso) {
  if (!iso) return '—';
  const p = String(iso).substring(0, 10).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}
function _mantDias(iso) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(String(iso).substring(0, 10) + 'T00:00:00') - hoy) / 86400000);
}
function _mantNum(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : null;
}
function _mantKm(n)    { return n == null ? '' : Math.round(Number(n)).toLocaleString('es-ES') + ' km'; }
function _mantEuros(n) { return n == null ? '' : Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }
function _mantUsuario() { return usuarioActual?.nombre || 'Admin'; }

/** Último kilometraje conocido del vehículo (sale de los repostajes). */
async function _mantKmActual(matricula) {
  const { data, error } = await sb.from('repostajes').select('kilometraje')
    .eq('matricula', matricula).not('kilometraje', 'is', null)
    .order('kilometraje', { ascending: false }).limit(1);
  if (error || !data || !data.length) return null;
  return Number(data[0].kilometraje);
}

/** Estado de una revisión programada: 'vencida' | 'proxima' | 'ok', con textos. */
function _mantEstadoRevision(r, kmActual) {
  let estado = 'ok';
  const partes = [];
  if (r.fecha_limite) {
    const d = _mantDias(r.fecha_limite);
    if (d < 0)                     { estado = 'vencida'; partes.push(`vencida hace ${-d} día${d === -1 ? '' : 's'}`); }
    else if (d === 0)              { estado = 'vencida'; partes.push('vence hoy'); }
    else if (d <= MANT_AVISO_DIAS) { estado = 'proxima'; partes.push(`faltan ${d} día${d === 1 ? '' : 's'}`); }
    else                             partes.push(`faltan ${d} días`);
  }
  if (r.km_limite != null) {
    if (kmActual == null) partes.push('sin kilometraje registrado');
    else {
      const rest = Number(r.km_limite) - kmActual;
      if (rest <= 0)                       { estado = 'vencida'; partes.push(`pasada por ${_mantKm(-rest)}`); }
      else if (rest <= MANT_AVISO_KM)      { if (estado !== 'vencida') estado = 'proxima'; partes.push(`faltan ${_mantKm(rest)}`); }
      else                                   partes.push(`faltan ${_mantKm(rest)}`);
    }
  }
  return { estado, texto: partes.join(' · ') };
}

// ── Resumen para el cuadrante ────────────────────────────────────────────────
async function mantCargarResumen() {
  try {
    const [av, rev, inc, enl] = await Promise.all([
      sb.from('averias').select('matricula, inmoviliza').neq('estado', 'reparada'),
      sb.from('revisiones_programadas').select('matricula, fecha_limite, km_limite').eq('activa', true),
      sb.from('incidencias').select('id, matricula, tipo').neq('estado', 'COMPLETADO'),
      sb.from('averias').select('incidencia_id').not('incidencia_id', 'is', null)
    ]);
    if (av.error || rev.error) return;
    const res = {};
    const obtener = m => (res[m] = res[m] || { averias: 0, inmoviliza: false, revVencida: false, revProxima: false, incid: 0, incidTipos: [] });
    (av.data || []).forEach(a => { const r = obtener(a.matricula); r.averias++; if (a.inmoviliza) r.inmoviliza = true; });
    // Incidencias pendientes que no tienen avería (las que sí, ya cuentan como avería)
    const conAveria = new Set(((enl && enl.data) || []).map(x => x.incidencia_id));
    ((inc && !inc.error && inc.data) || []).filter(i => !conAveria.has(i.id)).forEach(i => {
      const r = obtener(i.matricula); r.incid++;
      if (i.tipo && !r.incidTipos.includes(i.tipo)) r.incidTipos.push(i.tipo);
    });

    // Kilometraje actual solo de los vehículos con revisiones por km
    const conKm = [...new Set((rev.data || []).filter(r => r.km_limite != null).map(r => r.matricula))];
    const kms = {};
    await Promise.all(conKm.map(async m => { kms[m] = await _mantKmActual(m); }));
    (rev.data || []).forEach(r => {
      const e = _mantEstadoRevision(r, kms[r.matricula] ?? null).estado;
      const o = obtener(r.matricula);
      if (e === 'vencida') o.revVencida = true; else if (e === 'proxima') o.revProxima = true;
    });
    mantResumen = res;
    if (usuarioActual && typeof renderTabla === 'function') renderTabla();
  } catch (e) { /* sin conexión: el aviso del cuadrante no es crítico */ }
}

/** Icono de llave junto a la matrícula en el cuadrante ('' si no hay nada que avisar). */
function mantIconoCuadrante(matricula) {
  const r = mantResumen[matricula];
  if (!r) return '';
  let cls = '', titulo = '';
  const partes = [];
  if (r.averias) partes.push(r.averias === 1 ? 'Avería abierta' : `${r.averias} averías abiertas`);
  if (r.incid) {
    const tipos = (r.incidTipos || []).map(t => (MANT_TIPOS_INCID[t] || {}).txt).filter(Boolean).join(', ');
    partes.push((r.incid === 1 ? 'Incidencia pendiente' : `${r.incid} incidencias pendientes`) + (tipos ? ` (${tipos.toLowerCase()})` : ''));
  }
  if (r.revVencida) partes.push('revisión vencida');
  if (r.averias || r.incid) { cls = 'grave'; titulo = partes.join(' · '); }
  else if (r.revVencida) { cls = 'grave'; titulo = 'Revisión vencida'; }
  else if (r.revProxima)   { cls = 'aviso'; titulo = 'Revisión próxima'; }
  else return '';
  return `<span class="mant-badge ${cls}" title="${esc(titulo)} · ver en la ficha" role="button" tabindex="0"
    onclick="event.stopPropagation();abrirFichaVehiculo('${esc(matricula)}');fichaTabSwitch(mantPestanaFicha('${esc(matricula)}'))">`
    + `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg></span>`;
}

// ── Pestaña de la ficha ──────────────────────────────────────────────────────
async function mantCargarFicha(matricula) {
  const contAv = document.getElementById('ficha-averias-content');
  const contMt = document.getElementById('ficha-mant-content');
  if (!contAv && !contMt) return;
  const cargando = `<div class="ficha-docs-loading"><div class="ficha-spinner"></div>Cargando…</div>`;
  // Solo se muestra «Cargando» la primera vez; al refrescar se deja lo que había
  if (!_mantFicha || _mantFicha.matricula !== matricula) {
    if (contAv) contAv.innerHTML = cargando;
    if (contMt) contMt.innerHTML = cargando;
  }
  let averias, mants, revs, kmActual, incids = [];
  try {
    const [a, m, r, km, inc] = await Promise.all([
      sb.from('averias').select('*').eq('matricula', matricula).order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      sb.from('mantenimientos').select('*').eq('matricula', matricula).order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      sb.from('revisiones_programadas').select('*').eq('matricula', matricula).eq('activa', true).order('fecha_limite', { ascending: true, nullsFirst: false }),
      _mantKmActual(matricula),
      sb.from('incidencias').select('*').eq('matricula', matricula).neq('estado', 'COMPLETADO').order('timestamp', { ascending: false })
    ]);
    if (a.error || m.error || r.error) throw new Error((a.error || m.error || r.error).message);
    averias = a.data || []; mants = m.data || []; revs = r.data || []; kmActual = km;
    // Las incidencias que ya tienen avería se ven en la lista de averías
    const conAveria = new Set(averias.map(x => x.incidencia_id).filter(Boolean));
    incids = ((inc && !inc.error && inc.data) || []).filter(i => !conAveria.has(i.id));
  } catch (e) {
    if (_fichaMat === matricula) {
      const err = `<div class="ficha-docs-loading" style="color:#C93636">No se pudo cargar. Revisa la conexión.</div>`;
      if (contAv) contAv.innerHTML = err;
      if (contMt) contMt.innerHTML = err;
    }
    return;
  }
  if (_fichaMat !== matricula) return; // se cambió de vehículo mientras cargaba
  const filtro = (_mantFicha && _mantFicha.matricula === matricula) ? _mantFicha.filtro : 'abiertas';
  _mantFicha = { matricula, averias, mants, revs, kmActual, incids, filtro };
  _mantRenderAverias();
  _mantRenderMantenimiento();
}

// Datos de la ficha abierta (para cambiar de filtro sin volver a pedirlos)
let _mantFicha = null;

/** ¿A qué pestaña de la ficha llevar a quien pulsa el aviso de una matrícula? */
function mantPestanaFicha(matricula) {
  const r = mantResumen[matricula];
  return (r && (r.averias || r.incid)) ? 'averias' : 'mant';
}

function mantFiltrarAverias(filtro) {
  if (!_mantFicha) return;
  _mantFicha.filtro = filtro;
  _mantRenderAverias();
  document.querySelector(`#ficha-averias-content .mf-filtro[data-f="${filtro}"]`)?.focus();
}

// Cabecera oscura de cada bloque
function _mfCabecera(icono, titulo, extra, boton) {
  return `<div class="mf-head">
    ${icono}<h3>${titulo}</h3>${extra || ''}
    ${boton ? `<span class="mf-head-esp"></span>${boton}` : ''}
  </div>`;
}
const _MF_ICO_AVERIA = `<svg class="mf-ico av" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 16H3zM12 10v4M12 17h.01"/></svg>`;
const _MF_ICO_REV    = `<svg class="mf-ico rev" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`;
const _MF_ICO_MANT   = `<svg class="mf-ico mt" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg>`;
const _MF_ICO_INCID  = `<svg class="mf-ico av" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></svg>`;

function _mfHace(iso) {
  if (!iso) return { txt: '', cls: '' };
  const d = -_mantDias(iso);
  return { txt: d <= 0 ? 'hoy' : `hace ${d} día${d === 1 ? '' : 's'}`, cls: d > 14 ? 'tarde' : '' };
}

// ── Pestaña AVERÍAS ──────────────────────────────────────────────────────────
function _mantRenderAverias() {
  const cont = document.getElementById('ficha-averias-content');
  if (!cont || !_mantFicha) return;
  const { matricula, averias, incids, filtro } = _mantFicha;
  _mantIncidsFicha = incids;
  const admin = _mantEsAdmin();
  const mat = esc(matricula);
  const abiertas  = averias.filter(a => a.estado !== 'reparada');
  const inmov     = abiertas.filter(a => a.inmoviliza);
  const reparadas = averias.filter(a => a.estado === 'reparada');
  const enTaller  = abiertas.filter(a => a.estado === 'en_taller').length;
  let h = '';

  // Aviso: no puede circular
  if (inmov.length) {
    const cuales = inmov.slice(0, 3).map(a => `${esc(a.descripcion)} (${_mantFecha(a.fecha).substring(0, 5)})`).join(', ');
    h += `<div class="mf-aviso mal">${_MF_ICO_AVERIA}<span><strong>No puede circular:</strong> ${inmov.length === 1 ? 'una avería lo impide' : `${inmov.length} averías lo impiden`} · ${cuales}${inmov.length > 3 ? '…' : ''}</span></div>`;
  }

  // Incidencias pendientes que aún no son avería
  if (incids.length) {
    h += `<section class="mf-sec mf-sec-auto">
      ${_mfCabecera(_MF_ICO_INCID, 'INCIDENCIAS PENDIENTES', `<span class="mf-num">${incids.length}</span>`,
        `<button type="button" class="mf-btn-head" onclick="mantVerIncidenciasDe('${mat}')">Ver todas</button>`)}
      <div class="mf-lista">`;
    incids.forEach((i, idx) => {
      const t = MANT_TIPOS_INCID[i.tipo];
      const hace = _mfHace(i.fecha);
      h += `<div class="mf-incid">
        <span class="mant-pill ${t ? 'incid-' + i.tipo : 'incid-sin'}">${t ? esc(t.txt) : 'Sin tipo'}</span>
        <div class="mf-incid-txt"><strong>${esc(i.descripcion || '—')}</strong><span>Registrada por ${esc(i.responsable || '—')} · ${_mantFecha(i.fecha)}${hace.txt ? ' · ' + hace.txt : ''}</span></div>
        <button type="button" class="mf-btn" onclick="mantPasarIncidenciaAAveria(_mantIncidsFicha[${idx}])">Pasar a avería</button>
      </div>`;
    });
    h += `</div></section>`;
  }

  // Lista de averías
  const filtros = [
    ['abiertas',  'Abiertas', abiertas.length],
    ['inmov',     'Impiden circular', inmov.length],
    ['reparadas', 'Reparadas', reparadas.length]
  ];
  const chips = !averias.length ? '' : `<div class="mf-filtros" role="group" aria-label="Filtrar averías">${filtros.map(([f, txt, n]) =>
    `<button type="button" class="mf-filtro${filtro === f ? ' on' : ''}" data-f="${f}" aria-pressed="${filtro === f}" onclick="mantFiltrarAverias('${f}')">${txt} · ${n}</button>`).join('')}</div>`;
  const lista = filtro === 'reparadas' ? reparadas : filtro === 'inmov' ? inmov : abiertas;

  h += `<section class="mf-sec${lista.length ? ' mf-sec-llena' : ''}">
    ${_mfCabecera(_MF_ICO_AVERIA, 'AVERÍAS', chips,
      `<button type="button" class="mf-btn-head rojo" onclick="mantAbrirFormAveria('${mat}')">+ Dar parte de avería</button>`)}`;

  if (!lista.length) {
    if (filtro === 'abiertas') {
      h += `<div class="mf-ok"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>
        <div><strong>Sin averías abiertas</strong><span>${incids.length ? 'Revisa las incidencias pendientes.' : 'El vehículo puede circular.'}</span></div></div>`;
    } else {
      h += `<div class="mf-vacio">${filtro === 'inmov' ? 'Ninguna avería impide circular.' : 'No hay averías reparadas en el historial.'}</div>`;
    }
  } else {
    h += `<div class="mf-tabla-wrap"><table class="mf-tabla mf-tabla-av">
      <thead><tr><th>Estado</th><th>Avería</th><th>Parte de</th><th>Fecha</th><th class="der">Km</th><th class="der">${admin && filtro !== 'reparadas' ? 'Acciones' : ''}</th></tr></thead>
      <tbody>${lista.map(a => _mfFilaAveria(a, admin)).join('')}</tbody>
    </table></div>`;
  }
  const resumen = [`${abiertas.length} abierta${abiertas.length === 1 ? '' : 's'}`];
  if (enTaller) resumen.push(`${enTaller} en taller`);
  if (reparadas.length) resumen.push(`${reparadas.length} reparada${reparadas.length === 1 ? '' : 's'} en el historial`);
  h += `${averias.length ? `<div class="mf-pie"><span>${resumen.join(' · ')}</span></div>` : ''}</section>`;

  cont.innerHTML = h;
}

function _mfFilaAveria(a, admin) {
  const est = MANT_ESTADOS[a.estado] || MANT_ESTADOS.abierta;
  const mat = esc(a.matricula);
  const reparada = a.estado === 'reparada';
  const hace = _mfHace(a.fecha);
  let sub;
  if (reparada) {
    sub = `Reparada el ${_mantFecha(a.fecha_cierre)} por ${esc(a.cerrado_por || '—')}${a.comentario_cierre ? ' · ' + esc(a.comentario_cierre) : ''}`;
  } else if (a.estado === 'en_taller') {
    sub = a.taller ? `En taller ${esc(a.taller)}` : 'En taller';
  } else {
    sub = 'Sin taller asignado';
  }
  if (a.taller && reparada) sub += ` · Taller: ${esc(a.taller)}`;
  if (a.coste != null) sub += ` · ${_mantEuros(a.coste)}`;

  let acciones = '';
  if (admin && !reparada) {
    acciones = `${a.estado === 'abierta' ? `<button type="button" class="mf-btn" onclick="mantAveriaEnTaller('${mat}','${esc(a.id)}')">Pasar a taller</button>` : ''}
      <button type="button" class="mf-btn oscuro" onclick="mantAbrirFormReparada('${mat}','${esc(a.id)}')">✓ Reparada</button>`;
  }
  return `<tr class="${a.inmoviliza && !reparada ? 'inmov' : ''}${reparada ? ' cerrada' : ''}">
    <td class="mf-estado">
      <span class="mant-pill av-${est.cls}">${est.txt}</span>
      ${a.inmoviliza && !reparada ? '<span class="mant-pill av-inmoviliza">No puede circular</span>' : ''}
    </td>
    <td><strong class="mf-tit">${esc(a.descripcion)}</strong><span class="mf-sub">${sub}</span></td>
    <td class="mf-quien">${esc(a.reportado_por || '—')}</td>
    <td class="mf-fecha">${_mantFecha(a.fecha)}${!reparada && hace.txt ? `<span class="mf-hace ${hace.cls}">${hace.txt}</span>` : ''}</td>
    <td class="mf-mono der">${a.km != null ? esc(Math.round(Number(a.km)).toLocaleString('es-ES')) : '—'}</td>
    <td class="der"><div class="mf-acciones">${acciones}</div></td>
  </tr>`;
}

// ── Pestaña MANTENIMIENTO ────────────────────────────────────────────────────
function _mantRenderMantenimiento() {
  const cont = document.getElementById('ficha-mant-content');
  if (!cont || !_mantFicha) return;
  const { matricula, mants, revs, kmActual } = _mantFicha;
  const admin = _mantEsAdmin();
  const mat = esc(matricula);
  const orden = { vencida: 0, proxima: 1, ok: 2 };
  const revsEst = revs.map(r => Object.assign({}, r, _mantEstadoRevision(r, kmActual)))
    .sort((a, b) => orden[a.estado] - orden[b.estado] || String(a.fecha_limite || '9').localeCompare(String(b.fecha_limite || '9')));
  const vencidas = revsEst.filter(r => r.estado === 'vencida').length;
  const proximas = revsEst.filter(r => r.estado === 'proxima').length;
  const anio = String(new Date().getFullYear());
  const gastoAnio = mants.filter(m => String(m.fecha || '').startsWith(anio)).reduce((s, m) => s + (m.coste != null ? Number(m.coste) : 0), 0);
  const total = mants.reduce((s, m) => s + (m.coste != null ? Number(m.coste) : 0), 0);
  const urgente = revsEst[0];
  const ultimo = mants[0];
  let h = '';

  // Franja de resumen
  h += `<div class="mf-kpis">
    <div class="mf-kpi"><span class="mf-kpi-lbl">Kilometraje actual</span><span class="mf-kpi-num mono">${kmActual != null ? _mantKm(kmActual) : 'Sin datos'}</span></div>
    <div class="mf-kpi"><span class="mf-kpi-lbl">Revisión más urgente</span><span class="mf-kpi-txt ${urgente ? urgente.estado : ''}">${urgente ? `${esc(urgente.tipo)} · ${urgente.estado === 'vencida' ? 'vencida' : urgente.estado === 'proxima' ? 'próxima' : 'programada'}` : 'Ninguna programada'}</span></div>
    <div class="mf-kpi"><span class="mf-kpi-lbl">Último mantenimiento</span><span class="mf-kpi-txt">${ultimo ? `${esc(ultimo.tipo)} · ${_mantFecha(ultimo.fecha)}` : 'Ninguno registrado'}</span></div>
    <div class="mf-kpi"><span class="mf-kpi-lbl">Gasto en ${anio}</span><span class="mf-kpi-num mono">${_mantEuros(gastoAnio)}</span></div>
  </div>`;

  h += `<div class="mf-columnas">`;

  // Próximas revisiones
  const extraRev = vencidas ? `<span class="mf-num rojo">${vencidas} vencida${vencidas === 1 ? '' : 's'}</span>`
                 : proximas ? `<span class="mf-num ambar">${proximas} próxima${proximas === 1 ? '' : 's'}</span>` : '';
  h += `<section class="mf-sec">
    ${_mfCabecera(_MF_ICO_REV, 'PRÓXIMAS REVISIONES', extraRev,
      admin ? `<button type="button" class="mf-btn-head" onclick="mantAbrirFormRevision('${mat}')">+ Programar</button>` : '')}`;
  if (!revsEst.length) {
    h += `<div class="mf-vacio">No hay revisiones programadas.${admin ? ` <button type="button" class="adm-link mf-link" onclick="mantAbrirFormRevision('${mat}')">Programar una</button>` : ''}</div>`;
  } else {
    h += `<div class="mf-lista">`;
    revsEst.forEach(r => {
      const limites = [r.fecha_limite ? _mantFecha(r.fecha_limite) : '', r.km_limite != null ? _mantKm(r.km_limite) : ''].filter(Boolean).join(' o ');
      h += `<div class="mf-rev ${r.estado}">
        <div class="mf-rev-top">
          <span class="mant-pill rev-${r.estado}">${r.estado === 'vencida' ? 'Vencida' : r.estado === 'proxima' ? 'Próxima' : 'Programada'}</span>
          <strong class="mf-tit">${esc(r.tipo)}</strong>
          <span class="mf-rev-falta ${r.estado}">${esc(r.texto)}</span>
        </div>
        <div class="mf-rev-bot">
          <span class="mf-sub">Límite: <span class="mf-mono">${esc(limites || '—')}</span>${r.notas ? ' · ' + esc(r.notas) : ''}</span>
          ${admin ? `<span class="mf-acciones">
            <button type="button" class="mf-btn oscuro" onclick="mantAbrirFormMantenimiento('${mat}','${esc(r.id)}')">✓ Hecha</button>
            <button type="button" class="mf-btn" onclick="mantQuitarRevision('${mat}','${esc(r.id)}')">Quitar</button>
          </span>` : ''}
        </div>
      </div>`;
    });
    h += `</div>`;
  }
  h += `</section>`;

  // Mantenimientos realizados
  h += `<section class="mf-sec mf-sec-ancha">
    ${_mfCabecera(_MF_ICO_MANT, 'MANTENIMIENTOS REALIZADOS', mants.length ? `<span class="mf-num gris">${mants.length}</span>` : '',
      admin ? `<button type="button" class="mf-btn-head" onclick="mantAbrirFormMantenimiento('${mat}')">+ Registrar</button>` : '')}`;
  if (!mants.length) {
    h += `<div class="mf-vacio">Todavía no hay mantenimientos registrados.</div>`;
  } else {
    h += `<div class="mf-tabla-wrap"><table class="mf-tabla mf-tabla-mt">
      <thead><tr><th>Fecha</th><th>Trabajo</th><th>Taller</th><th class="der">Km</th><th class="der">Coste</th><th class="der">Documentos</th></tr></thead>
      <tbody>${mants.map(m => {
        // Documentos del mantenimiento: la factura y los adjuntos (certificados, etc.)
        const enlace = (path, nombre, txt) => `<button type="button" class="adm-link mf-link" title="${esc(nombre || '')}" onclick="abrirVisorDoc('sb:${esc(path)}','${esc(nombre || 'Documento')}','${/\.pdf$/i.test(nombre || '') ? 'pdf' : 'imagen'}')">${txt}</button>`;
        const adj = Array.isArray(m.adjuntos) ? m.adjuntos.filter(a => a && a.path) : [];
        const docsMt = (m.factura_path ? [enlace(m.factura_path, m.factura_nombre, adj.length ? 'Factura' : 'Ver')] : [])
          .concat(adj.map((a, i) => enlace(a.path, a.nombre, adj.length > 1 ? `Doc. ${i + 1}` : 'Certificado')));
        const fac = docsMt.length ? docsMt.join('') : '<span class="mf-sub">—</span>';
        const borrar = admin ? `<button type="button" class="mf-borrar" title="Eliminar este mantenimiento" aria-label="Eliminar este mantenimiento" onclick="mantBorrarMantenimiento('${mat}','${esc(m.id)}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>` : '';
        return `<tr>
          <td class="mf-fecha">${_mantFecha(m.fecha)}</td>
          <td><strong class="mf-tit">${esc(m.tipo)}</strong>${m.descripcion ? `<span class="mf-sub">${esc(m.descripcion)}</span>` : ''}<span class="mf-sub">Registrado por ${esc(m.registrado_por || '—')}</span></td>
          <td class="mf-quien">${esc(m.taller || '—')}</td>
          <td class="mf-mono der">${m.km != null ? esc(Math.round(Number(m.km)).toLocaleString('es-ES')) : '—'}</td>
          <td class="mf-mono der fuerte">${m.coste != null ? _mantEuros(m.coste) : '—'}</td>
          <td class="der"><span class="mf-acciones">${fac}${borrar}</span></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
    <div class="mf-pie"><span>${mants.length} mantenimiento${mants.length === 1 ? '' : 's'} · desde ${_mantFecha(mants[mants.length - 1].fecha)}</span><span>Gasto total: <strong class="mf-mono">${_mantEuros(total)}</strong></span></div>`;
  }
  h += `</section></div>`;

  cont.innerHTML = h;
}

// ── Ventanas de formulario ───────────────────────────────────────────────────
let _mantModalAbierto = null;

function _mantModal(titulo, icono, cuerpo, okTxt, alGuardar) {
  const ov = document.createElement('div');
  ov.className = 'mant-modal-ov';
  ov.innerHTML = `<div class="mant-modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="mant-modal-head"><span class="mant-modal-ico">${icono}</span><span>${esc(titulo)}</span></div>
      <form class="mant-modal-body" novalidate>${cuerpo}
        <div class="mant-modal-error" hidden></div>
        <div class="mant-modal-pie">
          <button type="button" class="mant-btn-cancel">Cancelar</button>
          <button type="submit" class="mant-btn-ok">${okTxt}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(ov);
  _mantModalAbierto = ov;
  const form = ov.querySelector('form');
  const btnOk = ov.querySelector('.mant-btn-ok');
  const errEl = ov.querySelector('.mant-modal-error');
  const cerrar = () => { if (ov.parentNode) ov.remove(); if (_mantModalAbierto === ov) _mantModalAbierto = null; };
  ov.querySelector('.mant-btn-cancel').onclick = cerrar;
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    errEl.hidden = true;
    const txt = btnOk.textContent;
    btnOk.disabled = true; btnOk.textContent = 'Guardando…';
    try {
      const err = await alGuardar(form);
      if (err) { errEl.textContent = err; errEl.hidden = false; }
      else cerrar();
    } catch (e) {
      errEl.textContent = 'No se pudo guardar: ' + (e.message || 'error de conexión'); errEl.hidden = false;
    } finally {
      btnOk.disabled = false; btnOk.textContent = txt;
    }
  });
  setTimeout(() => { const f = form.querySelector('input:not([type=hidden]),textarea,select'); if (f) f.focus(); }, 60);
  return ov;
}
// Escape cierra solo el formulario abierto, no la ficha que hay debajo
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _mantModalAbierto) {
    e.stopImmediatePropagation(); e.preventDefault();
    _mantModalAbierto.remove(); _mantModalAbierto = null;
  }
}, true);

function _mantCampo(label, html, ayuda) {
  return `<label class="mant-campo"><span class="mant-lbl">${label}</span>${html}${ayuda ? `<span class="mant-ayuda">${ayuda}</span>` : ''}</label>`;
}

function _mantRefrescar(matricula) {
  if (_fichaMat === matricula) { mantCargarFicha(matricula); if (typeof fichaRefrescar === 'function') fichaRefrescar(matricula); }
  mantCargarResumen();
}

// ── Avería: dar parte (cualquier responsable) ────────────────────────────────
function mantAbrirFormAveria(matricula) {
  if (!usuarioActual) { mostrarToast('Inicia sesión para dar parte de una avería', 'error'); return; }
  const v = _getVehiculo(matricula);
  const yaBloqueado = !!v?.bloqueado;
  const cuerpo =
    _mantCampo('Qué le pasa *', `<textarea name="descripcion" rows="3" required placeholder="Ej.: pierde aceite por el cárter, no arranca, testigo de motor encendido…"></textarea>`) +
    `<div class="mant-fila">` +
      _mantCampo('Fecha', `<input type="date" name="fecha" value="${_mantHoyISO()}" max="${_mantHoyISO()}">`) +
      _mantCampo('Kilómetros', `<input type="text" name="km" inputmode="numeric" placeholder="Opcional">`) +
    `</div>` +
    `<label class="mant-check"><input type="checkbox" name="inmoviliza">
      <span><strong>El vehículo no puede circular</strong><br>
      ${yaBloqueado ? 'El vehículo ya está NO DISPONIBLE.' : 'Pasará a NO DISPONIBLE en el cuadrante hasta que se repare.'}</span></label>`;
  _mantModal(`Dar parte de avería · ${_fichaMatReal(matricula)}`, '⚠️', cuerpo, 'Dar parte', async form => {
    const descripcion = form.descripcion.value.trim();
    if (!descripcion) { form.descripcion.focus(); return 'Describe qué le pasa al vehículo.'; }
    const inmoviliza = form.inmoviliza.checked;
    const fecha = form.fecha.value || _mantHoyISO();
    const bloquearAhora = inmoviliza && !!v && !v.bloqueado;

    // 1) Incidencia de tipo Avería: así sale en "Incidencias pendientes", se
    //    envía el correo de aviso de siempre y, si no puede circular, se
    //    bloquea el vehículo (todo en la misma llamada que el formulario de
    //    incidencias).
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, redirect: 'follow',
      body: JSON.stringify({
        accion: 'registrarIncidencia',
        bloquearVehiculo: bloquearAhora,
        incidencia: {
          timestamp: new Date().toISOString(), fecha, turno: turnoActual, matricula,
          descripcion, responsable: _mantUsuario(), estado: 'PENDIENTE', tipo: 'averia'
        }
      })
    });
    const json = await resp.json();
    if (!json.ok) return 'No se pudo guardar: ' + (json.error || 'error desconocido');

    // 2) La avería, enlazada a esa incidencia
    const { error } = await sb.from('averias').insert({
      matricula, descripcion, inmoviliza, estado: 'abierta', fecha,
      km: _mantNum(form.km.value),
      reportado_por: _mantUsuario(),
      bloqueo_aplicado: bloquearAhora,
      incidencia_id: json.id || null
    });
    if (error) {
      mostrarToast('La incidencia se registró, pero no se pudo guardar la avería en Mantenimiento: ' + error.message, 'error');
      return null;
    }

    // Reflejarlo ya en pantalla, sin esperar a recargar
    if (bloquearAhora) {
      v.bloqueado = true; v.motivo_bloqueo = descripcion; v.bloqueado_por = _mantUsuario();
      v.fecha_bloqueo = new Date().toISOString();
      if (typeof renderAdminVehiculos === 'function') { try { renderAdminVehiculos(); renderAdminStats(); } catch (e) {} }
    }
    if (typeof datos !== 'undefined' && fecha === fechaActual) {
      const key = `${matricula}|${turnoActual}|${fechaActual}`;
      if (!datos[key]) datos[key] = {};
      if (!datos[key].incidencias) datos[key].incidencias = descripcion;
    }
    if (typeof renderTabla === 'function') renderTabla();
    if (typeof actualizarBotonIncidenciasPendientes === 'function') actualizarBotonIncidenciasPendientes();
    const avisoCorreo = json.emailError || null;
    registrarAccion('MANTENIMIENTO', 'Parte de avería', `${matricula} · ${inmoviliza ? 'NO PUEDE CIRCULAR · ' : ''}${descripcion.substring(0, 80)}`);
    mostrarToast(inmoviliza ? `⛔ Avería registrada · ${_fichaMatReal(matricula)} no disponible` : '✓ Avería registrada', inmoviliza ? 'error' : 'success');
    if (avisoCorreo) appAlert(`La avería se ha registrado, pero no se pudo enviar el correo de aviso.<br><br><span style="color:#8899aa;font-size:12px">${esc(avisoCorreo)}</span>`, { titulo: 'Fallo al enviar correo electrónico', icono: '✉️⚠️' });
    _mantRefrescar(matricula);
    if (typeof abrirFichaVehiculo === 'function' && _fichaMat === matricula) _mantActualizarCabeceraFicha(matricula);
    return null;
  });
}

// ── Avería: pasar a taller (admin) ───────────────────────────────────────────
function mantAveriaEnTaller(matricula, id) {
  if (!_mantEsAdmin()) return;
  const cuerpo = _mantCampo('Taller', `<input type="text" name="taller" placeholder="Nombre del taller (opcional)">`);
  _mantModal('Pasar avería a taller', '🔧', cuerpo, 'Pasar a taller', async form => {
    const { error } = await sb.from('averias').update({
      estado: 'en_taller', taller: form.taller.value.trim() || null, updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) return 'No se pudo guardar: ' + error.message;
    registrarAccion('MANTENIMIENTO', 'Avería en taller', `${matricula}${form.taller.value.trim() ? ' · ' + form.taller.value.trim() : ''}`);
    mostrarToast('✓ Avería en taller', 'success');
    _mantRefrescar(matricula);
    return null;
  });
}

// ── Avería: marcar como reparada (admin) ─────────────────────────────────────
async function mantAbrirFormReparada(matricula, id) {
  if (!_mantEsAdmin()) return;
  const { data: a, error } = await sb.from('averias').select('*').eq('id', id).single();
  if (error || !a) { mostrarToast('No se pudo abrir la avería', 'error'); return; }
  const v = _getVehiculo(matricula);
  const desbloquear = a.bloqueo_aplicado && v?.bloqueado;
  const cuerpo =
    `<div class="mant-resumen">${esc(a.descripcion)}</div>` +
    `<div class="mant-fila">` +
      _mantCampo('Fecha de reparación', `<input type="date" name="fecha_cierre" value="${_mantHoyISO()}" max="${_mantHoyISO()}">`) +
      _mantCampo('Coste (€)', `<input type="text" name="coste" inputmode="decimal" placeholder="Opcional" value="${a.coste != null ? a.coste : ''}">`) +
    `</div>` +
    _mantCampo('Taller', `<input type="text" name="taller" value="${esc(a.taller || '')}" placeholder="Opcional">`) +
    _mantCampo('Qué se ha hecho', `<textarea name="comentario" rows="2" placeholder="Opcional"></textarea>`) +
    (desbloquear ? `<div class="mant-nota">El vehículo volverá a estar <strong>disponible</strong> en el cuadrante.</div>` : '') +
    (a.incidencia_id ? `<div class="mant-nota">La incidencia del cuadrante de la que viene esta avería se marcará como <strong>resuelta</strong>.</div>` : '');
  _mantModal('Marcar avería como reparada', '✅', cuerpo, 'Marcar reparada', async form => {
    const { error: e1 } = await sb.from('averias').update({
      estado: 'reparada',
      fecha_cierre: form.fecha_cierre.value || _mantHoyISO(),
      coste: _mantNum(form.coste.value),
      taller: form.taller.value.trim() || null,
      comentario_cierre: form.comentario.value.trim() || null,
      cerrado_por: _mantUsuario(),
      updated_at: new Date().toISOString()
    }).eq('id', id);
    if (e1) return 'No se pudo guardar: ' + e1.message;

    // ¿Se puede volver a dejar disponible? Solo si esta avería lo bloqueó y no
    // queda otra avería abierta que también lo inmovilice.
    let desbloqueado = false;
    if (desbloquear) {
      const { data: otras } = await sb.from('averias').select('id')
        .eq('matricula', matricula).neq('estado', 'reparada').eq('inmoviliza', true);
      if (!otras || !otras.length) {
        const { error: e2 } = await sb.from('vehiculos').update({
          bloqueado: false, motivo_bloqueo: '', bloqueado_por: '', fecha_bloqueo: null
        }).eq('matricula', matricula);
        if (!e2) {
          v.bloqueado = false; v.motivo_bloqueo = ''; v.bloqueado_por = ''; v.fecha_bloqueo = '';
          desbloqueado = true;
          if (typeof renderAdminVehiculos === 'function') { try { renderAdminVehiculos(); renderAdminStats(); } catch (e) {} }
        }
      } else {
        mostrarToast('Sigue NO DISPONIBLE: tiene otra avería que le impide circular', 'info');
      }
    }
    // Resolver la incidencia de la que viene la avería (si sigue pendiente)
    let incidenciaResuelta = false;
    if (a.incidencia_id) {
      const comentario = form.comentario.value.trim();
      const { data: incs, error: e3 } = await sb.from('incidencias').update({
        estado: 'COMPLETADO',
        resuelto_por: _mantUsuario(),
        fecha_resolucion: new Date().toISOString(),
        comentario_resolucion: 'Avería reparada' + (comentario ? ': ' + comentario : '')
      }).eq('id', a.incidencia_id).neq('estado', 'COMPLETADO').select('id');
      incidenciaResuelta = !e3 && incs && incs.length > 0;
      if (incidenciaResuelta) {
        if (typeof actualizarBotonIncidenciasPendientes === 'function') actualizarBotonIncidenciasPendientes();
        const modalInc = document.getElementById('modal-incidencias-pendientes');
        if (modalInc && modalInc.classList.contains('open') && typeof cargarIncidenciasPendientesModal === 'function') cargarIncidenciasPendientesModal();
      }
    }
    registrarAccion('MANTENIMIENTO', 'Avería reparada', `${matricula}${desbloqueado ? ' · vuelve a estar disponible' : ''}${incidenciaResuelta ? ' · incidencia resuelta' : ''} · ${a.descripcion.substring(0, 60)}`);
    mostrarToast((desbloqueado ? `✓ Reparada · ${_fichaMatReal(matricula)} disponible de nuevo` : '✓ Avería reparada') + (incidenciaResuelta ? ' · incidencia resuelta' : ''), 'success');
    _mantRefrescar(matricula);
    _mantActualizarCabeceraFicha(matricula);
    return null;
  });
}

// ── Mantenimiento realizado (admin) ──────────────────────────────────────────
async function mantAbrirFormMantenimiento(matricula, revisionId, tipoInicial) {
  if (!_mantEsAdmin()) return;
  let rev = null;
  if (revisionId) {
    const { data } = await sb.from('revisiones_programadas').select('*').eq('id', revisionId).maybeSingle();
    rev = data || null;
  }
  const kmActual = await _mantKmActual(matricula);
  const tipoSel = rev ? rev.tipo : tipoInicial;
  // Tacógrafo: la próxima revisión se propone a 2 años
  const prox2 = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 2); return d.toISOString().slice(0, 10); })();
  const opciones = MANT_TIPOS.map(t => `<option${tipoSel === t ? ' selected' : ''}>${t}</option>`).join('')
    + (rev && !MANT_TIPOS.includes(rev.tipo) ? `<option selected>${esc(rev.tipo)}</option>` : '');
  const cuerpo =
    `<div class="mant-fila">` +
      _mantCampo('Tipo *', `<select name="tipo">${opciones}</select>`) +
      _mantCampo('Fecha', `<input type="date" name="fecha" value="${_mantHoyISO()}" max="${_mantHoyISO()}">`) +
    `</div>` +
    _mantCampo('Detalle', `<textarea name="descripcion" rows="2" placeholder="Qué se ha hecho (opcional)"></textarea>`) +
    `<div class="mant-fila">` +
      _mantCampo('Kilómetros', `<input type="text" name="km" inputmode="numeric" value="${kmActual != null ? Math.round(kmActual) : ''}" placeholder="Opcional">`) +
      _mantCampo('Coste (€)', `<input type="text" name="coste" inputmode="decimal" placeholder="Opcional">`) +
    `</div>` +
    _mantCampo('Taller', `<input type="text" name="taller" placeholder="Opcional">`) +
    _mantCampo('Factura', `<input type="file" name="factura" accept=".pdf,image/*">`, 'PDF o foto. Queda guardada con este mantenimiento.') +
    `<fieldset class="mant-prox"><legend>Programar la próxima (opcional)</legend><div class="mant-fila">` +
      _mantCampo('Fecha', `<input type="date" name="prox_fecha" min="${_mantHoyISO()}"${tipoSel === 'Tacógrafo' ? ` value="${prox2}"` : ''}>`) +
      _mantCampo('Kilómetros', `<input type="text" name="prox_km" inputmode="numeric" placeholder="Ej.: ${kmActual != null ? Math.round(kmActual + 30000) : '250000'}">`) +
    `</div></fieldset>`;
  _mantModal(`Registrar mantenimiento · ${_fichaMatReal(matricula)}`, '🛠️', cuerpo, 'Guardar', async form => {
    const tipo = form.tipo.value;
    const fecha = form.fecha.value || _mantHoyISO();
    const archivo = form.factura.files && form.factura.files[0];
    if (archivo && archivo.size > (typeof DOCS_MAX_MB !== 'undefined' ? DOCS_MAX_MB : 15) * 1024 * 1024)
      return `La factura ocupa demasiado (máx. ${typeof DOCS_MAX_MB !== 'undefined' ? DOCS_MAX_MB : 15} MB).`;
    const proxKm = _mantNum(form.prox_km.value);
    const proxFecha = form.prox_fecha.value || null;

    let factura_path = null, factura_nombre = null;
    if (archivo) {
      const ext = (archivo.name.split('.').pop() || 'pdf').toLowerCase();
      factura_nombre = `Factura ${tipo} ${_mantFecha(fecha).replace(/\//g, '-')}.${ext}`;
      factura_path = await docsSubirArchivo(matricula, 'mantenimiento', archivo, factura_nombre); // va con el mantenimiento, no sale en Documentos
    }
    const { error } = await sb.from('mantenimientos').insert({
      matricula, tipo, fecha,
      descripcion: form.descripcion.value.trim() || null,
      km: _mantNum(form.km.value),
      coste: _mantNum(form.coste.value),
      taller: form.taller.value.trim() || null,
      factura_path, factura_nombre,
      registrado_por: _mantUsuario()
    });
    if (error) return 'No se pudo guardar: ' + error.message;

    if (rev) {
      await sb.from('revisiones_programadas').update({
        activa: false, completada_por: _mantUsuario(), fecha_completada: fecha
      }).eq('id', rev.id);
    }
    if (proxFecha || proxKm != null) {
      await sb.from('revisiones_programadas').insert({
        matricula, tipo, fecha_limite: proxFecha, km_limite: proxKm, creado_por: _mantUsuario()
      });
    }
    registrarAccion('MANTENIMIENTO', 'Mantenimiento registrado', `${matricula} · ${tipo}${rev ? ' · revisión completada' : ''}`);
    mostrarToast('✓ Mantenimiento registrado', 'success');
    _mantRefrescar(matricula);
    return null;
  });
}

async function mantBorrarMantenimiento(matricula, id) {
  if (!_mantEsAdmin()) return;
  const ok = await appConfirm('Se eliminará este mantenimiento del historial. Sus documentos (factura, certificados…) pasan a Documentos (Otros).', { titulo: '¿Eliminar mantenimiento?', icono: '🗑️', labelOk: 'Eliminar', peligro: true });
  if (!ok) return;
  // La factura y los adjuntos no se pierden: vuelven a Documentos como "Otros"
  const { data: mt } = await sb.from('mantenimientos').select('factura_path, adjuntos').eq('id', id).maybeSingle();
  const paths = mt ? [mt.factura_path].concat((Array.isArray(mt.adjuntos) ? mt.adjuntos : []).map(a => a && a.path)).filter(Boolean) : [];
  if (paths.length) await sb.from('documentos_vehiculo').update({ categoria: 'otros' }).in('path', paths);
  const { error } = await sb.from('mantenimientos').delete().eq('id', id);
  if (error) { mostrarToast('No se pudo eliminar: ' + error.message, 'error'); return; }
  registrarAccion('MANTENIMIENTO', 'Mantenimiento eliminado', matricula);
  mostrarToast('Mantenimiento eliminado', 'info');
  _mantRefrescar(matricula);
}

// ── Revisión programada (admin) ──────────────────────────────────────────────
async function mantAbrirFormRevision(matricula, tipoInicial) {
  if (!_mantEsAdmin()) return;
  const kmActual = await _mantKmActual(matricula);
  const cuerpo =
    _mantCampo('Tipo *', `<select name="tipo">${MANT_TIPOS.map(t => `<option${t === tipoInicial ? ' selected' : ''}>${t}</option>`).join('')}</select>`) +
    `<div class="mant-fila">` +
      _mantCampo('Antes de la fecha', `<input type="date" name="fecha_limite" min="${_mantHoyISO()}">`) +
      _mantCampo('O antes de los km', `<input type="text" name="km_limite" inputmode="numeric" placeholder="${kmActual != null ? 'Ahora: ' + Math.round(kmActual).toLocaleString('es-ES') : 'Ej.: 250000'}">`) +
    `</div>` +
    `<div class="mant-ayuda" style="margin:-4px 0 10px">Pon una fecha, unos kilómetros o las dos cosas. Se avisa ${MANT_AVISO_DIAS} días o ${MANT_AVISO_KM.toLocaleString('es-ES')} km antes.</div>` +
    _mantCampo('Notas', `<input type="text" name="notas" placeholder="Opcional">`);
  _mantModal(`Programar revisión · ${_fichaMatReal(matricula)}`, '📅', cuerpo, 'Programar', async form => {
    const fecha_limite = form.fecha_limite.value || null;
    const km_limite = _mantNum(form.km_limite.value);
    if (!fecha_limite && km_limite == null) return 'Indica una fecha o unos kilómetros.';
    const { error } = await sb.from('revisiones_programadas').insert({
      matricula, tipo: form.tipo.value, fecha_limite, km_limite,
      notas: form.notas.value.trim() || null, creado_por: _mantUsuario()
    });
    if (error) return 'No se pudo guardar: ' + error.message;
    registrarAccion('MANTENIMIENTO', 'Revisión programada', `${matricula} · ${form.tipo.value}`);
    mostrarToast('✓ Revisión programada', 'success');
    _mantRefrescar(matricula);
    return null;
  });
}

async function mantQuitarRevision(matricula, id) {
  if (!_mantEsAdmin()) return;
  const ok = await appConfirm('La revisión dejará de avisar. Si ya se ha hecho, usa mejor "Hecha: registrar mantenimiento".', { titulo: '¿Quitar revisión programada?', icono: '📅', labelOk: 'Quitar' });
  if (!ok) return;
  const { error } = await sb.from('revisiones_programadas').update({ activa: false }).eq('id', id);
  if (error) { mostrarToast('No se pudo quitar: ' + error.message, 'error'); return; }
  registrarAccion('MANTENIMIENTO', 'Revisión quitada', matricula);
  _mantRefrescar(matricula);
}

// Repinta las etiquetas de la cabecera de la ficha (Bloqueado, Avería…) sin
// cambiar de pestaña.
function _mantActualizarCabeceraFicha(matricula) {
  if (typeof fichaRefrescar === 'function') fichaRefrescar(matricula);
}

// Refresco periódico del aviso del cuadrante (por si otro equipo registra algo)
setInterval(() => { if (usuarioActual && !document.hidden) mantCargarResumen(); }, 5 * 60 * 1000);

// ── Avería registrada desde el formulario de incidencia ("Es una avería") ────
async function mantRegistrarAveriaDesdeIncidencia(matricula, descripcion, bloqueado, incidenciaId) {
  try {
    const { error } = await sb.from('averias').insert({
      matricula, descripcion, estado: 'abierta', inmoviliza: !!bloqueado, bloqueo_aplicado: !!bloqueado,
      fecha: _mantHoyISO(), reportado_por: _mantUsuario(), incidencia_id: incidenciaId || null
    });
    if (error) throw error;
    registrarAccion('MANTENIMIENTO', 'Parte de avería', `${matricula} · desde incidencia${bloqueado ? ' · NO PUEDE CIRCULAR' : ''} · ${descripcion.substring(0, 60)}`);
    mantCargarResumen();
  } catch (e) {
    mostrarToast('La incidencia se guardó, pero no se pudo registrar la avería en Mantenimiento', 'error');
  }
}

// ── Incidencias ↔ averías (lista de Incidencias pendientes) ──────────────────
const MANT_TIPOS_INCID = {
  averia:    { emoji: '🔧', txt: 'Avería' },
  accidente: { emoji: '💥', txt: 'Accidente' },
  revision:  { emoji: '📅', txt: 'Revisión' },
  otro:      { emoji: '📝', txt: 'Otro' }
};

/** Averías enlazadas a esas incidencias: { incidencia_id: { id, estado } } */
async function mantAveriasPorIncidencia(ids) {
  const res = {};
  ids = (ids || []).filter(Boolean);
  if (!ids.length) return res;
  const { data, error } = await sb.from('averias').select('id, incidencia_id, estado').in('incidencia_id', ids);
  if (!error) (data || []).forEach(a => { res[a.incidencia_id] = a; });
  return res;
}

/** Cambia el tipo de una incidencia ya registrada (p. ej. las antiguas, sin tipo). */
async function mantCambiarTipoIncidencia(incidenciaId, tipo, selectEl) {
  const { error } = await sb.from('incidencias').update({ tipo: tipo || null }).eq('id', incidenciaId);
  if (error) { mostrarToast('No se pudo cambiar el tipo: ' + error.message, 'error'); return; }
  if (selectEl) selectEl.dataset.tipo = tipo || '';
  mostrarToast('✓ Tipo actualizado', 'success');
}

/** Crea una avería a partir de una incidencia pendiente y las deja enlazadas. */
function mantPasarIncidenciaAAveria(inc) {
  if (!usuarioActual || !inc) return;
  const v = _getVehiculo(inc.matricula);
  const bloqueadoPorEsta = !!(v && v.bloqueado);
  const cuerpo =
    `<div class="mant-resumen">${esc(inc.descripcion || '')}</div>` +
    `<div class="mant-item-meta" style="margin-top:-4px">Incidencia del ${_mantFecha(inc.fecha)} · ${esc(inc.responsable || '—')}</div>` +
    `<label class="mant-check"><input type="checkbox" name="inmoviliza"${bloqueadoPorEsta ? ' checked' : ''}>
      <span><strong>El vehículo no puede circular</strong><br>
      ${bloqueadoPorEsta ? 'Ya está NO DISPONIBLE; volverá a estar disponible cuando se repare.' : 'Pasará a NO DISPONIBLE en el cuadrante hasta que se repare.'}</span></label>` +
    `<div class="mant-nota">Cuando la avería se marque como reparada, esta incidencia se resolverá sola.</div>`;
  _mantModal(`Pasar a avería · ${_fichaMatReal(inc.matricula)}`, '🔧', cuerpo, 'Pasar a avería', async form => {
    // Evitar duplicados: una incidencia solo puede tener una avería
    const { data: yaExiste } = await sb.from('averias').select('id').eq('incidencia_id', inc.id).limit(1);
    if (yaExiste && yaExiste.length) {
      _mantRefrescar(inc.matricula);
      if (typeof cargarIncidenciasPendientesModal === 'function') cargarIncidenciasPendientesModal();
      return 'Esta incidencia ya está pasada a avería.';
    }
    const inmoviliza = form.inmoviliza.checked;
    let bloqueoAplicado = inmoviliza && !!(v && v.bloqueado);
    if (inmoviliza && v && !v.bloqueado) {
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, redirect: 'follow',
        body: JSON.stringify({ accion: 'bloquearVehiculo', matricula: inc.matricula, motivo: 'Avería: ' + (inc.descripcion || ''), bloqueado_por: _mantUsuario() })
      });
      const json = await resp.json();
      if (!json.ok) return 'No se pudo bloquear el vehículo: ' + (json.error || '');
      v.bloqueado = true; v.motivo_bloqueo = 'Avería: ' + (inc.descripcion || ''); v.bloqueado_por = _mantUsuario();
      v.fecha_bloqueo = json.fecha_bloqueo || new Date().toISOString();
      bloqueoAplicado = true;
      if (typeof renderTabla === 'function') renderTabla();
    }
    const { error } = await sb.from('averias').insert({
      matricula: inc.matricula, descripcion: inc.descripcion || '(sin descripción)', estado: 'abierta',
      fecha: inc.fecha || _mantHoyISO(), inmoviliza, bloqueo_aplicado: bloqueoAplicado,
      reportado_por: inc.responsable || _mantUsuario(), incidencia_id: inc.id
    });
    if (error) return 'No se pudo guardar: ' + error.message;
    // Solo se pone el tipo "Avería" si no tenía ninguno (un accidente sigue siendo accidente)
    await sb.from('incidencias').update({ tipo: 'averia' }).eq('id', inc.id).is('tipo', null);
    registrarAccion('MANTENIMIENTO', 'Incidencia pasada a avería', `${inc.matricula} · ${(inc.descripcion || '').substring(0, 60)}`);
    mostrarToast('✓ Incidencia pasada a avería', 'success');
    _mantRefrescar(inc.matricula);  // repinta la ficha (si está abierta) y el aviso del cuadrante
    const modalInc = document.getElementById('modal-incidencias-pendientes');
    if (modalInc && modalInc.classList.contains('open') && typeof cargarIncidenciasPendientesModal === 'function') cargarIncidenciasPendientesModal();
    return null;
  });
}

// ════════════════════════════════════════════════════════════════════════════
// VENTANA "¿QUÉ QUIERES AÑADIR?" (botón "Añadir Incidencia" del cuadrante)
// Permite registrar desde el cuadrante, sin entrar al Panel Admin:
//   · Todos: incidencia del turno, avería, fotos y documentos (sin poder borrar).
//   · Admin: además, mantenimiento realizado y programar revisión.
// ════════════════════════════════════════════════════════════════════════════
let _mantMenuAbierto = null;

function _mantCerrarMenu(devolverFoco) {
  if (!_mantMenuAbierto) return;
  const b = _mantMenuAbierto._boton;
  _mantMenuAbierto.remove();
  _mantMenuAbierto = null;
  if (devolverFoco && b && document.body.contains(b)) b.focus();
}

function mantMenuAnadir(boton, matricula) {
  _mantCerrarMenu();
  if (!usuarioActual) { mostrarToast('Inicia sesión para añadir', 'error'); return; }

  const admin = _mantEsAdmin();
  const v = _getVehiculo(matricula);
  const d = (typeof getDato === 'function') ? getDato(matricula) : {};
  const esHoy = typeof esFechaHoy === 'function' ? esFechaHoy() : true;
  const yaTieneIncid = !!(d.incidencias && String(d.incidencias).trim());

  let motivoIncid = '';
  if (!esHoy) motivoIncid = 'Solo hoy';
  else if (v?.bloqueado) motivoIncid = 'No disponible';
  else if (yaTieneIncid) motivoIncid = 'Ya registrada';

  const tile = (accion, emoji, titulo, sub, deshabilitado) =>
    `<button type="button" class="mant-tile" data-accion="${accion}"${deshabilitado ? ' disabled' : ''}>
      <span class="mant-tile-emoji" aria-hidden="true">${emoji}</span>
      <span class="mant-tile-tit">${titulo}</span>
      <span class="mant-tile-sub">${sub}</span>
    </button>`;

  const ov = document.createElement('div');
  ov.className = 'mant-anadir-ov';
  ov.innerHTML = `
    <div class="mant-anadir" role="dialog" aria-modal="true" aria-labelledby="mant-anadir-tit">
      <div class="mant-anadir-head">
        <div>
          <div class="mant-anadir-tit" id="mant-anadir-tit">¿Qué quieres añadir?</div>
          <div class="mant-anadir-mat">${esc(_fichaMatReal(matricula))}<span>${esc(v ? v.tipo + (v.nota ? ' · ' + v.nota : '') : '')}</span></div>
        </div>
        <button type="button" class="mant-anadir-x" data-accion="cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="mant-anadir-body">
        <div class="mant-tiles${admin ? '' : ' cuatro'}">
          ${tile('incidencia', '⚠️', 'Incidencia', motivoIncid || 'Del turno de hoy', !!motivoIncid)}
          ${tile('averia', '🔧', 'Avería', 'Dar parte')}
          ${tile('fotos', '📷', 'Fotos', 'Entrega, daños…')}
          ${tile('docs', '📄', 'Documento', 'Permiso, ITV…')}
          ${admin ? tile('mant', '🛠️', 'Mantenimiento', 'Ya realizado') + tile('revision', '📅', 'Revisión', 'Programar aviso') : ''}
        </div>
      </div>
      <div class="mant-anadir-pie">
        <button type="button" class="mant-anadir-link" data-accion="ficha">🗂️ Ver mantenimiento del vehículo</button>
        <button type="button" class="mant-anadir-cancel" data-accion="cerrar">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov._boton = boton;
  _mantMenuAbierto = ov;

  ov.addEventListener('click', e => {
    // Un clic fuera NO cierra la ventana: solo «Cancelar».
    const b = e.target.closest('[data-accion]');
    if (!b || b.disabled) return;
    const accion = b.dataset.accion;
    _mantCerrarMenu(accion === 'cerrar');
    switch (accion) {
      case 'incidencia': abrirModalIncidencia(matricula); break;
      case 'averia':     mantAbrirFormAveria(matricula); break;
      case 'fotos':      abrirGestorDocumentos(matricula, 'fotos', { puedeBorrar: admin }); break;
      case 'docs':       abrirGestorDocumentos(matricula, 'docs', { puedeBorrar: admin }); break;
      case 'mant':       mantAbrirFormMantenimiento(matricula); break;
      case 'revision':   mantAbrirFormRevision(matricula); break;
      case 'ficha':      abrirFichaVehiculo(matricula); fichaTabSwitch(mantPestanaFicha(matricula)); break;
    }
  });
  const primero = ov.querySelector('.mant-tile:not([disabled])');
  if (primero) primero.focus();
}

// Escape cierra la ventana; con las flechas se pasa de una opción a otra
window.addEventListener('keydown', e => {
  if (!_mantMenuAbierto) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); _mantCerrarMenu(true); return; }
  if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
    const ops = [..._mantMenuAbierto.querySelectorAll('.mant-tile:not([disabled])')];
    const i = ops.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const paso = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    ops[(i + paso + ops.length) % ops.length].focus();
  }
}, true);
