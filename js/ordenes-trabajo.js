// ════════════════════════════════════════════════════════════════════════════
// MODAL ORDEN DE TRABAJO
// ════════════════════════════════════════════════════════════════════════════
// autoOpen: true = viene de asignar operario (pregunta si imprimir)
//           false = viene del botón "🖨️ Orden" (abre directamente)

// Rutas ya impresas para el vehículo actualmente abierto en el modal
// Set de strings con formato "empresaKey|rutaId"  (se rellena al abrir el modal)
let _rutasImpresasModal = new Set();

async function abrirModalOrden(matricula, autoOpen) {
  if (!usuarioActual) {
    mostrarToast('Debes iniciar sesión para imprimir órdenes', 'error');
    return;
  }
  const d = getDato(matricula);
  if (!d.operario || !d.operario.trim()) {
    mostrarToast('Asigna un operario antes de imprimir la orden', 'info');
    return;
  }
  ordenActual.matricula = matricula;
  ordenActual.operario  = d.operario;

  document.getElementById('orden-matricula').textContent = matricula;
  document.getElementById('orden-operario').textContent  = d.operario;
  document.getElementById('orden-fecha').textContent     = fechaActual.split('-').reverse().join('/');
  document.getElementById('orden-turno').textContent     = turnoActual === 'MANANA' ? 'MAÑANA' : turnoActual;

  // Mostrar spinner de carga inmediatamente mientras se hace el fetch
  const _cargaOrden = document.getElementById('carga-orden-overlay');
  if (_cargaOrden) _cargaOrden.classList.add('visible');

  // Cargar rutas ya impresas para este vehículo/turno/fecha desde LogOrdenes
  _rutasImpresasModal.clear();
  try {
    if (APPS_SCRIPT_URL) {
      const url = `${APPS_SCRIPT_URL}?accion=cargarLog&desde=${encodeURIComponent(fechaActual)}&hasta=${encodeURIComponent(fechaActual)}&_t=${Date.now()}`;
      const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(6000) });
      if (resp.ok) {
        const json = await resp.json();
        const filas = json.filas || [];
        filas.forEach(f => {
          const matLog   = (f.matricula || '').trim().toUpperCase();
          const turnoLog = (f.turno || '').trim().toUpperCase();
          if (matLog !== matricula.trim().toUpperCase()) return;
          if (turnoLog !== turnoActual.toUpperCase()) return;
          // Buscar empresa y ruta correspondiente al label guardado en el log
          Object.entries(EMPRESAS).forEach(([empKey, emp]) => {
            if (emp.label === f.empresa || emp.label.replace(' & ',' &amp; ') === f.empresa) {
              const ruta = emp.rutas.find(r => r.label === f.ruta);
              if (ruta) _rutasImpresasModal.add(`${empKey}|${ruta.id}`);
            }
          });
        });
      }
    }
  } catch(e) { /* sin conexión — no crítico */ }

  // Ocultar spinner y abrir modal
  if (_cargaOrden) _cargaOrden.classList.remove('visible');
  resetOrdenEmpresa();
  document.getElementById('modal-orden').classList.add('open');

  // Si viene de autoOpen, mostrar un pequeño indicador visual
  if (autoOpen) {
    const sub = document.querySelector('.modal-orden-sub');
    if (sub) sub.textContent = '✓ Operario asignado — ¿deseas imprimir la orden ahora?';
  } else {
    const sub = document.querySelector('.modal-orden-sub');
    if (sub) sub.textContent = 'Configura e imprime la orden para este vehículo';
  }
}

function cerrarModalOrden() {
  document.getElementById('modal-orden').classList.remove('open');
}

// Reimprimir una ruta específica ya registrada en el log
function reimprimirRuta(empKey, rutaId) {
  const emp  = EMPRESAS[empKey];
  const ruta = emp ? emp.rutas.find(r => r.id === rutaId) : null;
  if (!emp || !ruta) return;
  _ordenEmpresaKey = empKey;
  cerrarModalOrden();
  const modalGen = document.getElementById('modal-generando-orden');
  if (modalGen) modalGen.classList.add('visible');
  imprimirOrden(ordenActual.matricula, ordenActual.operario, emp, [ruta]);
}

// Packing List: usamos el HTML propio (mismo origen que index.html), igual que la Orden de Trabajo.
// Se carga vía fetch + srcdoc para que el iframe quede 100% "same-origin" y el print()
// se dispare directo, sin abrir pestaña/ventana nueva del navegador.
const _PACKING_HTML_URL = 'PACKING-LIST-CHOFERES.html';

async function abrirPackingList() {
  document.getElementById('modal-packing-list').classList.add('open');
  const iframe = document.getElementById('packing-list-iframe');
  if (!iframe) return;
  iframe.srcdoc = '<p style="font-family:Barlow,sans-serif;padding:24px;color:#8899aa;font-size:13px">Cargando packing list…</p>';
  try {
    const resp = await fetch(_PACKING_HTML_URL + '?_t=' + Date.now(), { cache: 'no-store' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const html = await resp.text();
    iframe.srcdoc = html;
  } catch (e) {
    iframe.srcdoc = '<p style="font-family:Barlow,sans-serif;padding:24px;color:#e84545;font-size:13px">No se pudo cargar el Packing List (' + (e && e.message ? e.message : 'error') + ').</p>';
  }
}

function cerrarPackingList() {
  document.getElementById('modal-packing-list').classList.remove('open');
}

function imprimirPackingList() {
  const iframe = document.getElementById('packing-list-iframe');
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
}

function resetOrdenEmpresa() {
  _ordenEmpresaKey = null;
  ['JD','LD'].forEach(k => {
    const btn = document.getElementById('orden-emp-'+k);
    if (btn) btn.classList.remove('active');
  });
  document.getElementById('orden-rutas-wrapper').classList.add('oculto');
  document.getElementById('orden-sin-empresa').style.display = '';
  document.getElementById('orden-rutas-lista').innerHTML = '';
  const counter = document.getElementById('orden-ruta-count');
  if (counter) counter.classList.remove('visible');
  // Deshabilitar botón imprimir
  const btn = document.querySelector('.btn-modal-imprimir');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.38'; btn.style.cursor = 'not-allowed'; }
}

function selOrdenEmpresa(key) {
  _ordenEmpresaKey = key;
  ['JD','LD'].forEach(k => {
    document.getElementById('orden-emp-'+k).classList.toggle('active', k===key);
  });
  // Mostrar rutas y ocultar placeholder
  document.getElementById('orden-sin-empresa').style.display = 'none';
  document.getElementById('orden-rutas-wrapper').classList.remove('oculto');
  const lista = document.getElementById('orden-rutas-lista');
  lista.innerHTML = EMPRESAS[key].rutas.map(r => {
    const yaImpresa = _rutasImpresasModal.has(`${key}|${r.id}`);
    return `
    <div class="orden-ruta-item${yaImpresa ? ' ya-impresa' : ''}" id="ruta-item-${r.id}" onclick="toggleRutaItem('${r.id}')">
      <input type="checkbox" id="ruta-chk-${r.id}" value="${r.id}" ${yaImpresa ? 'checked' : ''} onchange="actualizarContadorRutas()" onclick="event.stopPropagation()">
      <label for="ruta-chk-${r.id}">${r.label}</label>
      ${yaImpresa ? '<span class="badge-impresa">✓ YA IMPRESA</span><button class="btn-reimprimir" onclick="event.stopPropagation();reimprimirRuta(\''+key+'\',\''+r.id+'\')">🔁 REIMPRIMIR</button>' : ''}
    </div>`;
  }).join('');
  actualizarContadorRutas();
}

function toggleRutaItem(id) {
  const chk = document.getElementById('ruta-chk-' + id);
  const item = document.getElementById('ruta-item-' + id);
  chk.checked = !chk.checked;
  item.classList.toggle('selected', chk.checked);
  actualizarContadorRutas();
}

function actualizarContadorRutas() {
  // Sincronizar clases selected con estado real del checkbox
  const emp = EMPRESAS[_ordenEmpresaKey];
  if (!emp) return;
  emp.rutas.forEach(r => {
    const chk  = document.getElementById('ruta-chk-' + r.id);
    const item = document.getElementById('ruta-item-' + r.id);
    if (chk && item) item.classList.toggle('selected', chk.checked);
  });

  const checkedIds = [...document.querySelectorAll('#orden-rutas-lista input[type=checkbox]:checked')].map(c => c.value);
  const nuevas = checkedIds.filter(id => !_rutasImpresasModal.has(`${_ordenEmpresaKey}|${id}`));
  const total  = checkedIds.length;

  const counter = document.getElementById('orden-ruta-count');
  if (total > 1) {
    counter.textContent = total + ' seleccionadas';
    counter.classList.add('visible');
  } else {
    counter.classList.remove('visible');
  }

  // Activar/desactivar botón según haya rutas nuevas (no ya impresas)
  const btn = document.querySelector('.btn-modal-imprimir');
  if (btn) {
    const ok = nuevas.length > 0;
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.38';
    btn.style.cursor  = ok ? 'pointer' : 'not-allowed';
  }
}

function getRutasSeleccionadas() {
  const emp = EMPRESAS[_ordenEmpresaKey];
  const ids = [...document.querySelectorAll('#orden-rutas-lista input[type=checkbox]:checked')]
    .map(c => c.value);
  return ids.map(id => emp.rutas.find(r => r.id === id)).filter(Boolean);
}

async function ejecutarOrden() {
  const rutas = getRutasSeleccionadas();
  const emp   = EMPRESAS[_ordenEmpresaKey];
  if (!rutas.length) {
    mostrarToast('Selecciona al menos una ruta', 'error');
    return;
  }

  // Mostrar modal de carga y cerrar el modal de orden
  const modalGen = document.getElementById('modal-generando-orden');
  if (modalGen) modalGen.classList.add('visible');
  cerrarModalOrden();

  // Registrar log por cada ruta seleccionada
  for (const ruta of rutas) {
    await registrarLog(ordenActual.matricula, ordenActual.operario, emp.label, ruta.label);
  }

  imprimirOrden(ordenActual.matricula, ordenActual.operario, emp, rutas);
}

function imprimirOrden(matricula, operario, emp, rutas) {
  // rutas puede ser un array (nueva llamada multi-ruta) o un objeto único (compatibilidad)
  if (!Array.isArray(rutas)) rutas = [rutas];

  const conductor = CONDUCTORES.find(c => c.nombre.trim().toUpperCase() === operario.trim().toUpperCase());
  const sello     = SELLOS[_ordenEmpresaKey];
  const fechaFmt  = fechaActual.split('-').reverse().join('/');

  // Generar un bloque de orden por cada ruta seleccionada
  const bloques = rutas.map((ruta, idx) => {
    const orig = UBIC[ruta.origen] || {};
    const dest = UBIC[ruta.destino] || {};
    const pageBreak = idx > 0 ? 'page-break-before:always;' : '';
    return `
      <div style="${pageBreak}display:flex;flex-direction:column;min-height:calc(297mm - 20mm)">
        <div class="doc-header">
          <div class="doc-title">ORDEN DE TRABAJO</div>
          <div class="doc-date-block">
            <div class="doc-date-label">Fecha</div>
            <div class="doc-date-val">${fechaFmt}</div>
          </div>
        </div>
        <div class="ubic-grid">
          <div class="ubic-box rem">
            <span class="ubic-badge rem">Remitente</span>
            <div class="ubic-empresa">EMPRESA: ${emp.razon}</div>
            <div class="ubic-dato">DIRECCIÓN: ${orig.dir||'—'}<br>POBLACIÓN: ${orig.pob||'—'}<br>COD. POSTAL: ${orig.cp||'—'}<br>TELÉFONO: ${orig.tel||'—'}<br>N.I.F.: ${emp.nif}</div>
          </div>
          <div class="ubic-box dst">
            <span class="ubic-badge dst">Destino</span>
            <div class="ubic-empresa">EMPRESA: ${emp.razon}</div>
            <div class="ubic-dato">DIRECCIÓN: ${dest.dir||'—'}<br>POBLACIÓN: ${dest.pob||'—'}<br>COD. POSTAL: ${dest.cp||'—'}<br>TELÉFONO: ${dest.tel||'—'}<br>N.I.F.: ${emp.nif}</div>
          </div>
        </div>
        <div class="cond-section">
          <div class="cond-title">Datos del Conductor y Vehículo</div>
          <div class="cond-grid">
            <div class="cond-campo"><div class="cond-label">Nombre completo</div><div class="cond-val">${operario}</div></div>
            <div class="cond-campo"><div class="cond-label">DNI / NIE</div><div class="cond-val">${conductor ? conductor.dni : '—'}</div></div>
            <div class="cond-campo"><div class="cond-label">Matrícula vehículo</div><div class="cond-val">${matricula}</div></div>
            <div class="cond-campo"><div class="cond-label">Ruta</div><div class="cond-val">${ruta.origen} → ${ruta.destino}</div></div>
            <div class="cond-campo"><div class="cond-label">Nº Usuario</div><div class="cond-val">${conductor ? conductor.numUsuario : '—'}</div></div>
            <div class="cond-campo"><div class="cond-label">Turno</div><div class="cond-val">${turnoActual === 'MANANA' ? 'MAÑANA' : turnoActual}</div></div>
          </div>
        </div>
        <div class="obs-box"><div class="obs-label">Observaciones</div></div>
        <div class="firmas">
          <div class="firma-box"><div class="firma-label">Firma Conductor</div></div>
          <div class="firma-box">${sello ? `<img src="${sello}" style="max-height:70px;max-width:160px;object-fit:contain">` : `<div style="font-size:11px;color:#aaa;padding-top:20px">${emp.razon}</div>`}</div>
        </div>
      </div>`;
  }).join('');

  // Usar iframe oculto en lugar de window.open (evita bloqueo de popups)
  let frame = document.getElementById('print-orden-frame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'print-orden-frame';
    frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;visibility:hidden;';
    document.body.appendChild(frame);
  }

  const htmlContent = `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>Orden de Trabajo · ${matricula}</title>
    <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
      @page { size: A4 portrait; margin: 4mm; }
      * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
      body { font-family:'Barlow',sans-serif; background:white; padding:6mm; }
      .doc-header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #1a1a2e; padding-bottom:12px; margin-bottom:20px; }
      .doc-title { font-size:22px; font-weight:900; letter-spacing:2px; color:#1a1a2e; }
      .doc-date-block { text-align:right; }
      .doc-date-label { font-size:9px; font-weight:800; color:#999; letter-spacing:1px; text-transform:uppercase; }
      .doc-date-val { font-size:14px; font-weight:700; color:#1a1a2e; }
      .ubic-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:20px; }
      .ubic-box { border:2px solid #e0e0e0; border-radius:9px; padding:13px; }
      .ubic-box.rem { border-color:#1a1a2e; } .ubic-box.dst { border-color:#e84545; }
      .ubic-badge { font-size:9px; font-weight:800; letter-spacing:2px; padding:3px 8px; border-radius:4px; display:inline-block; margin-bottom:9px; text-transform:uppercase; }
      .ubic-badge.rem { background:#1a1a2e; color:white; } .ubic-badge.dst { background:#e84545; color:white; }
      .ubic-empresa { font-size:12px; font-weight:800; color:#1a1a2e; margin-bottom:5px; }
      .ubic-dato { font-size:11px; color:#555; line-height:1.85; }
      .cond-section { background:#f5f5fa; border-radius:9px; padding:14px; }
      .cond-title { font-size:10px; font-weight:800; letter-spacing:2px; color:#1a1a2e; margin-bottom:12px; border-bottom:2px solid #1a1a2e; padding-bottom:6px; text-transform:uppercase; }
      .cond-grid { display:grid; grid-template-columns:1fr 1fr; gap:13px; }
      .cond-label { font-size:9px; font-weight:800; color:#999; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; }
      .cond-val { font-size:13px; font-weight:700; color:#1a1a2e; border-bottom:1.5px solid #ccc; padding-bottom:5px; min-height:24px; }
      .obs-box { margin-top:20px; border:1.5px dashed #ddd; border-radius:7px; padding:12px; min-height:65px; }
      .obs-label { font-size:9px; font-weight:800; letter-spacing:1.5px; color:#ccc; margin-bottom:5px; text-transform:uppercase; }
      .firmas { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:auto; padding-top:20px; }
      .firma-box { border-top:2px solid #ccc; padding-top:8px; text-align:center; min-height:60px; display:flex; align-items:flex-end; justify-content:center; }
      .firma-label { font-size:10px; font-weight:700; color:#aaa; letter-spacing:1px; text-transform:uppercase; }
    </style>
  </head><body>${bloques}</body></html>`;

  frame.onload = function() {
    // Marcar la matrícula como orden impresa
    const _impKey = `${(matricula||'').trim().toUpperCase()}|${turnoActual.toUpperCase()}|${fechaActual}`;
    _ordenesImpresas.add(_impKey);
    // Actualizar el botón de esa fila sin re-renderizar toda la tabla
    const btns = document.querySelectorAll(`.btn-print-row[data-mat="${CSS.escape((matricula||''). trim().toUpperCase())}"]`);
    btns.forEach(b => {
      b.classList.remove('pendiente');
      b.classList.add('impresa');
      b.title = '✓ Orden ya impresa';
    });
    frame.contentWindow.focus();
    // Ocultar modal de carga justo antes de abrir el diálogo de impresión
    const _mg = document.getElementById('modal-generando-orden');
    if (_mg) _mg.classList.remove('visible');
    frame.contentWindow.print();
    frame.onload = null;
  };

  frame.srcdoc = htmlContent;
}

// ════════════════════════════════════════════════════════════════════════════
// LOG DE IMPRESIONES
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// SINCRONIZAR ÓRDENES IMPRESAS DESDE SHEETS
// Consulta el log del día/turno actual y actualiza _ordenesImpresas
// Se llama al cargar el cuadrante y en cada ciclo de sync
// ════════════════════════════════════════════════════════════════════════════
// Carga repostajes pendientes y actualiza _repostajesPendientesMat
// para que renderTabla muestre el badge correcto en columna Nº Tarjeta
async function sincronizarRepostajesPendientes() {
  if (!APPS_SCRIPT_URL) return;
  try {
    const resp = await fetch(APPS_SCRIPT_URL + '?accion=cargarRepostajesPendientes&_t=' + Date.now(), {
      redirect: 'follow', signal: AbortSignal.timeout(6000),
      cache: 'no-store'
    });
    if (!resp.ok) return;
    const json = await resp.json();
    _repostajesPendientesMat = {};
    if (json.ok && json.filas) {
      json.filas.forEach(f => {
        const mat = (f.matricula||'').trim().toUpperCase();
        if (mat) _repostajesPendientesMat[mat] = f;
      });
    }
  } catch(e) { /* sin conexión — no crítico */ }
}

// Carga repostajes de la fecha actual y actualiza _repostajesFechaMat
// para mostrar el nº de tarjeta en cuadrantes de días anteriores
async function sincronizarRepostajesFecha() {
  if (!APPS_SCRIPT_URL || !fechaActual) return;
  _repostajesFechaMat = {};
  try {
    const url = `${APPS_SCRIPT_URL}?accion=cargarRepostajes&desde=${encodeURIComponent(fechaActual)}&hasta=${encodeURIComponent(fechaActual)}&_t=${Date.now()}`;
    const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!resp.ok) return;
    const json = await resp.json();
    if (json.ok && json.filas) {
      json.filas.forEach(f => {
        const mat = (f.matricula||'').trim().toUpperCase();
        if (mat) {
          // Si hay varios repostajes del mismo día/matrícula, guardar el más reciente (último)
          _repostajesFechaMat[mat] = f;
        }
      });
    }
  } catch(e) { /* sin conexión — no crítico */ }
}

async function sincronizarOrdenesImpresas() {
  if (!APPS_SCRIPT_URL) return;
  try {
    const url = `${APPS_SCRIPT_URL}?accion=cargarLog&desde=${encodeURIComponent(fechaActual)}&hasta=${encodeURIComponent(fechaActual)}`;
    const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return;
    const json = await resp.json();
    const filas = json.filas || [];

    // Reconstruir el Set desde cero con lo que hay en Sheets
    _ordenesImpresas.clear();
    filas.forEach(f => {
      const turnoLog = (f.turno || '').trim().toUpperCase();
      const matLog   = (f.matricula || '').trim().toUpperCase();
      if (!matLog || !turnoLog) return;

      // La fecha puede llegar como YYYY-MM-DD, como ISO timestamp, o vacía
      // Sheets a veces devuelve fechas como "2026-06-10T22:00:00.000Z"
      // Necesitamos extraer siempre YYYY-MM-DD en hora local española (UTC+1/+2)
      let fechaFinal = fechaActual;
      const fechaRaw = (f.fecha || '').trim();
      if (fechaRaw) {
        if (fechaRaw.includes('T')) {
          // Es un ISO timestamp — convertir a fecha local sumando offset
          const d = new Date(fechaRaw);
          // Usar fecha local en España (Europe/Madrid) — o simplemente sumar 1 día si es T22:xx UTC
          // Método robusto: formatear como YYYY-MM-DD en zona local
          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
          fechaFinal = local.toISOString().slice(0, 10);
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) {
          fechaFinal = fechaRaw;
        }
      }
      _ordenesImpresas.add(`${matLog}|${turnoLog}|${fechaFinal}`);
    });


    // Actualizar visualmente los botones de orden sin re-renderizar toda la tabla
    document.querySelectorAll('.btn-print-row').forEach(btn => {
      const mat = (btn.dataset.mat || '').trim().toUpperCase();
      if (!mat) return;
      const impresa = _ordenesImpresas.has(`${mat}|${turnoActual.toUpperCase()}|${fechaActual}`);
      const asignado = !!(datos[`${mat}|${turnoActual}|${fechaActual}`] || {}).operario;
      btn.classList.toggle('impresa', impresa);
      btn.classList.toggle('pendiente', !impresa && asignado);
      btn.title = impresa ? '✓ Orden ya impresa' : (asignado ? 'Pendiente de imprimir' : 'Imprimir orden de trabajo');
    });
  } catch(e) { console.warn('sincronizarOrdenesImpresas error:', e); }
}

async function registrarLog(matricula, operario, empresa, ruta) {
  if (!APPS_SCRIPT_URL || !usuarioActual) return;
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: {'Content-Type':'text/plain'},
      body: JSON.stringify({
        accion: 'registrarLog',
        log: {
          timestamp:         new Date().toISOString(),
          numUsuario:        usuarioActual.numUsuario,
          nombreResponsable: usuarioActual.nombre,
          matricula, operario, empresa, ruta,
          turno: turnoActual, fecha: fechaActual
        }
      }), redirect:'follow'
    });
  } catch(e) { console.warn('No se pudo registrar log:', e); }
}

async function registrarReasignacion(matricula, operarioAnterior, hora) {
  if (!APPS_SCRIPT_URL || !usuarioActual) return;
  const dActual = getDato(matricula);
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: {'Content-Type':'text/plain'},
      body: JSON.stringify({
        accion: 'registrarReasignacion',
        reasignacion: {
          timestamp:        new Date().toISOString(),
          fecha:            fechaActual,
          turno:            turnoActual,
          matricula,
          operario:         operarioAnterior,
          resp_entrega:     dActual.resp_entrega || '',
          resp_recibe:      usuarioActual.nombre,
          hora_entrega:     dActual.hora_entrega || '',
          hora_reasignacion: hora,
          numUsuario:       usuarioActual.numUsuario,
          nombreResponsable: usuarioActual.nombre,
        }
      }), redirect:'follow'
    });
  } catch(e) { console.warn('No se pudo registrar reasignación:', e); }
}

let reasigCache = [];

async function cargarReasignaciones() {
  if (!APPS_SCRIPT_URL) return;
  const desde   = document.getElementById('reasig-fecha-desde').value;
  const hasta   = document.getElementById('reasig-fecha-hasta').value;
  const filtroM = document.getElementById('reasig-filtro-matricula').value.trim().toUpperCase();
  const tbody   = document.getElementById('reasig-tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="hist-empty">⏳ Cargando datos un momento por favor…</td></tr>';
  try {
    const url = `${APPS_SCRIPT_URL}?accion=cargarReasignaciones&desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&matricula=${encodeURIComponent(filtroM)}`;
    const resp = await fetch(url, { redirect:'follow' });
    const json = await resp.json();
    reasigCache = json.filas || [];
    renderReasignaciones();
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="9" class="hist-empty">Error: ${e.message}</td></tr>`;
  }
}

function renderReasignaciones() {
  const tbody = document.getElementById('reasig-tbody');
  if (!reasigCache.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="hist-empty">Sin reasignaciones en este período.</td></tr>';
    return;
  }
  tbody.innerHTML = reasigCache.map((f, idx) => `<tr>
    <td>${f.timestamp ? new Date(f.timestamp).toLocaleString('es-ES') : f.timestamp}</td>
    <td>${f.turno === 'MANANA' ? 'MAÑANA' : (f.turno||'—')}</td>
    <td class="mat">${f.matricula||'—'}</td>
    <td style="font-weight:700;color:#e84545">${f.operario||'—'}</td>
    <td>${f.resp_entrega||'—'}</td>
    <td style="font-weight:700">${f.resp_recibe||'—'}</td>
    <td>${fmtHora(f.hora_entrega)}</td>
    <td style="font-weight:800;color:#b45309">${fmtHora(f.hora_reasignacion)}</td>
    <td class="col-acciones" style="text-align:center">
      <button class="btn-item-action danger" onclick="eliminarReasignacion(${idx})" title="Eliminar registro" style="font-size:13px;padding:3px 8px">🗑</button>
    </td>
  </tr>`).join('');
}

function exportarReasignacionesCSV() {
  if (!reasigCache.length) { mostrarToast('Sin datos', 'info'); return; }
  const campos = ['timestamp','fecha','turno','matricula','operario','resp_entrega','resp_recibe','hora_entrega','hora_reasignacion'];
  const csv = [campos.join(';'), ...reasigCache.map(f => campos.map(c => `"${(f[c]||'').replace(/"/g,'""')}"`).join(';'))].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = `reasignaciones_${Date.now()}.csv`;
  a.click();
}

async function eliminarReasignacion(idx) {
  const f = reasigCache[idx];
  if (!f) return;
  if (!APPS_SCRIPT_URL) { mostrarToast('Sin URL de Apps Script configurada', 'error'); return; }

  const confirmado = await new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
    ov.innerHTML = `
      <div style="background:white;border-radius:18px;padding:32px 28px 24px;width:400px;max-width:95vw;box-shadow:0 32px 80px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;animation:nv-in 0.22s cubic-bezier(.34,1.56,.64,1)">
        <div style="font-size:36px;margin-bottom:10px;">🗑️</div>
        <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:6px;">¿Eliminar este registro de reasignación?</div>
        <div style="font-size:12px;color:#8899aa;margin-bottom:14px;">
          <span style="font-weight:700;color:#1a1a2e">${f.matricula||'—'}</span> · ${f.timestamp ? new Date(f.timestamp).toLocaleString('es-ES') : ''}
        </div>
        <div style="background:#fff5f5;border:1px solid #ffd0d0;border-radius:9px;padding:10px 14px;font-size:12px;color:#444;line-height:1.6;margin-bottom:16px;">
          <strong>Conductor anterior:</strong> ${f.operario||'—'}<br>
          <strong>Resp. entrega:</strong> ${f.resp_entrega||'—'} · <strong>Resp. recibe:</strong> ${f.resp_recibe||'—'}<br>
          <strong>Hora reasignación:</strong> ${fmtHora(f.hora_reasignacion)||'—'}
        </div>
        <div style="font-size:11px;color:#e84545;font-weight:700;margin-bottom:20px;">⚠️ Esta acción no se puede deshacer.</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="btn-relog-cancel" style="padding:10px 22px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>
          <button id="btn-relog-ok" style="padding:10px 22px;background:#e84545;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">🗑 Sí, eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#btn-relog-cancel').onclick = () => { document.body.removeChild(ov); resolve(false); };
    ov.querySelector('#btn-relog-ok').onclick     = () => { document.body.removeChild(ov); resolve(true); };
  });

  if (!confirmado) return;

  // Modal de "procesando" propio, para que no parezca que no pasa nada
  // (antes de que, si aplica, se dispare el modal grande de Cargando cuadrante)
  const loadingOverlay = document.createElement('div');
  loadingOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
  loadingOverlay.innerHTML = `
    <div style="background:white;border-radius:14px;padding:32px 36px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;min-width:260px;">
      <svg width="36" height="36" viewBox="0 0 36 36" style="animation:spin 0.75s linear infinite;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;">
        <circle cx="18" cy="18" r="14" fill="none" stroke="#f0f2f5" stroke-width="4"/>
        <path d="M18 4 A14 14 0 0 1 32 18" fill="none" stroke="#e84545" stroke-width="4" stroke-linecap="round"/>
      </svg>
      <div style="font-size:14px;font-weight:800;color:#1a1a2e;margin-bottom:4px;">Eliminando reasignación…</div>
      <div style="font-size:11px;color:#8899aa;">Un momento por favor...</div>
    </div>`;
  document.body.appendChild(loadingOverlay);

  try {
    // El backend borra en un único paso la fila de Reasignaciones y el
    // snapshot congelado (reasignado = SI) correspondiente en Registros
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'eliminarReasignacion', timestamp: f.timestamp })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'Error en Sheets (Reasignaciones)');

    // Limpiar también la memoria local si coincide con el cuadrante abierto
    if (f.matricula && f.fecha && f.turno) {
      const key = `${f.matricula}|${f.turno}|${f.fecha}`;
      if (typeof datos !== 'undefined' && datos[key]) {
        datos[key] = { operario:'', resp_entrega:'', resp_recibe:'', hora_entrega:'', hora_devolucion:'', num_tarjeta:'', itv:'', incidencias:'' };
      }
    }

    reasigCache.splice(idx, 1);
    renderReasignaciones();
    mostrarToast('✓ Registro de reasignación eliminado', 'success');
    // Refrescar cuadrante para quitar el badge en tiempo real
    if (usuarioActual) cargarCuadrante();
  } catch(e) {
    mostrarToast('Error al eliminar: ' + e.message, 'error');
  } finally {
    document.body.removeChild(loadingOverlay);
  }
}

let logCache = [];

async function cargarLog() {
  if (!APPS_SCRIPT_URL) return;
  const desde   = document.getElementById('log-fecha-desde').value;
  const hasta   = document.getElementById('log-fecha-hasta').value;
  const filtroU = document.getElementById('log-filtro-usuario').value.trim().toUpperCase();
  const tbody   = document.getElementById('log-tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="hist-empty">⏳ Cargando datos un momento por favor…</td></tr>';
  try {
    const url = `${APPS_SCRIPT_URL}?accion=cargarLog&desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&filtroUsuario=${encodeURIComponent(filtroU)}`;
    const resp = await fetch(url, { redirect:'follow' });
    const json = await resp.json();
    logCache = json.filas || [];
    renderLog();
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="9" class="hist-empty">Error: ${e.message}</td></tr>`;
  }
}

function renderLog() {
  const tbody = document.getElementById('log-tbody');
  if (!logCache.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="hist-empty">Sin registros.</td></tr>';
    return;
  }
  tbody.innerHTML = logCache.map((f, idx) => `<tr>
    <td>${f.timestamp ? new Date(f.timestamp).toLocaleString('es-ES') : f.timestamp}</td>
    <td style="font-weight:800">${f.nombreResponsable||'—'}</td>
    <td>${f.numUsuario||'—'}</td>
    <td class="mat">${f.matricula||'—'}</td>
    <td>${f.operario||'—'}</td>
    <td>${f.empresa||'—'}</td>
    <td>${f.ruta||'—'}</td>
    <td>${f.turno||'—'}</td>
    <td class="col-acciones" style="text-align:center;white-space:nowrap">
      <button class="btn-item-action" onclick="verLogOrden(${idx})" title="Ver orden de trabajo" style="font-size:13px;padding:3px 8px;color:#1d4ed8;border-color:#bfdbfe;margin-right:3px">📄</button>
      <button class="btn-item-action danger" onclick="eliminarLog(${idx})" title="Eliminar registro del log" style="font-size:13px;padding:3px 8px">🗑</button>
    </td>
  </tr>`).join('');
}

function exportarLogCSV() {
  if (!logCache.length) { mostrarToast('Sin datos', 'info'); return; }
  const campos = ['timestamp','nombreResponsable','numUsuario','matricula','operario','empresa','ruta','turno','fecha'];
  const csv = [campos.join(';'), ...logCache.map(f => campos.map(c => `"${(f[c]||'').replace(/"/g,'""')}"`).join(';'))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = `log_ordenes_${fechaActual}.csv`;
  a.click();
}

// Vuelve a generar e imprimir/visualizar la orden de trabajo de una entrada del log
function verLogOrden(idx) {
  const f = logCache[idx];
  if (!f) return;

  // Buscar la empresa cuyo label coincida con el guardado en el log
  let empKey = Object.keys(EMPRESAS).find(k => EMPRESAS[k].label === f.empresa);
  if (!empKey) empKey = Object.keys(EMPRESAS)[0];
  const emp = EMPRESAS[empKey];

  // Buscar la ruta cuyo label coincida dentro de esa empresa
  let ruta = (emp.rutas || []).find(r => r.label === f.ruta);
  if (!ruta) {
    // Fallback: construir una ruta genérica a partir del texto guardado, ej "GAITE → PTA"
    const partes = (f.ruta || '').split('→').map(s => s.trim());
    ruta = { id: 'log', origen: partes[0] || '', destino: partes[1] || '', label: f.ruta || '—' };
  }

  // Usar la fecha del log (no la del filtro actual) para el documento
  const fechaOriginal = fechaActual;
  if (f.fecha) fechaActual = f.fecha;
  _ordenEmpresaKey = empKey;
  try {
    imprimirOrden(f.matricula, f.operario, emp, [ruta]);
  } finally {
    fechaActual = fechaOriginal;
  }
}

// Elimina una entrada del log de órdenes
async function eliminarLog(idx) {
  const f = logCache[idx];
  if (!f) return;
  if (!APPS_SCRIPT_URL) { mostrarToast('Sin URL de Apps Script configurada', 'error'); return; }

  await new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:5000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
    ov.innerHTML = `
      <div style="background:white;border-radius:18px;padding:32px 28px 24px;width:420px;max-width:95vw;box-shadow:0 32px 80px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;animation:nv-in 0.22s cubic-bezier(.34,1.56,.64,1)">
        <div style="font-size:36px;margin-bottom:10px;">🗑️</div>
        <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:6px;">¿Eliminar este registro del log?</div>
        <div style="font-size:11px;color:#8899aa;margin-bottom:14px;">
          <span style="font-weight:700;color:#1a1a2e">${f.matricula||'—'}</span>
          · ${f.timestamp ? new Date(f.timestamp).toLocaleString('es-ES') : ''}
        </div>
        <div style="background:#fff5f5;border:1px solid #ffd0d0;border-radius:9px;padding:10px 14px;font-size:12px;color:#444;line-height:1.6;margin-bottom:16px;">
          <strong>Responsable:</strong> ${f.nombreResponsable||'—'}<br>
          <strong>Operario:</strong> ${f.operario||'—'}<br>
          <strong>Empresa / Ruta:</strong> ${f.empresa||'—'} · ${f.ruta||'—'}
        </div>
        <div style="font-size:11px;color:#e84545;font-weight:700;margin-bottom:20px;">⚠️ Esta acción no se puede deshacer.</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="btn-log-cancel" style="padding:10px 22px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>
          <button id="btn-log-ok" style="padding:10px 22px;background:#e84545;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">🗑 Sí, eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#btn-log-cancel').onclick = () => { document.body.removeChild(ov); resolve(false); };
    ov.querySelector('#btn-log-ok').onclick     = () => { document.body.removeChild(ov); resolve(true);  };
  }).then(async (confirmado) => {
    if (!confirmado) return;

    const ovBorrando = document.createElement('div');
    ovBorrando.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:5100;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
    ovBorrando.innerHTML = `
      <div style="background:white;border-radius:16px;padding:32px 36px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;animation:nv-in 0.2s ease;min-width:260px">
        <div style="width:40px;height:40px;border:3px solid #f0f0f0;border-top-color:#e84545;border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto 16px"></div>
        <div style="font-size:14px;font-weight:800;color:#1a1a2e;">Borrando registro…</div>
        <div style="font-size:11px;color:#8899aa;margin-top:5px">${f.matricula||''} · ${f.timestamp ? new Date(f.timestamp).toLocaleString('es-ES') : ''}</div>
      </div>`;
    document.body.appendChild(ovBorrando);

    try {
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ accion: 'eliminarLog', timestamp: f.timestamp })
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Error en Sheets');

      logCache.splice(idx, 1);
      renderLog();
      await sincronizarOrdenesImpresas();
      mostrarToast('✓ Registro de log eliminado', 'success');
    } catch(e) {
      mostrarToast('Error al eliminar: ' + e.message, 'error');
    } finally {
      document.body.removeChild(ovBorrando);
    }
  });
}

