// ════════════════════════════════════════════════════════════════════════════
// DOCUMENTOS DE VEHÍCULOS — Supabase Storage
//
// · Los archivos se guardan en el bucket privado "documentos" de Supabase.
// · La lista vive en la tabla public.documentos_vehiculo (consulta instantánea).
// · Para ver/descargar se pide un enlace firmado temporal (1 h).
// · Los documentos antiguos de Google Drive se siguen mostrando (marcados como
//   "Drive") hasta que se pasan a Supabase con migrarDocumentosDrive(). Al
//   terminar sin errores se guarda app_config.docs_drive_migrado = 'SI' y la
//   app deja de consultar Drive.
// ════════════════════════════════════════════════════════════════════════════
const DOCS_BUCKET = 'documentos';
const DOCS_MAX_MB = 15;
const _DOCS_CATS = [
  { id: 'ficha_tecnica',       label: 'Ficha técnica',          icon: '📄' },
  { id: 'permiso_circulacion', label: 'Permiso de circulación', icon: '🪪' },
  { id: 'informe_itv',         label: 'Informe ITV',            icon: '🔧' },
  { id: 'poliza_seguro',       label: 'Póliza de seguro',       icon: '🛡️' },
  { id: 'otros',               label: 'Otros',                  icon: '📎' },
];
const _DOCS_MIME_EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif' };

// ── Capa de datos ────────────────────────────────────────────────────────────
let _docsDriveActivoCache = null;
async function docsDriveActivo() {
  if (_docsDriveActivoCache !== null) return _docsDriveActivoCache;
  try {
    const { data, error } = await sb.from('app_config').select('valor').eq('clave', 'docs_drive_migrado').maybeSingle();
    if (error) throw error;
    _docsDriveActivoCache = !(data && String(data.valor).toUpperCase() === 'SI');
  } catch (e) {
    _docsDriveActivoCache = true; // ante la duda, seguimos mostrando Drive
  }
  return _docsDriveActivoCache;
}

function _docsSlug(txt) {
  return String(txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'archivo';
}
function _docsMime(file) {
  if (file.type) return file.type;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return _DOCS_MIME_EXT[ext] || 'application/octet-stream';
}
function _docsEsPdf(doc) {
  return (doc.formato || '').toLowerCase() === 'pdf' || (doc.nombre || '').toLowerCase().endsWith('.pdf');
}

/** Documentos guardados en Supabase. Devuelve objetos normalizados. */
async function docsListarSupabase(matricula) {
  const { data, error } = await sb.from('documentos_vehiculo')
    .select('*').eq('matricula', matricula).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(d => ({
    origen: 'supabase', id: d.id, path: d.path, drive_id: d.drive_id || '',
    categoria: d.categoria, nombre: d.nombre, subido_por: d.subido_por, fecha: d.created_at,
    formato: (d.mime === 'application/pdf' || /\.pdf$/i.test(d.nombre)) ? 'pdf' : 'imagen',
    ref: 'sb:' + d.path
  }));
}

/** Documentos que siguen en Google Drive (vacío si ya se migró todo). */
async function docsListarDrive(matricula, idsYaMigrados) {
  if (!(await docsDriveActivo())) return [];
  const r = await fetch(`${APPS_SCRIPT_URL}?accion=cargarDocumentos&matricula=${encodeURIComponent(matricula)}`);
  const d = await r.json();
  const ya = new Set(idsYaMigrados || []);
  return (d.docs || []).map(x => {
    const m = String(x.url || '').match(/\/file\/d\/([^/]+)/);
    const fileId = x.public_id || (m ? m[1] : '');
    return { origen: 'drive', id: fileId, drive_id: fileId, categoria: x.categoria, nombre: x.nombre,
             subido_por: x.subido_por, fecha: x.fecha, formato: x.formato || '', ref: x.url || '' };
  }).filter(x => !ya.has(x.drive_id));
}

/** Enlace firmado temporal para ver (o descargar, si se pasa nombre) un archivo. */
async function docsUrlFirmada(path, nombreDescarga) {
  const opts = nombreDescarga ? { download: nombreDescarga } : undefined;
  const { data, error } = await sb.storage.from(DOCS_BUCKET).createSignedUrl(path, 3600, opts);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Sube un archivo (File o Blob con nombre) y registra la fila. */
async function docsSubirArchivo(matricula, categoria, file, nombre, extra) {
  nombre = nombre || file.name;
  const mime = file.type || _docsMime({ name: nombre, type: '' });
  const uid = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const path = `${_docsSlug(matricula)}/${uid}-${_docsSlug(nombre)}`;
  const up = await sb.storage.from(DOCS_BUCKET).upload(path, file, { contentType: mime, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const fila = Object.assign({
    matricula, categoria, nombre, path, mime, tamano: file.size || null,
    subido_por: usuarioActual?.nombre || 'Admin'
  }, extra || {});
  const ins = await sb.from('documentos_vehiculo').insert(fila);
  if (ins.error) {
    await sb.storage.from(DOCS_BUCKET).remove([path]); // no dejar archivos huérfanos
    throw new Error(ins.error.message);
  }
  return path;
}

async function docsEliminarSupabase(id, path) {
  const rm = await sb.storage.from(DOCS_BUCKET).remove([path]);
  if (rm.error) throw new Error(rm.error.message);
  const del = await sb.from('documentos_vehiculo').delete().eq('id', id);
  if (del.error) throw new Error(del.error.message);
}

// ── Gestor de documentos (Panel Admin) ───────────────────────────────────────
async function abrirGestorDocumentos(matricula) {
  const overlay = document.createElement('div');
  overlay.id = 'overlay-docs';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(5,5,20,0.72);z-index:6000;display:flex;align-items:center;justify-content:center;';

  overlay.innerHTML = `
    <div role="dialog" aria-label="Documentos de ${esc(matricula)}" style="background:#fff;border-radius:16px;width:600px;max-width:97vw;max-height:88vh;
                display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,0.4);font-family:'Barlow',sans-serif;overflow:hidden;">
      <div style="padding:20px 22px 14px;border-bottom:1px solid #eef0f3;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;">
        <div>
          <div style="font-size:12px;font-weight:600;color:#5b6475;">Documentos del vehículo</div>
          <div style="font-size:20px;font-weight:800;color:#1a1a2e;margin-top:2px;font-family:'JetBrains Mono',ui-monospace,monospace;">${esc(matricula)}</div>
        </div>
        <button id="docs-close" aria-label="Cerrar" style="background:#fff;border:1px solid #d5d9e0;color:#1a1a2e;width:36px;height:36px;border-radius:8px;cursor:pointer;font-size:16px;">✕</button>
      </div>

      <div style="background:#f7f8fa;border-bottom:1px solid #eef0f3;padding:16px 22px;flex-shrink:0;">
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
          <label style="flex:1;min-width:160px;font-size:12px;font-weight:600;color:#5b6475;display:flex;flex-direction:column;gap:4px;">Categoría
            <select id="docs-cat" style="padding:9px 10px;border:1px solid #d5d9e0;border-radius:8px;font:600 13px 'Barlow',sans-serif;color:#1a1a2e;background:#fff;">
              ${_DOCS_CATS.map(c => `<option value="${c.id}">${c.label}</option>`).join('')}
            </select>
          </label>
          <label style="flex:1.4;min-width:180px;font-size:12px;font-weight:600;color:#5b6475;display:flex;flex-direction:column;gap:4px;">Archivo (PDF o imagen, máx. ${DOCS_MAX_MB} MB)
            <input type="file" id="docs-file" accept=".pdf,image/*" style="padding:6px 8px;border:1px solid #d5d9e0;border-radius:8px;font:600 12px 'Barlow',sans-serif;background:#fff;">
          </label>
          <button id="docs-subir" style="height:38px;padding:0 18px;background:#1a1a2e;color:#fff;border:none;border-radius:8px;font:700 13px 'Barlow',sans-serif;cursor:pointer;white-space:nowrap;">Subir</button>
        </div>
        <div id="docs-upload-status" role="status" style="margin-top:8px;font-size:12px;font-weight:700;display:none;"></div>
      </div>

      <div id="docs-lista" style="flex:1;overflow-y:auto;padding:14px 22px 20px;display:flex;flex-direction:column;gap:8px;"></div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#docs-close').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.querySelector('#docs-subir').onclick = () => _docsSubir(matricula, overlay);
  await _docsCargar(matricula, overlay);
}

function _docsSpinner(txt) {
  return `<div style="display:flex;align-items:center;gap:8px;color:#5b6475;font-size:12px;font-weight:600;padding:12px 0;justify-content:center;">
    <div style="width:16px;height:16px;border:2.5px solid #e0e4ed;border-top-color:#1a1a2e;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;"></div>${txt}</div>`;
}

async function _docsCargar(matricula, overlay) {
  const lista = overlay.querySelector('#docs-lista');
  lista.innerHTML = _docsSpinner('Cargando documentos…');
  let docsSb = [];
  try {
    docsSb = await docsListarSupabase(matricula);
  } catch (e) {
    lista.innerHTML = `<div style="color:#b42318;font-size:13px;font-weight:700;padding:16px 0;text-align:center;">Error al cargar documentos: ${esc(e.message)}</div>`;
    return;
  }
  // Pintamos ya lo de Supabase (instantáneo) y Drive se añade después sin bloquear
  _docsRender(docsSb, [], matricula, overlay, await docsDriveActivo());
  if (!(await docsDriveActivo())) return;
  try {
    const docsDrive = await docsListarDrive(matricula, docsSb.map(d => d.drive_id).filter(Boolean));
    if (document.body.contains(overlay)) _docsRender(docsSb, docsDrive, matricula, overlay, false);
  } catch (e) {
    if (document.body.contains(overlay)) _docsRender(docsSb, [], matricula, overlay, false, 'No se pudieron consultar los documentos antiguos de Drive.');
  }
}

function _docsRender(docsSb, docsDrive, matricula, overlay, driveCargando, avisoDrive) {
  const lista = overlay.querySelector('#docs-lista');
  const docs = docsSb.concat(docsDrive);
  let html = '';
  if (!docs.length && !driveCargando) {
    html = `<div style="text-align:center;padding:28px 0;color:#6b7385;font-size:13px;font-weight:600;">No hay documentos todavía.<br><span style="font-size:12px;font-weight:500;">Usa el formulario de arriba para subir el primero.</span></div>`;
  }
  _DOCS_CATS.forEach(cat => {
    const catDocs = docs.filter(d => (d.categoria || 'otros') === cat.id || (cat.id === 'otros' && !_DOCS_CATS.some(c => c.id === d.categoria)));
    if (!catDocs.length) return;
    html += `<div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#5b6475;margin-top:8px;display:flex;align-items:center;gap:8px;">
              ${cat.label}<span style="flex:1;height:1px;background:#eef0f3;"></span></div>`;
    catDocs.forEach(doc => {
      const fecha = doc.fecha ? new Date(doc.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      const enDrive = doc.origen === 'drive';
      const borrar = enDrive
        ? `_docsEliminarDrive('${esc(doc.id)}','${esc(matricula)}',this)`
        : `_docsEliminar('${esc(doc.id)}','${esc(doc.path)}','${esc(matricula)}',this)`;
      html += `<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e3e6eb;border-radius:10px;padding:10px 12px;">
        <div aria-hidden="true" style="width:36px;height:36px;border-radius:8px;background:#f1f3f6;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#5b6475;flex-shrink:0;">${_docsEsPdf(doc) ? 'PDF' : 'IMG'}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(doc.nombre)}">${esc(doc.nombre || 'Sin nombre')}</div>
          <div style="font-size:12px;color:#5b6475;margin-top:2px;">${fecha} · ${esc(doc.subido_por || '—')}${enDrive ? ' · <span style="color:#93370d;font-weight:700;">en Drive</span>' : ''}</div>
        </div>
        <button onclick="event.stopPropagation();abrirVisorDoc('${esc(doc.ref)}','${esc(doc.nombre || '')}','${esc(doc.formato || '')}')"
          style="height:32px;padding:0 12px;font:700 12px 'Barlow',sans-serif;border-radius:7px;cursor:pointer;border:1px solid #d5d9e0;background:#fff;color:#1a1a2e;flex-shrink:0;">Ver</button>
        <button onclick="${borrar}" aria-label="Eliminar ${esc(doc.nombre || '')}"
          style="height:32px;padding:0 12px;font:700 12px 'Barlow',sans-serif;border-radius:7px;cursor:pointer;border:1px solid #fecdca;background:#fff;color:#b42318;flex-shrink:0;">Eliminar</button>
      </div>`;
    });
  });
  if (driveCargando) html += _docsSpinner('Buscando documentos antiguos en Drive…');
  if (avisoDrive) html += `<div style="font-size:12px;color:#93370d;text-align:center;padding:6px 0;">${esc(avisoDrive)}</div>`;
  lista.innerHTML = html;
}

async function _docsSubir(matricula, overlay) {
  const fileInput = overlay.querySelector('#docs-file');
  const catSelect = overlay.querySelector('#docs-cat');
  const statusEl  = overlay.querySelector('#docs-upload-status');
  const btnSubir  = overlay.querySelector('#docs-subir');
  const file      = fileInput.files[0];

  if (!file) { mostrarToast('Selecciona un archivo primero', 'error'); return; }
  if (file.size > DOCS_MAX_MB * 1024 * 1024) { mostrarToast(`El archivo supera los ${DOCS_MAX_MB} MB`, 'error'); return; }
  const mime = _docsMime(file);
  if (mime !== 'application/pdf' && !mime.startsWith('image/')) { mostrarToast('Solo se admiten PDF o imágenes', 'error'); return; }

  const categoria = catSelect.value;
  const catLabel  = _DOCS_CATS.find(c => c.id === categoria)?.label || categoria;

  btnSubir.disabled = true; btnSubir.textContent = 'Subiendo…';
  statusEl.style.display = 'block';
  statusEl.innerHTML = `<span style="color:#5b6475;">Subiendo ${esc(file.name)}…</span>`;
  try {
    const blob = file.type ? file : new Blob([file], { type: mime });
    await docsSubirArchivo(matricula, categoria, blob, file.name);
    statusEl.innerHTML = `<span style="color:#05603a;">✓ Documento subido</span>`;
    fileInput.value = '';
    mostrarToast(`✓ ${catLabel} subido`, 'success');
    registrarAccion('VEHICULO', 'Subir documento', `${matricula} · ${catLabel} · ${file.name}`);
    await _docsCargar(matricula, overlay);
  } catch (err) {
    statusEl.innerHTML = `<span style="color:#b42318;">No se pudo subir: ${esc(err.message)}</span>`;
    mostrarToast('Error al subir el documento', 'error');
  } finally {
    btnSubir.disabled = false; btnSubir.textContent = 'Subir';
    setTimeout(() => { statusEl.style.display = 'none'; }, 5000);
  }
}

async function _docsEliminar(id, path, matricula, btnEl) {
  const ok = await appConfirm('El documento se eliminará permanentemente.', { titulo: '¿Eliminar documento?', icono: '🗑️', labelOk: 'Sí, eliminar', peligro: true });
  if (!ok) return;
  const overlay = document.getElementById('overlay-docs');
  btnEl.disabled = true; btnEl.textContent = '…';
  try {
    await docsEliminarSupabase(id, path);
    mostrarToast('Documento eliminado', 'success');
    registrarAccion('VEHICULO', 'Eliminar documento', matricula);
    if (overlay) await _docsCargar(matricula, overlay);
  } catch (e) {
    mostrarToast('Error al eliminar: ' + e.message, 'error');
    btnEl.disabled = false; btnEl.textContent = 'Eliminar';
  }
}

async function _docsEliminarDrive(fileId, matricula, btnEl) {
  const ok = await appConfirm('El documento de Google Drive se eliminará permanentemente.', { titulo: '¿Eliminar documento?', icono: '🗑️', labelOk: 'Sí, eliminar', peligro: true });
  if (!ok) return;
  const overlay = document.getElementById('overlay-docs');
  btnEl.disabled = true; btnEl.textContent = '…';
  try {
    const r = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ accion: 'eliminarDocumento', fileId }) });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'error');
    mostrarToast('Documento eliminado', 'success');
    registrarAccion('VEHICULO', 'Eliminar documento', matricula);
    if (overlay) await _docsCargar(matricula, overlay);
  } catch (e) {
    mostrarToast('Error al eliminar', 'error');
    btnEl.disabled = false; btnEl.textContent = 'Eliminar';
  }
}

// ── Paso de documentos antiguos: Google Drive → Supabase ─────────────────────
async function _docsDescargarDeDrive(fileId) {
  const r = await fetch(`${APPS_SCRIPT_URL}?accion=proxyDoc&fileId=${encodeURIComponent(fileId)}`, { redirect: 'follow' });
  const j = await r.json();
  if (!j.ok || !j.base64) throw new Error(j.error || 'Drive no devolvió el archivo');
  const bin = atob(j.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime: j.mimeType || j.mime || '' };
}

/** Pinta (si toca) el aviso con el botón para pasar los documentos de Drive. */
async function pintarAvisoMigracionDocs() {
  const cont = document.getElementById('adm-docs-migracion');
  if (!cont) return;
  if (!(await docsDriveActivo())) { cont.innerHTML = ''; return; }
  cont.innerHTML = `<div class="adm-aviso" style="background:#f5f8ff;border-color:#c7d4fe;color:#1e3a8a;">
    <div class="adm-aviso-head">
      <span>Los documentos antiguos siguen en <strong>Google Drive</strong> y por eso tardan en abrir. Pásalos a Supabase una sola vez y todo irá rápido.</span>
      <button type="button" class="adm-btn adm-btn-sm" onclick="migrarDocumentosDrive()">Pasar documentos a Supabase</button>
    </div></div>`;
}

async function migrarDocumentosDrive() {
  const ok = await appConfirm('Se copiarán todos los documentos de Google Drive a Supabase. Puede tardar unos minutos; no cierres la app mientras tanto. Los archivos de Drive no se borran.',
    { titulo: '¿Pasar documentos a Supabase?', icono: '📂', labelOk: 'Empezar' });
  if (!ok) return;

  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(5,5,20,0.72);z-index:7000;display:flex;align-items:center;justify-content:center;font-family:Barlow,sans-serif;';
  ov.innerHTML = `<div role="dialog" aria-label="Pasando documentos" style="background:#fff;border-radius:14px;padding:26px;width:440px;max-width:94vw;box-shadow:0 24px 64px rgba(0,0,0,.35);">
    <div style="font-size:17px;font-weight:800;color:#1a1a2e;margin-bottom:6px;">Pasando documentos a Supabase</div>
    <div id="mig-txt" role="status" style="font-size:13px;color:#5b6475;margin-bottom:14px;min-height:36px;">Preparando…</div>
    <div style="height:8px;background:#eef0f3;border-radius:4px;overflow:hidden;"><div id="mig-bar" style="height:100%;width:0;background:#1a1a2e;transition:width .2s;"></div></div>
    <div id="mig-errores" style="margin-top:12px;font-size:12px;color:#b42318;max-height:140px;overflow:auto;"></div>
    <div style="display:flex;justify-content:flex-end;margin-top:16px;"><button id="mig-cerrar" disabled style="height:38px;padding:0 18px;border:none;border-radius:8px;background:#1a1a2e;color:#fff;font:700 13px Barlow,sans-serif;cursor:pointer;opacity:.5;">Cerrar</button></div>
  </div>`;
  document.body.appendChild(ov);
  const txt = ov.querySelector('#mig-txt'), bar = ov.querySelector('#mig-bar'), errEl = ov.querySelector('#mig-errores'), btnCerrar = ov.querySelector('#mig-cerrar');

  const mats = [...new Set(GRUPOS.flatMap(g => g.vehiculos.map(v => v.matricula)))];
  let copiados = 0, errores = 0, revisados = 0;
  const fallos = [];
  _docsDriveActivoCache = true;

  for (let i = 0; i < mats.length; i++) {
    const mat = mats[i];
    txt.textContent = `Vehículo ${i + 1} de ${mats.length}: ${mat}`;
    bar.style.width = Math.round((i / mats.length) * 100) + '%';
    let pendientes = [];
    try {
      const yaSb = await docsListarSupabase(mat);
      pendientes = await docsListarDrive(mat, yaSb.map(d => d.drive_id).filter(Boolean));
    } catch (e) {
      errores++; fallos.push(`${mat}: no se pudo leer la lista de Drive (${e.message})`);
      errEl.innerHTML = fallos.map(esc).join('<br>');
      continue;
    }
    for (const doc of pendientes) {
      revisados++;
      txt.textContent = `Vehículo ${i + 1} de ${mats.length}: ${mat} · ${doc.nombre}`;
      try {
        const { bytes, mime } = await _docsDescargarDeDrive(doc.drive_id);
        const tipo = mime || _docsMime({ name: doc.nombre || '', type: '' });
        const blob = new Blob([bytes], { type: tipo });
        await docsSubirArchivo(mat, doc.categoria || 'otros', blob, doc.nombre || 'documento',
          { drive_id: doc.drive_id, subido_por: doc.subido_por || 'Migración Drive', created_at: doc.fecha ? new Date(doc.fecha).toISOString() : undefined });
        copiados++;
      } catch (e) {
        errores++; fallos.push(`${mat} · ${doc.nombre}: ${e.message}`);
        errEl.innerHTML = fallos.map(esc).join('<br>');
      }
    }
  }

  bar.style.width = '100%';
  if (!errores) {
    const { error } = await sb.from('app_config').upsert({ clave: 'docs_drive_migrado', valor: 'SI' }, { onConflict: 'clave' });
    if (!error) _docsDriveActivoCache = false;
    txt.innerHTML = `<strong style="color:#05603a;">Listo.</strong> ${copiados} documento${copiados === 1 ? '' : 's'} copiado${copiados === 1 ? '' : 's'}. A partir de ahora todo se guarda y se abre desde Supabase.`;
    registrarAccion('VEHICULO', 'Migrar documentos Drive → Supabase', `${copiados} documentos`);
  } else {
    txt.innerHTML = `Copiados ${copiados} de ${revisados}. <strong style="color:#b42318;">${errores} con error</strong>: puedes volver a lanzarlo y solo intentará los que faltan.`;
  }
  btnCerrar.disabled = false; btnCerrar.style.opacity = '1';
  btnCerrar.onclick = () => { ov.remove(); pintarAvisoMigracionDocs(); };
}
