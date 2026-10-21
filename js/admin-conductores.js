// ════════════════════════════════════════════════════════════════════════════
// GESTIÓN CONDUCTORES (Panel Admin)
// ════════════════════════════════════════════════════════════════════════════
// ── Utilidades de presentación ───────────────────────────────────────────────
// Los nombres se guardan en MAYÚSCULAS; en pantalla se muestran en formato nombre.
function _condNombreBonito(nombre) {
  const minus = ['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'E', 'DA', 'DO', 'DOS', 'DAS'];
  return String(nombre || '').trim().split(/\s+/).map((p, i) =>
    (i > 0 && minus.includes(p.toUpperCase()))
      ? p.toLowerCase()
      : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
  ).join(' ');
}
function _condIniciales(nombre) {
  const p = String(nombre || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}
function _condTurnoEtiqueta(turno) {
  if (turno === 1) return '<span class="cond-turno t1">Turno 1</span>';
  if (turno === 2) return '<span class="cond-turno t2">Turno 2</span>';
  return '<span class="cond-turno st">Sin turno</span>';
}

// ── Lista de conductores (tabla) ─────────────────────────────────────────────
function renderAdminConductores() {
  const lista = document.getElementById('admin-lista-conductores');
  if (!lista) return;
  const filtro      = (document.getElementById('cond-filtro')?.value || '').trim().toUpperCase();
  const filtroNave  = (document.getElementById('cond-filtro-nave')?.value || '').trim().toUpperCase();
  const filtroTurno = document.getElementById('cond-filtro-turno')?.value ?? '';

  // Poblar select de naves
  const navesLista = [...new Set(CONDUCTORES.map(c => (c.nave || '').toUpperCase()).filter(Boolean))].sort();
  const naveSelect = document.getElementById('cond-filtro-nave');
  if (naveSelect) {
    const valActual = naveSelect.value;
    naveSelect.innerHTML = '<option value="">Todas las naves</option>' +
      navesLista.map(n => `<option value="${esc(n)}" ${n === valActual ? 'selected' : ''}>${esc(n)}</option>`).join('');
  }

  // Resumen bajo el título
  const total = CONDUCTORES.length;
  const sociedades = new Set(CONDUCTORES.map(c => c.sociedad || '').filter(Boolean));
  const sinTurno = CONDUCTORES.filter(c => !c.turno).length;
  const resumen = document.getElementById('cond-resumen');
  if (resumen) {
    resumen.textContent = `${total} conductores · ${navesLista.length} naves · ${sociedades.size} sociedades · ${sinTurno} sin turno`;
  }

  // Filtrado
  const visible = CONDUCTORES.filter(c => {
    const matchFiltro = !filtro ||
      (c.nombre || '').toUpperCase().includes(filtro) ||
      (c.dni || '').toUpperCase().includes(filtro) ||
      String(c.numUsuario).includes(filtro) ||
      (c.sociedad || '').toUpperCase().includes(filtro) ||
      (c.nave || '').toUpperCase().includes(filtro);
    const matchNave  = !filtroNave || (c.nave || '').toUpperCase() === filtroNave;
    const matchTurno = filtroTurno === '' || String(c.turno || 0) === filtroTurno;
    return matchFiltro && matchNave && matchTurno;
  }).sort((a, b) =>
    (a.nave || '~').localeCompare(b.nave || '~') || (a.nombre || '').localeCompare(b.nombre || '', 'es')
  );

  const pie = document.getElementById('cond-pie');
  if (pie) {
    pie.textContent = visible.length
      ? `${visible.length} de ${total} conductores · pulsa una fila para abrir su ficha`
      : '';
  }

  if (!visible.length) {
    lista.innerHTML = `<div class="cond-vacio">
      <strong>Sin resultados</strong>
      <span>No hay conductores que coincidan con el filtro.</span>
    </div>`;
    return;
  }

  const filas = visible.map(c => {
    const idx = CONDUCTORES.indexOf(c);
    return `<tr class="cond-fila" onclick="abrirFichaConductor(${idx})">
      <td class="adm-mat cond-num">${esc(String(c.numUsuario ?? '—'))}</td>
      <td><button type="button" class="cond-nombre" onclick="event.stopPropagation();abrirFichaConductor(${idx})">${esc(_condNombreBonito(c.nombre))}</button></td>
      <td class="adm-mat cond-dni">${esc(c.dni || '—')}</td>
      <td>${esc(c.sociedad || '—')}</td>
      <td>${esc(c.nave || '—')}</td>
      <td>${_condTurnoEtiqueta(c.turno || 0)}</td>
      <td class="cond-chev"><svg class="adm-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></td>
    </tr>`;
  }).join('');

  lista.innerHTML = `<table class="adm-table cond-table">
    <thead><tr>
      <th>Nº</th><th>Conductor</th><th>DNI / NIE</th><th>Sociedad</th><th>Nave</th><th>Turno</th>
      <th><span class="adm-sr">Abrir ficha</span></th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>`;
}

// ── Ficha del conductor (modal) ──────────────────────────────────────────────
let _condFicha = null;   // { num, turno, foco }

function _condFichaConductor() {
  if (!_condFicha) return null;
  return CONDUCTORES.find(c => String(c.numUsuario) === _condFicha.num) || null;
}

function abrirFichaConductor(idx) {
  const c = CONDUCTORES[idx];
  if (!c) return;
  _condFicha = { num: String(c.numUsuario), turno: c.turno || 0, foco: document.activeElement };

  document.getElementById('ficha-cond-ini').textContent    = _condIniciales(c.nombre);
  document.getElementById('ficha-cond-num').textContent    = String(c.numUsuario);
  document.getElementById('ficha-cond-nombre').textContent = _condNombreBonito(c.nombre);
  document.getElementById('ficha-cond-in-nombre').value    = c.nombre || '';
  document.getElementById('ficha-cond-in-dni').value       = c.dni || '';
  document.getElementById('ficha-cond-in-num').textContent = String(c.numUsuario);
  document.getElementById('ficha-cond-in-sociedad').value  = c.sociedad || '';
  document.getElementById('ficha-cond-in-nave').value      = c.nave || '';
  _condPintarTurno();
  _condPintarHabituales(c);

  const guardar = document.getElementById('ficha-cond-guardar');
  guardar.disabled = false;
  guardar.textContent = 'Guardar cambios';

  document.getElementById('modal-ficha-conductor').style.display = 'flex';
  document.addEventListener('keydown', _condFichaTeclas, true);
  setTimeout(() => document.getElementById('ficha-cond-cerrar')?.focus(), 50);
}

function cerrarFichaConductor() {
  document.getElementById('modal-ficha-conductor').style.display = 'none';
  document.removeEventListener('keydown', _condFichaTeclas, true);
  const foco = _condFicha?.foco;
  _condFicha = null;
  if (foco && document.contains(foco)) foco.focus();
}

function _condFichaTeclas(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarFichaConductor(); }
}

function _condPintarTurno() {
  const cont = document.getElementById('ficha-cond-turno');
  if (!cont || !_condFicha) return;
  cont.innerHTML = [[1, 'Turno 1'], [2, 'Turno 2'], [0, 'Sin turno']].map(([t, lbl]) => {
    const on = _condFicha.turno === t;
    return `<button type="button" role="radio" aria-checked="${on}" class="${on ? 'on' : ''}" onclick="elegirTurnoFicha(${t})">${lbl}</button>`;
  }).join('');
}

function elegirTurnoFicha(turno) {
  if (!_condFicha) return;
  _condFicha.turno = turno;
  _condPintarTurno();
  document.querySelector('#ficha-cond-turno button.on')?.focus();
}

function _condPintarHabituales(c) {
  const sec  = document.getElementById('ficha-cond-hab-sec');
  const cont = document.getElementById('ficha-cond-habituales');
  if (!sec || !cont) return;
  if (typeof HABITUALES === 'undefined' || (typeof _habitualesTablaOk !== 'undefined' && !_habitualesTablaOk)) {
    sec.style.display = 'none';
    return;
  }
  sec.style.display = '';
  const mios = HABITUALES
    .filter(h => String(h.num_usuario) === String(c.numUsuario))
    .sort((a, b) => (a.suplente ? 1 : 0) - (b.suplente ? 1 : 0) || a.matricula.localeCompare(b.matricula));
  cont.innerHTML = mios.length
    ? mios.map(h => `<span class="cond-hab${h.suplente ? ' sup' : ''}">${esc(h.matricula)}${h.suplente ? '<em>suplente</em>' : ''}</span>`).join('')
    : '<span class="cond-hab-vacio">No es habitual de ningún vehículo.</span>';
}

async function guardarFichaConductor() {
  const c = _condFichaConductor();
  if (!c) { cerrarFichaConductor(); return; }

  const nombre   = document.getElementById('ficha-cond-in-nombre').value.trim().toUpperCase();
  const dni      = document.getElementById('ficha-cond-in-dni').value.trim().toUpperCase();
  const sociedad = document.getElementById('ficha-cond-in-sociedad').value.trim().toUpperCase();
  const nave     = document.getElementById('ficha-cond-in-nave').value.trim().toUpperCase();
  if (!nombre) { mostrarToast('El nombre es obligatorio', 'error'); return; }
  if (!dni)    { mostrarToast('El DNI es obligatorio', 'error'); return; }

  const cambiaDatos = nombre !== (c.nombre || '') || dni !== (c.dni || '') ||
                      sociedad !== (c.sociedad || '') || nave !== (c.nave || '');
  const cambiaTurno = (_condFicha.turno || 0) !== (c.turno || 0);
  if (!cambiaDatos && !cambiaTurno) { cerrarFichaConductor(); return; }

  const btn = document.getElementById('ficha-cond-guardar');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  let ok = true;
  if (cambiaDatos) {
    const { error } = await sb.from('conductores')
      .update({ nombre, dni, sociedad, nave })
      .eq('num_usuario', c.numUsuario);
    if (error) {
      ok = false;
      mostrarToast('⚠️ No se pudieron guardar los datos: ' + error.message, 'error');
    } else {
      const antes = c.nombre;
      Object.assign(c, { nombre, dni, sociedad, nave });
      if (typeof registrarAccion === 'function') {
        registrarAccion('ADMIN', 'Editar conductor', `${antes} → ${nombre} · DNI ${dni} · Nº${c.numUsuario}`);
      }
    }
  }
  if (ok && cambiaTurno) ok = await guardarTurnoConductor(c.numUsuario, _condFicha.turno);

  btn.disabled = false;
  btn.textContent = 'Guardar cambios';
  if (!ok) { renderAdminConductores(); return; }

  mostrarToast(`✓ ${_condNombreBonito(c.nombre)}: cambios guardados`, 'success');
  cerrarFichaConductor();
  renderAdminConductores();
}

function eliminarDesdeFichaConductor() {
  const c = _condFichaConductor();
  if (!c) return;
  const idx = CONDUCTORES.indexOf(c);
  cerrarFichaConductor();
  eliminarConductorAdmin(idx);
}

function irAAsignacionesDesdeFicha() {
  cerrarFichaConductor();
  if (typeof cambiarTab === 'function') cambiarTab('asignaciones');
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

