// ════════════════════════════════════════════════════════════════════════════
// HISTORIAL
// ════════════════════════════════════════════════════════════════════════════
let historialCache = [];

async function cargarHistorial() {
  if (!APPS_SCRIPT_URL) return;
  const desde  = document.getElementById('hist-fecha-desde').value;
  const hasta  = document.getElementById('hist-fecha-hasta').value;
  const turno  = document.getElementById('hist-turno').value;
  const mat    = document.getElementById('hist-matricula').value.trim().toUpperCase();
  const tbody  = document.getElementById('hist-tbody');
  tbody.innerHTML = '<tr><td colspan="12" class="hist-empty">⏳ Cargando datos un momento por favor…</td></tr>';
  try {
    const url = `${APPS_SCRIPT_URL}?accion=historial&desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&turno=${encodeURIComponent(turno)}&matricula=${encodeURIComponent(mat)}`;
    const resp = await fetch(url, { redirect:'follow' });
    const json = await resp.json();
    historialCache = json.filas || [];
    renderHistorial();
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="12" class="hist-empty">Error: ${e.message}</td></tr>`;
  }
}

function renderHistorial() {
  const tbody = document.getElementById('hist-tbody');
  if (!historialCache.length) {
    tbody.innerHTML = '<tr><td colspan="13" class="hist-empty">Sin registros.</td></tr>';
    return;
  }

  // Normaliza hora: acepta "9:43", "09:43", ISO con T, descarta fechas puras
  function fmtHora(val) {
    if (!val) return '';
    const s = String(val).trim();
    if (!s || s === '0' || s === '00:00:00' || s === '00:00') return '';
    // Descartar si parece una fecha pura YYYY-MM-DD (sin hora)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    // Ya es HH:MM o H:MM (con o sin segundos)
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s.substring(0, 5);
    // ISO con T: puede ser epoch 1899 de Sheets o fecha completa con hora
    if (s.includes('T')) {
      try {
        const d = new Date(s);
        if (!isNaN(d)) {
          const useUTC = s.startsWith('1899');
          const h = String(useUTC ? d.getUTCHours() : d.getHours()).padStart(2,'0');
          const m = String(useUTC ? d.getUTCMinutes() : d.getMinutes()).padStart(2,'0');
          return (h === '00' && m === '00') ? '' : `${h}:${m}`;
        }
      } catch(e) {}
    }
    return '';
  }

  // Formatea fecha YYYY-MM-DD → DD/MM/AAAA
  function fmtFecha(val) {
    if (!val) return '';
    const s = String(val).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return s;
  }

  const CAMPOS_HORA = ['hora_entrega','hora_devolucion'];
  const campos = ['fecha','turno','matricula','tipo','operario','resp_entrega','resp_recibe','hora_entrega','hora_devolucion','num_tarjeta','itv','incidencias'];
  tbody.innerHTML = historialCache.map((f, idx) =>
    `<tr>${campos.map(c => {
      let val;
      if (c === 'fecha')              val = fmtFecha(f[c]);
      else if (CAMPOS_HORA.includes(c)) val = fmtHora(f[c]);
      else                            val = f[c] || '';
      return `<td class="${c==='matricula'?'mat':''}${!val?' vacio':''}">${val||'—'}</td>`;
    }).join('')}
    <td class="col-acciones" style="text-align:center;white-space:nowrap">
      <button class="btn-item-action danger" onclick="eliminarHistorial(${idx})" title="Eliminar registro" style="font-size:13px;padding:3px 8px">🗑</button>
    </td></tr>`
  ).join('');
}

function exportarCSV() {
  if (!historialCache.length) { mostrarToast('Sin datos', 'info'); return; }
  const campos = ['fecha','turno','matricula','tipo','operario','resp_entrega','resp_recibe','hora_entrega','hora_devolucion','num_tarjeta','itv','incidencias'];
  const csv = [campos.join(';'), ...historialCache.map(f => campos.map(c => `"${(f[c]||'').replace(/"/g,'""')}"`).join(';'))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = `historial_${fechaActual}.csv`;
  a.click();
}

// ── Poblar desplegables de matrícula en el panel admin ───────────────────────
function poblarSelectsMatricula() {
  const ids = ['hist-matricula','reasig-filtro-matricula','incid-filtro-matricula','repo-tab-filtro-matricula'];
  const matriculas = [];
  GRUPOS.forEach(g => g.vehiculos.forEach(v => { if (v.matricula) matriculas.push(v.matricula); }));
  matriculas.sort();
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Todas las matrículas</option>';
    matriculas.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m;
      if (m === current) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

// ── Trunca un texto con "…" para que quepa en un ancho dado (evita solapes entre filas) ──
function truncarTexto(doc, texto, maxW) {
  if (doc.getTextWidth(texto) <= maxW) return texto;
  let truncado = texto;
  while (truncado.length > 1 && doc.getTextWidth(truncado + '…') > maxW) {
    truncado = truncado.slice(0, -1);
  }
  return truncado + '…';
}

// ── Exportar PDF visual para cada pestaña ───────────────────────────────────
function exportarPDF(tipo) {
  const { jsPDF } = window.jspdf;

  const configs = {
    historial:      { cache: () => historialCache,    titulo: 'HISTORIAL DE REGISTROS',    color: [26,26,46],   accentR: 232, accentG: 69,  accentB: 69  },
    log:            { cache: () => logCache,          titulo: 'LOG DE ÓRDENES DE TRABAJO', color: [26,26,46],   accentR: 29,  accentG: 78,  accentB: 216 },
    reasignaciones: { cache: () => reasigCache,       titulo: 'REGISTRO DE REASIGNACIONES',color: [26,26,46],   accentR: 180, accentG: 83,  accentB: 9   },
    incidencias:    { cache: () => incidenciasCache,  titulo: 'REGISTRO DE INCIDENCIAS',   color: [26,26,46],   accentR: 232, accentG: 69,  accentB: 69  },
    repostajes:     { cache: () => repostajesCache,   titulo: 'REGISTRO DE REPOSTAJES',    color: [26,26,46],   accentR: 14,  accentG: 165, accentB: 233 },
  };

  const cfg   = configs[tipo];
  if (!cfg) return;
  const filas = cfg.cache();
  if (!filas || !filas.length) { mostrarToast('Sin datos para exportar', 'info'); return; }

  const columnas = {
    historial:      [
      { k:'fecha',          l:'Fecha',        w:20 },
      { k:'turno',          l:'Turno',        w:16, fmt: v => v==='MANANA'?'Mañana':v },
      { k:'matricula',      l:'Matrícula',    w:24 },
      { k:'tipo',           l:'Tipo',         w:22 },
      { k:'operario',       l:'Operario',     w:38 },
      { k:'resp_entrega',   l:'Resp. Entrega',w:34 },
      { k:'resp_recibe',    l:'Resp. Recibe', w:34 },
      { k:'hora_entrega',   l:'H.Entr.',      w:14 },
      { k:'hora_devolucion',l:'H.Dev.',       w:14 },
    ],
    log:            [
      { k:'fecha',             l:'Fecha',       w:20 },
      { k:'turno',             l:'Turno',       w:16, fmt: v => v==='MANANA'?'Mañana':v },
      { k:'nombreResponsable', l:'Responsable', w:38 },
      { k:'matricula',         l:'Matrícula',   w:22 },
      { k:'operario',          l:'Operario',    w:38 },
      { k:'empresa',           l:'Empresa',     w:36 },
      { k:'ruta',              l:'Ruta',        w:46 },
    ],
    reasignaciones: [
      { k:'fecha',             l:'Fecha',         w:20 },
      { k:'turno',             l:'Turno',         w:16, fmt: v => v==='MANANA'?'Mañana':v },
      { k:'matricula',         l:'Matrícula',     w:22 },
      { k:'operario',          l:'Cond. anterior',w:38 },
      { k:'resp_entrega',      l:'Resp. Entrega', w:34 },
      { k:'resp_recibe',       l:'Resp. Recibe',  w:34 },
      { k:'hora_entrega',      l:'H.Entr.',       w:14 },
      { k:'hora_reasignacion', l:'H.Reasig.',     w:14 },
    ],
    incidencias:    [
      { k:'fecha',       l:'Fecha',       w:20 },
      { k:'turno',       l:'Turno',       w:16, fmt: v => v==='MANANA'?'Mañana':v },
      { k:'matricula',   l:'Matrícula',   w:22 },
      { k:'responsable', l:'Responsable', w:38 },
      { k:'descripcion', l:'Descripción', w:68 },
      { k:'estado',      l:'Estado',      w:20, fmt: v => v==='COMPLETADO'?'Resuelto':'Pendiente' },
    ],
    repostajes:     [
      { k:'fecha',          l:'Fecha',      w:20 },
      { k:'matricula',      l:'Matrícula',  w:22 },
      { k:'usuario_chofer', l:'Chofer',     w:36 },
      { k:'kilometraje',    l:'Km',         w:18 },
      { k:'num_tarjeta',    l:'Tarjeta',    w:14 },
      { k:'hora_entrega',   l:'H.Entr.',    w:14 },
      { k:'hora_devolucion',l:'H.Dev.',     w:14 },
      { k:'gasoil_antes',   l:'Gsl Antes',  w:18 },
      { k:'gasoil_despues', l:'Gsl Desp.',  w:18 },
      { k:'ticket_ref',     l:'Ref. Ticket',w:24 },
      { k:'ticket_importe', l:'Importe',    w:18, fmt: v => (v && v !== '—') ? Number(v).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €' : '—' },
      { k:'estado',         l:'Estado',     w:20 },
    ],
  };

  const cols = columnas[tipo];
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const isLandscape = totalW > 160;
  const doc   = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageW = isLandscape ? 297 : 210;
  const pageH = isLandscape ? 210 : 297;
  const margin = 12;
  const contentW = pageW - margin * 2;

  const [r, g, b] = cfg.color;
  const [ar, ag, ab] = [cfg.accentR, cfg.accentG, cfg.accentB];

   const ahora = new Date();
  const fechaStr = ahora.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });
  const horaStr  = ahora.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });

  // ── Rango de fechas del filtro de búsqueda ──────────────────────────────
  const idsFiltroFecha = {
    historial:      { desde: 'hist-fecha-desde',     hasta: 'hist-fecha-hasta'     },
    log:            { desde: 'log-fecha-desde',      hasta: 'log-fecha-hasta'      },
    reasignaciones: { desde: 'reasig-fecha-desde',    hasta: 'reasig-fecha-hasta'   },
    incidencias:    { desde: 'incid-fecha-desde',     hasta: 'incid-fecha-hasta'    },
    repostajes:     { desde: 'repo-tab-fecha-desde',  hasta: 'repo-tab-fecha-hasta' },
  };
  const idsF     = idsFiltroFecha[tipo];
  const desdeISO = idsF ? document.getElementById(idsF.desde).value : '';
  const hastaISO = idsF ? document.getElementById(idsF.hasta).value : '';
  const fmtFecha = iso => iso ? iso.split('-').reverse().join('/') : '';
  const filtroFechaStr = (desdeISO && hastaISO)
    ? `Del ${fmtFecha(desdeISO)} al ${fmtFecha(hastaISO)}`
    : 'Todos los registros';

  let pageNum = 1;

  function drawHeader() {
    // Fondo cabecera
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageW, 22, 'F');
    // Acento lateral izquierdo
    doc.setFillColor(ar, ag, ab);
    doc.rect(0, 0, 5, 22, 'F');
    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(cfg.titulo, margin + 4, 14);
    // Rango de fechas filtrado, centrado en el hueco del medio
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(205, 212, 230);
    doc.text(filtroFechaStr, pageW / 2, 14, { align: 'center' });
    // Fecha generación
    doc.setFontSize(8);
    doc.setTextColor(180, 190, 210);
    doc.text(`Generado el ${fechaStr} a las ${horaStr}  ·  ${filas.length} registro(s)`, pageW - margin, 10, { align: 'right' });
    doc.text('Gestión de Flota · Primor', pageW - margin, 17, { align: 'right' });
  }

  function drawTableHeader(y) {
    // Fondo fila cabecera tabla
    doc.setFillColor(ar, ag, ab);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    let x = margin;
    const scale = contentW / totalW;
    cols.forEach(col => {
      const cw = col.w * scale;
      doc.text(col.l.toUpperCase(), x + 2, y + 5, { maxWidth: cw - 3 });
      x += cw;
    });
    return y + 7;
  }

  function drawFooter(pageNum) {
    doc.setFillColor(240, 242, 245);
    doc.rect(0, pageH - 8, pageW, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 160, 175);
    doc.text('Gestión de Flota · Primor', margin, pageH - 3);
    doc.text(`Página ${pageNum}`, pageW - margin, pageH - 3, { align: 'right' });
  }

  const scale = contentW / totalW;
  const rowH  = 6.5;
  const tableTop = 28;

  drawHeader();
  let y = drawTableHeader(tableTop);
  drawFooter(pageNum);

  filas.forEach((fila, fi) => {
    if (y + rowH > pageH - 12) {
      doc.addPage();
      pageNum++;
      drawHeader();
      y = drawTableHeader(tableTop);
      drawFooter(pageNum);
    }

    // Alternado de filas
    if (fi % 2 === 0) {
      doc.setFillColor(248, 249, 252);
      doc.rect(margin, y, contentW, rowH, 'F');
    }

    // Borde inferior sutil
    doc.setDrawColor(220, 224, 232);
    doc.setLineWidth(0.15);
    doc.line(margin, y + rowH, margin + contentW, y + rowH);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 35, 55);

    let x = margin;
    cols.forEach(col => {
      const cw = col.w * scale;
      let val = fila[col.k] || '—';
      // Formatear fecha ISO
      if (col.k === 'fecha' && val.length >= 10) val = val.substring(0,10).split('-').reverse().join('/');
      if (col.k === 'timestamp' && val.length > 10) {
        try { val = new Date(val).toLocaleString('es-ES', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch(e){}
      }
      if (col.fmt) val = col.fmt(val);
      // Color especial para estado
      if (col.k === 'estado') {
        if (val === 'PENDIENTE') doc.setTextColor(180, 83, 9);
        else if (val === 'COMPLETADO') doc.setTextColor(22, 120, 60);
        else doc.setTextColor(30, 35, 55);
      } else {
        doc.setTextColor(30, 35, 55);
      }
      doc.text(truncarTexto(doc, String(val), cw - 3), x + 2, y + rowH - 1.8);
      x += cw;
    });
    y += rowH;
  });

  // Línea de cierre tabla
  doc.setDrawColor(ar, ag, ab);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentW, y);

  doc.save(`${tipo}_${fechaStr.replace(/\//g,'-')}.pdf`);
}

async function eliminarHistorial(idx) {
  const f = historialCache[idx];
  if (!f) return;
  if (!APPS_SCRIPT_URL) { mostrarToast('Sin URL de Apps Script configurada', 'error'); return; }

  const turnoLabel = f.turno === 'MANANA' ? 'Mañana' : (f.turno || '—');

  // ── Modal confirmación ────────────────────────────────────────────────────
  await new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:5000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
    ov.innerHTML = `
      <div style="background:white;border-radius:18px;padding:32px 28px 24px;width:420px;max-width:95vw;box-shadow:0 32px 80px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;animation:nv-in 0.22s cubic-bezier(.34,1.56,.64,1)">
        <div style="font-size:36px;margin-bottom:10px;">🗑️</div>
        <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:6px;">¿Eliminar este registro?</div>
        <div style="font-size:11px;color:#8899aa;margin-bottom:14px;">
          <span style="font-weight:700;color:#1a1a2e">${f.matricula||'—'}</span>
          · ${f.fecha||''}
          · ${turnoLabel}
        </div>
        <div style="background:#fff5f5;border:1px solid #ffd0d0;border-radius:9px;padding:10px 14px;font-size:12px;color:#444;line-height:1.6;margin-bottom:16px;">
          <strong>Operario:</strong> ${f.operario||'—'}<br>
          <strong>Resp. entrega:</strong> ${f.resp_entrega||'—'}
        </div>
        <div style="font-size:11px;color:#e84545;font-weight:700;margin-bottom:20px;">⚠️ Se eliminará de la hoja Registros. Esta acción no se puede deshacer.</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="btn-hst-cancel" style="padding:10px 22px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>
          <button id="btn-hst-ok" style="padding:10px 22px;background:#e84545;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">🗑 Sí, eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#btn-hst-cancel').onclick = () => { document.body.removeChild(ov); resolve(false); };
    ov.querySelector('#btn-hst-ok').onclick     = () => { document.body.removeChild(ov); resolve(true);  };
  }).then(async (confirmado) => {
    if (!confirmado) return;

    // ── Modal "Borrando…" ─────────────────────────────────────────────────
    const ovBorrando = document.createElement('div');
    ovBorrando.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:5100;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
    ovBorrando.innerHTML = `
      <div style="background:white;border-radius:16px;padding:32px 36px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;animation:nv-in 0.2s ease;min-width:260px">
        <div style="width:40px;height:40px;border:3px solid #f0f0f0;border-top-color:#e84545;border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto 16px"></div>
        <div style="font-size:14px;font-weight:800;color:#1a1a2e;">Borrando registro…</div>
        <div style="font-size:11px;color:#8899aa;margin-top:5px">${f.matricula} · ${f.fecha}</div>
      </div>`;
    document.body.appendChild(ovBorrando);

    try {
      // eliminarFila → borra la fila incluso si tiene reasignado = SI
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          accion: 'eliminarFila',
          fila: { fecha: f.fecha, turno: f.turno, matricula: f.matricula }
        })
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Error en Sheets');

      // Actualizar memoria local si coincide con el cuadrante abierto
      const key = `${f.matricula}|${f.turno}|${f.fecha}`;
      if (datos[key]) {
        datos[key] = { operario:'', resp_entrega:'', resp_recibe:'', hora_entrega:'', hora_devolucion:'', num_tarjeta:'', itv:'', incidencias:'' };
      }

      renderTabla();

      // Borrar también las entradas del Log de Órdenes de este vehículo/fecha/turno,
      // y resincronizar inmediatamente el estado de los botones "Orden"
      // (misma lógica que el sync periódico, pero al instante)
      try {
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST', redirect: 'follow',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            accion: 'eliminarLogPorFiltro',
            matricula: f.matricula, fecha: f.fecha, turno: f.turno
          })
        });
        await sincronizarOrdenesImpresas();
      } catch(e) { console.warn('No se pudo limpiar el log de órdenes:', e); }

      historialCache.splice(idx, 1);
      renderHistorial();
      registrarAccion('CUADRANTE', 'Eliminar fila del cuadrante', `${f.matricula} · ${f.fecha} · turno ${f.turno} · conductor: ${f.operario||'—'}`);
      mostrarToast('✓ Registro eliminado', 'success');
    } catch(e) {
      mostrarToast('Error al eliminar: ' + e.message, 'error');
    } finally {
      document.body.removeChild(ovBorrando);
    }
  });
}

