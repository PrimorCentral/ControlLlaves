// ════════════════════════════════════════════════════════════════════════════
// INCIDENCIAS
// ════════════════════════════════════════════════════════════════════════════
// Tipos de incidencia (columna incidencias.tipo)
const INCID_TIPOS = [
  { id: 'averia',    emoji: '🔧', txt: 'Avería' },
  { id: 'accidente', emoji: '💥', txt: 'Accidente' },
  { id: 'revision',  emoji: '📅', txt: 'Revisión' },
  { id: 'otro',      emoji: '📝', txt: 'Otro' }
];

function abrirModalIncidencia(matricula) {
  const d = getDato(matricula);
  const textoActual = d.incidencias || '';

  // Formatear fecha como DD-MM-AAAA
  const partesFecha = fechaActual.split('-');
  const fechaFormateada = partesFecha.length === 3 ? `${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}` : fechaActual;
  const turnoLabel = turnoActual === 'MANANA' ? 'Mañana' : 'Tarde';
  const turnoColor = turnoActual === 'MANANA' ? '#f59e0b' : '#f97316';
  const turnoBg    = turnoActual === 'MANANA' ? '#fffbeb' : '#fff5f0';
  const turnoBorde = turnoActual === 'MANANA' ? '#fde68a' : '#fecaca';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,30,0.7);backdrop-filter:blur(3px);z-index:4500;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:20px;width:500px;max-width:96vw;box-shadow:0 40px 100px rgba(0,0,0,0.5);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1);overflow:hidden;">

      <!-- CABECERA -->
      <div style="background:${textoActual ? '#1a1a2e' : '#1a1a2e'};padding:22px 26px 18px;display:flex;align-items:center;gap:14px;">
        <div style="width:44px;height:44px;background:#e84545;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">⚠️</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:17px;font-weight:900;color:#ffffff;letter-spacing:0.3px;">${textoActual ? 'Incidencia registrada' : 'Registrar incidencia'}</div>
          <div style="font-size:11px;color:#6b7a94;margin-top:2px;">Gestión de Flota · Primor</div>
        </div>
        <button onclick="this.closest('div[style*=fixed]').remove()"
          style="width:30px;height:30px;border-radius:8px;border:1.5px solid #2a2a4a;background:transparent;color:#6b7a94;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;line-height:1;"
          onmouseover="this.style.borderColor='#e84545';this.style.color='#e84545'" onmouseout="this.style.borderColor='#2a2a4a';this.style.color='#6b7a94'">✕</button>
      </div>

      <!-- PILLS INFO -->
      <div style="background:#f4f6fb;padding:10px 26px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e8eaf0;flex-wrap:wrap;">
        <span style="display:inline-flex;align-items:center;gap:5px;background:white;border:1.5px solid #dde1ea;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:800;color:#1a1a2e;letter-spacing:0.3px;">
          🚛 ${esc(matricula)}
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px;background:white;border:1.5px solid #dde1ea;border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;color:#556;">
          📅 ${fechaFormateada}
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px;background:${turnoBg};border:1.5px solid ${turnoBorde};border-radius:7px;padding:4px 10px;font-size:11px;font-weight:800;color:${turnoColor};">
          ● ${turnoLabel}
        </span>
      </div>

      <!-- CUERPO -->
      <div style="padding:22px 26px 24px;">
        <label style="font-size:10px;font-weight:800;color:#8899aa;letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:8px;">Descripción de la incidencia</label>
        <textarea id="incid-texto" rows="5"
          style="width:100%;padding:12px 14px;border:1.5px solid ${textoActual ? '#e8eaf0' : '#dde1ea'};border-radius:10px;font-family:Barlow,sans-serif;font-size:13px;line-height:1.6;color:${textoActual ? '#556' : '#1a1a2e'};resize:vertical;outline:none;background:${textoActual ? '#f8f9fc' : 'white'};transition:border-color .2s,box-shadow .2s;"
          ${textoActual ? 'readonly' : "onfocus=\"this.style.borderColor='#e84545';this.style.boxShadow='0 0 0 3px rgba(232,69,69,0.08)'\" onblur=\"this.style.borderColor='#dde1ea';this.style.boxShadow='none'\""}
          placeholder="Describe la incidencia con el mayor detalle posible…">${esc(textoActual)}</textarea>

        ${textoActual
          ? `<div style="display:flex;align-items:center;gap:6px;margin-top:10px;padding:8px 12px;background:#fff8f0;border:1px solid #fde8d0;border-radius:8px;font-size:11px;color:#b07040;font-weight:600;">
               <span style="font-size:13px;">✓</span> Incidencia registrada y enviada por correo electronico.
             </div>`
          : `<div style="margin-top:8px;font-size:10px;color:#aab5c0;font-weight:600;">Se registrará la incidencia y se enviará por <strong style="color:#8899aa">correo electronico</strong>.</div>`
        }

        ${!textoActual ? `
        <!-- TOGGLE BLOQUEAR VEHÍCULO -->
        <label for="incid-bloquear-cb" id="bloqueo-toggle-wrap" style="margin-top:16px;padding:13px 14px;border-radius:10px;border:1.5px solid #fecaca;background:#fff5f5;display:flex;align-items:center;gap:12px;cursor:pointer;transition:background .15s,border-color .15s;user-select:none;">
          <input type="checkbox" id="incid-bloquear-cb" style="opacity:0;width:0;height:0;position:absolute;">
          <div style="position:relative;width:40px;height:22px;flex-shrink:0;pointer-events:none;">
            <div id="bloqueo-track" style="position:absolute;inset:0;background:#fecaca;border-radius:11px;transition:background .2s;"></div>
            <div id="bloqueo-thumb" style="position:absolute;top:3px;left:3px;width:16px;height:16px;background:white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.2);transition:transform .2s;"></div>
          </div>
          <div style="flex:1;min-width:0;pointer-events:none;">
            <div style="font-size:12px;font-weight:800;color:#c0392b;letter-spacing:0.3px;">⛔ Bloquear vehículo</div>
            <div style="font-size:10px;color:#e07070;margin-top:1px;font-weight:600;">No estará disponible para asignación hasta resolver la incidencia</div>
          </div>
        </label>` : ''}

        ${textoActual ? '' : `<fieldset class="incid-tipo-grupo">
          <legend>Tipo de incidencia *</legend>
          <div class="incid-tipo-opciones">
            ${INCID_TIPOS.map(t => `<label class="incid-tipo-op"><input type="radio" name="incid-tipo" value="${t.id}"><span><b aria-hidden="true">${t.emoji}</b>${t.txt}</span></label>`).join('')}
          </div>
          <div class="incid-tipo-nota" id="incid-tipo-nota" hidden>🔧 Se registrará también como avería en Mantenimiento para seguir su reparación.</div>
        </fieldset>`}

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;">
          <button onclick="this.closest('div[style*=fixed]').remove()"
            style="padding:10px 22px;background:#f4f5f8;color:#667;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;letter-spacing:0.5px;transition:background .15s;"
            onmouseover="this.style.background='#e8eaf0'" onmouseout="this.style.background='#f4f5f8'">${textoActual ? 'Cerrar' : 'Cancelar'}</button>
          ${textoActual ? '' : '<button id="btn-guardar-incidencia" style="padding:10px 26px;background:#e84545;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:900;cursor:pointer;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(232,69,69,0.3);transition:background .15s,transform .1s;" onmouseover="this.style.background=\'#c63030\'" onmouseout="this.style.background=\'#e84545\'">Registrar incidencia</button>'}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // ── Animar toggle bloqueo ──────────────────────────────────────────────
  const cbBloqueo = overlay.querySelector('#incid-bloquear-cb');
  if (cbBloqueo) {
    cbBloqueo.addEventListener('change', function() {
      const track = overlay.querySelector('#bloqueo-track');
      const thumb = overlay.querySelector('#bloqueo-thumb');
      const wrap  = overlay.querySelector('#bloqueo-toggle-wrap');
      if (this.checked) {
        track.style.background = '#e84545';
        thumb.style.transform  = 'translateX(18px)';
        wrap.style.background   = '#fff0f0';
        wrap.style.borderColor  = '#e84545';
      } else {
        track.style.background = '#fecaca';
        thumb.style.transform  = 'translateX(0)';
        wrap.style.background   = '#fff5f5';
        wrap.style.borderColor  = '#fecaca';
      }
    });
  }

  // Nota "se registrará también como avería" al elegir ese tipo
  overlay.querySelectorAll('input[name="incid-tipo"]').forEach(r => r.addEventListener('change', () => {
    const nota = overlay.querySelector('#incid-tipo-nota');
    if (nota) nota.hidden = r.value !== 'averia' || !r.checked;
    const grupo = overlay.querySelector('.incid-tipo-grupo');
    if (grupo) grupo.classList.remove('falta');
  }));

  const btnGuardar = overlay.querySelector('#btn-guardar-incidencia');
  if (btnGuardar) btnGuardar.onclick = async () => {
    const texto = document.getElementById('incid-texto').value.trim();
    if (!texto) { mostrarToast('Escribe la incidencia antes de guardar', 'error'); return; }
    const tipoSel = overlay.querySelector('input[name="incid-tipo"]:checked');
    if (!tipoSel) {
      const grupo = overlay.querySelector('.incid-tipo-grupo');
      if (grupo) { grupo.classList.add('falta'); grupo.scrollIntoView({ block: 'nearest' }); }
      mostrarToast('Elige el tipo de incidencia', 'error');
      return;
    }
    const tipoIncid = tipoSel.value;

    // ── Confirmar bloqueo si está activado ──
    const quiereBloquear = cbBloqueo && cbBloqueo.checked;
    if (quiereBloquear) {
      const confirmar = await new Promise(resolve => {
        const dlg = document.createElement('div');
        dlg.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,30,0.75);backdrop-filter:blur(3px);z-index:5500;display:flex;align-items:center;justify-content:center;';
        dlg.innerHTML = `
          <div style="background:white;border-radius:18px;width:400px;max-width:94vw;box-shadow:0 40px 100px rgba(0,0,0,0.5);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1);overflow:hidden;">
            <div style="background:#1a1a2e;padding:20px 24px 16px;display:flex;align-items:center;gap:12px;">
              <div style="width:40px;height:40px;background:#e84545;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">⛔</div>
              <div>
                <div style="font-size:15px;font-weight:900;color:#fff;">Bloquear vehículo</div>
                <div style="font-size:10px;color:#6b7a94;margin-top:2px;">${esc(matricula)}</div>
              </div>
            </div>
            <div style="padding:22px 24px 20px;">
              <div style="font-size:13px;color:#1a1a2e;font-weight:700;line-height:1.6;margin-bottom:6px;">
                ¿Confirmas que quieres bloquear este vehículo?
              </div>
              <div style="font-size:12px;color:#778899;line-height:1.7;background:#f4f6fb;border-radius:9px;padding:10px 14px;margin-top:10px;">
                🔒 El vehículo <strong>${esc(matricula)}</strong> quedará <strong>no disponible para asignación</strong> hasta que la incidencia sea marcada como resuelta por un administrador.
              </div>
              <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end;">
                <button id="dlg-no" style="padding:10px 22px;background:#f4f5f8;color:#667;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;transition:background .15s;" onmouseover="this.style.background='#e8eaf0'" onmouseout="this.style.background='#f4f5f8'">Cancelar</button>
                <button id="dlg-si" style="padding:10px 24px;background:#e84545;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 4px 14px rgba(232,69,69,0.3);letter-spacing:0.5px;transition:background .15s;" onmouseover="this.style.background='#c63030'" onmouseout="this.style.background='#e84545'">⛔ Sí, bloquear</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(dlg);
        dlg.querySelector('#dlg-no').onclick  = () => { document.body.removeChild(dlg); resolve(false); };
        dlg.querySelector('#dlg-si').onclick  = () => { document.body.removeChild(dlg); resolve(true); };
      });
      if (!confirmar) return;
    }

    const btn = overlay.querySelector('#btn-guardar-incidencia');
    btn.disabled = true; btn.textContent = '⏳ Guardando…';

    // ── Modal de progreso ────────────────────────────────────────────────
    const modalEnvio = document.createElement('div');
    modalEnvio.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:5000;display:flex;align-items:center;justify-content:center;';
    modalEnvio.innerHTML = `
      <div style="background:white;border-radius:16px;padding:36px 32px;width:360px;max-width:94vw;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1)">
        <div style="font-size:44px;margin-bottom:14px;">⚠️</div>
        <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:8px;">Registrando incidencia</div>
        <div style="font-size:12px;color:#8899aa;line-height:1.6;margin-bottom:22px;">Guardando en el sistema y enviando<br>notificación por correo…<br>Por favor, espere un momento.</div>
        <div style="display:flex;justify-content:center;gap:7px;align-items:center;">
          <div style="width:9px;height:9px;border-radius:50%;background:#e84545;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0s"></div>
          <div style="width:9px;height:9px;border-radius:50%;background:#e84545;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0.2s"></div>
          <div style="width:9px;height:9px;border-radius:50%;background:#e84545;animation:dot-bounce 1.2s ease-in-out infinite;animation-delay:0.4s"></div>
        </div>
      </div>`;
    document.body.appendChild(modalEnvio);

    // Actualizar memoria local
    const key = `${matricula}|${turnoActual}|${fechaActual}`;
    if (!datos[key]) datos[key] = {};
    datos[key].incidencias = texto;

    // Guardar en hoja Incidencias (historial, correo y bloqueo si aplica, todo en una sola llamada)
    const resInc = await registrarIncidenciaEnSheets(matricula, texto, quiereBloquear, tipoIncid);

    // Tipo "Avería": se registra también en Mantenimiento (js/mantenimiento.js),
    // enlazada a esta incidencia. Si además se bloqueó, la avería queda como
    // causante del bloqueo: al marcarla como reparada el vehículo vuelve a estar
    // disponible y la incidencia se resuelve sola.
    if (tipoIncid === 'averia' && typeof mantRegistrarAveriaDesdeIncidencia === 'function') {
      await mantRegistrarAveriaDesdeIncidencia(matricula, texto, quiereBloquear, resInc && resInc.id);
    }

    // Si se bloqueó el vehículo, reflejarlo YA en memoria local para que
    // la fila se pinte en rojo sin esperar a un "Recargar" manual.
    if (quiereBloquear) {
      const respUsuarioLocal = usuarioActual ? (usuarioActual.nombre || usuarioActual.numUsuario) : '—';
      GRUPOS.forEach(g => g.vehiculos.forEach(v => {
        if (v.matricula === matricula) {
          v.bloqueado      = true;
          v.motivo_bloqueo = texto;
          v.bloqueado_por  = respUsuarioLocal;
          v.fecha_bloqueo  = new Date().toISOString();
        }
      }));
    }

    document.body.removeChild(modalEnvio);
    document.body.removeChild(overlay);
    renderTabla();
    mostrarToast(quiereBloquear ? '✓ Incidencia registrada · Vehículo bloqueado' : '✓ Incidencia registrada', 'success');
  };
}

async function registrarIncidenciaEnSheets(matricula, descripcion, bloquear, tipo) {
  if (!APPS_SCRIPT_URL) return;
  try {
    const respUsuario = usuarioActual ? (usuarioActual.nombre || usuarioActual.numUsuario) : '—';
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        accion:           'registrarIncidencia',
        bloquearVehiculo: bloquear || false,
        incidencia: {
          timestamp:   new Date().toISOString(),
          fecha:       fechaActual,
          turno:       turnoActual,
          matricula:   matricula,
          descripcion: descripcion,
          responsable: respUsuario,
          estado:      'PENDIENTE',
          tipo:        tipo || null
        }
      })
    });
    const json = await resp.json();
    if (json && json.emailError) {
      appAlert(`La incidencia se ha guardado correctamente, pero no se pudo enviar el correo de aviso.<br><br><span style="color:#8899aa;font-size:12px">${json.emailError}</span>`, { titulo: 'Fallo al enviar correo electrónico', icono: '✉️⚠️' });
    }
    if (bloquear) {
      registrarAccion('INCIDENCIA', 'Registrar incidencia + Bloquear vehículo', `${matricula} · ${descripcion.substring(0,80)}`);
    } else {
      registrarAccion('INCIDENCIA', 'Registrar incidencia', `${matricula} · ${descripcion.substring(0,80)}`);
    }
    return json;
  } catch(e) { console.warn('No se pudo guardar incidencia en Sheets:', e); }
  actualizarBotonIncidenciasPendientes();
}

// ════════════════════════════════════════════════════════════════════════════
// PESTAÑA INCIDENCIAS (Panel Admin)
// ════════════════════════════════════════════════════════════════════════════
let incidenciasCache = [];

// ════════════════════════════════════════════════════════════════════════════
// TAB REPOSTAJES (Panel Admin)
// ════════════════════════════════════════════════════════════════════════════
let repostajesCache = [];

async function cargarTabRepostajes() {
  const tbody = document.getElementById('repo-tab-tbody');
  const statsEl = document.getElementById('repo-tab-stats');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="15" class="hist-empty">⏳ Cargando datos un momento por favor…</td></tr>';
  if (statsEl) statsEl.innerHTML = '';

  const desde     = document.getElementById('repo-tab-fecha-desde').value;
  const hasta     = document.getElementById('repo-tab-fecha-hasta').value;
  const matricula = (document.getElementById('repo-tab-filtro-matricula').value || '').trim();
  const estado    = (document.getElementById('repo-tab-filtro-estado').value || '').trim();
  const refTicket = (document.getElementById('repo-tab-filtro-ref').value || '').trim().toUpperCase();

  if (!APPS_SCRIPT_URL) {
    tbody.innerHTML = '<tr><td colspan="15" class="hist-empty">⚠️ Sin URL de Apps Script configurada.</td></tr>';
    return;
  }

  try {
    let url = `${APPS_SCRIPT_URL}?accion=cargarRepostajes`;
    if (desde)    url += `&desde=${encodeURIComponent(desde)}`;
    if (hasta)    url += `&hasta=${encodeURIComponent(hasta)}`;
    if (matricula) url += `&matricula=${encodeURIComponent(matricula)}`;
    const resp = await fetch(url, { redirect: 'follow' });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'Error en Sheets');
    // Filtrar por estado y por referencia de ticket en cliente (Apps Script no los filtra)
    repostajesCache = (json.filas || [])
      .filter(f => !estado || (f.estado||'').toUpperCase() === estado)
      .filter(f => !refTicket || (f.ticket_ref||'').toString().toUpperCase().includes(refTicket));
    renderTabRepostajes();
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="15" class="hist-empty">Error al cargar: ${e.message}</td></tr>`;
  }
}

function renderTabRepostajes() {
  const tbody   = document.getElementById('repo-tab-tbody');
  const statsEl = document.getElementById('repo-tab-stats');
  if (!tbody) return;

  // ── Estadísticas ─────────────────────────────────────────────────────────
  if (statsEl) {
    const total      = repostajesCache.length;
    const pendientes = repostajesCache.filter(f => (f.estado||'').toUpperCase() === 'PENDIENTE').length;
    const completados = total - pendientes;
    statsEl.innerHTML = `
      <div style="background:white;border:1px solid #dde1e8;border-radius:9px;padding:6px 12px;display:flex;align-items:center;gap:7px;white-space:nowrap">
        <span style="font-size:17px;font-weight:900;color:#1a1a2e">${total}</span>
        <span style="font-size:10px;font-weight:700;color:#8899aa;letter-spacing:0.4px">Total</span>
      </div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:6px 12px;display:flex;align-items:center;gap:7px;white-space:nowrap">
        <span style="font-size:17px;font-weight:900;color:#92600a">${pendientes}</span>
        <span style="font-size:10px;font-weight:700;color:#92600a;letter-spacing:0.4px">⏳ Pendientes</span>
      </div>
      <div style="background:#eafaf1;border:1px solid #a9dfbf;border-radius:9px;padding:6px 12px;display:flex;align-items:center;gap:7px;white-space:nowrap">
        <span style="font-size:17px;font-weight:900;color:#1a6635">${completados}</span>
        <span style="font-size:10px;font-weight:700;color:#1a6635;letter-spacing:0.4px">✅ Completados</span>
      </div>`;
  }

  if (!repostajesCache.length) {
    tbody.innerHTML = '<tr><td colspan="15" class="hist-empty">Sin repostajes en el rango seleccionado.</td></tr>';
    return;
  }

  tbody.innerHTML = repostajesCache.map((f, idx) => {
    const completado = (f.estado||'').toUpperCase() === 'COMPLETADO';
    const pendiente  = (f.estado||'').toUpperCase() === 'PENDIENTE';
    const estadoBadge = completado
      ? `<span style="font-size:9px;font-weight:800;color:#1a6635;background:#eafaf1;border:1px solid #a9dfbf;border-radius:5px;padding:2px 8px;white-space:nowrap">✅ Completado</span>`
      : `<span style="font-size:9px;font-weight:800;color:#92600a;background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:2px 8px;white-space:nowrap">⏳ Pendiente</span>`;
    const fechaFmt = (f.fecha||'').length >= 10
      ? f.fecha.substring(0,10).split('-').reverse().join('-')
      : (f.fecha||'—');
    // Consumo: diferencia gasoil
    let consumoBadge = '';
    if (completado && f.gasoil_antes !== '' && f.gasoil_despues !== '') {
      const diff = parseFloat(f.gasoil_despues) - parseFloat(f.gasoil_antes);
      const color = diff >= 0 ? '#1a6635' : '#c62020';
      const bg    = diff >= 0 ? '#eafaf1' : '#fff0f0';
      const bdr   = diff >= 0 ? '#a9dfbf' : '#fcc';
      consumoBadge = `<span style="font-size:9px;font-weight:700;color:${color};background:${bg};border:1px solid ${bdr};border-radius:4px;padding:1px 5px;margin-left:4px">${diff>0?'+':''}${diff.toFixed(0)}%</span>`;
    }
    // Gasoil antes/después combinado
    const gasoilAntesTxt   = (f.gasoil_antes !== '' && f.gasoil_antes !== undefined) ? f.gasoil_antes+'%' : '—';
    const gasoilDespuesTxt = completado
      ? (f.gasoil_despues !== '' && f.gasoil_despues !== undefined ? f.gasoil_despues+'%'+consumoBadge : '—')
      : '⏳';
    const gasoilCelda = `<span>${gasoilAntesTxt}</span><span style="color:#b0bac8;margin:0 3px">→</span><span style="font-weight:700">${gasoilDespuesTxt}</span>`;
    // AdBlue antes/después combinado
    const adblueAntesTxt   = (f.adblue_antes === 'N/A') ? 'No' : (f.adblue_antes !== '' && f.adblue_antes !== undefined) ? f.adblue_antes+'%' : '—';
    const adblueDespuesTxt = completado
      ? (f.adblue_despues !== '' && f.adblue_despues !== undefined ? f.adblue_despues+'%' : '—')
      : '⏳';
    const adblueCelda = `<span>${adblueAntesTxt}</span><span style="color:#b0bac8;margin:0 3px">→</span><span style="font-weight:700">${adblueDespuesTxt}</span>`;
    return `<tr style="background:${pendiente?'#fffbeb':'white'}">
      <td style="white-space:nowrap;font-weight:700">${fechaFmt}</td>
      <td><strong style="font-size:12px;background:#eef0f5;border-radius:5px;padding:2px 7px">${esc(f.matricula||'—')}</strong></td>
      <td style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(f.usuario_chofer||'')}">${esc(f.usuario_chofer||'—')}</td>
      <td style="font-size:11px;white-space:nowrap">${f.kilometraje ? Number(f.kilometraje).toLocaleString('es-ES') + ' km' : '—'}</td>
      <td style="font-size:11px;font-weight:700">${esc(f.num_tarjeta||'—')}</td>
      <td style="font-size:11px;white-space:nowrap">${esc(f.hora_entrega||'—')}</td>
      <td style="font-size:11px;white-space:nowrap;color:${completado?'#1a6635':'#92600a'}">${completado ? esc(f.hora_devolucion||'—') : '⏳'}</td>
      <td style="font-size:11px;text-align:center;white-space:nowrap">${gasoilCelda}</td>
      <td style="font-size:11px;text-align:center;white-space:nowrap">${adblueCelda}</td>
      <td style="font-size:11px;font-weight:700;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(f.ticket_ref||'')}">${esc(f.ticket_ref||'—')}</td>
      <td style="font-size:11px;text-align:right;white-space:nowrap">${f.ticket_importe !== '' && f.ticket_importe !== undefined ? Number(f.ticket_importe).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €' : '—'}</td>
      <td style="font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(f.resp_entrega||'')}">${esc(f.resp_entrega||'—')}</td>
      <td style="font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(f.resp_recibe||'')}">${completado ? esc(f.resp_recibe||'—') : '—'}</td>
      <td>${estadoBadge}</td>
      <td class="col-acciones" style="text-align:center;white-space:nowrap">
        <button class="btn-item-action" onclick="generarPDFRepostaje(${idx})" title="Generar PDF solicitud repostaje" style="font-size:13px;padding:3px 8px;color:#c0392b;border-color:#e8c5c5;margin-right:3px">📄</button>
        <button class="btn-item-action danger" onclick="eliminarRepostajeAdmin(${idx})" title="Eliminar repostaje" style="font-size:13px;padding:3px 8px">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════════
// ── RESUMEN MENSUAL DE REPOSTAJES (estilo "Control Gasoil" tipo Excel) ──
// ═══════════════════════════════════════════════════════════════════════
let _resumenMensualData = null; // { anio, mes, dias, vehiculos:[{matricula,tipo,porDia:[{importe,km}],totalImporte,totalKm}], totalGeneral }

function abrirModalResumenMensual() {
  const modal = document.getElementById('modal-resumen-mensual');
  if (!modal) return;
  const inputMes = document.getElementById('resumen-mensual-mes');
  if (inputMes && !inputMes.value) {
    const hoy = new Date();
    inputMes.value = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  }
  modal.classList.add('open');
}

function cerrarModalResumenMensual() {
  document.getElementById('modal-resumen-mensual').classList.remove('open');
}

// Devuelve la lista de vehículos (matricula+tipo) activos durante el mes dado (aunque ahora estén archivados)
function _vehiculosActivosEnMes(anioMes /* 'YYYY-MM' */) {
  const lista = [];
  const vistos = new Set();
  GRUPOS.forEach(g => {
    g.vehiculos.forEach(v => {
      if (vistos.has(v.matricula)) return;
      // Si no está archivado, siempre cuenta.
      // Si está archivado, cuenta solo si se archivó DESPUÉS del mes consultado (o sin fecha registrada, por seguridad se incluye).
      let incluir = true;
      if (v.archivado) {
        if (v.fecha_archivado) {
          const mesArchivado = v.fecha_archivado.substring(0,7); // YYYY-MM
          incluir = mesArchivado >= anioMes;
        } else {
          incluir = true;
        }
      }
      if (incluir) {
        vistos.add(v.matricula);
        lista.push({ matricula: v.matricula, tipo: v.tipo || '' });
      }
    });
  });
  lista.sort((a,b) => a.matricula.localeCompare(b.matricula));
  return lista;
}

async function generarResumenMensual() {
  const body = document.getElementById('resumen-mensual-body');
  const inputMes = document.getElementById('resumen-mensual-mes');
  const anioMes = inputMes ? inputMes.value : '';
  if (!anioMes) { mostrarToast('Selecciona un mes', 'info'); return; }
  if (!APPS_SCRIPT_URL) { mostrarToast('Sin URL de Apps Script configurada', 'error'); return; }

  body.innerHTML = '<div style="text-align:center;color:#8899aa;font-size:13px;font-weight:700;padding:60px 0;">⏳ Calculando resumen mensual…</div>';

  const [anio, mes] = anioMes.split('-').map(Number);
  const diasEnMes = new Date(anio, mes, 0).getDate();
  const desde = `${anioMes}-01`;
  const hasta = `${anioMes}-${String(diasEnMes).padStart(2,'0')}`;

  try {
    const url = `${APPS_SCRIPT_URL}?accion=cargarRepostajes&desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`;
    const resp = await fetch(url, { redirect: 'follow' });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'Error en Sheets');
    const filas = json.filas || [];

    const vehiculosBase = _vehiculosActivosEnMes(anioMes);

    const vehiculos = vehiculosBase.map(vb => {
      const porDia = Array.from({length: diasEnMes}, () => ({ importe: 0, km: null }));
      let totalImporte = 0;
      let tieneMovimiento = false;
      let kmMin = null, kmMax = null; // odómetro mínimo y máximo del mes → km recorridos
      filas.filter(f => f.matricula === vb.matricula).forEach(f => {
        if (!f.fecha || f.fecha.length < 10) return;
        const diaNum = parseInt(f.fecha.substring(8,10), 10);
        if (!diaNum || diaNum < 1 || diaNum > diasEnMes) return;
        const importe = parseFloat(f.ticket_importe) || 0;
        const km = f.kilometraje !== '' && f.kilometraje !== undefined && f.kilometraje !== null ? Number(f.kilometraje) : null;
        porDia[diaNum-1].importe += importe;
        if (km !== null) {
          porDia[diaNum-1].km = (porDia[diaNum-1].km || 0) + km;
          if (kmMin === null || km < kmMin) kmMin = km;
          if (kmMax === null || km > kmMax) kmMax = km;
        }
        totalImporte += importe;
        tieneMovimiento = true;
      });
      // Km recorridos en el mes = diferencia entre el odómetro mayor y menor registrado
      const totalKm = (kmMin !== null && kmMax !== null && kmMax > kmMin) ? (kmMax - kmMin) : null;
      return { matricula: vb.matricula, tipo: vb.tipo, porDia, totalImporte, totalKm, tieneMovimiento };
    });

    const totalGeneral = vehiculos.reduce((s,v) => s + v.totalImporte, 0);
    const totalKmGeneral = vehiculos.reduce((s,v) => s + (v.totalKm || 0), 0);

    _resumenMensualData = { anio, mes, diasEnMes, vehiculos, totalGeneral, totalKmGeneral, anioMes };
    _renderResumenMensual();
  } catch(e) {
    body.innerHTML = `<div style="text-align:center;color:#c0392b;font-size:13px;font-weight:700;padding:60px 0;">Error al generar el resumen: ${esc(e.message)}</div>`;
  }
}

function _renderResumenMensual() {
  const body = document.getElementById('resumen-mensual-body');
  const d = _resumenMensualData;
  if (!d) return;
  if (!d.vehiculos.length) {
    body.innerHTML = '<div style="text-align:center;color:#8899aa;font-size:13px;font-weight:700;padding:60px 0;">No hay vehículos activos para este mes.</div>';
    return;
  }

  const nombreMes = new Date(d.anio, d.mes-1, 1).toLocaleDateString('es-ES', { month:'long' }).toUpperCase();

  let cols = '';
  for (let i=1; i<=d.diasEnMes; i++) cols += `<th style="min-width:62px">${String(i).padStart(2,'0')}-${nombreMes.substring(0,3)}</th>`;

  let filasHtml = '';
  d.vehiculos.forEach(v => {
    const bg = v.tieneMovimiento ? '#ffffff' : '#fbfbfd';
    let celdasImporte = '';
    let celdasKm = '';
    v.porDia.forEach(dia => {
      celdasImporte += `<td style="text-align:right;font-size:10px;color:#1a1a2e">${dia.importe ? dia.importe.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €' : ''}</td>`;
      celdasKm += `<td style="text-align:right;font-size:9px;color:#8899aa">${dia.km !== null ? dia.km.toLocaleString('es-ES') : ''}</td>`;
    });
    filasHtml += `
      <tr style="background:${bg}">
        <td rowspan="2" style="font-weight:900;font-size:11px;background:#eef0f5;vertical-align:middle;white-space:nowrap">${esc(v.matricula)}<div style="font-size:9px;font-weight:600;color:#8899aa">${esc(v.tipo||'')}</div></td>
        <td style="font-size:9px;font-weight:800;color:#92600a;background:#fdf6e8">€/KM</td>
        ${celdasImporte}
        <td rowspan="2" style="text-align:center;font-weight:900;font-size:13px;color:#1a1a2e;background:#eef0f5;vertical-align:middle;white-space:nowrap">${v.totalImporte.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})} €</td>
        <td rowspan="2" style="text-align:center;font-weight:900;font-size:14px;color:#0f9d8c;background:#eafaf8;vertical-align:middle;white-space:nowrap">${v.totalKm !== null ? v.totalKm.toLocaleString('es-ES')+' km' : '—'}</td>
      </tr>
      <tr style="background:${bg}">
        <td style="font-size:9px;font-weight:800;color:#556;background:#f4f6fb">KM</td>
        ${celdasKm}
      </tr>`;
  });

  body.innerHTML = `
    <div style="overflow:auto;background:white;border-radius:10px;border:1px solid #dde1e8;">
      <table style="border-collapse:collapse;width:100%;font-family:Barlow,sans-serif;">
        <thead>
          <tr style="background:#1a1a2e;color:white;">
            <th style="padding:8px 10px;font-size:11px;white-space:nowrap">MATRÍCULA</th>
            <th style="padding:8px 10px;font-size:11px;white-space:nowrap">€/KM</th>
            ${cols}
            <th style="padding:8px 10px;font-size:11px;white-space:nowrap">TOTAL</th>
            <th style="padding:8px 10px;font-size:11px;white-space:nowrap">KM MES</th>
          </tr>
        </thead>
        <tbody>${filasHtml}</tbody>
        <tfoot>
          <tr style="background:#1a1a2e;color:white;">
            <td colspan="${d.diasEnMes+2}" style="padding:9px 14px;text-align:right;font-size:12px;font-weight:800;letter-spacing:0.5px;">TOTAL GENERAL</td>
            <td style="padding:9px 14px;text-align:center;font-size:15px;font-weight:900;color:#6c3ce8;background:#f4f0ff;">${d.totalGeneral.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})} €</td>
            <td style="padding:9px 14px;text-align:center;font-size:15px;font-weight:900;color:#0f9d8c;background:#eafaf8;">${d.totalKmGeneral.toLocaleString('es-ES')} km</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <style>
      #resumen-mensual-body table td, #resumen-mensual-body table th { border:1px solid #e2e6ee; padding:4px 6px; }
    </style>`;
}

// ── Exporta el resumen mensual actual a PDF apaisado (estilo hoja de cálculo) ──
function exportarResumenMensualPDF() {
  const d = _resumenMensualData;
  if (!d || !d.vehiculos.length) { mostrarToast('Genera primero el resumen', 'info'); return; }
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297, pageH = 210, margin = 5;
  const colMat = 30, colTotal = 22, colKm = 20;
  const colDia = (pageW - margin*2 - colMat - colTotal - colKm) / d.diasEnMes;
  const bannerH = 14;
  const startY = bannerH + 4;        // donde empieza la tabla (debajo del banner oscuro)
  const tableHeadH = 5.4;            // alto fijo de la fila de cabecera de columnas
  const totalRowH = 7;               // alto fijo de la fila TOTAL GENERAL
  const nVeh = d.vehiculos.length;
  const nombreMes = new Date(d.anio, d.mes-1, 1).toLocaleDateString('es-ES', { month:'long' }).toUpperCase();

  // ── Altura de fila dinámica: que TODOS los vehículos quepan en una sola página ──
  const availH = (pageH - margin) - startY - tableHeadH - totalRowH - 2;
  let rowH = availH / (nVeh * 2);
  let multiPage = false;
  if (rowH < 2.6) { rowH = 2.6; multiPage = true; }   // si hay demasiados vehículos, no bajar de un mínimo legible
  if (rowH > 5.2) rowH = 5.2;
  const f = rowH / 5.2; // factor de escala para fuentes y posiciones, basado en el tamaño "de referencia"

  // Escribe texto alineado a la derecha encogiendo el tamaño de fuente si no cabe en maxW
  function fitTextRight(txt, xRight, yPos, maxW, startSize) {
    let size = Math.max(3.0, startSize);
    doc.setFontSize(size);
    while (size > 2.8 && doc.getTextWidth(txt) > maxW) {
      size -= 0.25;
      doc.setFontSize(size);
    }
    doc.text(txt, xRight, yPos, { align: 'right' });
  }

  // Escribe texto centrado encogiendo el tamaño de fuente si no cabe en maxW
  function fitTextCenter(txt, xCenter, yPos, maxW, startSize) {
    let size = Math.max(3.0, startSize);
    doc.setFontSize(size);
    while (size > 2.8 && doc.getTextWidth(txt) > maxW) {
      size -= 0.25;
      doc.setFontSize(size);
    }
    doc.text(txt, xCenter, yPos, { align: 'center' });
  }

  // Trunca texto con "…" para que quepa en maxW (usa fuente ya seleccionada en doc)
  function fitTextLeft(txt, xLeft, yPos, maxW) {
    let t = txt;
    if (doc.getTextWidth(t) <= maxW) { doc.text(t, xLeft, yPos); return; }
    while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
    doc.text(t + '…', xLeft, yPos);
  }

  let y = margin;

  function header() {
    doc.setFillColor(26,26,46);
    doc.rect(0, 0, pageW, bannerH, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(255,255,255);
    doc.text(`CONTROL GASOIL — ${nombreMes} ${d.anio}`, margin, 9);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(180,185,200);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageW - margin, 9, { align:'right' });
    y = startY;
    // Cabecera de tabla
    doc.setFillColor(26,26,46);
    doc.rect(margin, y, colMat + colTotal + colKm + colDia*d.diasEnMes, tableHeadH, 'F');
    doc.setFontSize(6); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
    doc.text('MATRÍCULA', margin + 2, y + 3.5);
    let x = margin + colMat;
    for (let i=1; i<=d.diasEnMes; i++) {
      doc.text(String(i).padStart(2,'0'), x + colDia/2, y + 3.5, { align:'center' });
      x += colDia;
    }
    doc.text('TOTAL', x + colTotal/2, y + 3.5, { align:'center' });
    doc.text('KM MES', x + colTotal + colKm/2, y + 3.5, { align:'center' });
    y += tableHeadH;
  }

  header();

  d.vehiculos.forEach((v, idx) => {
    if (multiPage && y > pageH - margin - (totalRowH + rowH*2 + 2)) { doc.addPage('a4','landscape'); y = margin; header(); }
    const bgGris = [238,240,245];
    doc.setDrawColor(225,228,235);
    doc.setFillColor(...(idx % 2 === 0 ? [255,255,255] : [250,251,253]));
    doc.rect(margin, y, colMat + colTotal + colKm + colDia*d.diasEnMes, rowH*2, 'F');
    doc.setFillColor(...bgGris);
    doc.rect(margin, y, colMat, rowH*2, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(Math.max(4.2, 6.5*f)); doc.setTextColor(26,26,46);
    fitTextLeft(v.matricula, margin + 2, y + 3.6*f, colMat - 3);
    doc.setFont('helvetica','normal'); doc.setFontSize(Math.max(3.4, 5*f));
    doc.setTextColor(120,128,145);
    fitTextLeft((v.tipo||''), margin + 2, y + rowH + 2.6*f, colMat - 3);

    let x = margin + colMat;
    v.porDia.forEach(dia => {
      doc.setTextColor(26,26,46); doc.setFont('helvetica','bold');
      if (dia.importe) {
        fitTextRight(dia.importe.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+'€', x + colDia - 1, y + 3.6*f, colDia - 1.5, Math.max(4.2,5.8*f));
      }
      doc.setTextColor(140,150,165); doc.setFont('helvetica','normal');
      if (dia.km !== null) {
        fitTextRight(dia.km.toLocaleString('es-ES'), x + colDia - 1, y + rowH + 3.2*f, colDia - 1.5, Math.max(3.4,5.4*f));
      }
      doc.setDrawColor(230,233,240); doc.line(x, y, x, y + rowH*2);
      x += colDia;
    });
    doc.setFillColor(...bgGris);
    doc.rect(x, y, colTotal, rowH*2, 'F');
    doc.setFont('helvetica','bold'); doc.setTextColor(26,26,46);
    fitTextCenter(v.totalImporte.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €', x + colTotal/2, y + rowH + 0.8*f, colTotal - 2.5, Math.max(4.6,6.8*f));
    doc.setFillColor(234,250,248);
    doc.rect(x + colTotal, y, colKm, rowH*2, 'F');
    doc.setFont('helvetica','bold'); doc.setTextColor(15,157,140);
    fitTextCenter(v.totalKm !== null ? v.totalKm.toLocaleString('es-ES')+' km' : '—', x + colTotal + colKm/2, y + rowH + 0.8*f, colKm - 2.5, Math.max(5.2,7.4*f));
    doc.setDrawColor(210,213,222);
    doc.rect(margin, y, colMat + colTotal + colKm + colDia*d.diasEnMes, rowH*2);
    y += rowH*2;
  });

  // Total general
  if (multiPage && y > pageH - margin - totalRowH) { doc.addPage('a4','landscape'); y = margin; header(); }
  doc.setFillColor(26,26,46);
  doc.rect(margin, y, colMat + colTotal + colKm + colDia*d.diasEnMes, totalRowH, 'F');
  const xFinDias = margin + colMat + colDia*d.diasEnMes;
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(255,255,255);
  doc.text('TOTAL GENERAL', xFinDias - 2, y + totalRowH/2 + 1.4, { align:'right' });
  doc.setTextColor(180, 150, 255);
  fitTextCenter(d.totalGeneral.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €', xFinDias + colTotal/2, y + totalRowH/2 + 1.4, colTotal - 2.5, 9);
  doc.setTextColor(120,220,200);
  fitTextCenter(d.totalKmGeneral.toLocaleString('es-ES')+' km', xFinDias + colTotal + colKm/2, y + totalRowH/2 + 1.4, colKm - 2.5, 9);

  doc.save(`resumen_gasoil_${d.anioMes}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// ── REGISTRO MANUAL DE REPOSTAJE (volcado de tickets antiguos en papel) ──
// ═══════════════════════════════════════════════════════════════════════
async function abrirModalRegistroManual() {
  const modal = document.getElementById('modal-registro-manual');
  if (!modal) return;

  // Asegurar que tenemos la lista de responsables y de conductores cargada
  if (!responsablesCache.length && typeof cargarResponsables === 'function') {
    try { await cargarResponsables(); } catch(e) {}
  }
  if (!CONDUCTORES.length && typeof cargarConductoresDesdeSheets === 'function') {
    try { await cargarConductoresDesdeSheets(false); } catch(e) {}
  }

  // Poblar matrículas (todas, incluidas archivadas, por si el ticket es de un vehículo ya dado de baja)
  const sel = document.getElementById('manual-repo-matricula');
  if (sel) {
    const matriculas = [];
    GRUPOS.forEach(g => g.vehiculos.forEach(v => { if (v.matricula) matriculas.push(v.matricula); }));
    matriculas.sort();
    sel.innerHTML = '<option value="">Selecciona…</option>' +
      matriculas.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  }

  // Reset de campos
  ['manual-repo-fecha','manual-repo-km','manual-repo-tarjeta','manual-repo-ticket-ref','manual-repo-importe','manual-hora-entrega','manual-hora-devolucion'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['manual-resp-entrega-input','manual-resp-recibe-input','manual-chofer-input'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['manual-resp-entrega-valor','manual-resp-recibe-valor','manual-chofer-valor'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['manual-gasoil-antes','manual-adblue-antes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const gasoilDesp = document.getElementById('manual-gasoil-despues'); if (gasoilDesp) gasoilDesp.value = '100';
  const adblueDesp = document.getElementById('manual-adblue-despues'); if (adblueDesp) adblueDesp.value = '';
  const sinAdblue  = document.getElementById('manual-sin-adblue'); if (sinAdblue) { sinAdblue.checked = false; toggleSinAdblueManual(false); }
  const fechaInput = document.getElementById('manual-repo-fecha');
  if (fechaInput) fechaInput.value = fechaActual || '';

  modal.classList.add('open');
  setTimeout(() => { const f = document.getElementById('manual-repo-fecha'); if (f) f.focus(); }, 100);
}

function cerrarModalRegistroManual() {
  document.getElementById('modal-registro-manual').classList.remove('open');
  cerrarDropdownsRespManual();
}

function toggleSinAdblueManual(sinAdblue) {
  const grid = document.getElementById('manual-adblue-grid');
  if (grid) grid.style.opacity = sinAdblue ? '0.4' : '1';
  ['manual-adblue-antes','manual-adblue-despues'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = sinAdblue;
  });
}

function cerrarDropdownsRespManual() {
  ['manual-resp-entrega-dropdown','manual-resp-recibe-dropdown','manual-chofer-dropdown'].forEach(id => {
    const dd = document.getElementById(id); if (dd) dd.classList.remove('open');
  });
}

// Filtra CONDUCTORES según lo que se escribe en el campo de chofer
function filtrarChoferManual() {
  const input = document.getElementById('manual-chofer-input');
  const dd    = document.getElementById('manual-chofer-dropdown');
  if (!input || !dd) return;
  const filtro = input.value.trim().toUpperCase();
  const valorOculto = document.getElementById('manual-chofer-valor');
  if (valorOculto && valorOculto.value !== input.value) valorOculto.value = '';

  const visibles = CONDUCTORES.filter(c =>
    !filtro ||
    (c.nombre||'').toUpperCase().includes(filtro) ||
    (c.dni||'').toUpperCase().includes(filtro) ||
    String(c.numUsuario||'').includes(filtro)
  ).slice(0, 30);

  if (!CONDUCTORES.length) {
    dd.innerHTML = `<div class="manual-resp-empty">Sin conductores registrados todavía</div>`;
  } else if (!visibles.length) {
    dd.innerHTML = `<div class="manual-resp-empty">Sin resultados para "${esc(input.value)}"</div>`;
  } else {
    dd.innerHTML = visibles.map(c => `
      <div class="manual-resp-item" onmousedown="event.preventDefault();seleccionarChoferManual('${esc(c.nombre).replace(/'/g,"\\'")}')">
        <span>${esc(c.nombre||'—')}</span>
        <small>${esc(c.dni||'')}</small>
      </div>`).join('');
  }
  dd.classList.add('open');
}

function seleccionarChoferManual(nombre) {
  document.getElementById('manual-chofer-input').value = nombre;
  document.getElementById('manual-chofer-valor').value = nombre;
  document.getElementById('manual-chofer-dropdown').classList.remove('open');
}

// Filtra responsablesCache según lo que se escribe en el input 'entrega' o 'recibe'
function filtrarRespManual(tipo) {
  const input = document.getElementById(`manual-resp-${tipo}-input`);
  const dd    = document.getElementById(`manual-resp-${tipo}-dropdown`);
  if (!input || !dd) return;
  const filtro = input.value.trim().toUpperCase();
  // Si el texto no coincide ya con el valor seleccionado, invalidamos la selección previa
  const valorOculto = document.getElementById(`manual-resp-${tipo}-valor`);
  if (valorOculto && valorOculto.value !== input.value) valorOculto.value = '';

  const visibles = responsablesCache.filter(r =>
    !filtro ||
    (r.nombre||'').toUpperCase().includes(filtro) ||
    String(r.numUsuario||'').includes(filtro)
  ).slice(0, 30);

  if (!responsablesCache.length) {
    dd.innerHTML = `<div class="manual-resp-empty">Sin responsables registrados todavía</div>`;
  } else if (!visibles.length) {
    dd.innerHTML = `<div class="manual-resp-empty">Sin resultados para "${esc(input.value)}"</div>`;
  } else {
    dd.innerHTML = visibles.map(r => `
      <div class="manual-resp-item" onmousedown="event.preventDefault();seleccionarRespManual('${tipo}','${esc(r.nombre).replace(/'/g,"\\'")}')">
        <span>${esc(r.nombre||'—')}</span>
        <small>${esc(r.rol||'')}</small>
      </div>`).join('');
  }
  dd.classList.add('open');
}

function seleccionarRespManual(tipo, nombre) {
  document.getElementById(`manual-resp-${tipo}-input`).value = nombre;
  document.getElementById(`manual-resp-${tipo}-valor`).value = nombre;
  document.getElementById(`manual-resp-${tipo}-dropdown`).classList.remove('open');
}

// Cierra los dropdowns si se hace click fuera de ellos
document.addEventListener('click', (e) => {
  if (!e.target.closest('#manual-resp-entrega-input, #manual-resp-entrega-dropdown, #manual-resp-recibe-input, #manual-resp-recibe-dropdown, #manual-chofer-input, #manual-chofer-dropdown')) {
    cerrarDropdownsRespManual();
  }
});

async function guardarRegistroManual() {
  const fecha      = document.getElementById('manual-repo-fecha').value;
  const matricula  = document.getElementById('manual-repo-matricula').value;
  const km         = document.getElementById('manual-repo-km').value.trim();
  const tarjeta    = document.getElementById('manual-repo-tarjeta').value.trim();
  const ticketRef  = document.getElementById('manual-repo-ticket-ref').value.trim();
  const importe    = document.getElementById('manual-repo-importe').value.trim();

  // Responsable que entrega: si se escribió texto libre sin seleccionar de la lista, lo aceptamos igualmente
  const respEntrega = (document.getElementById('manual-resp-entrega-valor').value || document.getElementById('manual-resp-entrega-input').value || '').trim();
  let   respRecibe  = (document.getElementById('manual-resp-recibe-valor').value || document.getElementById('manual-resp-recibe-input').value || '').trim();
  if (!respRecibe) respRecibe = respEntrega; // por defecto, el mismo que entrega
  let   chofer      = (document.getElementById('manual-chofer-valor').value || document.getElementById('manual-chofer-input').value || '').trim();
  if (!chofer) chofer = respEntrega; // si no se indica chofer, usamos el responsable que entrega

  const sinAdblue    = document.getElementById('manual-sin-adblue').checked;
  const gasoilAntes  = document.getElementById('manual-gasoil-antes').value;
  const gasoilDespues= document.getElementById('manual-gasoil-despues').value;
  const adblueAntes  = sinAdblue ? 'N/A' : document.getElementById('manual-adblue-antes').value;
  const adblueDespues= sinAdblue ? 'N/A' : document.getElementById('manual-adblue-despues').value;
  const horaEntrega    = document.getElementById('manual-hora-entrega').value || '00:00';
  const horaDevolucion = document.getElementById('manual-hora-devolucion').value || horaEntrega;

  if (!fecha)       { mostrarToast('Indica la fecha del repostaje', 'error'); return; }
  if (!matricula)   { mostrarToast('Selecciona la matrícula', 'error'); return; }
  if (!respEntrega) { mostrarToast('Indica quién entrega la tarjeta', 'error'); return; }
  if (importe === '' || isNaN(parseFloat(importe))) { mostrarToast('Indica el importe del ticket', 'error'); return; }
  if (!APPS_SCRIPT_URL) { mostrarToast('Sin URL de Apps Script configurada', 'error'); return; }

  const btn = document.getElementById('btn-guardar-registro-manual');
  const txtOriginal = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Guardando…'; }

  try {
    // 1) Crear el registro (queda como PENDIENTE en el backend)
    const respCrear = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'registrarRepostaje', repostaje: {
        fecha,
        matricula,
        usuario_chofer:  chofer,
        kilometraje:     km,
        num_tarjeta:     tarjeta || 'MANUAL',
        hora_entrega:    horaEntrega,
        gasoil_antes:    gasoilAntes,
        adblue_antes:    adblueAntes,
        resp_entrega:    respEntrega,
      }}),
      redirect: 'follow'
    });
    const jsonCrear = await respCrear.json();
    if (!jsonCrear.ok) throw new Error(jsonCrear.error || 'No se pudo crear el registro');

    // 2) Buscar el id recién creado entre los pendientes para poder completarlo
    let repoId = jsonCrear.id || null;
    if (!repoId) {
      const respPend = await fetch(`${APPS_SCRIPT_URL}?accion=cargarRepostajesPendientes&_t=${Date.now()}`, { redirect: 'follow', cache: 'no-store' });
      const jsonPend = await respPend.json();
      if (jsonPend.ok && jsonPend.filas) {
        const matU = matricula.trim().toUpperCase();
        const candidatos = jsonPend.filas.filter(f => (f.matricula||'').trim().toUpperCase() === matU && (f.fecha||'').substring(0,10) === fecha);
        if (candidatos.length) repoId = candidatos[candidatos.length-1].id;
      }
    }
    if (!repoId) throw new Error('No se encontró el registro recién creado para completarlo');

    // 3) Completar el registro con los datos de "devolución" (importe, ticket, responsable que recibe)
    const respCompletar = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'completarRepostaje', repostaje: {
        id:              repoId,
        hora_devolucion: horaDevolucion,
        gasoil_despues:  gasoilDespues,
        adblue_despues:  adblueDespues,
        ticket_ref:      ticketRef,
        ticket_importe:  importe,
        resp_recibe:     respRecibe,
      }}),
      redirect: 'follow'
    });
    const jsonCompletar = await respCompletar.json();
    if (!jsonCompletar.ok) throw new Error(jsonCompletar.error || 'No se pudo completar el registro');

    cerrarModalRegistroManual();
    await sincronizarRepostajesPendientes();
    await sincronizarRepostajesFecha();
    if (typeof cargarTabRepostajes === 'function') cargarTabRepostajes();
    registrarAccion('REPOSTAJE', 'Registro manual de repostaje (ticket antiguo)', `${matricula} · ${fecha} · ${importe}€`);
    mostrarToast(`✓ Registro manual guardado para ${matricula} (${fecha})`, 'success');
  } catch(e) {
    if ((e.message||'').toLowerCase().includes('kilometraje')) {
      resaltarCampoErrorKm('manual-repo-km');
      mostrarModalErrorKm(e.message);
    } else {
      mostrarToast('⚠️ Error: ' + e.message, 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = txtOriginal; }
  }
}

function exportarRepostajesCSV() {
  if (!repostajesCache.length) { mostrarToast('Sin datos para exportar', 'info'); return; }
  const campos    = ['fecha','matricula','usuario_chofer','kilometraje','num_tarjeta','hora_entrega','hora_devolucion','gasoil_antes','adblue_antes','gasoil_despues','adblue_despues','ticket_ref','ticket_importe','resp_entrega','resp_recibe','estado'];
  const cabeceras = ['Fecha','Matrícula','Chofer','Km','Tarjeta','H.Entrega','H.Devolución','Gasoil Antes%','AdBlue Antes%','Gasoil Después%','AdBlue Después%','Ref.Ticket','Importe','Resp.Entrega','Resp.Recibe','Estado'];
  const csv = [cabeceras.join(';'), ...repostajesCache.map(f =>
    campos.map(c => `"${(f[c]||'').toString().replace(/"/g,'""')}"`).join(';')
  )].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'}));
  a.download = `repostajes_${fechaActual}.csv`;
  a.click();
}

// Genera el PDF directamente desde un objeto repostaje (para uso desde el cuadrante histórico)
function generarPDFRepostajeDirecto(f) {
  if (!f) return;
  _generarPDFDesdeObjeto(f);
}

function generarPDFRepostaje(idx) {
  const f = repostajesCache[idx];
  if (!f) return;
  _generarPDFDesdeObjeto(f);
}

function _generarPDFDesdeObjeto(f) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 18;
  const contentW = pageW - margin * 2;

  // ── Título ──────────────────────────────────────────────────────
  doc.setFillColor(26, 26, 46);
  doc.rect(-10, 12, pageW + 20, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('SOLICITUD DE REPOSTAJE DE VEHICULO', pageW / 2, 21, { align: 'center' });

  // ── Helpers ──────────────────────────────────────────────────────
  function drawCell(x, y, w, h, label, value, bgLabel) {
    doc.setDrawColor(180, 185, 200);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
    if (bgLabel) {
      doc.setFillColor(245, 246, 250);
      doc.rect(x, y, w, 5.5, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 110, 130);
    doc.text(label, x + 2.5, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 46);
    doc.text(String(value || '—'), x + 2.5, y + h - 3);
  }

  // ── Fila 1: Fecha / Matrícula ────────────────────────────────────
  const rowH = 16;
  let y = 30;
  const halfW = contentW / 2;

  const fechaFmt = (f.fecha||'').length >= 10
    ? f.fecha.substring(0,10).split('-').reverse().join('/')
    : (f.fecha || '—');

  drawCell(margin, y, halfW, rowH, 'FECHA', fechaFmt, true);
  drawCell(margin + halfW, y, halfW, rowH, 'MATRÍCULA', f.matricula || '—', true);
  y += rowH;

  // ── Fila 2: Chofer / Kilometraje ─────────────────────────────────
  drawCell(margin, y, halfW, rowH, 'USUARIO CHOFER', f.usuario_chofer || '—', true);
  drawCell(margin + halfW, y, halfW, rowH, 'KILOMETRAJE', f.kilometraje ? Number(f.kilometraje).toLocaleString('es-ES') + ' km' : '—', true);
  y += rowH;

  // ── Fila 3: Nº Tarjeta + celdas grandes ANTES/DESPUÉS ────────────
  const col1W = halfW;
  const col2W = halfW / 2;
  const col3W = halfW / 2;
  const gaugeRowH = 40;

  // Columna izquierda: Nº Tarjeta + Hora entrega + Hora devolución
  const subRowH = gaugeRowH / 3;
  drawCell(margin, y, col1W, subRowH, 'NÚMERO DE TARJETA', f.num_tarjeta || '—', true);
  drawCell(margin, y + subRowH, col1W, subRowH, 'HORA ENTREGA TARJETA', f.hora_entrega || '—', true);
  drawCell(margin, y + subRowH * 2, col1W, subRowH, 'HORA DEVOLUCIÓN TARJETA', f.hora_devolucion || '—', true);

  // Columna ANTES
  const antesX = margin + col1W;
  doc.setDrawColor(180, 185, 200);
  doc.setLineWidth(0.3);
  doc.rect(antesX, y, col2W, gaugeRowH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 110, 130);
  doc.setFillColor(245, 246, 250);
  doc.rect(antesX, y, col2W, 5.5, 'F');
  doc.text('ANTES DE REPOSTAR', antesX + col2W / 2, y + 4, { align: 'center' });
  // Medidor semicircular ANTES
  drawFuelGauge(doc, antesX + col2W / 2, y + gaugeRowH / 2, 12, f.gasoil_antes);
  // AdBlue
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 90, 110);
  doc.text('AdBlue: ' + (f.adblue_antes === 'N/A' ? 'No' : f.adblue_antes !== '' && f.adblue_antes !== undefined ? f.adblue_antes + '%' : '—'), antesX + col2W / 2, y + gaugeRowH - 3, { align: 'center' });

  // Columna DESPUÉS
  const despuesX = margin + col1W + col2W;
  doc.setDrawColor(180, 185, 200);
  doc.rect(despuesX, y, col3W, gaugeRowH);
  doc.setFillColor(245, 246, 250);
  doc.rect(despuesX, y, col3W, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 110, 130);
  doc.text('DESPUÉS DE REPOSTAR', despuesX + col3W / 2, y + 4, { align: 'center' });
  drawFuelGauge(doc, despuesX + col3W / 2, y + gaugeRowH / 2, 12, f.gasoil_despues);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 90, 110);
  doc.text('AdBlue: ' + (f.adblue_despues !== '' && f.adblue_despues !== undefined ? f.adblue_despues + '%' : '—'), despuesX + col3W / 2, y + gaugeRowH - 3, { align: 'center' });

  y += gaugeRowH;

  // ── Fila responsable ─────────────────────────────────────────────
  const respH = 12;
  doc.setDrawColor(180, 185, 200);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentW, respH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(26, 26, 46);
  doc.text('RESPONSABLE:', margin + 2.5, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(f.resp_entrega || '', margin + 32, y + 8);
  y += respH;

  // ── Fila Ref. Ticket / Importe ────────────────────────────────────
  const ticketRefTxt     = f.ticket_ref || '—';
  const ticketImporteTxt = (f.ticket_importe !== '' && f.ticket_importe !== undefined && f.ticket_importe !== null)
    ? Number(f.ticket_importe).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    : '—';
  drawCell(margin, y, halfW, rowH, 'REF. TICKET', ticketRefTxt, true);
  drawCell(margin + halfW, y, halfW, rowH, 'IMPORTE', ticketImporteTxt, true);
  y += rowH;

  // ── Línea de firma ───────────────────────────────────────────────
  y += 10;
  doc.setDrawColor(180, 185, 200);
  doc.setLineWidth(0.4);
  const sigW = (contentW - 12) / 2;
  doc.line(margin, y, margin + sigW, y);
  doc.line(margin + sigW + 12, y, margin + contentW, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 130, 150);
  doc.text('Firma responsable entrega', margin + sigW / 2, y + 4, { align: 'center' });
  doc.text('Firma conductor', margin + sigW + 12 + sigW / 2, y + 4, { align: 'center' });

  // ── Pie de página ─────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(160, 170, 185);
  doc.text('Gestión de Flota · Primor', pageW / 2, 285, { align: 'center' });
  doc.text('Generado: ' + new Date().toLocaleString('es-ES'), pageW / 2, 289, { align: 'center' });

  const mat = (f.matricula || 'repostaje').replace(/[^a-zA-Z0-9]/g, '_');
  const pdfBlob = doc.output('blob');
  const pdfUrl  = URL.createObjectURL(pdfBlob);

  // Mostrar PDF en overlay modal con iframe
  let pdfOverlay = document.getElementById('pdf-repostaje-overlay');
  if (pdfOverlay) pdfOverlay.remove();

  pdfOverlay = document.createElement('div');
  pdfOverlay.id = 'pdf-repostaje-overlay';
  pdfOverlay.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(10,12,30,0.80);backdrop-filter:blur(3px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;';
  pdfOverlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;width:90vw;max-width:900px;">
      <span style="color:#e2e8f0;font-size:14px;font-weight:700;flex:1;">📄 Solicitud de repostaje</span>
      <button onclick="document.getElementById('pdf-repostaje-overlay').remove();URL.revokeObjectURL('${pdfUrl}')"
        style="padding:8px 20px;background:#e84545;color:white;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;letter-spacing:0.5px;">
        ✕ Cerrar
      </button>
      <a href="${pdfUrl}" download="repostaje_${mat}_${fechaFmt.replace(/\//g,'-')}.pdf"
        style="padding:8px 18px;background:#2a4a2a;color:#4ade80;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;text-decoration:none;letter-spacing:0.5px;">
        ⬇ Descargar
      </a>
    </div>
    <iframe src="${pdfUrl}" style="width:90vw;max-width:900px;height:80vh;border:none;border-radius:10px;box-shadow:0 24px 64px rgba(0,0,0,0.5);"></iframe>`;
  document.body.appendChild(pdfOverlay);

  // Renderizar con pdf.js
  (async () => {
    try {
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      if (!pdfjsLib) {
        // pdf.js no cargado aún — cargar dinámicamente
        await new Promise((resolve, reject) => {
          if (document.getElementById('pdfjs-script')) { resolve(); return; }
          const s = document.createElement('script');
          s.id = 'pdfjs-script';
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const lib = window['pdfjs-dist/build/pdf'];
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const arrayBuf = await fetch(pdfUrl).then(r => r.arrayBuffer());
      const pdfDoc   = await lib.getDocument({ data: arrayBuf }).promise;
      const page     = await pdfDoc.getPage(1);

      const canvas  = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx     = canvas.getContext('2d');

      // Calcular escala para que quepa en pantalla
      const maxW    = Math.min(window.innerWidth * 0.88, 760);
      const vp0     = page.getViewport({ scale: 1 });
      const scale   = maxW / vp0.width;
      const vp      = page.getViewport({ scale });

      canvas.width  = vp.width;
      canvas.height = vp.height;
      canvas.style.width  = vp.width  + 'px';
      canvas.style.height = vp.height + 'px';

      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    } catch(e) {
      console.error('pdf.js render error:', e);
      // Fallback al iframe si pdf.js falla
      const canvas = document.getElementById(canvasId);
      if (canvas && canvas.parentElement) {
        canvas.parentElement.innerHTML = `<iframe src="${pdfUrl}" style="width:min(90vw,760px);height:80vh;border:none;display:block;"></iframe>`;
      }
    }
  })();
}

// Dibuja un medidor semicircular de combustible
function drawFuelGauge(doc, cx, cy, r, pct) {
  // Arco de fondo gris
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(2);
  // jsPDF no tiene arc nativo, usamos lines para simular el semicírculo
  const steps = 36;
  const startAngle = Math.PI;
  const endAngle   = 0;
  function toRad(deg) { return deg * Math.PI / 180; }

  // Fondo gris (semicírculo completo)
  let pts = [];
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / steps);
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(2.2);
  for (let i = 0; i < pts.length - 1; i++) {
    doc.line(pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]);
  }

  // Arco coloreado según nivel
  const level = (parseFloat(pct) || 0) / 100;
  const fillEnd = startAngle + (endAngle - startAngle) * level;
  const color = level > 0.5 ? [39, 174, 96] : level > 0.25 ? [230, 126, 34] : [231, 76, 60];
  doc.setDrawColor(...color);
  doc.setLineWidth(2.2);
  let pts2 = [];
  for (let i = 0; i <= Math.round(steps * level); i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / steps);
    pts2.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  for (let i = 0; i < pts2.length - 1; i++) {
    doc.line(pts2[i][0], pts2[i][1], pts2[i+1][0], pts2[i+1][1]);
  }

  // Aguja
  const needleAngle = startAngle + (endAngle - startAngle) * level;
  const nx = cx + (r - 2) * Math.cos(needleAngle);
  const ny = cy + (r - 2) * Math.sin(needleAngle);
  doc.setDrawColor(80, 80, 100);
  doc.setLineWidth(0.6);
  doc.line(cx, cy, nx, ny);

  // Centro del medidor
  doc.setFillColor(80, 80, 100);
  doc.circle(cx, cy, 1, 'F');

  // Etiquetas E / F
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 100);
  doc.text('E', cx - r - 1, cy + 3);
  doc.text('F', cx + r - 0.5, cy + 3);

  // Porcentaje
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...color);
  doc.text((pct !== '' && pct !== undefined ? pct + '%' : '—'), cx, cy + 6, { align: 'center' });
}

async function eliminarRepostajeAdmin(idx) {
  const rep = repostajesCache[idx];
  if (!rep) return;
  if (!APPS_SCRIPT_URL) { mostrarToast('Sin URL de Apps Script configurada', 'error'); return; }

  const matricula = rep.matricula || '—';
  const fecha     = rep.fecha ? rep.fecha.substring(0,10).split('-').reverse().join('-') : '—';

  // Modal de confirmación
  await new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:5000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
    ov.innerHTML = `
      <div style="background:white;border-radius:18px;padding:32px 28px 24px;width:420px;max-width:95vw;box-shadow:0 32px 80px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;animation:nv-in 0.22s cubic-bezier(.34,1.56,.64,1)">
        <div style="font-size:36px;margin-bottom:10px;">🗑️</div>
        <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:6px;">¿Eliminar repostaje?</div>
        <div style="font-size:11px;color:#8899aa;margin-bottom:14px;">
          <span style="font-weight:700;color:#1a1a2e">${esc(matricula)}</span>
          · ${fecha}
          · Chofer: <strong>${esc(rep.usuario_chofer||'—')}</strong>
        </div>
        <div style="background:#fff5f5;border:1px solid #ffd0d0;border-radius:9px;padding:10px 14px;font-size:12px;color:#444;line-height:1.5;margin-bottom:20px;">
          Tarjeta: <strong>${esc(rep.num_tarjeta||'—')}</strong> · 
          Estado: <strong>${esc(rep.estado||'—')}</strong>
        </div>
        <div style="font-size:11px;color:#e84545;font-weight:700;margin-bottom:20px;">⚠️ Esta acción no se puede deshacer.</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="btn-repo-cancel" style="padding:10px 22px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>
          <button id="btn-repo-confirmar" style="padding:10px 22px;background:#e84545;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">🗑 Sí, eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#btn-repo-cancel').onclick    = () => { document.body.removeChild(ov); resolve(false); };
    ov.querySelector('#btn-repo-confirmar').onclick = () => { document.body.removeChild(ov); resolve(true);  };
  }).then(async (confirmado) => {
    if (!confirmado) return;

    // Modal borrando
    const ovB = document.createElement('div');
    ovB.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:5100;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
    ovB.innerHTML = `
      <div style="background:white;border-radius:16px;padding:32px 36px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;animation:nv-in 0.2s ease;min-width:260px">
        <div style="width:40px;height:40px;border:3px solid #f0f0f0;border-top-color:#e84545;border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto 16px"></div>
        <div style="font-size:14px;font-weight:800;color:#1a1a2e;">Eliminando repostaje…</div>
        <div style="font-size:11px;color:#8899aa;margin-top:5px">${esc(matricula)} · ${fecha}</div>
      </div>`;
    document.body.appendChild(ovB);

    try {
      // Eliminar desde Sheets usando el ID del repostaje
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ accion: 'eliminarRepostaje', id: rep.id })
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Error en Sheets');
      repostajesCache.splice(idx, 1);
      renderTabRepostajes();
      // Limpiar num_tarjeta del cuadrante en memoria y guardar en Registros
      setDato(rep.matricula, 'num_tarjeta', '');
      programarGuardado();
      // Limpiar inmediatamente los mapas de badges para que renderTabla
      // muestre el botón "Registrar" sin esperar al fetch
      const matUp = (rep.matricula || '').trim().toUpperCase();
      delete _repostajesPendientesMat[matUp];
      delete _repostajesFechaMat[matUp];
      renderTabla();
      // Luego sincronizar con Sheets para confirmar estado real
      await sincronizarRepostajesPendientes();
      await sincronizarRepostajesFecha();
      renderTabla();
      registrarAccion('REPOSTAJE', 'Eliminar repostaje', `${rep.matricula} · tarjeta ${rep.num_tarjeta||'—'} · ${rep.fecha||'—'}`);
      mostrarToast('✓ Repostaje eliminado', 'success');
    } catch(e) {
      mostrarToast('Error al eliminar: ' + e.message, 'error');
    } finally {
      document.body.removeChild(ovB);
    }
  });
}

async function cargarTabIncidencias() {
  const tbody = document.getElementById('incid-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="hist-empty">⏳ Cargando datos un momento por favor…</td></tr>';

  const desde    = document.getElementById('incid-fecha-desde').value;
  const hasta    = document.getElementById('incid-fecha-hasta').value;
  const matricula = (document.getElementById('incid-filtro-matricula').value || '').trim();
  const estado    = (document.getElementById('incid-filtro-estado').value || '').trim();

  if (!APPS_SCRIPT_URL) {
    tbody.innerHTML = '<tr><td colspan="6" class="hist-empty">⚠️ Sin URL de Apps Script configurada.</td></tr>';
    return;
  }

  try {
    let url = `${APPS_SCRIPT_URL}?accion=cargarIncidencias`;
    if (desde)    url += `&desde=${desde}`;
    if (hasta)    url += `&hasta=${hasta}`;
    if (matricula) url += `&matricula=${encodeURIComponent(matricula)}`;
    const resp = await fetch(url, { redirect: 'follow' });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'Error en Sheets');
    // Filtrar por estado en cliente (Apps Script no lo filtra)
    incidenciasCache = (json.filas || []).filter(f => !estado || (f.estado||'').toUpperCase() === estado);
    renderTabIncidencias();
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" class="hist-empty">Error al cargar: ${e.message}</td></tr>`;
  }
}

function renderTabIncidencias() {
  const tbody = document.getElementById('incid-tbody');
  if (!tbody) return;
  if (!incidenciasCache.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="hist-empty">Sin incidencias en el rango seleccionado.</td></tr>';
    return;
  }
  tbody.innerHTML = incidenciasCache.map((f, idx) => {
    // Formatear timestamp a hora legible
    let hora = '—';
    try { hora = new Date(f.timestamp).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); } catch(e){}
    const completado = (f.estado||'').toUpperCase() === 'COMPLETADO';
    const estadoBadge = completado
      ? `<span style="font-size:9px;font-weight:800;color:#1a6635;background:#eafaf1;border:1px solid #a9dfbf;border-radius:5px;padding:2px 8px;white-space:nowrap">✅ Resuelto</span>`
      : `<span style="font-size:9px;font-weight:800;color:#92600a;background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:2px 8px;white-space:nowrap">⏳ Pendiente</span>`;
    return `<tr style="background:${completado?'#f9fffe':''}">
      <td style="white-space:nowrap;font-size:11px">${hora}</td>
      <td><strong>${f.matricula||'—'}</strong></td>
      <td style="font-size:11px">${f.responsable||'—'}</td>
      <td style="font-size:12px;line-height:1.5;max-width:320px;word-break:break-word">${esc(f.descripcion||'—')}</td>
      <td style="text-align:center;white-space:nowrap">${estadoBadge}</td>
      <td style="text-align:center;white-space:nowrap">
        ${!completado ? `<button class="btn-item-action" onclick="resolverIncidencia(${idx})" title="Marcar como resuelta" style="font-size:11px;padding:3px 8px;color:#1a6635;border-color:#a9dfbf;background:#eafaf1;margin-right:3px">✓ Resolver</button>` : ''}
        ${completado ? `<button class="btn-item-action" onclick="verResolucionIncidencia(${idx})" title="Ver resolución" style="font-size:11px;padding:3px 8px;color:#1a6635;border-color:#a9dfbf;background:#eafaf1;margin-right:3px">ℹ️ Ver resolución</button>` : ''}
        <button class="btn-item-action danger" onclick="eliminarIncidencia(${idx})" title="Eliminar incidencia" style="font-size:13px;padding:3px 8px">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function verResolucionIncidencia(idx) {
  const inc = incidenciasCache[idx];
  if (!inc) return;
  let fechaResLabel = '—';
  try { fechaResLabel = new Date(inc.fecha_resolucion).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); } catch(e){}
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,30,0.7);backdrop-filter:blur(3px);z-index:5000;display:flex;align-items:center;justify-content:center;';
  ov.innerHTML = `
    <div style="background:white;border-radius:18px;padding:28px 26px 22px;width:420px;max-width:94vw;box-shadow:0 32px 80px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1);">
      <div style="font-size:36px;text-align:center;margin-bottom:8px;">✅</div>
      <div style="font-size:16px;font-weight:900;color:#1a6635;text-align:center;margin-bottom:4px;">Incidencia resuelta</div>
      <div style="font-size:12px;color:#8899aa;text-align:center;margin-bottom:18px;">${esc(inc.matricula||'—')}</div>
      <div style="background:#f4f6fb;border:1.5px solid #e3e8f5;border-radius:10px;padding:12px 14px;font-size:12px;color:#334;line-height:1.7;">
        <div><strong style="color:#556">Resuelto por:</strong> ${esc(inc.resuelto_por||'—')}</div>
        <div><strong style="color:#556">Fecha de resolución:</strong> ${esc(fechaResLabel)}</div>
        ${inc.comentario_resolucion ? `<div style="margin-top:8px;"><strong style="color:#556">Comentario:</strong><br>${esc(inc.comentario_resolucion)}</div>` : ''}
      </div>
      <button id="btn-ver-res-cerrar" style="width:100%;margin-top:18px;padding:11px;background:#f0f2f5;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">Cerrar</button>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#btn-ver-res-cerrar').onclick = () => document.body.removeChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) document.body.removeChild(ov); });
}

function exportarIncidenciasCSV() {
  if (!incidenciasCache.length) { mostrarToast('Sin datos para exportar', 'info'); return; }
  const campos = ['timestamp','turno','matricula','responsable','descripcion','estado'];
  const cabeceras = ['Fecha/Hora','Turno','Matrícula','Responsable','Descripción','Estado'];
  const csv = [cabeceras.join(';'), ...incidenciasCache.map(f =>
    campos.map(c => `"${(f[c]||'').replace(/"/g,'""')}"`).join(';')
  )].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'}));
  a.download = `incidencias_${fechaActual}.csv`;
  a.click();
}

async function resolverIncidencia(idx) {
  const inc = incidenciasCache[idx];
  if (!inc || !APPS_SCRIPT_URL) return;

  // Modal de confirmación
  const confirmado = await new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,30,0.7);backdrop-filter:blur(3px);z-index:5000;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = `
      <div style="background:white;border-radius:18px;padding:32px 28px 24px;width:400px;max-width:94vw;box-shadow:0 32px 80px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1);text-align:center;">
        <div style="font-size:44px;margin-bottom:12px;">✅</div>
        <div style="font-size:17px;font-weight:900;color:#1a1a2e;margin-bottom:8px;">¿Marcar como resuelta?</div>
        <div style="background:#f4f6fb;border:1.5px solid #e3e8f5;border-radius:10px;padding:12px 16px;margin-bottom:18px;text-align:left;">
          <div style="font-size:10px;font-weight:800;color:#8899aa;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Incidencia</div>
          <div style="font-size:12px;font-weight:700;color:#e84545;margin-bottom:4px;">🚛 ${esc(inc.matricula||'—')}</div>
          <div style="font-size:12px;color:#334;line-height:1.5;word-break:break-word;">${esc((inc.descripcion||'').substring(0,120))}${inc.descripcion && inc.descripcion.length>120?'…':''}</div>
        </div>
        <div style="font-size:12px;color:#8899aa;line-height:1.6;margin-bottom:22px;">
          Se marcará como <strong style="color:#1a6635">Resuelto</strong> en el sistema.<br>
          Si el vehículo estaba bloqueado por esta incidencia, <strong>deberás desbloquearlo manualmente</strong> desde el panel de vehículos.
        </div>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button id="inc-resolver-cancel" style="padding:10px 22px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>
          <button id="inc-resolver-ok" style="padding:10px 26px;background:#2ecc71;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:900;cursor:pointer;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(46,204,113,0.3);transition:background .15s;" onmouseover="this.style.background='#27ae60'" onmouseout="this.style.background='#2ecc71'">✓ Sí, marcar como resuelta</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#inc-resolver-cancel').onclick = () => { document.body.removeChild(ov); resolve(false); };
    ov.querySelector('#inc-resolver-ok').onclick     = () => { document.body.removeChild(ov); resolve(true); };
  });

  if (!confirmado) return;

  // Modal de progreso
  const ovP = document.createElement('div');
  ovP.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:5100;display:flex;align-items:center;justify-content:center;';
  ovP.innerHTML = `
    <div style="background:white;border-radius:16px;padding:32px 36px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;min-width:260px">
      <div style="width:40px;height:40px;border:3px solid #f0f0f0;border-top-color:#2ecc71;border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto 16px"></div>
      <div style="font-size:14px;font-weight:800;color:#1a1a2e;">Marcando como resuelta…</div>
      <div style="font-size:11px;color:#8899aa;margin-top:5px">${esc(inc.matricula||'')}</div>
    </div>`;
  document.body.appendChild(ovP);

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        accion: 'resolverIncidencia',
        timestamp: inc.timestamp,
        matricula: inc.matricula,
        resueltoPor: usuarioActual ? (usuarioActual.nombre || usuarioActual.numUsuario) : '—',
      })
    });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'Error en Sheets');

    // Actualizar caché local
    incidenciasCache[idx].estado = 'COMPLETADO';
    renderTabIncidencias();
    registrarAccion('INCIDENCIA', 'Resolver incidencia', `${inc.matricula} · ${(inc.descripcion||'').substring(0,60)}`);
    mostrarToast(`✅ Incidencia de ${inc.matricula} marcada como resuelta`, 'success');
    actualizarBotonIncidenciasPendientes();
  } catch(e) {
    mostrarToast('Error al resolver la incidencia: ' + e.message, 'error');
  } finally {
    document.body.removeChild(ovP);
  }
}

async function eliminarIncidencia(idx) {
  const inc = incidenciasCache[idx];
  if (!inc) return;
  if (!APPS_SCRIPT_URL) { mostrarToast('Sin URL de Apps Script configurada', 'error'); return; }

  const desc = (inc.descripcion || '').substring(0, 80);
  const descCorta = desc + (inc.descripcion && inc.descripcion.length > 80 ? '…' : '');

  // ── Modal de confirmación ─────────────────────────────────────────────────
  await new Promise((resolve) => {
    const overlayConfirm = document.createElement('div');
    overlayConfirm.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:5000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
    overlayConfirm.innerHTML = `
      <div style="background:white;border-radius:18px;padding:32px 28px 24px;width:440px;max-width:95vw;box-shadow:0 32px 80px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;animation:nv-in 0.22s cubic-bezier(.34,1.56,.64,1)">
        <div style="font-size:36px;margin-bottom:10px;">🗑️</div>
        <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:6px;">¿Eliminar incidencia?</div>
        <div style="font-size:11px;color:#8899aa;margin-bottom:14px;">
          <span style="font-weight:700;color:#1a1a2e">${inc.matricula}</span>
          · ${inc.fecha || ''}
          · ${inc.turno === 'MANANA' ? 'Mañana' : (inc.turno || '')}
        </div>
        <div style="background:#fff5f5;border:1px solid #ffd0d0;border-radius:9px;padding:10px 14px;font-size:12px;color:#444;line-height:1.5;margin-bottom:20px;max-height:80px;overflow:hidden;word-break:break-word;">
          "${descCorta}"
        </div>
        <div style="font-size:11px;color:#e84545;font-weight:700;margin-bottom:20px;">⚠️ Esta acción no se puede deshacer.</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="btn-incid-cancel"
            style="padding:10px 22px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
            Cancelar
          </button>
          <button id="btn-incid-confirmar"
            style="padding:10px 22px;background:#e84545;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:0.3px;">
            🗑 Sí, eliminar
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlayConfirm);

    overlayConfirm.querySelector('#btn-incid-cancel').onclick = () => {
      document.body.removeChild(overlayConfirm);
      resolve(false);
    };
    overlayConfirm.querySelector('#btn-incid-confirmar').onclick = () => {
      document.body.removeChild(overlayConfirm);
      resolve(true);
    };
  }).then(async (confirmado) => {
    if (!confirmado) return;

    // ── Modal "Borrando…" ───────────────────────────────────────────────────
    const overlayBorrando = document.createElement('div');
    overlayBorrando.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:5100;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
    overlayBorrando.innerHTML = `
      <div style="background:white;border-radius:16px;padding:32px 36px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;animation:nv-in 0.2s ease;min-width:260px">
        <div style="width:40px;height:40px;border:3px solid #f0f0f0;border-top-color:#e84545;border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto 16px"></div>
        <div style="font-size:14px;font-weight:800;color:#1a1a2e;letter-spacing:0.3px;">Borrando incidencia…</div>
        <div style="font-size:11px;color:#8899aa;margin-top:5px">${inc.matricula}</div>
      </div>`;
    document.body.appendChild(overlayBorrando);

    try {
      // 1. Borrar de la hoja Incidencias
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ accion: 'eliminarIncidencia', timestamp: inc.timestamp, matricula: inc.matricula })
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Error en Sheets');

      // 2. Actualizar memoria local y refrescar cuadrante
      const key = `${inc.matricula}|${inc.turno}|${inc.fecha}`;
      const keyActual = `${inc.matricula}|${turnoActual}|${fechaActual}`;
      if (datos[key]) datos[key].incidencias = '';
      if (datos[keyActual]) datos[keyActual].incidencias = '';

      // 3. Si el vehículo estaba bloqueado por esta incidencia, el backend
      // ya lo ha desbloqueado en Supabase: reflejarlo ya en memoria local.
      if (json.vehiculoDesbloqueado) {
        GRUPOS.forEach(g => g.vehiculos.forEach(v => {
          if (v.matricula === inc.matricula) {
            v.bloqueado      = false;
            v.motivo_bloqueo = '';
            v.bloqueado_por  = '';
            v.fecha_bloqueo  = '';
          }
        }));
        renderAdminVehiculos();
      }

      renderTabla();

      incidenciasCache.splice(idx, 1);
      renderTabIncidencias();
      mostrarToast(json.vehiculoDesbloqueado ? '✓ Incidencia eliminada · Vehículo desbloqueado' : '✓ Incidencia eliminada', 'success');
      actualizarBotonIncidenciasPendientes();
    } catch(e) {
      mostrarToast('Error al eliminar: ' + e.message, 'error');
    } finally {
      document.body.removeChild(overlayBorrando);
    }
  });
}
  // ════════════════════════════════════════════════════════════════════════════
// IMPRIMIR CUADRANTE — solo vehículos asignados, horizontal
// ════════════════════════════════════════════════════════════════════════════
function imprimirCuadrante() {
  const turnoLabel = turnoActual === 'MANANA' ? 'MAÑANA' : turnoActual;
  const fechaLabel = fechaActual
    ? new Date(fechaActual + 'T12:00:00').toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    : fechaActual;

  const filas = [];
  GRUPOS.forEach(g => {
    g.vehiculos.forEach(v => {
      if (v.archivado) return;
      const d = getDato(v.matricula);
      if (!d.operario || !d.operario.trim()) return;
      const reasignaciones = d._reasignaciones || [];
      filas.push({ v, d, reasignaciones });
    });
  });

  if (filas.length === 0) {
    mostrarToast('No hay vehículos asignados para imprimir', 'info');
    return;
  }

  const vacio = '-';

  const filasTbody = filas.map(({ v, d, reasignaciones }) => {
    const tieneIncid = d.incidencias && d.incidencias.trim();
    const incidBadge = tieneIncid
      ? `<span style="color:#c47d00;font-weight:800;">&#9888; Si</span>`
      : `<span style="color:#aaa;">-</span>`;

    let reasigHtml = '';
    if (reasignaciones.length > 0) {
      reasigHtml = reasignaciones.map(r => `
        <tr style="background:#fff8f0;font-size:9px;color:#92600a;">
          <td style="padding:4px 8px;border:1px solid #fde68a;font-style:italic;color:#6b7a94;">
            &#8635; Conductor anterior
          </td>
          <td style="padding:4px 8px;border:1px solid #fde68a;">${esc(r.operario||vacio)}</td>
          <td style="padding:4px 8px;border:1px solid #fde68a;">${esc(r.resp_entrega||vacio)}</td>
          <td style="padding:4px 8px;border:1px solid #fde68a;">${esc(fmtHora(r.hora_entrega)||vacio)}</td>
          <td style="padding:4px 8px;border:1px solid #fde68a;">${esc(r.resp_recibe||vacio)}</td>
          <td style="padding:4px 8px;border:1px solid #fde68a;">${esc(fmtHora(r.hora_reasignacion)||vacio)}</td>
          <td style="padding:4px 8px;border:1px solid #fde68a;">-</td>
          <td style="padding:4px 8px;border:1px solid #fde68a;">-</td>
        </tr>`).join('');
    }

    return `
      <tr>
        <td style="padding:6px 8px;border:1px solid #dde1ea;font-weight:800;font-size:11px;">${esc(v.matricula)}</td>
        <td style="padding:6px 8px;border:1px solid #dde1ea;font-weight:700;">${esc(d.operario||vacio)}</td>
        <td style="padding:6px 8px;border:1px solid #dde1ea;">${esc(d.resp_entrega||vacio)}</td>
        <td style="padding:6px 8px;border:1px solid #dde1ea;font-weight:700;">${esc(d.hora_entrega||vacio)}</td>
        <td style="padding:6px 8px;border:1px solid #dde1ea;">${esc(d.resp_recibe||vacio)}</td>
        <td style="padding:6px 8px;border:1px solid #dde1ea;font-weight:700;">${esc(d.hora_devolucion||vacio)}</td>
        <td style="padding:6px 8px;border:1px solid #dde1ea;">${esc(d.num_tarjeta||vacio)}</td>
        <td style="padding:6px 8px;border:1px solid #dde1ea;text-align:center;">${incidBadge}</td>
      </tr>
      ${reasigHtml}`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>Cuadrante ${turnoLabel} - ${fechaActual}</title>
  <style>
    @page { size: A4 landscape; margin: 14mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a2e; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; border-bottom: 3px solid #e84545; padding-bottom: 10px; }
    .header-title { font-size: 20px; font-weight: 900; color: #1a1a2e; letter-spacing: 0.5px; }
    .header-sub { font-size: 12px; color: #6b7a94; margin-top: 3px; text-transform: capitalize; }
    .header-meta { text-align: right; font-size: 10px; color: #8899aa; }
    .header-meta strong { display: block; font-size: 13px; color: #1a1a2e; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: #1a1a2e !important; color: #fff; font-size: 10px;
      font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
      padding: 8px; text-align: left; border: 1px solid #2a2a4e;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    tbody tr:nth-child(even) { background: #f8f9fc; }
    .footer { margin-top: 14px; font-size: 9px; color: #b0bac8; text-align: right; }
    .badge-total { display: inline-block; background: #e84545; color: white; border-radius: 6px; padding: 2px 10px; font-size: 11px; font-weight: 800; margin-left: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-title">&#128273; Cuadrante de Flota - Primor <span class="badge-total">${filas.length} vehiculos</span></div>
      <div class="header-sub">${fechaLabel} - Turno ${turnoLabel}</div>
    </div>
    <div class="header-meta">
      <strong>Gestion de Flota</strong>
      Impreso: ${new Date().toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Matricula</th>
        <th>Operario</th>
        <th>Resp. Entrega</th>
        <th>Hora Entrega</th>
        <th>Resp. Recibe</th>
        <th>Hora Devolucion</th>
        <th>Num. Tarjeta</th>
        <th>Incidencia</th>
      </tr>
    </thead>
    <tbody>
      ${filasTbody}
    </tbody>
  </table>
  <div class="footer">Gestion de Flota - Primor - Documento generado automaticamente</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1100,height=700');
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}
// La contraseña de admin por defecto es "admin123" — cámbiala en Panel Admin.
// ════════════════════════════════════════════════════════════════════════════
  
  // ════════════════════════════════════════════════════════════════════════════
// CERRAR PESTAÑA — cerrar sesión automáticamente
// ════════════════════════════════════════════════════════════════════════════
window.addEventListener('beforeunload', e => {
  if (usuarioActual) {
    enviarDesconexion();
    e.preventDefault();
    e.returnValue = '';
  }
});
