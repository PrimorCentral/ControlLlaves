// ════════════════════════════════════════════════════════════════════════════
// GESTOR DE DOCUMENTOS — Panel Admin (Cloudinary)
// ════════════════════════════════════════════════════════════════════════════
const _DOCS_CATS = [
  { id: 'ficha_tecnica',       label: 'Ficha técnica',          icon: '📄' },
  { id: 'permiso_circulacion', label: 'Permiso de circulación', icon: '🪪' },
  { id: 'informe_itv',         label: 'Informe ITV',            icon: '🔧' },
  { id: 'poliza_seguro',       label: 'Póliza de seguro',       icon: '🛡️' },
  { id: 'otros',               label: 'Otros',                  icon: '📎' },
];

async function abrirGestorDocumentos(matricula) {
  // ── Overlay ──
  const overlay = document.createElement('div');
  overlay.id = 'overlay-docs';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(5,5,20,0.82);z-index:6000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:580px;max-width:97vw;max-height:88vh;
                display:flex;flex-direction:column;box-shadow:0 40px 100px rgba(0,0,0,0.5);
                font-family:'Barlow',sans-serif;overflow:hidden;">

      <!-- Cabecera -->
      <div style="background:linear-gradient(135deg,#0c0c20,#1a1a3a);padding:20px 22px 16px;flex-shrink:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <div>
            <div style="font-size:9px;font-weight:900;letter-spacing:3px;color:rgba(255,255,255,0.35);text-transform:uppercase;">Panel Admin · Documentos</div>
            <div style="font-size:20px;font-weight:900;color:#fff;margin-top:4px;">📂 ${esc(matricula)}</div>
          </div>
          <button id="docs-close" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);
            color:#7788bb;width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:15px;
            display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
      </div>

      <!-- Subir nuevo -->
      <div style="background:#f8faff;border-bottom:1.5px solid #e8ecf4;padding:16px 20px;flex-shrink:0;">
        <div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#3b5bdb;margin-bottom:10px;">➕ Subir nuevo documento</div>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
          <div style="flex:1;min-width:160px;">
            <label style="font-size:9px;font-weight:700;color:#8899aa;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:4px;">Categoría</label>
            <select id="docs-cat" style="width:100%;padding:8px 10px;border:1.5px solid #dde1ea;border-radius:8px;font-family:'Barlow',sans-serif;font-size:12px;font-weight:700;color:#1a1a2e;background:#fff;outline:none;">
              ${_DOCS_CATS.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1;min-width:160px;">
            <label style="font-size:9px;font-weight:700;color:#8899aa;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:4px;">Archivo (PDF / Imagen)</label>
            <input type="file" id="docs-file" accept=".pdf,image/*"
              style="width:100%;padding:6px 10px;border:1.5px solid #dde1ea;border-radius:8px;font-family:'Barlow',sans-serif;font-size:11px;font-weight:600;color:#1a1a2e;background:#fff;cursor:pointer;outline:none;">
          </div>
          <button id="docs-subir" style="padding:9px 18px;background:#16a34a;color:#fff;border:none;border-radius:9px;
            font-family:'Barlow',sans-serif;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;
            box-shadow:0 4px 14px rgba(22,163,74,0.3);flex-shrink:0;">⬆ Subir</button>
        </div>
        <div id="docs-upload-status" style="margin-top:8px;font-size:11px;font-weight:700;display:none;"></div>
      </div>

      <!-- Lista documentos -->
      <div id="docs-lista" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:8px;
           scrollbar-width:thin;scrollbar-color:#dde1ea transparent;">
        <div style="display:flex;align-items:center;gap:8px;color:#8899aa;font-size:12px;font-weight:600;padding:20px 0;justify-content:center;">
          <div style="width:18px;height:18px;border:2.5px solid #e0e4ed;border-top-color:#3b5bdb;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;"></div>
          Cargando documentos…
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Cerrar
  overlay.querySelector('#docs-close').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  // Cargar docs actuales
  await _docsCargar(matricula, overlay);

  // Subir
  overlay.querySelector('#docs-subir').onclick = () => _docsSubir(matricula, overlay);
}

async function _docsCargar(matricula, overlay) {
  const lista = overlay.querySelector('#docs-lista');
  lista.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:#8899aa;font-size:12px;font-weight:600;padding:20px 0;justify-content:center;">
    <div style="width:18px;height:18px;border:2.5px solid #e0e4ed;border-top-color:#3b5bdb;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;"></div>
    Cargando documentos…</div>`;
  try {
    const r = await fetch(`${APPS_SCRIPT_URL}?accion=cargarDocumentos&matricula=${encodeURIComponent(matricula)}`);
    const d = await r.json();
    _docsRender(d.docs || [], matricula, overlay);
  } catch(e) {
    lista.innerHTML = `<div style="color:#e84545;font-size:12px;font-weight:700;padding:16px 0;text-align:center;">Error al cargar documentos</div>`;
  }
}

function _docsRender(docs, matricula, overlay) {
  const lista = overlay.querySelector('#docs-lista');
  if (docs.length === 0) {
    lista.innerHTML = `<div style="text-align:center;padding:30px 0;color:#b0bac8;font-size:13px;font-weight:600;">
      <div style="font-size:36px;margin-bottom:8px;">📂</div>
      No hay documentos aún.<br>
      <span style="font-size:11px;">Usa el formulario de arriba para subir el primero.</span>
    </div>`;
    return;
  }

  // Agrupar por categoría
  let html = '';
  _DOCS_CATS.forEach(cat => {
    const catDocs = docs.filter(d => d.categoria === cat.id);
    if (catDocs.length === 0) return;
    html += `<div style="font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#6b7a94;
              margin-top:8px;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
              ${cat.icon} ${cat.label}
              <span style="flex:1;height:1px;background:#e8ecf4;"></span>
             </div>`;
    catDocs.forEach(doc => {
      const isPdf = (doc.formato||'').toLowerCase() === 'pdf' || (doc.url||'').toLowerCase().includes('/image/upload/') === false || (doc.nombre||'').toLowerCase().endsWith('.pdf');
      const icono = isPdf ? '📄' : '🖼️';
      const fecha = doc.fecha ? new Date(doc.fecha).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      html += `<div data-pubid="${esc(doc.public_id)}" style="display:flex;align-items:center;gap:10px;
                background:#fff;border:1.5px solid #e8ecf4;border-radius:11px;padding:10px 12px;transition:border-color 0.15s;">
        <div style="width:38px;height:38px;border-radius:9px;background:#f0f4ff;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${icono}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(doc.nombre)}">${esc(doc.nombre||'Sin nombre')}</div>
          <div style="font-size:10px;color:#8899aa;font-weight:600;margin-top:2px;">${fecha} · ${esc(doc.subido_por||'—')}</div>
        </div>
        <button onclick="event.stopPropagation();abrirVisorDoc('${esc(doc.url)}','${esc(doc.nombre||'')}','${esc(doc.formato||'')}')"
          style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;
                 border-radius:7px;padding:5px 10px;cursor:pointer;border:1.5px solid #c5d0ff;
                 background:#f0f4ff;color:#3b5bdb;white-space:nowrap;flex-shrink:0;font-family:'Barlow',sans-serif;">👁 Ver</button>
        <button onclick="_docsEliminar('${esc(doc.public_id)}','${esc(matricula)}',this)"
          style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;
                 border-radius:7px;padding:5px 10px;cursor:pointer;border:1.5px solid #fecaca;
                 background:#fff0f0;color:#dc2626;flex-shrink:0;font-family:'Barlow',sans-serif;">🗑 Eliminar</button>
      </div>`;
    });
  });

  lista.innerHTML = html;
}

async function _docsSubir(matricula, overlay) {
  const fileInput = overlay.querySelector('#docs-file');
  const catSelect = overlay.querySelector('#docs-cat');
  const statusEl  = overlay.querySelector('#docs-upload-status');
  const btnSubir  = overlay.querySelector('#docs-subir');
  const file      = fileInput.files[0];

  if (!file) { mostrarToast('Selecciona un archivo primero', 'error'); return; }

  const MAX_MB = 10;
  if (file.size > MAX_MB * 1024 * 1024) {
    mostrarToast(`El archivo supera los ${MAX_MB} MB`, 'error'); return;
  }

  const categoria = catSelect.value;
  const catLabel  = _DOCS_CATS.find(c => c.id === categoria)?.label || categoria;

  btnSubir.disabled = true; btnSubir.textContent = '⏳ Subiendo…';
  statusEl.style.display = 'flex'; statusEl.style.gap = '8px'; statusEl.style.alignItems = 'center';
  statusEl.innerHTML = `<div style="width:14px;height:14px;border:2px solid #dde1ea;border-top-color:#16a34a;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;"></div><span style="color:#6b7a94;">Subiendo a Google Drive…</span>`;

  try {
    // ── Leer archivo como base64 ──
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = () => res(reader.result.split(',')[1]);
      reader.onerror = () => rej(new Error('Error leyendo el archivo'));
      reader.readAsDataURL(file);
    });

    statusEl.innerHTML = `<div style="width:14px;height:14px;border:2px solid #dde1ea;border-top-color:#16a34a;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;"></div><span style="color:#6b7a94;">Guardando en Drive…</span>`;

    // ── Enviar al GAS para subir a Drive ──
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        accion: 'subirDocumento',
        archivo: {
          matricula,
          categoria,
          nombre:     file.name,
          mimeType:   file.type || 'application/octet-stream',
          base64,
          subido_por: (usuarioActual?.nombre || 'Admin'),
        }
      })
    });
    const rData = await resp.json();
    if (!rData.ok) throw new Error(rData.error || 'Error al guardar en Drive');

    // ── Éxito ──
    statusEl.innerHTML = `<span style="color:#16a34a;font-weight:800;">✓ Documento subido correctamente</span>`;
    fileInput.value = '';
    mostrarToast(`✓ ${catLabel} subido`, 'success');
    registrarAccion('VEHICULO', 'Subir documento', `${matricula} · ${catLabel} · ${file.name}`);
    await _docsCargar(matricula, overlay);

  } catch(err) {
    statusEl.innerHTML = `<span style="color:#e84545;font-weight:800;">⚠ Error: ${err.message}</span>`;
    mostrarToast('Error al subir el documento', 'error');
  } finally {
    btnSubir.disabled = false; btnSubir.textContent = '⬆ Subir';
    setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
  }
}

async function _docsEliminar(publicId, matricula, btnEl) {
  const ok = await appConfirm('El documento será eliminado permanentemente.', { titulo: '¿Eliminar documento?', icono: '🗑️', labelOk: '🗑 Sí, eliminar', peligro: true });
  if (!ok) return;
  const overlay = document.getElementById('overlay-docs');
  btnEl.disabled = true; btnEl.textContent = '…';
  try {
    const r = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ accion: 'eliminarDocumento', fileId: publicId })
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error);
    mostrarToast('Documento eliminado', 'success');
    registrarAccion('VEHICULO', 'Eliminar documento', matricula);
    await _docsCargar(matricula, overlay);
  } catch(e) {
    mostrarToast('Error al eliminar', 'error');
    btnEl.disabled = false; btnEl.textContent = '🗑 Eliminar';
  }
}

