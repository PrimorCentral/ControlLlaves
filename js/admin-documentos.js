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
  { id: 'fotos',               label: 'Fotos',                  icon: '📷' },
];
const DOCS_CARPETA_DEFECTO = 'Entrega vehículo';
const DOCS_CARPETAS_HABITUALES = ['Entrega vehículo', 'Devolución vehículo', 'Daños', 'Taller / reparación', 'Limpieza'];
const DOCS_CARPETA_NUEVA = '__nueva__';
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
    origen: 'supabase', id: d.id, path: d.path, drive_id: d.drive_id || '', carpeta: d.carpeta || '',
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

/** Reduce fotos grandes (móvil) a máx. 2048 px en JPEG. Si no se puede, devuelve el original. */
async function docsComprimirImagen(file) {
  const tipo = _docsMime(file);
  if (!/^image\/(jpeg|png|webp)$/.test(tipo) || file.size < 600 * 1024) return { blob: file, nombre: file.name };
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const esc = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close && bmp.close();
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    c.width = c.height = 0;
    if (!blob || blob.size >= file.size) return { blob: file, nombre: file.name };
    return { blob, nombre: file.name.replace(/\.[^.]+$/, '') + '.jpg' };
  } catch (e) {
    return { blob: file, nombre: file.name };
  }
}

/** Pone el src de las miniaturas (img[data-path]) con un solo enlace firmado por lote. */
async function docsPintarMiniaturas(cont) {
  const imgs = [...cont.querySelectorAll('img[data-path]:not([src])')];
  if (!imgs.length) return;
  const paths = imgs.map(i => i.dataset.path);
  const { data, error } = await sb.storage.from(DOCS_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return;
  const porPath = {};
  data.forEach(d => { if (d.signedUrl) porPath[d.path] = d.signedUrl; });
  imgs.forEach(i => { if (porPath[i.dataset.path]) i.src = porPath[i.dataset.path]; });
}

// ── Carpetas de fotos ────────────────────────────────────────────────────────
// La lista de carpetas (con su comentario) vive en public.carpetas_fotos; las
// fotos son filas de documentos_vehiculo con categoria='fotos' y carpeta=<nombre>.

/** Filas de carpetas_fotos del vehículo, o null si la tabla aún no existe. */
async function docsListarCarpetas(matricula) {
  try {
    const { data, error } = await sb.from('carpetas_fotos').select('*').eq('matricula', matricula);
    if (error) return null;
    return data || [];
  } catch (e) { return null; }
}

/** Une filas de carpetas y fotos en [{nombre, comentario, fotos[], fecha, creado_por}] (más recientes primero). */
function docsCombinarCarpetas(fotos, filas) {
  const mapa = {};
  (filas || []).forEach(c => {
    mapa[c.nombre] = { id: c.id, nombre: c.nombre, comentario: c.comentario || '', creado_por: c.creado_por || '', fecha: c.created_at, fotos: [] };
  });
  fotos.forEach(f => {
    const n = f.carpeta || 'Sin carpeta';
    if (!mapa[n]) mapa[n] = { id: null, nombre: n, comentario: '', creado_por: f.subido_por || '', fecha: f.fecha, fotos: [] };
    mapa[n].fotos.push(f);
  });
  Object.values(mapa).forEach(c => c.fotos.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))));
  return Object.values(mapa).sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
}

async function docsGuardarCarpeta(matricula, nombre, comentario) {
  const { data: ya, error: e1 } = await sb.from('carpetas_fotos').select('id').eq('matricula', matricula).eq('nombre', nombre).maybeSingle();
  if (e1) throw new Error(e1.message);
  if (ya) {
    const { error } = await sb.from('carpetas_fotos').update({ comentario: comentario || '', updated_at: new Date().toISOString() }).eq('id', ya.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from('carpetas_fotos').insert({ matricula, nombre, comentario: comentario || '', creado_por: usuarioActual?.nombre || 'Admin' });
    if (error) throw new Error(error.message);
  }
}

async function docsEliminarCarpeta(matricula, carpeta) {
  const paths = carpeta.fotos.map(f => f.path);
  for (let i = 0; i < paths.length; i += 100) {
    const rm = await sb.storage.from(DOCS_BUCKET).remove(paths.slice(i, i + 100));
    if (rm.error) throw new Error(rm.error.message);
  }
  const d1 = await sb.from('documentos_vehiculo').delete().eq('matricula', matricula).eq('categoria', 'fotos').eq('carpeta', carpeta.nombre);
  if (d1.error) throw new Error(d1.error.message);
  const d2 = await sb.from('carpetas_fotos').delete().eq('matricula', matricula).eq('nombre', carpeta.nombre);
  if (d2.error && !/carpetas_fotos/.test(d2.error.message)) throw new Error(d2.error.message);
}

const _DOCS_ICO = {
  carpeta: 'M3 6h6l2 2h10v11H3z',
  camara:  'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  galeria: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01',
  mas:     'M12 5v14M5 12h14',
  cerrar:  'M6 6l12 12M18 6L6 18',
  volver:  'M15 6l-6 6 6 6',
  papelera:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'
};
function _dIco(n, size, sw) {
  return `<svg width="${size || 20}" height="${size || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${_DOCS_ICO[n]}"/></svg>`;
}
const _dBtn  = 'height:46px;padding:0 18px;border-radius:10px;border:1px solid #d5d9e0;background:#fff;color:#1a1a2e;font:700 16px Barlow,sans-serif;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;';
const _dBtnP = 'height:46px;padding:0 20px;border-radius:10px;border:none;background:#1a1a2e;color:#fff;font:700 16px Barlow,sans-serif;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;';
const _dFecha = f => f ? new Date(f).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

/** Bloque de solo lectura (ficha del vehículo): carpetas con comentario y miniaturas. */
function docsHtmlFotos(fotos, matricula, conBorrar, filasCarpetas) {
  return docsCombinarCarpetas(fotos, filasCarpetas).filter(c => c.fotos.length).map(c => `
    <div style="border:1px solid #e3e6eb;border-radius:12px;padding:12px 14px;background:#fff;display:flex;flex-direction:column;gap:8px;">
      <div style="display:flex;align-items:center;gap:8px;color:#1a1a2e;">
        ${_dIco('carpeta', 18, 1.9)}<span style="font-size:15px;font-weight:800;flex:1;">${esc(c.nombre)}</span>
        <span style="font-size:13px;color:#5b6475;font-weight:600;">${c.fotos.length} foto${c.fotos.length === 1 ? '' : 's'}</span>
      </div>
      ${c.comentario ? `<p style="margin:0;font-size:14px;line-height:1.45;color:#333b4a;white-space:pre-line;">${esc(c.comentario)}</p>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px;">
        ${c.fotos.map(f => `<button type="button" onclick="event.stopPropagation();abrirVisorDoc('${esc(f.ref)}','${esc(f.nombre || '')}','imagen')" aria-label="Ver ${esc(f.nombre || 'foto')}"
          style="all:unset;display:block;aspect-ratio:1;border-radius:8px;overflow:hidden;background:#f1f3f6;cursor:zoom-in;">
          <img data-path="${esc(f.path)}" alt="${esc(f.nombre || '')}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"></button>`).join('')}
      </div>
    </div>`).join('');
}

async function docsEliminarSupabase(id, path) {
  const rm = await sb.storage.from(DOCS_BUCKET).remove([path]);
  if (rm.error) throw new Error(rm.error.message);
  const del = await sb.from('documentos_vehiculo').delete().eq('id', id);
  if (del.error) throw new Error(del.error.message);
}

// ── Gestor de documentos y fotos (Panel Admin) ───────────────────────────────
async function abrirGestorDocumentos(matricula, pestana, opciones) {
  document.getElementById('overlay-docs')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'overlay-docs';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(5,5,20,0.72);z-index:10300;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;font-family:Barlow,sans-serif;color:#1a1a2e;';
  overlay._g = { mat: matricula, tab: pestana || 'docs', vista: 'carpetas', sel: null, docsSb: [], docsDrive: [], filas: [], sinTabla: false,
                 cargando: true, puedeBorrar: !(opciones && opciones.puedeBorrar === false), nueva: { nombre: DOCS_CARPETA_DEFECTO, otro: false, comentario: '', files: [] }, ocupado: false };
  overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-label="Documentos y fotos de ${esc(matricula)}"
      style="width:1080px;max-width:100%;height:88vh;max-height:860px;background:#fff;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;"></section>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => {
    // Un clic fuera NO cierra la ventana: solo la ✕ o su botón de cerrar.
    const b = e.target.closest('[data-acc]');
    if (b && !b.disabled) _gAccion(overlay, b.dataset.acc, b.dataset, b);
  });
  overlay.addEventListener('change', e => {
    if (e.target.matches('input[type=file][data-subir]')) _gFicherosElegidos(overlay, e.target);
  });
  overlay.addEventListener('input', e => {
    if (e.target.id === 'g-nueva-otro') overlay._g.nueva.nombreOtro = e.target.value;
    if (e.target.id === 'g-nueva-com') overlay._g.nueva.comentario = e.target.value;
  });
  _gPintar(overlay);
  await _gCargar(overlay);
}
// Compatibilidad con llamadas antiguas
async function _docsCargar(matricula, overlay) { if (overlay && overlay._g) await _gCargar(overlay); }

function _gCerrar(overlay) {
  if (overlay._g.ocupado && !confirm('Se están subiendo fotos. ¿Cerrar igualmente?')) return;
  overlay._g.nueva.files.forEach(f => URL.revokeObjectURL(f.url));
  overlay.remove();
  if (typeof fichaRefrescar === 'function') fichaRefrescar(overlay._g.mat); // la ficha abierta muestra lo nuevo
}

async function _gCargar(overlay) {
  const g = overlay._g;
  try {
    const [docs, filas] = await Promise.all([docsListarSupabase(g.mat), docsListarCarpetas(g.mat)]);
    g.docsSb = docs; g.filas = filas || []; g.sinTabla = filas === null; g.error = '';
  } catch (e) { g.error = e.message; }
  g.cargando = false;
  if (!document.body.contains(overlay)) return;
  _gPintar(overlay);
  if (await docsDriveActivo()) {
    try { g.docsDrive = await docsListarDrive(g.mat, g.docsSb.map(d => d.drive_id).filter(Boolean)); } catch (e) { g.docsDrive = []; }
    if (document.body.contains(overlay)) _gPintar(overlay);
  }
}

function _gCarpetas(g) {
  return docsCombinarCarpetas(g.docsSb.filter(d => d.categoria === 'fotos'), g.filas);
}

function _gPintar(overlay) {
  const g = overlay._g;
  const docs = g.docsSb.filter(d => d.categoria !== 'fotos' && d.categoria !== 'mantenimiento').concat(g.docsDrive); // las facturas van en Mantenimiento
  const carpetas = _gCarpetas(g);
  const nFotos = carpetas.reduce((s, c) => s + c.fotos.length, 0);
  const tab = (id, txt, n) => `<button type="button" data-acc="tab" data-tab="${id}" role="tab" aria-selected="${g.tab === id}"
      style="all:unset;display:inline-flex;align-items:center;gap:8px;height:50px;padding:0 18px;font-size:17px;font-weight:${g.tab === id ? 800 : 600};color:${g.tab === id ? '#1a1a2e' : '#5b6475'};border-bottom:3px solid ${g.tab === id ? '#e84545' : 'transparent'};cursor:pointer;">
      ${txt}<span style="font-size:13px;font-weight:700;border-radius:10px;padding:2px 9px;background:${g.tab === id ? '#1a1a2e' : '#f1f3f6'};color:${g.tab === id ? '#fff' : '#4a5263'};">${n}</span></button>`;

  let cuerpo;
  if (g.cargando) cuerpo = `<div style="flex:1;display:flex;align-items:center;justify-content:center;">${_docsSpinner('Cargando documentos…')}</div>`;
  else if (g.error) cuerpo = `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#b42318;font-size:16px;font-weight:700;padding:24px;text-align:center;">No se pudieron cargar los documentos: ${esc(g.error)}</div>`;
  else if (g.tab === 'docs') cuerpo = _gHtmlDocs(g, docs);
  else if (g.vista === 'nueva') cuerpo = _gHtmlNueva(g, carpetas);
  else if (g.vista === 'carpeta') cuerpo = _gHtmlCarpeta(g, carpetas.find(c => c.nombre === g.sel));
  else cuerpo = _gHtmlCarpetas(g, carpetas, nFotos);

  overlay.firstElementChild.innerHTML = `
    <header style="padding:22px 26px 0;border-bottom:1px solid #e3e6eb;display:flex;flex-direction:column;gap:14px;flex-shrink:0;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
          <span style="font-size:15px;font-weight:600;color:#5b6475;">Documentos y fotos del vehículo</span>
          <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:28px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(g.mat)}</span>
        </div>
        <button type="button" data-acc="cerrar" aria-label="Cerrar" style="${_dBtn}width:46px;padding:0;flex-shrink:0;">${_dIco('cerrar', 20, 2.2)}</button>
      </div>
      <div role="tablist" style="display:flex;gap:6px;">${tab('docs', 'Documentos', docs.length)}${tab('fotos', 'Fotos', nFotos)}</div>
    </header>
    ${cuerpo}`;
  docsPintarMiniaturas(overlay);
  const foco = overlay.querySelector('[data-foco]');
  if (foco) { foco.focus(); foco.removeAttribute('data-foco'); }
}

// ── Pestaña Documentos ──
function _gHtmlDocs(g, docs) {
  const cats = _DOCS_CATS.filter(c => c.id !== 'fotos');
  let lista = '';
  cats.forEach(cat => {
    const cd = docs.filter(d => (d.categoria || 'otros') === cat.id || (cat.id === 'otros' && !_DOCS_CATS.some(c => c.id === d.categoria)));
    if (!cd.length) return;
    lista += `<h3 style="margin:10px 0 2px;font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#5b6475;">${cat.label}</h3>`;
    cd.forEach(d => {
      const borrar = d.origen === 'drive' ? `_docsEliminarDrive('${esc(d.id)}','${esc(g.mat)}',this)` : `_docsEliminar('${esc(d.id)}','${esc(d.path)}','${esc(g.mat)}',this)`;
      lista += `<div style="display:flex;align-items:center;gap:14px;border:1px solid #e3e6eb;border-radius:12px;padding:12px 14px;">
        <span aria-hidden="true" style="width:46px;height:46px;border-radius:10px;background:#f1f3f6;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#5b6475;flex-shrink:0;">${_docsEsPdf(d) ? 'PDF' : 'IMG'}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(d.nombre)}">${esc(d.nombre || 'Sin nombre')}</div>
          <div style="font-size:14px;color:#5b6475;margin-top:2px;">${_dFecha(d.fecha)} · ${esc(d.subido_por || '—')}${d.origen === 'drive' ? ' · <strong style="color:#93370d;">en Drive</strong>' : ''}</div>
        </div>
        <button type="button" onclick="abrirVisorDoc('${esc(d.ref)}','${esc(d.nombre || '')}','${esc(d.formato || '')}')" style="${_dBtn}height:42px;">Ver</button>
        ${g.puedeBorrar ? `<button type="button" onclick="${borrar}" aria-label="Eliminar ${esc(d.nombre || '')}" style="${_dBtn}height:42px;color:#b42318;border-color:#fecdca;">Eliminar</button>` : ''}
      </div>`;
    });
  });
  if (!lista) lista = `<div style="text-align:center;padding:40px 0;color:#5b6475;font-size:17px;font-weight:600;">Este vehículo aún no tiene documentos.<br><span style="font-size:15px;font-weight:500;">Súbelos con el formulario de arriba.</span></div>`;
  return `
    <div style="padding:16px 26px;background:#f7f8fa;border-bottom:1px solid #eef0f3;display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;flex-shrink:0;">
      <label style="display:flex;flex-direction:column;gap:6px;font-size:15px;font-weight:700;flex:1;min-width:200px;">Tipo de documento
        <select id="docs-cat" style="height:46px;padding:0 12px;border:1px solid #d5d9e0;border-radius:10px;font:600 16px Barlow,sans-serif;color:#1a1a2e;background:#fff;">
          ${cats.map(c => `<option value="${c.id}">${c.label}</option>`).join('')}
        </select></label>
      <label style="display:flex;flex-direction:column;gap:6px;font-size:15px;font-weight:700;flex:1.4;min-width:220px;">Archivo (PDF o imagen, máx. ${DOCS_MAX_MB} MB)
        <input type="file" id="docs-file" accept=".pdf,image/*" style="height:46px;box-sizing:border-box;padding:9px 10px;border:1px solid #d5d9e0;border-radius:10px;font:600 15px Barlow,sans-serif;background:#fff;"></label>
      <button type="button" data-acc="subirDoc" style="${_dBtnP}">Subir documento</button>
    </div>
    <div id="docs-upload-status" role="status" style="display:none;padding:10px 26px 0;font-size:15px;font-weight:700;"></div>
    <div style="flex:1;overflow:auto;padding:16px 26px 26px;display:flex;flex-direction:column;gap:10px;">${lista}</div>`;
}

// ── Pestaña Fotos: tarjetas de carpeta ──
function _gHtmlCarpetas(g, carpetas, nFotos) {
  const tarjetas = carpetas.map(c => {
    const portada = c.fotos.slice(-4);
    const mosaico = portada.length
      ? `<div style="display:grid;grid-template-columns:repeat(${portada.length > 1 ? 2 : 1},minmax(0,1fr));grid-template-rows:repeat(${portada.length > 2 ? 2 : 1},minmax(0,1fr));gap:3px;height:170px;overflow:hidden;flex-shrink:0;background:#e3e6eb;">
          ${portada.map(f => `<img data-path="${esc(f.path)}" alt="" loading="lazy" style="width:100%;height:100%;min-height:0;object-fit:cover;display:block;background:#dfe3e8;${portada.length === 3 && f === portada[0] ? 'grid-row:span 2;' : ''}">`).join('')}</div>`
      : `<div style="height:170px;background:#f1f3f6;display:flex;align-items:center;justify-content:center;color:#8a93a3;">${_dIco('camara', 34, 1.6)}</div>`;
    return `<button type="button" data-acc="abrir" data-nombre="${esc(c.nombre)}" aria-label="Abrir carpeta ${esc(c.nombre)}"
        style="all:unset;box-sizing:border-box;border:1px solid #e3e6eb;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;background:#fff;cursor:pointer;">
      ${mosaico}
      <span style="padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px;">
        <span style="display:flex;align-items:center;gap:10px;">${_dIco('carpeta', 22, 1.9)}
          <span style="font-size:19px;font-weight:800;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.nombre)}</span>
          <span style="font-size:14px;font-weight:700;color:#4a5263;background:#f1f3f6;border-radius:10px;padding:3px 10px;white-space:nowrap;">${c.fotos.length} foto${c.fotos.length === 1 ? '' : 's'}</span></span>
        <span style="font-size:15px;line-height:1.45;color:${c.comentario ? '#333b4a' : '#8a93a3'};display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line;">${esc(c.comentario || 'Sin comentario')}</span>
        <span style="font-size:13px;color:#5b6475;font-weight:600;">${[_dFecha(c.fecha), esc(c.creado_por)].filter(Boolean).join(' · ')}</span>
      </span></button>`;
  }).join('');
  return `
    <div style="padding:14px 26px;background:#f7f8fa;border-bottom:1px solid #eef0f3;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;flex-shrink:0;">
      <span style="font-size:16px;color:#5b6475;font-weight:600;">${carpetas.length} carpeta${carpetas.length === 1 ? '' : 's'} · ${nFotos} foto${nFotos === 1 ? '' : 's'}</span>
      <button type="button" data-acc="nueva" style="${_dBtnP}">${_dIco('mas', 20, 2.2)}Nueva carpeta de fotos</button>
    </div>
    <div style="flex:1;overflow:auto;padding:20px 26px 26px;">
      ${carpetas.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;">${tarjetas}</div>`
        : `<div style="text-align:center;padding:50px 0;color:#5b6475;font-size:17px;font-weight:600;">Todavía no hay fotos de este vehículo.<br><span style="font-size:15px;font-weight:500;">Crea una carpeta, por ejemplo «Entrega vehículo», y añade las fotos.</span></div>`}
    </div>`;
}

// ── Carpeta abierta ──
function _gHtmlCarpeta(g, c) {
  if (!c) { g.vista = 'carpetas'; return _gHtmlCarpetas(g, _gCarpetas(g), 0); }
  return `
    <div style="padding:14px 26px;background:#f7f8fa;border-bottom:1px solid #eef0f3;display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex-shrink:0;">
      <button type="button" data-acc="volver" style="${_dBtn}">${_dIco('volver', 20, 2.2)}Carpetas</button>
      <h3 style="margin:0;font-size:24px;font-weight:800;flex:1;min-width:200px;display:flex;align-items:center;gap:10px;">${_dIco('carpeta', 24, 1.9)}${esc(c.nombre)}</h3>
      <span style="font-size:15px;color:#5b6475;font-weight:600;">${c.fotos.length} foto${c.fotos.length === 1 ? '' : 's'}${c.fecha ? ' · ' + _dFecha(c.fecha) : ''}${c.creado_por ? ' · ' + esc(c.creado_por) : ''}</span>
    </div>
    <div style="flex:1;overflow:auto;padding:18px 26px 26px;display:flex;flex-direction:column;gap:18px;">
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label for="g-com" style="font-size:16px;font-weight:700;">Comentario de la carpeta</label>
        <textarea id="g-com" rows="3" ${g.sinTabla ? 'disabled' : ''} placeholder="Ej: a quién se entrega, kilómetros, combustible, daños que ya tenía…"
          style="width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #d5d9e0;border-radius:10px;font:500 16px/1.5 Barlow,sans-serif;color:#1a1a2e;resize:vertical;">${esc(c.comentario)}</textarea>
        <div style="display:flex;justify-content:flex-end;gap:10px;align-items:center;">
          ${g.sinTabla ? `<span style="font-size:14px;color:#93370d;font-weight:600;">Falta crear la tabla de carpetas en Supabase para guardar comentarios.</span>` : ''}
          <button type="button" data-acc="guardarCom" data-nombre="${esc(c.nombre)}" ${g.sinTabla ? 'disabled' : ''} style="${_dBtn}height:42px;">Guardar comentario</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <span style="font-size:16px;font-weight:700;">Añadir fotos a esta carpeta</span>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
          <label style="${_dBtn}height:58px;font-size:17px;">${_dIco('camara', 24, 1.9)}Hacer foto
            <input type="file" accept="image/*" capture="environment" data-subir="carpeta" data-nombre="${esc(c.nombre)}" style="position:absolute;width:1px;height:1px;opacity:0;"></label>
          <label style="${_dBtn}height:58px;font-size:17px;">${_dIco('galeria', 24, 1.9)}Elegir de la galería
            <input type="file" accept="image/*" multiple data-subir="carpeta" data-nombre="${esc(c.nombre)}" style="position:absolute;width:1px;height:1px;opacity:0;"></label>
        </div>
        <div id="g-subida" role="status" style="font-size:15px;font-weight:700;color:#5b6475;min-height:20px;"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;">
        ${c.fotos.map(f => `<div style="position:relative;aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:#f1f3f6;">
          <button type="button" onclick="abrirVisorDoc('${esc(f.ref)}','${esc(f.nombre || '')}','imagen')" aria-label="Ver ${esc(f.nombre || 'foto')}" style="all:unset;display:block;width:100%;height:100%;cursor:zoom-in;">
            <img data-path="${esc(f.path)}" alt="${esc(f.nombre || '')}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"></button>
          ${g.puedeBorrar ? `<button type="button" data-acc="borrarFoto" data-id="${esc(f.id)}" data-path="${esc(f.path)}" aria-label="Eliminar foto"
            style="position:absolute;top:8px;right:8px;width:38px;height:38px;border-radius:9px;border:none;background:rgba(17,17,34,.75);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;">${_dIco('papelera', 18, 2)}</button>` : ''}
        </div>`).join('')}
      </div>
      ${c.fotos.length ? '' : `<p style="margin:0;color:#5b6475;font-size:16px;">Esta carpeta no tiene fotos todavía.</p>`}
      ${g.puedeBorrar ? `<div style="border-top:1px solid #eef0f3;padding-top:16px;display:flex;justify-content:flex-end;">
        <button type="button" data-acc="borrarCarpeta" data-nombre="${esc(c.nombre)}" style="${_dBtn}height:42px;color:#b42318;border-color:#fecdca;">${_dIco('papelera', 18, 2)}Eliminar carpeta</button>
      </div>` : ''}
    </div>`;
}

// ── Nueva carpeta en un solo paso ──
function _gHtmlNueva(g, carpetas) {
  const n = g.nueva;
  const chip = (txt, on, acc, extra) => `<button type="button" role="radio" aria-checked="${on}" data-acc="${acc}" ${extra || ''}
      style="height:46px;padding:0 18px;border-radius:23px;font:700 16px Barlow,sans-serif;cursor:pointer;${on ? 'background:#1a1a2e;color:#fff;border:1px solid #1a1a2e;' : 'background:#fff;color:#1a1a2e;border:1px solid #d5d9e0;'}">${esc(txt)}</button>`;
  const existentes = carpetas.map(c => c.nombre).filter(x => !DOCS_CARPETAS_HABITUALES.includes(x));
  const nombres = DOCS_CARPETAS_HABITUALES.concat(existentes);
  const nf = n.files.length;
  return `
    <div style="padding:14px 26px;background:#f7f8fa;border-bottom:1px solid #eef0f3;display:flex;align-items:center;gap:12px;flex-shrink:0;">
      <button type="button" data-acc="volver" style="${_dBtn}">${_dIco('volver', 20, 2.2)}Carpetas</button>
      <h3 style="margin:0;font-size:24px;font-weight:800;">Nueva carpeta de fotos</h3>
    </div>
    <div style="flex:1;overflow:auto;padding:20px 26px;display:flex;flex-direction:column;gap:24px;">
      <div style="display:flex;flex-direction:column;gap:10px;">
        <span style="font-size:17px;font-weight:800;">1. ¿Qué es?</span>
        <div role="radiogroup" aria-label="Nombre de la carpeta" style="display:flex;flex-wrap:wrap;gap:8px;">
          ${nombres.map(x => chip(x, !n.otro && n.nombre === x, 'chip', `data-nombre="${esc(x)}"`)).join('')}
          ${chip('+ Otro nombre…', n.otro, 'chipOtro')}
        </div>
        ${n.otro ? `<input id="g-nueva-otro" ${n.enfocarOtro ? 'data-foco' : ''} value="${esc(n.nombreOtro || '')}" aria-label="Nombre de la carpeta" placeholder="Escribe el nombre de la carpeta"
          style="height:48px;box-sizing:border-box;padding:0 14px;border:1px solid #d5d9e0;border-radius:10px;font:600 17px Barlow,sans-serif;color:#1a1a2e;max-width:460px;">` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label for="g-nueva-com" style="font-size:17px;font-weight:800;">2. Comentario <span style="font-weight:500;color:#5b6475;">(opcional)</span></label>
        <textarea id="g-nueva-com" rows="3" placeholder="Ej: a quién se entrega, kilómetros, combustible, daños que ya tenía…" ${g.sinTabla ? 'disabled' : ''}
          style="width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #d5d9e0;border-radius:10px;font:500 16px/1.5 Barlow,sans-serif;color:#1a1a2e;resize:vertical;">${esc(n.comentario)}</textarea>
        ${g.sinTabla ? `<span style="font-size:14px;color:#93370d;font-weight:600;">Falta crear la tabla de carpetas en Supabase para guardar comentarios.</span>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <span style="font-size:17px;font-weight:800;">3. Fotos</span>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
          <label style="${_dBtn}height:64px;font-size:17px;position:relative;">${_dIco('camara', 24, 1.9)}Hacer foto
            <input type="file" accept="image/*" capture="environment" data-subir="nueva" style="position:absolute;width:1px;height:1px;opacity:0;"></label>
          <label style="${_dBtn}height:64px;font-size:17px;position:relative;">${_dIco('galeria', 24, 1.9)}Elegir de la galería
            <input type="file" accept="image/*" multiple data-subir="nueva" style="position:absolute;width:1px;height:1px;opacity:0;"></label>
        </div>
        ${nf ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;">
            ${n.files.map((f, i) => `<div style="position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#f1f3f6;">
              <img src="${f.url}" alt="${esc(f.file.name)}" style="width:100%;height:100%;object-fit:cover;display:block;">
              <button type="button" data-acc="quitar" data-i="${i}" aria-label="Quitar ${esc(f.file.name)}" style="position:absolute;top:6px;right:6px;width:32px;height:32px;border-radius:8px;border:none;background:rgba(17,17,34,.75);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;">${_dIco('cerrar', 16, 2.4)}</button>
            </div>`).join('')}</div>
          <span style="font-size:15px;color:#5b6475;font-weight:600;">${nf} foto${nf === 1 ? '' : 's'} lista${nf === 1 ? '' : 's'} · se reducen automáticamente para subir rápido</span>`
          : `<span style="font-size:15px;color:#5b6475;">Puedes crear la carpeta sin fotos y añadirlas después.</span>`}
      </div>
    </div>
    <footer style="padding:16px 26px;border-top:1px solid #e3e6eb;background:#f7f8fa;display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;flex-shrink:0;">
      <button type="button" data-acc="volver" style="${_dBtn}height:52px;">Cancelar</button>
      <button type="button" data-acc="crear" id="g-crear" style="${_dBtnP}height:52px;font-size:17px;font-weight:800;">${nf ? `Crear carpeta y subir ${nf} foto${nf === 1 ? '' : 's'}` : 'Crear carpeta'}</button>
    </footer>`;
}

// ── Acciones ──
async function _gAccion(overlay, acc, ds, btn) {
  const g = overlay._g;
  if (g.ocupado && acc !== 'cerrar') return;
  switch (acc) {
    case 'cerrar': return _gCerrar(overlay);
    case 'tab': g.tab = ds.tab; if (g.tab === 'fotos' && g.vista !== 'nueva') g.vista = g.vista === 'carpeta' ? 'carpeta' : 'carpetas'; return _gPintar(overlay);
    case 'nueva': g.vista = 'nueva'; return _gPintar(overlay);
    case 'volver':
      if (g.vista === 'nueva') { g.nueva.files.forEach(f => URL.revokeObjectURL(f.url)); g.nueva = { nombre: DOCS_CARPETA_DEFECTO, otro: false, comentario: '', files: [] }; }
      g.vista = 'carpetas'; g.sel = null; return _gPintar(overlay);
    case 'abrir': g.vista = 'carpeta'; g.sel = ds.nombre; return _gPintar(overlay);
    case 'chip': g.nueva.otro = false; g.nueva.nombre = ds.nombre; return _gPintar(overlay);
    case 'chipOtro': g.nueva.otro = true; g.nueva.enfocarOtro = true; _gPintar(overlay); g.nueva.enfocarOtro = false; return;
    case 'quitar': { const f = g.nueva.files.splice(Number(ds.i), 1)[0]; if (f) URL.revokeObjectURL(f.url); return _gPintar(overlay); }
    case 'subirDoc': return _gSubirDocumento(overlay);
    case 'crear': return _gCrearCarpeta(overlay);
    case 'guardarCom': {
      const txt = overlay.querySelector('#g-com').value.trim();
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await docsGuardarCarpeta(g.mat, ds.nombre, txt);
        mostrarToast('✓ Comentario guardado', 'success');
        registrarAccion('VEHICULO', 'Comentario carpeta fotos', `${g.mat} · ${ds.nombre}`);
        await _gCargar(overlay);
      } catch (e) { mostrarToast('No se pudo guardar: ' + e.message, 'error'); btn.disabled = false; btn.textContent = 'Guardar comentario'; }
      return;
    }
    case 'borrarFoto': {
      if (!g.puedeBorrar) return;
      if (!(await appConfirm('La foto se eliminará permanentemente.', { titulo: '¿Eliminar foto?', icono: '🗑️', labelOk: 'Sí, eliminar', peligro: true }))) return;
      try { await docsEliminarSupabase(ds.id, ds.path); mostrarToast('Foto eliminada', 'success'); await _gCargar(overlay); }
      catch (e) { mostrarToast('Error al eliminar: ' + e.message, 'error'); }
      return;
    }
    case 'borrarCarpeta': {
      if (!g.puedeBorrar) return;
      const c = _gCarpetas(g).find(x => x.nombre === ds.nombre);
      if (!c) return;
      const n = c.fotos.length;
      if (!(await appConfirm(`Se eliminará la carpeta «${esc(c.nombre)}»${n ? ` y sus ${n} foto${n === 1 ? '' : 's'}` : ''}. No se puede deshacer.`, { titulo: '¿Eliminar carpeta?', icono: '🗑️', labelOk: 'Sí, eliminar', peligro: true }))) return;
      try {
        await docsEliminarCarpeta(g.mat, c);
        mostrarToast('Carpeta eliminada', 'success');
        registrarAccion('VEHICULO', 'Eliminar carpeta fotos', `${g.mat} · ${c.nombre} · ${n} fotos`);
        g.vista = 'carpetas'; g.sel = null;
        await _gCargar(overlay);
      } catch (e) { mostrarToast('Error al eliminar: ' + e.message, 'error'); }
      return;
    }
  }
}

function _gFicherosElegidos(overlay, input) {
  const g = overlay._g;
  const files = [...input.files].filter(f => _docsMime(f).startsWith('image/'));
  if (input.files.length && !files.length) mostrarToast('Solo se admiten imágenes', 'error');
  input.value = '';
  if (!files.length) return;
  if (input.dataset.subir === 'nueva') {
    files.forEach(f => g.nueva.files.push({ file: f, url: URL.createObjectURL(f) }));
    _gPintar(overlay);
  } else {
    _gSubirFotos(overlay, input.dataset.nombre, files, overlay.querySelector('#g-subida'));
  }
}

/** Sube fotos a una carpeta. estado(i, total) se usa para mostrar el progreso. Devuelve {ok, fallos}. */
async function _gSubirFotos(overlay, carpeta, files, statusEl, botonEl) {
  const g = overlay._g;
  g.ocupado = true;
  let ok = 0; const fallos = [];
  for (let i = 0; i < files.length; i++) {
    const txt = `Subiendo ${i + 1} de ${files.length}…`;
    if (statusEl) statusEl.textContent = txt;
    if (botonEl) botonEl.textContent = txt;
    try {
      let { blob, nombre } = await docsComprimirImagen(files[i]);
      if (blob.size > DOCS_MAX_MB * 1024 * 1024) throw new Error(`supera los ${DOCS_MAX_MB} MB`);
      if (!blob.type) blob = new Blob([blob], { type: _docsMime(files[i]) });
      await docsSubirArchivo(g.mat, 'fotos', blob, nombre, { carpeta });
      ok++;
    } catch (e) { fallos.push(`${files[i].name}: ${e.message}`); }
  }
  g.ocupado = false;
  if (ok) {
    mostrarToast(`✓ ${ok} foto${ok === 1 ? '' : 's'} subida${ok === 1 ? '' : 's'} a «${carpeta}»`, 'success');
    registrarAccion('VEHICULO', 'Subir fotos', `${g.mat} · ${carpeta} · ${ok}`);
  }
  if (fallos.length) appAlert(fallos.map(esc).join('<br>'), { titulo: 'Algunas fotos no se subieron', icono: '⚠️' });
  await _gCargar(overlay);
  return { ok, fallos };
}

async function _gCrearCarpeta(overlay) {
  const g = overlay._g, n = g.nueva;
  let nombre = n.otro ? (overlay.querySelector('#g-nueva-otro')?.value || '').trim().replace(/\s+/g, ' ') : n.nombre;
  if (!nombre) { mostrarToast('Escribe el nombre de la carpeta', 'error'); overlay.querySelector('#g-nueva-otro')?.focus(); return; }
  const existente = _gCarpetas(g).find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
  if (existente) nombre = existente.nombre;
  const comentario = (overlay.querySelector('#g-nueva-com')?.value || '').trim();
  const btn = overlay.querySelector('#g-crear');
  btn.disabled = true; btn.textContent = 'Creando…';

  if (!g.sinTabla) {
    try {
      const com = existente && existente.comentario
        ? (comentario && comentario !== existente.comentario ? existente.comentario + '\n' + comentario : existente.comentario)
        : comentario;
      await docsGuardarCarpeta(g.mat, nombre, com);
    } catch (e) {
      mostrarToast('No se pudo crear la carpeta: ' + e.message, 'error');
      btn.disabled = false; btn.textContent = 'Crear carpeta'; return;
    }
  } else if (!n.files.length) {
    mostrarToast('Añade al menos una foto (falta la tabla de carpetas en Supabase)', 'error');
    btn.disabled = false; btn.textContent = 'Crear carpeta'; return;
  }
  const files = n.files.map(f => f.file);
  n.files.forEach(f => URL.revokeObjectURL(f.url));
  g.nueva = { nombre: DOCS_CARPETA_DEFECTO, otro: false, comentario: '', files: [] };
  if (existente) mostrarToast(`La carpeta «${nombre}» ya existía: se añaden las fotos ahí`, 'info');
  else registrarAccion('VEHICULO', 'Crear carpeta fotos', `${g.mat} · ${nombre}`);
  if (files.length) await _gSubirFotos(overlay, nombre, files, null, btn);
  else { mostrarToast(`✓ Carpeta «${nombre}» creada`, 'success'); await _gCargar(overlay); }
  g.vista = 'carpeta'; g.sel = nombre;
  if (document.body.contains(overlay)) _gPintar(overlay);
}

async function _gSubirDocumento(overlay) {
  const g = overlay._g;
  const fileInput = overlay.querySelector('#docs-file');
  const categoria = overlay.querySelector('#docs-cat').value;
  const statusEl  = overlay.querySelector('#docs-upload-status');
  const file = fileInput.files[0];
  if (!file) { mostrarToast('Selecciona un archivo primero', 'error'); return; }
  const mime = _docsMime(file);
  if (mime !== 'application/pdf' && !mime.startsWith('image/')) { mostrarToast('Solo se admiten PDF o imágenes', 'error'); return; }
  if (file.size > DOCS_MAX_MB * 1024 * 1024) { mostrarToast(`El archivo supera los ${DOCS_MAX_MB} MB`, 'error'); return; }
  const catLabel = _DOCS_CATS.find(c => c.id === categoria)?.label || categoria;
  statusEl.style.display = 'block'; statusEl.style.color = '#5b6475'; statusEl.textContent = `Subiendo ${file.name}…`;
  g.ocupado = true;
  try {
    const blob = file.type ? file : new Blob([file], { type: mime });
    await docsSubirArchivo(g.mat, categoria, blob, file.name);
    mostrarToast(`✓ ${catLabel} subido`, 'success');
    registrarAccion('VEHICULO', 'Subir documento', `${g.mat} · ${catLabel} · ${file.name}`);
    g.ocupado = false;
    await _gCargar(overlay);
    // Informe ITV: leer la fecha de próxima inspección y ofrecer actualizarla (js/itv-ocr.js)
    if (categoria === 'informe_itv' && typeof itvActualizarDesdeInforme === 'function') {
      itvActualizarDesdeInforme(g.mat, file, overlay.querySelector('#docs-upload-status'));
    }
  } catch (e) {
    g.ocupado = false;
    statusEl.style.color = '#b42318'; statusEl.textContent = 'No se pudo subir: ' + e.message;
  }
}

function _docsSpinner(txt) {
  return `<div style="display:flex;align-items:center;gap:10px;color:#5b6475;font-size:16px;font-weight:600;padding:14px 0;justify-content:center;">
    <div style="width:20px;height:20px;border:3px solid #e0e4ed;border-top-color:#1a1a2e;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;"></div>${txt}</div>`;
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
    if (overlay) await _gCargar(overlay);
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
    if (overlay) await _gCargar(overlay);
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
