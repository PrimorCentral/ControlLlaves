// ════════════════════════════════════════════════════════════════════════════
// GESTIÓN CONDUCTORES (Panel Admin)
// ════════════════════════════════════════════════════════════════════════════
function renderAdminConductores() {
  const lista   = document.getElementById('admin-lista-conductores');
  const filtro  = (document.getElementById('cond-filtro')?.value || '').trim().toUpperCase();
  const filtroNave = (document.getElementById('cond-filtro-nave')?.value || '').trim().toUpperCase();

  // Poblar select de naves
  const naveSelect = document.getElementById('cond-filtro-nave');
  if (naveSelect) {
    const naves = [...new Set(CONDUCTORES.map(c => (c.nave||'').toUpperCase()).filter(Boolean))].sort();
    const valActual = naveSelect.value;
    naveSelect.innerHTML = '<option value="">Todas las naves</option>' + naves.map(n => `<option value="${n}" ${n===valActual?'selected':''}>${n}</option>`).join('');
  }

  // Stats
  const statsEl = document.getElementById('cond-stats');
  if (statsEl) {
    const total = CONDUCTORES.length;
    const naves = new Set(CONDUCTORES.map(c => c.nave||'').filter(Boolean));
    const sociedades = new Set(CONDUCTORES.map(c => c.sociedad||'').filter(Boolean));
    statsEl.innerHTML = `
      <div class="admin-stat-card">
        <div class="admin-stat-icon">👷</div>
        <div class="admin-stat-num">${total}</div>
        <div class="admin-stat-label">Conductores</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon">🏭</div>
        <div class="admin-stat-num">${naves.size}</div>
        <div class="admin-stat-label">Naves</div>
        <div class="admin-stat-sub">${[...naves].join(', ') || '—'}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon">🏢</div>
        <div class="admin-stat-num">${sociedades.size}</div>
        <div class="admin-stat-label">Sociedades</div>
        <div class="admin-stat-sub">${CONDUCTORES.filter(c => !c.turno).length} sin turno asignado</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-icon">🔍</div>
        <div class="admin-stat-num" id="cond-stat-visible">${total}</div>
        <div class="admin-stat-label">Resultados</div>
        <div class="admin-stat-sub">con filtro activo</div>
      </div>`;
  }

  // Filtrado
  let visible = CONDUCTORES.filter(c => {
    const matchFiltro = !filtro ||
      c.nombre.toUpperCase().includes(filtro) ||
      (c.dni||'').toUpperCase().includes(filtro) ||
      String(c.numUsuario).includes(filtro) ||
      (c.sociedad||'').toUpperCase().includes(filtro) ||
      (c.nave||'').toUpperCase().includes(filtro);
    const matchNave = !filtroNave || (c.nave||'').toUpperCase() === filtroNave;
    return matchFiltro && matchNave;
  });

  const visEl = document.getElementById('cond-stat-visible');
  if (visEl) visEl.textContent = visible.length;

  if (!visible.length) {
    lista.innerHTML = `<div style="padding:32px 16px;text-align:center;">
      <div style="font-size:36px;margin-bottom:10px">🔍</div>
      <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:4px">Sin resultados</div>
      <div style="font-size:11px;color:#8899aa">No hay conductores que coincidan con el filtro</div>
    </div>`;
    return;
  }

  // Agrupar por nave
  const porNave = {};
  visible.forEach(c => {
    const nave = c.nave || '— Sin nave';
    if (!porNave[nave]) porNave[nave] = [];
    porNave[nave].push(c);
  });

  lista.innerHTML = Object.entries(porNave).sort(([a],[b]) => a.localeCompare(b)).map(([nave, conductores]) => {
    const filas = conductores.map(c => {
      const idx = CONDUCTORES.indexOf(c);
      // Iniciales avatar
      const partes = c.nombre.trim().split(' ');
      const iniciales = (partes[0]?.[0]||'') + (partes[1]?.[0]||'');
      // Color determinístico por inicial
      const colores = ['#e84545','#3b5bdb','#16a34a','#d97706','#7c3aed','#0369a1','#b91c1c','#065f46'];
      const col = colores[(c.nombre.charCodeAt(0)||0) % colores.length];
      return `<div class="admin-item cond-item" style="padding:10px 14px;align-items:center;">
        <div style="width:38px;height:38px;border-radius:10px;background:${col};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:white;flex-shrink:0;letter-spacing:0.5px;">${iniciales.toUpperCase()}</div>
        <div style="display:flex;flex-direction:column;flex:1;min-width:0;gap:2px;">
          <div style="font-size:13px;font-weight:900;color:#1a1a2e;line-height:1.2;">${esc(c.nombre)}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-size:9px;font-weight:800;color:#7c3aed;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:4px;padding:1px 7px;">${esc(c.sociedad||'—')}</span>
          </div>
        </div>
        <div class="adm-seg turno-seg" role="group" aria-label="Turno de ${esc(c.nombre)}">
          ${[[1,'Turno 1'],[2,'Turno 2'],[0,'Sin turno']].map(([t, lbl]) =>
            `<button type="button" class="${(c.turno || 0) === t ? 'on' : ''}${t ? ' t' + t : ''}" onclick="cambiarTurnoConductor(${idx}, ${t})">${lbl}</button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap;">
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
            <span style="font-size:10px;font-weight:700;color:#1a1a2e;background:#f0f2f5;border:1px solid #e2e8f0;border-radius:5px;padding:2px 9px;letter-spacing:0.5px;">${esc(c.dni||'—')}</span>
            <span style="font-size:10px;font-weight:800;color:#3b5bdb;background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px;padding:2px 9px;">Nº ${esc(String(c.numUsuario))}</span>
          </div>
          <button class="btn-item-action btn-bloquear" onclick="eliminarConductorAdmin(${idx})" title="Eliminar conductor" style="font-size:11px;padding:6px 12px;">🗑 Eliminar</button>
        </div>
      </div>`;
    }).join('');

    return `<div style="margin-bottom:6px;">
      <div style="font-size:9px;font-weight:900;letter-spacing:2.5px;color:#6b7a94;text-transform:uppercase;padding:8px 4px 5px;display:flex;align-items:center;gap:7px;border-top:2px solid #f0f3f8;">
        📍 ${esc(nave)}
        <span style="font-size:9px;font-weight:700;background:#f0f2f5;color:#6b7a94;border-radius:4px;padding:1px 7px;border:1px solid #e2e8f0;">${conductores.length} conductores</span>
      </div>
      ${filas}
    </div>`;
  }).join('');
}

// Turno (equipo) del conductor: se guarda al momento en Supabase
async function cambiarTurnoConductor(idx, turno) {
  const c = CONDUCTORES[idx];
  if (!c) return;
  if (await guardarTurnoConductor(c.numUsuario, turno || null)) {
    mostrarToast(`✓ ${c.nombre}: ${turno ? 'Turno ' + turno : 'sin turno'}`, 'success');
  }
  renderAdminConductores();
}

function exportarConductoresPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = 297, PH = 210;
  const ML = 14, MR = 14, MT = 14;
  const CW = PW - ML - MR;
  let y = MT;

  // Paleta
  const ROJO   = [232, 69, 69];
  const OSCURO = [26, 26, 46];
  const GRIS   = [248, 249, 252];
  const GRISL  = [225, 228, 235];
  const TEXTO  = [80, 90, 110];
  const BLANCO = [255, 255, 255];

  // ── Cabecera ─────────────────────────────────────────────────────────────
  doc.setFillColor(...ROJO);
  doc.rect(0, 0, PW, 26, 'F');
  doc.setFillColor(...OSCURO);
  doc.rect(0, 26, PW, 3, 'F');

  doc.setTextColor(...BLANCO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('GESTION DE FLOTA · PRIMOR', ML, 11);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('LISTADO DE CONDUCTORES POR NAVE', ML, 18);

  const hoy = new Date();
  const fechaStr = hoy.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const horaStr  = hoy.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  doc.setFontSize(8);
  doc.text(`Generado: ${fechaStr} a las ${horaStr}`, PW - MR, 18, { align: 'right' });

  y = 36;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalCond  = CONDUCTORES.length;
  const navesSet   = [...new Set(CONDUCTORES.map(c => c.nave || 'Sin nave').filter(Boolean))].sort();
  const sociedades = [...new Set(CONDUCTORES.map(c => c.sociedad || '').filter(Boolean))];

  const statW = (CW - 8) / 3;
  const statsData = [
    { label: 'TOTAL CONDUCTORES', val: String(totalCond) },
    { label: 'NAVES',             val: String(navesSet.length) },
    { label: 'SOCIEDADES',        val: String(sociedades.length) },
  ];
  statsData.forEach((s, i) => {
    const sx = ML + i * (statW + 4);
    doc.setFillColor(...GRIS);
    doc.roundedRect(sx, y, statW, 14, 2, 2, 'F');
    doc.setDrawColor(...GRISL);
    doc.setLineWidth(0.3);
    doc.roundedRect(sx, y, statW, 14, 2, 2, 'S');
    doc.setTextColor(...ROJO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(s.val, sx + statW / 2, y + 7, { align: 'center' });
    doc.setTextColor(...TEXTO);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(s.label, sx + statW / 2, y + 12, { align: 'center' });
  });
  y += 20;

  // ── Columnas (landscape: más espacio) ────────────────────────────────────
  const cols = [
    { label: 'CONDUCTOR',  x: ML,       w: 80 },
    { label: 'DNI / NIE',  x: ML + 81,  w: 38 },
    { label: 'N. USUARIO', x: ML + 120, w: 30 },
    { label: 'SOCIEDAD',   x: ML + 151, w: CW - 151 },
  ];
  const ROW_H   = 8;
  const THEAD_H = 7;

  function dibujarCabeceraTabla() {
    doc.setFillColor(...GRISL);
    doc.rect(ML, y, CW, THEAD_H, 'F');
    doc.setTextColor(...OSCURO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    cols.forEach(col => doc.text(col.label, col.x + 2, y + 5));
    y += THEAD_H;
  }

  // ── Datos por nave ────────────────────────────────────────────────────────
  const porNave = {};
  CONDUCTORES.forEach(c => {
    const nave = c.nave || 'Sin nave';
    if (!porNave[nave]) porNave[nave] = [];
    porNave[nave].push(c);
  });

  Object.entries(porNave).sort(([a], [b]) => a.localeCompare(b)).forEach(([nave, conductores]) => {
    // Salto de página si no cabe nave + thead + 2 filas
    if (y + THEAD_H + ROW_H * 2 + 12 > PH - 14) {
      doc.addPage();
      y = MT;
    }

    // Cabecera de nave
    doc.setFillColor(...OSCURO);
    doc.rect(ML, y, CW, 8, 'F');
    doc.setTextColor(...BLANCO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`NAVE: ${nave.toUpperCase()}`, ML + 4, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${conductores.length} conductor${conductores.length !== 1 ? 'es' : ''}`, PW - MR - 2, y + 5.5, { align: 'right' });
    y += 10;

    dibujarCabeceraTabla();

    conductores.forEach((c, ri) => {
      if (y + ROW_H > PH - 14) {
        doc.addPage();
        y = MT;
        dibujarCabeceraTabla();
      }

      if (ri % 2 === 0) {
        doc.setFillColor(252, 252, 254);
        doc.rect(ML, y, CW, ROW_H, 'F');
      }
      doc.setDrawColor(...GRISL);
      doc.setLineWidth(0.2);
      doc.line(ML, y + ROW_H, ML + CW, y + ROW_H);

      doc.setTextColor(...OSCURO);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(c.nombre || '—', cols[0].x + 2, y + 5.5, { maxWidth: cols[0].w - 3 });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXTO);
      doc.text(c.dni || '—',              cols[1].x + 2, y + 5.5);
      doc.text(`N. ${c.numUsuario||'—'}`, cols[2].x + 2, y + 5.5);
      doc.text(c.sociedad || '—',         cols[3].x + 2, y + 5.5, { maxWidth: cols[3].w - 3 });

      y += ROW_H;
    });

    y += 8;
  });

  // ── Pie en todas las páginas ──────────────────────────────────────────────
  const totalPags = doc.getNumberOfPages();
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p);
    doc.setFillColor(...OSCURO);
    doc.rect(0, PH - 9, PW, 9, 'F');
    doc.setTextColor(...BLANCO);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Gestion de Flota · Primor — Documento generado automaticamente', ML, PH - 3.5);
    doc.text(`Pagina ${p} de ${totalPags}`, PW - MR, PH - 3.5, { align: 'right' });
  }

  const nombre = `conductores_${hoy.toISOString().slice(0, 10)}.pdf`;
  doc.save(nombre);
  mostrarToast('PDF generado correctamente', 'success');
}

function exportarFlotaPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = 297, PH = 210;
  const ML = 14, MR = 14, MT = 14;
  const CW = PW - ML - MR;
  let y = MT;

  // Paleta
  const ROJO   = [232, 69, 69];
  const OSCURO = [26, 26, 46];
  const GRIS   = [248, 249, 252];
  const GRISL  = [225, 228, 235];
  const TEXTO  = [80, 90, 110];
  const BLANCO = [255, 255, 255];
  const VERDE  = [22, 163, 74];
  const AMBAR  = [217, 119, 6];

  // ── Cabecera ─────────────────────────────────────────────────────────────
  doc.setFillColor(...ROJO);
  doc.rect(0, 0, PW, 26, 'F');
  doc.setFillColor(...OSCURO);
  doc.rect(0, 26, PW, 3, 'F');

  doc.setTextColor(...BLANCO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('GESTION DE FLOTA · PRIMOR', ML, 11);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('LISTADO DE VEHICULOS ACTIVOS POR NAVE', ML, 18);

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fechaStr = hoy.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const horaStr  = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  doc.setFontSize(8);
  doc.text(`Generado: ${fechaStr} a las ${horaStr}`, PW - MR, 18, { align: 'right' });

  y = 36;

  // ── Stats (igual que el panel de administración en pantalla) ───────────────
  let total = 0, restringidos = 0, alquiler = 0, bloqueados = 0, itvAlerta = 0;
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

  const statW = (CW - 12) / 4;
  const statsData = [
    { label: 'VEHICULOS ACTIVOS', val: String(total) },
    { label: 'EN ALQUILER',       val: String(alquiler) },
    { label: 'BLOQUEADOS',        val: String(bloqueados) },
    { label: 'ITV PROXIMAS (60D)', val: String(itvAlerta) },
  ];
  statsData.forEach((s, i) => {
    const sx = ML + i * (statW + 4);
    doc.setFillColor(...GRIS);
    doc.roundedRect(sx, y, statW, 14, 2, 2, 'F');
    doc.setDrawColor(...GRISL);
    doc.setLineWidth(0.3);
    doc.roundedRect(sx, y, statW, 14, 2, 2, 'S');
    doc.setTextColor(...ROJO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(s.val, sx + statW / 2, y + 7, { align: 'center' });
    doc.setTextColor(...TEXTO);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(s.label, sx + statW / 2, y + 12, { align: 'center' });
  });
  y += 20;

  // ── Columnas ──────────────────────────────────────────────────────────────
  const cols = [
    { label: 'MATRICULA',        x: ML,       w: 42 },
    { label: 'TIPO',             x: ML + 43,  w: 55 },
    { label: 'PROVEEDOR / NOTA', x: ML + 99,  w: 45 },
    { label: 'ESTADO',           x: ML + 145, w: 42 },
    { label: 'ITV',              x: ML + 188, w: CW - 188 },
  ];
  const ROW_H   = 8;
  const THEAD_H = 7;

  function dibujarCabeceraTabla() {
    doc.setFillColor(...GRISL);
    doc.rect(ML, y, CW, THEAD_H, 'F');
    doc.setTextColor(...OSCURO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    cols.forEach(col => doc.text(col.label, col.x + 2, y + 5));
    y += THEAD_H;
  }

  // ── Datos por nave (solo vehículos activos, sin dar de baja) ────────────────
  GRUPOS.forEach(grupo => {
    const activos = grupo.vehiculos.filter(v => !v.archivado);
    if (!activos.length) return;

    if (y + THEAD_H + ROW_H * 2 + 12 > PH - 14) {
      doc.addPage();
      y = MT;
    }

    doc.setFillColor(...OSCURO);
    doc.rect(ML, y, CW, 8, 'F');
    doc.setTextColor(...BLANCO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`NAVE: ${(grupo.nombre||'').toUpperCase()}`, ML + 4, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${activos.length} vehiculo${activos.length !== 1 ? 's' : ''}`, PW - MR - 2, y + 5.5, { align: 'right' });
    y += 10;

    dibujarCabeceraTabla();

    activos.forEach((v, ri) => {
      if (y + ROW_H > PH - 14) {
        doc.addPage();
        y = MT;
        dibujarCabeceraTabla();
      }

      if (ri % 2 === 0) {
        doc.setFillColor(252, 252, 254);
        doc.rect(ML, y, CW, ROW_H, 'F');
      }
      doc.setDrawColor(...GRISL);
      doc.setLineWidth(0.2);
      doc.line(ML, y + ROW_H, ML + CW, y + ROW_H);

      // Estado + color
      let estadoTxt, estadoColor;
      if (v.bloqueado)        { estadoTxt = 'Bloqueado';       estadoColor = ROJO; }
      else if (v.restringido) { estadoTxt = 'Restringido';    estadoColor = AMBAR; }
      else                    { estadoTxt = 'En vigor';       estadoColor = VERDE; }

      // ITV texto
      let itvTxt = 'Sin fecha';
      if (v.itv_fin) {
        const fin = new Date(v.itv_fin + 'T00:00:00');
        const dias = Math.ceil((fin - hoy) / 86400000);
        const fechaFmt = fmtFechaITV(v.itv_fin);
        if (dias <= 0)       itvTxt = `Caducada · ${fechaFmt}`;
        else if (dias <= 60) itvTxt = `${dias}d · ${fechaFmt}`;
        else                 itvTxt = fechaFmt;
      }

      doc.setTextColor(...OSCURO);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(v.matricula || '—', cols[0].x + 2, y + 5.5, { maxWidth: cols[0].w - 3 });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXTO);
      doc.text(v.tipo || '—',              cols[1].x + 2, y + 5.5, { maxWidth: cols[1].w - 3 });
      doc.text(v.nota || '—',              cols[2].x + 2, y + 5.5, { maxWidth: cols[2].w - 3 });

      doc.setTextColor(...estadoColor);
      doc.setFont('helvetica', 'bold');
      doc.text(estadoTxt, cols[3].x + 2, y + 5.5, { maxWidth: cols[3].w - 3 });

      doc.setTextColor(...TEXTO);
      doc.setFont('helvetica', 'normal');
      doc.text(itvTxt, cols[4].x + 2, y + 5.5, { maxWidth: cols[4].w - 3 });

      y += ROW_H;
    });

    y += 8;
  });

  // ── Pie en todas las páginas ──────────────────────────────────────────────
  const totalPags = doc.getNumberOfPages();
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p);
    doc.setFillColor(...OSCURO);
    doc.rect(0, PH - 9, PW, 9, 'F');
    doc.setTextColor(...BLANCO);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Gestion de Flota · Primor — Documento generado automaticamente', ML, PH - 3.5);
    doc.text(`Pagina ${p} de ${totalPags}`, PW - MR, PH - 3.5, { align: 'right' });
  }

  const nombre = `flota_${hoy.toISOString().slice(0, 10)}.pdf`;
  doc.save(nombre);
  mostrarToast('PDF de flota generado correctamente', 'success');
}

function abrirModalNuevoConductor() {
  ['modal-cond-nombre','modal-cond-dni','modal-cond-num','modal-cond-sociedad','modal-cond-nave'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('modal-nuevo-conductor').style.display = 'flex';
  setTimeout(() => document.getElementById('modal-cond-nombre').focus(), 100);
}
function cerrarModalNuevoConductor() {
  document.getElementById('modal-nuevo-conductor').style.display = 'none';
}
function confirmarNuevoConductor() {
  const nombre   = document.getElementById('modal-cond-nombre').value.trim();
  const dni      = document.getElementById('modal-cond-dni').value.trim().toUpperCase();
  const num      = document.getElementById('modal-cond-num').value.trim();
  const sociedad = document.getElementById('modal-cond-sociedad').value.trim();
  const nave     = document.getElementById('modal-cond-nave').value.trim();
  if (!nombre) { mostrarToast('El nombre es obligatorio', 'error'); return; }
  if (!dni)    { mostrarToast('El DNI es obligatorio', 'error'); return; }
  if (!num)    { mostrarToast('El Nº de usuario es obligatorio', 'error'); return; }
  if (CONDUCTORES.some(c => String(c.numUsuario) === String(num))) { mostrarToast('Ese Nº de usuario ya existe', 'error'); return; }
  CONDUCTORES.push({ nombre, dni, numUsuario: num, sociedad, nave });
  cerrarModalNuevoConductor();
  renderAdminConductores();
  sincronizarConductoresConSheets().then(ok => {
    if (ok) {
      registrarAccion('ADMIN', 'Añadir conductor', `${nombre} · DNI ${dni} · Nº${num}`);
      mostrarToast(`✓ ${nombre} añadido`, 'success');
    }
  });
}
function añadirConductorAdmin() { abrirModalNuevoConductor(); }

function eliminarConductorAdmin(idx) {
  const c = CONDUCTORES[idx];
  if (!c) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:3000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:14px;padding:26px 26px 20px;width:360px;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;">
      <div style="font-size:22px;margin-bottom:10px">🗑️</div>
      <div style="font-size:14px;font-weight:900;color:#1a1a2e;margin-bottom:6px">¿Eliminar conductor?</div>
      <div style="font-size:12px;color:#556;margin-bottom:18px"><strong>${esc(c.nombre)}</strong> · DNI ${esc(c.dni)}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="del-cond-cancel" style="padding:8px 16px;background:#f4f5f8;color:#556;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:700;cursor:pointer">Cancelar</button>
        <button id="del-cond-confirm" style="padding:8px 16px;background:#e84545;color:white;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer">Sí, eliminar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#del-cond-cancel').onclick  = () => document.body.removeChild(overlay);
  overlay.querySelector('#del-cond-confirm').onclick = () => {
    document.body.removeChild(overlay);
    const numUsuarioBorrado = c.numUsuario;
    CONDUCTORES.splice(idx, 1);
    renderAdminConductores();
    eliminarConductorDeSheets(numUsuarioBorrado).then(ok => {
      if (ok) {
        registrarAccion('ADMIN', 'Eliminar conductor', `${c.nombre} · DNI ${c.dni}`);
        mostrarToast('Conductor eliminado', 'info');
      } else {
        CONDUCTORES.splice(idx, 0, c);
        renderAdminConductores();
      }
    });
  };
}

