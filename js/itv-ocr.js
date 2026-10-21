// ════════════════════════════════════════════════════════════════════════════
// FLOTA PRIMOR · js/itv-ocr.js — FECHA DE ITV LEÍDA DEL INFORME
//
// Al subir un "Informe ITV" (PDF escaneado o foto), se lee la primera página
// con reconocimiento de texto (Tesseract, en el propio navegador: el informe
// no sale a ningún sitio) y se busca la "Fecha de próxima inspección".
// Si la encuentra, pregunta antes de guardarla y avisa si la matrícula del
// informe no coincide o si el resultado no es favorable.
// Lo usa js/admin-documentos.js (_gSubirDocumento). Solo para administradores.
// ════════════════════════════════════════════════════════════════════════════

const _ITV_OCR_LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
let _itvOcrCarga = null;

function _itvCargarTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (_itvOcrCarga) return _itvCargarTesseract._p;
  _itvOcrCarga = true;
  _itvCargarTesseract._p = new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = _ITV_OCR_LIB;
    s.onload = () => window.Tesseract ? ok(window.Tesseract) : mal(new Error('No se cargó el lector'));
    s.onerror = () => { _itvOcrCarga = null; mal(new Error('No se pudo descargar el lector de texto')); };
    document.head.appendChild(s);
  });
  return _itvCargarTesseract._p;
}

/** Saca de un texto de informe ITV: fecha de próxima inspección (AAAA-MM-DD), matrícula y resultado. */
function itvExtraerDatos(txt) {
  const t = String(txt || '').replace(/\r/g, '');
  // Confusiones típicas del OCR dentro de los números (O→0, l/I→1, S→5, B→8)
  const fixDig = s => s.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/S/g, '5').replace(/B/g, '8');
  const reFecha = /([0-3OoIl]?[\dOoIlSB])\s*[-\/.]\s*([01OoIl]?[\dOoIlSB])\s*[-\/.]\s*((?:19|20)[\dOoIlSB]{2})/;
  let fecha = null;
  // Solo la de PRÓXIMA inspección (no la "Fecha de inspección", que es el día que se pasó)
  const m = t.match(new RegExp('pr[oóò0]xima\\s+inspecci[oóò0]n[^\\d\\n]{0,15}' + reFecha.source, 'i'));
  if (m) {
    const d = +fixDig(m[1]), mo = +fixDig(m[2]), y = +fixDig(m[3]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) fecha = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const mm = t.match(/matr[ií1]cula\s+actual\s*:?\s*([0-9OoIl]{4}\s?[A-Z]{3}|[A-Z]{1,2}\s?\d{4}\s?[A-Z]{1,2})/i);
  const matricula = mm ? fixDig(mm[1].replace(/\s/g, '').toUpperCase().slice(0, 4)) + mm[1].replace(/\s/g, '').toUpperCase().slice(4) : null;
  const bloqueRes = (t.match(/RESULTADO[\s\S]{0,120}/i) || [''])[0];
  const resultado = /DESFAVORABLE/i.test(bloqueRes || t) ? 'DESFAVORABLE'
    : /NEGATIVA/i.test(bloqueRes) ? 'NEGATIVA'
    : /FAVORABLE/i.test(bloqueRes || t) ? 'FAVORABLE' : null;
  return { fecha, matricula, resultado };
}

/** Primera página del archivo (PDF o imagen) como imagen para el OCR. */
async function _itvImagenPrimeraPagina(file) {
  if ((file.type || '').startsWith('image/')) return file;
  for (let i = 0; i < 25 && !window._pdfjs; i++) await new Promise(r => setTimeout(r, 200));
  if (!window._pdfjs) throw new Error('No se pudo abrir el PDF');
  const pdf = await window._pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pag = await pdf.getPage(1);
  const vp = pag.getViewport({ scale: 2.1 }); // ≈150 ppp: suficiente y rápido
  const c = document.createElement('canvas');
  c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  await pag.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  return c;
}

/** Lee el informe y devuelve { fecha, matricula, resultado } (fecha null si no la encuentra). */
async function itvLeerInforme(file) {
  const [T, img] = await Promise.all([_itvCargarTesseract(), _itvImagenPrimeraPagina(file)]);
  const w = await T.createWorker('spa');
  try {
    const { data } = await w.recognize(img);
    return itvExtraerDatos(data.text);
  } finally { w.terminate(); }
}

/**
 * Tras subir un informe ITV: lo lee y, si encuentra la fecha, pregunta si se actualiza.
 * statusEl (opcional): línea de estado de la ventana de documentos.
 */
async function itvActualizarDesdeInforme(matricula, file, statusEl) {
  if (typeof usuarioEsAdmin === 'function' && !usuarioEsAdmin()) return;
  let gi = -1, vi = -1;
  for (let i = 0; i < GRUPOS.length && vi < 0; i++) { vi = GRUPOS[i].vehiculos.findIndex(x => x.matricula === matricula); gi = i; }
  if (vi < 0) return;
  const v = GRUPOS[gi].vehiculos[vi];
  const estado = (txt, color) => { if (statusEl) { statusEl.style.display = txt ? 'block' : 'none'; statusEl.style.color = color || '#5b6475'; statusEl.textContent = txt || ''; } };

  estado('Leyendo la fecha del informe ITV… (puede tardar unos segundos)');
  let datos;
  try { datos = await itvLeerInforme(file); }
  catch (e) {
    estado('');
    mostrarToast('No se pudo leer el informe: pon la fecha con «Editar fecha»', 'info');
    return;
  }
  estado('');

  const fmt = iso => iso ? iso.split('-').reverse().join('/') : '—';
  if (!datos.fecha) {
    appAlert('No he encontrado la <strong>fecha de próxima inspección</strong> en el informe (puede que el escaneo no se lea bien).<br><br>Ponla a mano con el botón <strong>«Editar fecha»</strong> de la ficha, en ITV.',
      { titulo: 'Fecha de ITV no encontrada', icono: '📄' });
    return;
  }
  if (datos.fecha === v.itv_fin) { mostrarToast(`✓ La ITV ya estaba al día (${fmt(datos.fecha)})`, 'success'); return; }

  // Avisos: matrícula distinta o resultado no favorable
  const matVeh = (typeof _fichaMatReal === 'function' ? _fichaMatReal(v.matricula) : v.matricula).replace(/\s/g, '').toUpperCase();
  const avisos = [];
  if (datos.matricula && datos.matricula !== matVeh)
    avisos.push(`⚠️ El informe es de la matrícula <strong>${esc(datos.matricula)}</strong>, no de <strong>${esc(matVeh)}</strong>.`);
  if (datos.resultado && datos.resultado !== 'FAVORABLE')
    avisos.push(`⚠️ El resultado de la inspección es <strong>${esc(datos.resultado)}</strong>.`);

  const ok = await appConfirm(
    `En el informe pone que la próxima ITV es el <strong style="font-size:1.15em">${fmt(datos.fecha)}</strong>.<br>` +
    `Ahora mismo está guardada: ${v.itv_fin ? fmt(v.itv_fin) : 'sin fecha'}.` +
    (avisos.length ? `<br><br>${avisos.join('<br>')}` : '') +
    `<br><br>¿Actualizo la fecha de la ITV de <strong>${esc(v.matricula)}</strong>?`,
    { titulo: 'Fecha de ITV leída del informe', icono: '📋', labelOk: 'Sí, actualizar', colorOk: avisos.length ? '#e84545' : '#16a34a' });
  if (!ok) return;

  v.itv_fin = datos.fecha;
  renderAdminVehiculos(); renderTabla();
  sincronizarVehiculosConSheets();
  registrarAccion('VEHICULO', 'Fecha ITV desde informe', `${v.matricula} · ${fmt(datos.fecha)}`);
  mostrarToast(`✓ ITV actualizada: ${fmt(datos.fecha)}`, 'success');
}
