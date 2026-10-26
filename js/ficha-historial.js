// ════════════════════════════════════════════════════════════════════════════
// FLOTA PRIMOR · js/ficha-historial.js — FICHA DEL VEHÍCULO · HISTORIAL
//
// Pestaña "Historial" de la ficha (solo administradores). Junta en una lista
// todo lo que le ha pasado al vehículo, de lo más nuevo a lo más antiguo:
//   · Nave y datos: cambios de nave, matrícula, tipo y sociedad, altas y bajas,
//     tacógrafo y conductores habituales (registro de acciones).
//   · Bloqueos: tabla bloqueos_historial (se apunta sola en la base de datos).
//   · Averías y mantenimiento: incidencias, averías, talleres, mantenimientos.
//   · Seguro, ITV y documentos: cambios del seguro, ITV, documentos y fotos.
//   · Repostajes: tabla repostajes.
// La pinta js/ficha-vehiculo.js llamando a fichaHistHtml(v).
// ════════════════════════════════════════════════════════════════════════════

const FH_PAGINA = 60;                        // eventos que se ven de golpe
let _fhCache = null;                         // { mat, eventos, resumen }
let _fhFiltro = 'todo';
let _fhVisibles = FH_PAGINA;

const FH_FILTROS = [
  { id: 'todo',   label: 'Todo' },
  { id: 'nave',   label: 'Nave y datos',             color: '#1D3FA8' },
  { id: 'bloq',   label: 'Bloqueos',                 color: '#C93636' },
  { id: 'averia', label: 'Averías y mantenimiento',  color: '#F59E0B' },
  { id: 'docs',   label: 'Seguro, ITV y documentos', color: '#5B6576' },
  { id: 'rep',    label: 'Repostajes',               color: '#5B2DB0' }
];

const _fhSvg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const FH_ICONOS = {
  nave:  _fhSvg('<path d="M3 21V9l9-5 9 5v12"/><path d="M8 21v-7h8v7"/>'),
  datos: _fhSvg('<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>'),
  bloq:  _fhSvg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  desb:  _fhSvg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
  llave: _fhSvg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
  aviso: _fhSvg('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>'),
  ok:    _fhSvg('<path d="M5 12l5 5L20 7"/>'),
  doc:   _fhSvg('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>'),
  foto:  _fhSvg('<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>'),
  rep:   _fhSvg('<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/><path d="M7 7h4"/>'),
  pers:  _fhSvg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')
};
const FH_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Utilidades ───────────────────────────────────────────────────────────────
function _fhNombre(n) {            // "JOSE LUIS FRANCO FERNANDEZ" → "Jose Luis Franco"
  const p = String(n || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '';
  const corto = p.length >= 4 ? p.slice(0, p.length - 1) : p;
  return _fvCap(corto.join(' '));
}
function _fhDiaLocal(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function _fhDdMm(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}
function _fhHora(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function _fhDias(desde, hasta) {
  const ms = (hasta ? new Date(hasta) : new Date()) - new Date(desde);
  return Math.max(1, Math.round(ms / 86400000));
}
// Miles con punto también en números de 4 cifras (1.729), que el formato español no agrupa
function _fhMiles(ent) { return String(ent).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function _fhEuros(n) {
  const [e, d] = Number(n || 0).toFixed(2).split('.');
  return `${_fhMiles(e)},${d} €`;
}
function _fhKm(n) { return _fhMiles(Math.round(Number(n || 0))) + ' km'; }
// Fecha sin hora (AAAA-MM-DD) → mediodía local, para ordenarla con las demás
function _fhMediodia(fecha) { return fecha ? new Date(`${String(fecha).substring(0, 10)}T12:00:00`).toISOString() : null; }
// Texto del registro tras la matrícula: "MAT · a · b" → "a · b"
function _fhResto(detalle, mat) {
  let s = String(detalle || '');
  if (s.toUpperCase().startsWith(mat.toUpperCase())) s = s.substring(mat.length);
  return s.replace(/^\s*·\s*/, '').trim();
}

// ── Pestaña ──────────────────────────────────────────────────────────────────
function fichaHistHtml(v) {
  if (_fhCache && _fhCache.mat === _fichaMat) return _fhPintar();
  _fhFiltro = 'todo'; _fhVisibles = FH_PAGINA;
  _fhCargar(_fichaMat);
  return `<h2 class="fv-h2">Historial</h2>${_fvCargando()}`;
}

function fichaHistFiltro(id) {
  _fhFiltro = id; _fhVisibles = FH_PAGINA;
  _fhRepintar();
}
function fichaHistMas() {
  _fhVisibles += FH_PAGINA;
  _fhRepintar();
}
/** Para que la próxima vez que se abra la pestaña se vuelva a leer (tras un cambio). */
function fichaHistInvalidar() { _fhCache = null; }

function _fhRepintar() {
  const cont = document.querySelector('#modal-ficha-vehiculo .fv-panel[data-tab="hist"]');
  if (cont && _fhCache && _fhCache.mat === _fichaMat) cont.innerHTML = _fhPintar();
}

// ── Carga de datos ───────────────────────────────────────────────────────────
async function _fhCargar(mat) {
  const r = { log: [], bloq: [], rep: [], av: [], inc: [] };
  const q = s => s.then(x => x.data || []).catch(() => []);
  try {
    [r.log, r.bloq, r.rep, r.av, r.inc] = await Promise.all([
      q(sb.from('log_acciones').select('timestamp, nombre, categoria, accion, detalle')
        .in('categoria', ['VEHICULO', 'MANTENIMIENTO', 'INCIDENCIA', 'ADMIN'])
        .or(`detalle.ilike."${mat}%",detalle.ilike."%→ ${mat} ·%"`)
        .order('timestamp', { ascending: false }).limit(1000)),
      q(sb.from('bloqueos_historial').select('*').eq('matricula', mat)),
      q(sb.from('repostajes').select('fecha, hora_entrega, timestamp, kilometraje, ticket_importe, num_tarjeta, usuario_chofer, resp_entrega, estado').eq('matricula', mat)),
      q(sb.from('averias').select('fecha, descripcion, estado, taller, coste, fecha_cierre, comentario_cierre, cerrado_por, updated_at').eq('matricula', mat)),
      q(sb.from('incidencias').select('estado').eq('matricula', mat))
    ]);
  } catch (e) { /* sin conexión: se pinta lo que haya */ }
  if (_fichaMat !== mat) return;   // se cerró o se cambió de ficha mientras cargaba
  _fhCache = { mat, eventos: _fhMontarEventos(mat, r), resumen: _fhResumen(mat, r) };
  _fhRepintar();
}

function _fhMontarEventos(mat, r) {
  const ev = [];
  const add = (cat, ts, ico, cls, tit, det, quien, extra) => { if (ts) ev.push({ cat, ts, ico, cls, tit, det: det || '', quien: quien || '', ...(extra || {}) }); };

  // Registro de acciones
  r.log.forEach(l => {
    const quien = _fhNombre(l.nombre), ts = l.timestamp, a = l.accion, resto = _fhResto(l.detalle, mat);
    switch (a) {
      case 'Editar vehículo': {
        const [antes, despues] = String(l.detalle || '').split(' → ');
        if (!despues) return;
        const A = antes.split(' · '), B = despues.split(' · ');
        if (B[0] !== mat && A[0] !== mat) return;
        if ((A[0] || '') !== (B[0] || '')) add('nave', ts, 'datos', 'nave', 'Cambio de matrícula', `${esc(A[0])}<span class="fh-flecha">→</span><strong>${esc(B[0])}</strong>`, quien);
        if ((A[2] || '').toUpperCase() !== (B[2] || '').toUpperCase()) add('nave', ts, 'nave', 'nave', 'Cambio de nave', `${esc(A[2] || '—')}<span class="fh-flecha">→</span><strong>${esc(B[2] || '—')}</strong>`, quien, { nave: true, naveNueva: B[2] });
        if ((A[1] || '') !== (B[1] || '')) add('nave', ts, 'datos', 'nave', 'Cambio de tipo', `${esc(_fvTipo(A[1]))}<span class="fh-flecha">→</span><strong>${esc(_fvTipo(B[1]))}</strong>`, quien);
        if ((A[3] || '') !== (B[3] || '')) add('nave', ts, 'datos', 'nave', 'Cambio de sociedad', `${esc(A[3] || 'Sin sociedad')}<span class="fh-flecha">→</span><strong>${esc(B[3] || 'Sin sociedad')}</strong>`, quien);
        return;
      }
      case 'Añadir vehículo': return add('nave', ts, 'ok', 'desb', 'Alta en la flota', esc(resto), quien);
      case 'Dar de baja (archivar) vehículo': return add('nave', ts, 'bloq', 'docs', 'Dado de baja', '', quien);
      case 'Dar de alta (restaurar) vehículo': return add('nave', ts, 'ok', 'desb', 'Dado de alta de nuevo', '', quien);
      case 'Lleva tacógrafo': return add('nave', ts, 'datos', 'nave', 'Marcado como que lleva tacógrafo', '', quien);
      case 'No lleva tacógrafo': return add('nave', ts, 'datos', 'nave', 'Marcado como que no lleva tacógrafo', '', quien);
      case 'Añadir habitual': return add('nave', ts, 'pers', 'nave', 'Conductor habitual añadido', esc(resto), quien);
      case 'Quitar habitual': return add('nave', ts, 'pers', 'nave', 'Conductor habitual quitado', esc(resto), quien);
      case 'Marcar suplente': return add('nave', ts, 'pers', 'nave', 'Conductor marcado como suplente', esc(resto), quien);

      case 'Registrar incidencia': return add('averia', ts, 'aviso', 'averia', 'Incidencia registrada', esc(resto), quien);
      case 'Registrar incidencia + Bloquear vehículo': return add('averia', ts, 'aviso', 'averia', 'Incidencia registrada', esc(resto), quien, { tag: ['rojo', 'Bloquea el vehículo'] });
      case 'Resolver incidencia': {
        const desb = / · desbloqueado$/.test(resto);
        return add('averia', ts, 'ok', 'desb', 'Incidencia resuelta', esc(resto.replace(/ · desbloqueado$/, '')), quien, desb ? { tag: ['verde', 'Desbloqueado'] } : null);
      }
      case 'Parte de avería': {
        const inm = /NO PUEDE CIRCULAR/.test(resto);
        const txt = resto.replace(/(^|\s·\s)NO PUEDE CIRCULAR(\s·\s)?/, '$1').replace(/^desde incidencia\s·\s/, '').replace(/\s·\s$/, '');
        return add('averia', ts, 'aviso', 'averia', 'Avería registrada', esc(txt), quien, inm ? { tag: ['rojo', 'Inmoviliza'] } : null);
      }
      case 'Incidencia pasada a avería': return add('averia', ts, 'aviso', 'averia', 'Incidencia pasada a avería', esc(resto), quien);
      case 'Avería en taller': return add('averia', ts, 'llave', 'averia', 'Avería llevada a taller', resto ? `Taller ${esc(resto)}` : '', quien);
      case 'Mantenimiento registrado': {
        const rev = / · revisión completada$/.test(resto);
        return add('averia', ts, 'llave', 'desb', 'Mantenimiento hecho', esc(resto.replace(/ · revisión completada$/, '')), quien, rev ? { tag: ['verde', 'Revisión completada'] } : null);
      }
      case 'Mantenimiento eliminado': return add('averia', ts, 'llave', 'docs', 'Mantenimiento borrado', '', quien);
      case 'Revisión programada': return add('averia', ts, 'llave', 'nave', 'Revisión programada', esc(resto), quien);
      case 'Revisión quitada': return add('averia', ts, 'llave', 'docs', 'Revisión programada quitada', '', quien);
      case 'Documento añadido a revisión de tacógrafo': return add('averia', ts, 'doc', 'docs', 'Documento añadido a la revisión de tacógrafo', esc(resto), quien);

      case 'Editar datos seguro': return add('docs', ts, 'doc', 'docs', 'Datos del seguro modificados', '', quien);
      case 'Fecha ITV desde informe': return add('docs', ts, 'ok', 'desb', 'Nueva fecha de ITV', resto ? `Válida hasta el <strong>${esc(resto)}</strong>` : '', quien);
      case 'Subir documento': return add('docs', ts, 'doc', 'docs', 'Documento subido', esc(resto), quien);
      case 'Eliminar documento': return add('docs', ts, 'doc', 'docs', 'Documento borrado', '', quien);
      case 'Subir fotos': {
        const p = resto.split(' · ');
        return add('docs', ts, 'foto', 'docs', 'Fotos subidas', esc(p.length > 1 ? `${p.slice(0, -1).join(' · ')} · ${p[p.length - 1]} fotos` : resto), quien);
      }
      case 'Crear carpeta fotos': return add('docs', ts, 'foto', 'docs', 'Carpeta de fotos creada', esc(resto), quien);
      case 'Comentario carpeta fotos': return add('docs', ts, 'foto', 'docs', 'Comentario en carpeta de fotos', esc(resto), quien);
      case 'Eliminar carpeta fotos': return add('docs', ts, 'foto', 'docs', 'Carpeta de fotos borrada', esc(resto), quien);
      default: return;   // bloqueos y reparaciones salen de sus tablas
    }
  });

  // Bloqueos (con lo que duraron)
  r.bloq.forEach(b => {
    const dias = _fhDias(b.desde, b.hasta);
    const motivo = b.motivo ? `Motivo: ${esc(b.motivo)}` : '';
    add('bloq', b.desde, 'bloq', 'bloq', 'Bloqueado · no disponible', motivo, _fhNombre(b.bloqueado_por),
      { tag: ['rojo', b.hasta ? `${dias} ${dias === 1 ? 'día' : 'días'}` : 'Sigue bloqueado'] });
    if (b.hasta) add('bloq', b.hasta, 'desb', 'desb', 'Desbloqueado · vuelve a estar disponible', b.motivo ? `Bloqueo por ${esc(b.motivo)}` : '', '',
      { tag: ['verde', 'Disponible'], tramo: `${_fhDdMm(b.desde)} → ${_fhDdMm(b.hasta)} · ${dias} ${dias === 1 ? 'día' : 'días'} sin poder usarse` });
  });

  // Averías reparadas (fecha de cierre)
  r.av.filter(a => a.estado === 'reparada' && a.fecha_cierre).forEach(a => {
    const ts = (a.updated_at && _fhDiaLocal(a.updated_at) === String(a.fecha_cierre).substring(0, 10)) ? a.updated_at : _fhMediodia(a.fecha_cierre);
    const partes = [esc(a.descripcion || '')];
    if (a.comentario_cierre) partes.push(`«${esc(a.comentario_cierre)}»`);
    if (a.coste) partes.push(`<span class="fh-mono">${_fhEuros(a.coste)}</span>`);
    add('averia', ts, 'llave', 'desb', 'Avería reparada', partes.filter(Boolean).join(' · '), _fhNombre(a.cerrado_por), a.taller ? { tag: ['gris', a.taller] } : null);
  });

  // Repostajes
  r.rep.forEach(p => {
    const ts = p.fecha && p.hora_entrega ? new Date(`${p.fecha}T${String(p.hora_entrega).substring(0, 5)}:00`).toISOString() : (p.timestamp || _fhMediodia(p.fecha));
    const det = [p.kilometraje ? `<span class="fh-mono">${_fhKm(p.kilometraje)}</span>` : '', p.num_tarjeta ? `tarjeta ${esc(p.num_tarjeta)}` : '', esc(_fhNombre(p.usuario_chofer))].filter(Boolean).join(' · ');
    add('rep', ts, 'rep', 'rep', p.ticket_importe ? `Repostaje · <span class="fh-mono">${_fhEuros(p.ticket_importe)}</span>` : 'Repostaje', det, _fhNombre(p.resp_entrega), { titHtml: true });
  });

  // Lo mismo guardado dos veces seguidas (doble clic, reintento) sale una sola vez
  ev.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  return ev.filter((e, i) => !ev.slice(Math.max(0, i - 4), i).some(o =>
    o.cat === e.cat && o.tit === e.tit && o.det === e.det && Math.abs(new Date(o.ts) - new Date(e.ts)) < 10 * 60000));
}

function _fhResumen(mat, r) {
  const anio = new Date().getFullYear();
  const iniAnio = new Date(anio, 0, 1);
  // Días no disponible este año
  let dias = 0, nBloq = 0, ultimo = null;
  r.bloq.forEach(b => {
    const desde = new Date(b.desde), hasta = b.hasta ? new Date(b.hasta) : new Date();
    if (hasta < iniAnio) return;
    nBloq++;
    dias += _fhDias(desde < iniAnio ? iniAnio : desde, hasta);
    if (!ultimo || desde > new Date(ultimo.desde)) ultimo = b;
  });
  // Averías e incidencias
  const avAbiertas = r.av.filter(a => a.estado !== 'reparada').length;
  const incAbiertas = r.inc.filter(i => String(i.estado || '').toUpperCase() !== 'COMPLETADO').length;
  // Repostajes del año
  const repAnio = r.rep.filter(p => String(p.fecha || '').startsWith(String(anio)));
  const gasto = repAnio.reduce((s, p) => s + (Number(p.ticket_importe) || 0), 0);
  const kms = repAnio.map(p => Number(p.kilometraje) || 0).filter(Boolean);
  const km = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0;
  return { anio, dias, nBloq, ultimo, nAv: r.av.length, avAbiertas, nInc: r.inc.length, incAbiertas, nRep: repAnio.length, gasto, km };
}

// ── Pintado ──────────────────────────────────────────────────────────────────
function _fhPintar() {
  const c = _fhCache, s = c.resumen;
  const cambiosNave = c.eventos.filter(e => e.nave);
  const naveActual = _fvGrupo(c.mat);
  const ult = cambiosNave[0];
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

  const tarjetas = `
    <div class="fh-resumen">
      <div class="fv-card"><span class="fv-card-lbl">NO DISPONIBLE ESTE AÑO</span>
        <span class="fv-card-big ${s.dias ? 'mal' : 'ok'}">${s.dias ? plural(s.dias, 'día', 'días') : 'Ningún día'}</span>
        <span class="fv-card-pie">${s.nBloq ? `${plural(s.nBloq, 'bloqueo', 'bloqueos')} · el último, ${s.ultimo.hasta ? `del ${_fhDdMm(s.ultimo.desde)} al ${_fhDdMm(s.ultimo.hasta)}` : `desde el ${_fhDdMm(s.ultimo.desde)}`}` : 'Sin bloqueos'}</span></div>
      <div class="fv-card"><span class="fv-card-lbl">AVERÍAS E INCIDENCIAS</span>
        <span class="fv-card-big${s.avAbiertas ? ' aviso' : ''}">${plural(s.nAv, 'avería', 'averías')}</span>
        <span class="fv-card-pie">${plural(s.nInc, 'incidencia', 'incidencias')} · ${(s.avAbiertas + s.incAbiertas) ? `${s.avAbiertas + s.incAbiertas} abierta${s.avAbiertas + s.incAbiertas === 1 ? '' : 's'}` : 'ninguna abierta'}</span></div>
      <div class="fv-card"><span class="fv-card-lbl">CAMBIOS DE NAVE</span>
        <span class="fv-card-big">${cambiosNave.length}</span>
        <span class="fv-card-pie">${naveActual ? `En ${esc(naveActual.toUpperCase())}${ult ? ` desde el ${_fhDdMm(ult.ts)}` : ''}` : '—'}</span></div>
      <div class="fv-card"><span class="fv-card-lbl">GASOIL ESTE AÑO</span>
        <span class="fv-card-big">${_fhEuros(s.gasto)}</span>
        <span class="fv-card-pie">${plural(s.nRep, 'repostaje', 'repostajes')}${s.km ? ` · ${_fhKm(s.km)} recorridos` : ''}</span></div>
    </div>`;

  const filtros = `<div class="fh-filtros" role="group" aria-label="Filtrar el historial">${FH_FILTROS.map(f => {
    const n = f.id === 'todo' ? c.eventos.length : c.eventos.filter(e => e.cat === f.id).length;
    return `<button type="button" class="fh-filtro${_fhFiltro === f.id ? ' activo' : ''}" aria-pressed="${_fhFiltro === f.id}" onclick="fichaHistFiltro('${f.id}')">${f.color ? `<i style="background:${f.color}"></i>` : ''}${f.label}<b>${n}</b></button>`;
  }).join('')}</div>`;

  const lista = _fhFiltro === 'todo' ? c.eventos : c.eventos.filter(e => e.cat === _fhFiltro);
  let cuerpo = '';
  if (!lista.length) {
    cuerpo = `<div class="fh-vacio">No hay nada apuntado${_fhFiltro === 'todo' ? '' : ' de este tipo'} para este vehículo.</div>`;
  } else {
    let mesActual = '';
    lista.slice(0, _fhVisibles).forEach(e => {
      const d = new Date(e.ts);
      const mes = `${FH_MESES[d.getMonth()]} ${d.getFullYear()}`;
      if (mes !== mesActual) { cuerpo += `<div class="fh-mes">${mes}</div>`; mesActual = mes; }
      cuerpo += `
        <div class="fh-ev">
          <div class="fh-fecha"><span class="fh-dia">${_fhDdMm(e.ts)}</span><span class="fh-hora">${_fhHora(e.ts)}</span></div>
          <div class="fh-ico ${e.cls}">${FH_ICONOS[e.ico] || ''}</div>
          <div class="fh-txt">
            <span class="fh-tit">${e.titHtml ? e.tit : esc(e.tit)}${e.tag ? `<span class="fh-tag ${e.tag[0]}">${esc(e.tag[1])}</span>` : ''}</span>
            ${e.det ? `<span class="fh-det">${e.det}</span>` : ''}
            ${e.tramo ? `<div class="fh-tramo"><span class="barra"></span>${esc(e.tramo)}</div>` : ''}
          </div>
          <span class="fh-quien">${esc(e.quien)}</span>
        </div>`;
    });
    if (lista.length > _fhVisibles) cuerpo += `<div class="fh-mas"><button type="button" class="fv-btn" onclick="fichaHistMas()">Ver más antiguos (${lista.length - _fhVisibles})</button></div>`;
  }

  return `
    <div class="fh-cab"><div>
      <h2 class="fv-h2">Historial</h2>
      <div class="fv-card-nota">Todo lo que le ha pasado a este vehículo, de lo más reciente a lo más antiguo.</div>
    </div></div>
    ${tarjetas}
    ${filtros}
    <div class="fh-lista">${cuerpo}</div>`;
}
