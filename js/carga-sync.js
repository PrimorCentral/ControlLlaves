// ════════════════════════════════════════════════════════════════════════════
// GOOGLE SHEETS
// ════════════════════════════════════════════════════════════════════════════
// ── Helpers del modal de carga ───────────────────────────────────────────────
function mostrarCargando(subtitulo, paso, pct) {
  const modal = document.getElementById('modal-cargando');
  document.getElementById('carga-titulo').textContent = subtitulo || 'Espere un momento, por favor';
  document.getElementById('carga-paso').textContent   = paso  || '';
  document.getElementById('carga-barra').style.width  = (pct || 0) + '%';
  modal.classList.add('visible');
}
function actualizarCargando(paso, pct) {
  document.getElementById('carga-paso').textContent  = paso || '';
  document.getElementById('carga-barra').style.width = (pct || 0) + '%';
}
function ocultarCargando(callback) {
  document.getElementById('carga-barra').style.width = '100%';
  setTimeout(() => {
    document.getElementById('modal-cargando').classList.remove('visible');
    document.getElementById('carga-barra').style.width = '0%';
    if (typeof callback === 'function') callback();
  }, 300);
}

async function cargarCuadrante() {
  if (!APPS_SCRIPT_URL) { ocultarSplash(); return; }
  _cargaCuadranteFallida = false;

  // Mostrar modal de carga ANTES de cualquier await
  const turnoLabel = turnoActual === 'MANANA' ? 'Mañana' : 'Tarde';
  const fechaLabel = fechaActual
    ? fechaActual.split('-').reverse().join('/')
    : '';
  mostrarCargando(fechaActual ? `${fechaLabel} - Turno ${turnoLabel}` : 'Espere un momento, por favor', 'Iniciando…', 5);

  // Limpiar estado local
  datos = {};
  pendientesGuardar.clear();

  try {
    actualizarCargando('Cargando datos en paralelo…', 30);

    const urlCuadrante = `${APPS_SCRIPT_URL}?accion=cargar&fecha=${encodeURIComponent(fechaActual)}&turno=${encodeURIComponent(turnoActual)}`;
    const urlIncid     = `${APPS_SCRIPT_URL}?accion=cargarIncidencias&desde=${encodeURIComponent(fechaActual)}&hasta=${encodeURIComponent(fechaActual)}`;
    const urlReasig    = `${APPS_SCRIPT_URL}?accion=cargarReasignaciones&desde=${encodeURIComponent(fechaActual)}&hasta=${encodeURIComponent(fechaActual)}`;

    // Todas las peticiones de lectura son independientes — se lanzan en paralelo
    // (flota/conductores con mostrarError=false: el modal de error, si hace falta,
    //  se gestiona de forma centralizada abajo para evitar condiciones de carrera
    //  cuando una de las dos termina antes que la otra)
    // Rutas se carga en paralelo pero SIN bloquear el arranque del cuadrante
    rutasCargarDesdeSheets();
    // Choferes habituales + rotación de turnos: tampoco bloquean el arranque
    if (typeof cargarHabituales === 'function') cargarHabituales();
    const [flotaOk, conductoresOk, json, jsonIncid, jsonReasig] = await Promise.all([
      cargarFlotaDesdeSheets(false),
      cargarConductoresDesdeSheets(false),
      fetch(urlCuadrante, { redirect: 'follow' }).then(r => r.json()).catch(() => null),
      fetch(urlIncid, { redirect: 'follow' }).then(r => r.json()).catch(() => null),
      fetch(urlReasig, { redirect: 'follow' }).then(r => r.json()).catch(() => null),
      sincronizarRepostajesPendientes(),
      sincronizarRepostajesFecha(),
      sincronizarOrdenesImpresas(),
    ]);

    if (!flotaOk || !conductoresOk) {
      _cargaCuadranteFallida = true;
      mostrarErrorCargaFlotaConductores(!flotaOk, !conductoresOk);
      return;
    }

    // Ambas cargas correctas — si quedaba visible un modal de error de un intento anterior, ocultarlo
    ocultarErrorCarga();

    actualizarCargando('Procesando datos…', 75);

    if (json && json.ok && json.filas && json.filas.length > 0) {
      json.filas.forEach(fila => {

        const key = `${fila.matricula}|${turnoActual}|${fechaActual}`;
        datos[key] = {
          operario:        fila.operario||'',
          resp_entrega:    fila.resp_entrega||'',
          resp_recibe:     fila.resp_recibe||'',
          hora_entrega:    fila.hora_entrega||'',
          hora_devolucion: fila.hora_devolucion||'',
          num_tarjeta:     fila.num_tarjeta||'',
          itv:             fila.itv||'',
          incidencias:     fila.incidencias||'',
        };
      });
      mostrarToast(`✓ Cuadrante cargado — ${json.filas.length} vehículo(s) con datos`, 'success');
    } else {
      mostrarToast('Cuadrante vacío para hoy — puedes empezar a asignar', 'info');
    }

    // Procesar incidencias del día (ya cargadas en paralelo arriba)
    if (jsonIncid && jsonIncid.ok && jsonIncid.filas) {
      jsonIncid.filas.forEach(f => {
        const turno = f.turno || turnoActual;
        const key = `${f.matricula}|${turno}|${fechaActual}`;
        if (!datos[key]) datos[key] = {};
        if (f.descripcion) datos[key].incidencias = f.descripcion;
      });
    }

    // Marcar vehículos reasignados en este turno/fecha para mostrar el badge
    if (jsonReasig && jsonReasig.ok && jsonReasig.filas) {
      const turnoNormActual = turnoActual;
      jsonReasig.filas.forEach(f => {
        const fTurno = (f.turno || '').toUpperCase();
        if (fTurno !== turnoNormActual && fTurno !== '') return;
        const mat = (f.matricula || '').trim().toUpperCase();
        if (!mat) return;
        const key = `${mat}|${turnoActual}|${fechaActual}`;
        if (!datos[key]) datos[key] = {};
        datos[key]._reasignado      = 'SI';
        datos[key]._operarioAnterior = f.operario || '?';
        // Guardar objeto completo para el modal de detalle
        if (!datos[key]._reasignaciones) datos[key]._reasignaciones = [];
        datos[key]._reasignaciones.push(f);
      });
    }


  } catch(e) {
    console.error(e);
    mostrarToast('⚠️ Error al conectar: ' + e.message, 'error');
  } finally {
    if (!_cargaCuadranteFallida) {
      actualizarCargando('Renderizando tabla…', 97);
      ocultarSplash();
      ocultarCargando(() => {
        renderTabla();
        actualizarBloqueoCuadrante();
        verificarConfig();
      });
    }
    _cargaCuadranteFallida = false;
  }
}

// ── guardarTodo: versión visible (botón manual) ──────────────────────────────
async function guardarTodo() {
  await _ejecutarGuardado(true);
}

// ── guardarTodoSilencioso: usado internamente, sin mensajes de error ──────────
async function guardarTodoSilencioso() {
  await _ejecutarGuardado(false);
}

// ── Upsert de una sola fila — núcleo atómico ─────────────────────────────────
// Envía solo la matrícula que cambió. El servidor hace INSERT o UPDATE
// sin tocar ninguna otra fila. Si falla: reintenta hasta MAX_INTENTOS.
async function guardarFilaUpsert(matricula, mostrarErrores) {
  if (!APPS_SCRIPT_URL) return false;
  const d = datos[`${matricula}|${turnoActual}|${fechaActual}`] || {};
  // Encontrar el tipo del vehículo
  let tipo = '';
  GRUPOS.forEach(g => g.vehiculos.forEach(v => { if (v.matricula === matricula) tipo = v.tipo; }));

  const fila = {
    fecha: fechaActual, turno: turnoActual, matricula, tipo,
    operario:        d.operario        || '',
    resp_entrega:    d.resp_entrega    || '',
    resp_recibe:     d.resp_recibe     || '',
    hora_entrega:    d.hora_entrega    || '',
    hora_devolucion: d.hora_devolucion || '',
    num_tarjeta:     d.num_tarjeta     || '',
    itv:             d.itv             || '',
    incidencias:     d.incidencias     || '',
  };

  const MAX_INTENTOS = 3;
  for (let i = 1; i <= MAX_INTENTOS; i++) {
    try {
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ accion: 'guardarFila', fila }),
        redirect: 'follow'
      });
      const json = await resp.json();
      if (json.ok) return true;
    } catch(e) {
      if (i < MAX_INTENTOS) await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
  if (mostrarErrores) mostrarToast(`⚠️ No se pudo guardar ${matricula} — se reintentará`, 'error');
  return false;
}

// ── Guarda snapshot histórico de una reasignación (siempre INSERT, nunca UPDATE)
async function guardarSnapshotReasignacion(snapshot) {
  if (!APPS_SCRIPT_URL) return false;
  const MAX_INTENTOS = 3;
  for (let i = 1; i <= MAX_INTENTOS; i++) {
    try {
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ accion: 'guardarSnapshotReasignacion', fila: snapshot }),
        redirect: 'follow'
      });
      const json = await resp.json();
      if (json.ok) return true;
    } catch(e) {
      if (i < MAX_INTENTOS) await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
  return false;
}

// ── núcleo compartido — itera sobre las matrículas pendientes ─────────────────
async function _ejecutarGuardado(mostrarErrores) {
  if (!APPS_SCRIPT_URL) { setSaveIndicator('', '—'); return; }
  if (pendientesGuardar.size === 0) {
    setSaveIndicator('saved', `✓ ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`);
    return;
  }
  if (guardandoAhora) return;
  guardandoAhora = true;
  setSaveIndicator('saving', '');

  // Extraer las matrículas de las keys "MAT|turno|fecha"
  const snap = new Set(pendientesGuardar);
  pendientesGuardar.clear();

  const matriculas = [...snap].map(k => k.split('|')[0]);
  const fallidas   = [];

  // Marcar como "en vuelo" para que el sync no las borre mientras se guardan
  snap.forEach(k => _enVuelo.add(k));

  const resultados = await Promise.all(matriculas.map(mat => guardarFilaUpsert(mat, mostrarErrores)));
  matriculas.forEach((mat, idx) => {
    if (!resultados[idx]) fallidas.push(`${mat}|${turnoActual}|${fechaActual}`);
    _enVuelo.delete(`${mat}|${turnoActual}|${fechaActual}`);
  });

  if (fallidas.length === 0) {
    setSaveIndicator('saved', `✓ ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`);
    // Reiniciar el timer de sync para que otros vean el cambio enseguida
    if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = setInterval(() => syncSilencioso(), SYNC_INTERVALO); }
  } else {
    // Devolver solo las que fallaron para reintentar
    fallidas.forEach(k => pendientesGuardar.add(k));
    setSaveIndicator('error', '⚠️ Error al guardar');
    if (mostrarErrores) mostrarToast('No se pudo guardar — se reintentará pronto', 'info');
    setTimeout(() => guardarTodoSilencioso(), 10000);
  }

  guardandoAhora = false;
}

function setSaveIndicator(type, msg) {
  const el = document.getElementById('save-indicator');
  el.className = 'save-indicator ' + type;
  el.textContent = msg;
}

// ════════════════════════════════════════════════════════════════════════════
// SYNC MULTI-USUARIO — polling silencioso cada 5s
// Fusiona cambios de otros usuarios sin pisar los propios
// ════════════════════════════════════════════════════════════════════════════
let _syncTimer       = null;
let _syncEnCurso     = false;
let _syncEnError     = false; // evita repetir el toast mientras el fallo persiste
const SYNC_INTERVALO = 15000; // 15 segundos — tiempo real

function notificarSyncError(msg) {
  if (!_syncEnError) {
    _syncEnError = true;
    mostrarToast('⚠️ ' + msg, 'error');
  }
}

function notificarSyncRecuperado() {
  if (_syncEnError) {
    _syncEnError = false;
    mostrarToast('✓ Conexión restablecida', 'success');
  }
}

function setSyncStatus(estado, msg) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  if (estado === 'syncing') {
    el.innerHTML = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#f39c12;margin-right:3px;animation:blink 0.6s infinite"></span>' + msg;
  } else if (estado === 'ok') {
    el.innerHTML = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2ecc71;margin-right:3px"></span>' + msg;
  } else if (estado === 'error') {
    el.innerHTML = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#e84545;margin-right:3px"></span>' + msg;
  }
}

function iniciarSync() {
  detenerSync();
  // Sincronizar al instante al arrancar
  syncSilencioso();
  // Y luego cada 5 segundos
  _syncTimer = setInterval(() => syncSilencioso(), SYNC_INTERVALO);
  // Al volver a la pestaña después de estar en background → sync inmediato
  document.addEventListener('visibilitychange', _onVisibilityChange);
}

function detenerSync() {
  if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; }
  document.removeEventListener('visibilitychange', _onVisibilityChange);
}

function _onVisibilityChange() {
  if (!document.hidden) syncSilencioso(); // vuelve el foco → sincronizar ya
}

let _syncCiclo = 0; // contador de ciclos para sincronizar flota cada N ciclos
let _ultimoSyncOrdenes = 0; // timestamp del último sync de órdenes impresas

async function syncSilencioso() {
  if (!APPS_SCRIPT_URL || !usuarioActual) return;
  if (_syncEnCurso || guardandoAhora) return;
  if (document.hidden) return;

  _syncEnCurso = true;
  setSyncStatus('syncing', 'Sincronizando…');
  try {
    _syncCiclo++;

    // ── Cada 6 ciclos (~30s) sincronizar la flota ──
    if (_syncCiclo % 6 === 1) {
      await cargarFlotaDesdeSheets();
    }

    // ── Cada 3 ciclos (~15s) sincronizar repostajes pendientes ──
    let hayNovedadesRepostaje = false;
    if (_syncCiclo === 1 || _syncCiclo % 3 === 0) {
      const pendientesAntes = JSON.stringify(_repostajesPendientesMat);
      const fechaAntes      = JSON.stringify(_repostajesFechaMat);
      await sincronizarRepostajesPendientes();
      await sincronizarRepostajesFecha();
      if (JSON.stringify(_repostajesPendientesMat) !== pendientesAntes ||
          JSON.stringify(_repostajesFechaMat)      !== fechaAntes) {
        hayNovedadesRepostaje = true;
      }
      actualizarBotonIncidenciasPendientes();
    }

    // ── Sincronizar órdenes impresas cada 15s ──
    const ahora = Date.now();
    if (ahora - _ultimoSyncOrdenes > 15000) {
      _ultimoSyncOrdenes = ahora;
      await sincronizarOrdenesImpresas();
    }

    if (hayNovedadesRepostaje) {
      renderTabla();
      actualizarBloqueoCuadrante();
    }

    const url = `${APPS_SCRIPT_URL}?accion=cargar&fecha=${encodeURIComponent(fechaActual)}&turno=${encodeURIComponent(turnoActual)}`;
    const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(7000) });
    if (!resp.ok) { setSyncStatus('error', 'Error de conexión'); notificarSyncError('Error de conexión con el servidor'); return; }
    const json = await resp.json();
    if (!json.ok || !json.filas) { setSyncStatus('error', 'Error de respuesta'); notificarSyncError('Error al sincronizar los datos'); return; }

    let hayNovedades = false;
    const campos = ['operario','resp_entrega','resp_recibe','hora_entrega',
                    'hora_devolucion','num_tarjeta','itv','incidencias'];

    // ── Actualizar filas con datos remotos más recientes ──────────────────
    json.filas.forEach(fila => {
      const key = `${fila.matricula}|${turnoActual}|${fechaActual}`;
      if (pendientesGuardar.has(key)) return; // mis cambios pendientes mandan
      if (_enVuelo.has(key)) return; // guardado en curso — no sobreescribir

      const local = datos[key] || {};
      let cambio  = false;

      campos.forEach(k => {
        const remoto = fila[k] || '';
        const propio = local[k] || '';
        if (remoto !== propio && (remoto || !propio)) {
          if (!datos[key]) datos[key] = {};
          datos[key][k] = remoto;
          cambio = true;
        }
      });
      if (cambio) hayNovedades = true;
    });

    // ── Detectar matrículas liberadas por otro usuario ────────────────────
    GRUPOS.forEach(g => g.vehiculos.forEach(v => {
      const key = `${v.matricula}|${turnoActual}|${fechaActual}`;
      if (pendientesGuardar.has(key)) return;
      if (_enVuelo.has(key)) return; // guardado en curso — no tocar
      const local  = datos[key];
      if (!local || !local.operario) return;
      const remoto = json.filas.find(f => f.matricula === v.matricula);
      if (!remoto || !remoto.operario) {
        datos[key] = {
          operario: '', resp_entrega: '', resp_recibe: '',
          hora_entrega: '', hora_devolucion: '',
          num_tarjeta: '', itv: '', incidencias: ''
        };
        hayNovedades = true;
      }
    }));

    if (hayNovedades) {
      renderTabla();
      actualizarBloqueoCuadrante();
    }

    const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSyncStatus('ok', `Sync ${hora}`);
    notificarSyncRecuperado();
  } catch(e) {
    setSyncStatus('error', 'Sin conexión');
    notificarSyncError('Sin conexión con el servidor');
  } finally {
    _syncEnCurso = false;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL ERROR DE CARGA — con botón Reintentar
// ════════════════════════════════════════════════════════════════════════════
// Guarda la última función de carga que falló, para poder reintentarla
let _ultimaCargaFallida = null;
let _cargaCuadranteFallida = false;

function mostrarErrorCarga(titulo, detalle, retryFn) {
  _ultimaCargaFallida = retryFn;
  const modal = document.getElementById('modal-error-carga');
  document.getElementById('err-carga-titulo').textContent  = titulo  || 'No se pudieron cargar los datos';
  document.getElementById('err-carga-detalle').textContent = detalle || 'Comprueba tu conexión a Internet e inténtalo de nuevo.';
  modal.classList.add('visible');
  ocultarCargando();
  ocultarSplash();
}

function ocultarErrorCarga() {
  document.getElementById('modal-error-carga').classList.remove('visible');
}

// ── Modal de error combinado para flota/conductores (carga en paralelo) ──────
// Se llama desde cargarCuadrante cuando una o ambas cargas fallan. Evita la
// condición de carrera de tener dos llamadas independientes a mostrarErrorCarga/
// ocultarErrorCarga pisándose entre sí, y reintenta solo lo que haya fallado.
function mostrarErrorCargaFlotaConductores(faltaFlota, faltaConductores) {
  let detalle;
  if (faltaFlota && faltaConductores) {
    detalle = 'No se pudo cargar la flota de vehículos ni la lista de conductores. Comprueba tu conexión e inténtalo de nuevo.';
  } else if (faltaFlota) {
    detalle = 'No se pudo cargar la flota de vehículos. Comprueba tu conexión e inténtalo de nuevo.';
  } else {
    detalle = 'No se pudo cargar la lista de conductores. Comprueba tu conexión e inténtalo de nuevo.';
  }
  mostrarErrorCarga('No se pudieron cargar los datos', detalle, async () => {
    const [fOk, cOk] = await Promise.all([
      faltaFlota ? cargarFlotaDesdeSheets(false) : Promise.resolve(true),
      faltaConductores ? cargarConductoresDesdeSheets(false) : Promise.resolve(true)
    ]);
    if (fOk && cOk) {
      ocultarErrorCarga();
      return true;
    }
    // Sigue fallando algo: actualizar el modal con el reintento de lo que falte
    mostrarErrorCargaFlotaConductores(!fOk, !cOk);
    return false;
  });
}

async function reintentarCargaError() {
  const btn = document.getElementById('err-carga-btn');
  const fn  = _ultimaCargaFallida;
  if (!fn) { ocultarErrorCarga(); return; }
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Reintentando…'; }
  try {
    const ok = await fn();
    if (ok) {
      // Si el modal de error sigue visible es porque otra carga falló también; no continuar
      if (document.getElementById('modal-error-carga').classList.contains('visible')) return;
      if (usuarioActual) {
        await cargarCuadrante();
      } else {
        await iniciarPrecarga();
      }
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↻ Reintentar'; }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FLOTA DESDE SHEETS
// ════════════════════════════════════════════════════════════════════════════
async function cargarFlotaDesdeSheets(mostrarError = true) {
  if (!APPS_SCRIPT_URL) {
    if (mostrarError) mostrarErrorCarga('Sin conexión configurada', 'No hay una URL de Apps Script configurada.', cargarFlotaDesdeSheets);
    return false;
  }
  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?accion=cargarFlota`, { redirect:'follow' });
    const json = await resp.json();
    if (json.ok && json.flota && json.flota.length > 0) {
      // Reconstruir GRUPOS desde Sheets
      GRUPOS.length = 0;
      json.flota.forEach(v => {
        let g = GRUPOS.find(g => g.nombre === v.grupo);
        if (!g) { g = { nombre: v.grupo, vehiculos: [] }; GRUPOS.push(g); }
        g.vehiculos.push({ matricula: v.matricula, tipo: v.tipo, nota: v.nota||'', orden: (v.orden ?? null), restringido: v.restringido==='SI', itv_fin: v.itv_fin||'', itv_aviso_enviado: v.itv_aviso_enviado||'', archivado: v.archivado===true, fecha_archivado: v.fecha_archivado||'', bloqueado: v.bloqueado===true, motivo_bloqueo: v.motivo_bloqueo||'', bloqueado_por: v.bloqueado_por||'', fecha_bloqueo: v.fecha_bloqueo||'', seguro_aseguradora: v.seguro_aseguradora||'', seguro_nombre: v.seguro_nombre||'', seguro_cif: v.seguro_cif||'', seguro_poliza: v.seguro_poliza||'', seguro_vencimiento: v.seguro_vencimiento||'', seguro_tel: v.seguro_tel||'' });
      });
      if (mostrarError) ocultarErrorCarga();
      return true;
    } else {
      if (mostrarError) mostrarErrorCarga('No se pudo cargar la flota', 'La hoja "Vehiculos" está vacía o no respondió correctamente.', cargarFlotaDesdeSheets);
      return false;
    }
  } catch(e) {
    if (mostrarError) mostrarErrorCarga('Error de conexión', 'No se pudo cargar la flota de vehículos.', cargarFlotaDesdeSheets);
    return false;
  }
}

async function sincronizarVehiculosConSheets() {
  if (!APPS_SCRIPT_URL) return;
  const flota = [];
  GRUPOS.forEach(g => g.vehiculos.forEach(v => {
    flota.push({ grupo: g.nombre, matricula: v.matricula, tipo: v.tipo, nota: v.nota||'', orden: (v.orden ?? ''), restringido: v.restringido?'SI':'', itv_fin: v.itv_fin||'', itv_aviso_enviado: v.itv_aviso_enviado||'', archivado: v.archivado?'SI':'', fecha_archivado: v.fecha_archivado||'', bloqueado: v.bloqueado?'SI':'', motivo_bloqueo: v.motivo_bloqueo||'', bloqueado_por: v.bloqueado_por||'', fecha_bloqueo: v.fecha_bloqueo||'', seguro_aseguradora: v.seguro_aseguradora||'', seguro_nombre: v.seguro_nombre||'', seguro_cif: v.seguro_cif||'', seguro_poliza: v.seguro_poliza||'', seguro_vencimiento: v.seguro_vencimiento||'', seguro_tel: v.seguro_tel||'' });
  }));
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method:'POST', headers:{'Content-Type':'text/plain'},
      body: JSON.stringify({ accion:'guardarFlota', flota }), redirect:'follow'
    });
    const json = await resp.json();
    if (!json || !json.ok) {
      console.warn('Fallo al guardar flota:', json && json.error);
      mostrarToast('⚠️ No se pudo guardar la flota: ' + ((json && json.error) || 'error desconocido'), 'error');
      return false;
    }
    return true;
  } catch(e) {
    console.warn('No se pudo sincronizar flota:', e);
    mostrarToast('⚠️ No se pudo guardar la flota (sin conexión)', 'error');
    return false;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CONDUCTORES — SYNC CON GOOGLE SHEETS
// ════════════════════════════════════════════════════════════════════════════
async function cargarConductoresDesdeSheets(mostrarError = true) {
  if (!APPS_SCRIPT_URL) {
    if (mostrarError) mostrarErrorCarga('Sin conexión configurada', 'No hay una URL de Apps Script configurada.', cargarConductoresDesdeSheets);
    return false;
  }
  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?accion=cargarConductores`, { redirect: 'follow' });
    const json = await resp.json();
    if (json.ok && json.conductores && json.conductores.length > 0) {
      CONDUCTORES.length = 0;
      json.conductores.forEach(c => CONDUCTORES.push(c));
      if (mostrarError) ocultarErrorCarga();
      return true;
    } else {
      if (mostrarError) mostrarErrorCarga('No se pudo cargar conductores', 'La hoja "Conductores" está vacía o no respondió correctamente.', cargarConductoresDesdeSheets);
      return false;
    }
  } catch(e) {
    if (mostrarError) mostrarErrorCarga('Error de conexión', 'No se pudo cargar la lista de conductores.', cargarConductoresDesdeSheets);
    return false;
  }
}

async function sincronizarConductoresConSheets() {
  if (!APPS_SCRIPT_URL) return false;
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'guardarConductores', conductores: CONDUCTORES }), redirect: 'follow'
    });
    const json = await resp.json();
    if (!json.ok) {
      console.warn('Fallo al sincronizar conductores:', json.error);
      mostrarToast('⚠️ No se pudo guardar en la base de datos: ' + (json.error || 'error desconocido'), 'error');
      return false;
    }
    return true;
  } catch(e) {
    console.warn('No se pudo sincronizar conductores:', e);
    mostrarToast('⚠️ No se pudo guardar en la base de datos (sin conexión)', 'error');
    return false;
  }
}

async function eliminarConductorDeSheets(numUsuario) {
  if (!APPS_SCRIPT_URL) return false;
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'eliminarConductor', numUsuario }), redirect: 'follow'
    });
    const json = await resp.json();
    if (!json.ok) {
      console.warn('Fallo al eliminar conductor:', json.error);
      mostrarToast('⚠️ No se pudo eliminar de la base de datos: ' + (json.error || 'error desconocido'), 'error');
      return false;
    }
    return true;
  } catch(e) {
    console.warn('No se pudo eliminar conductor:', e);
    mostrarToast('⚠️ No se pudo eliminar de la base de datos (sin conexión)', 'error');
    return false;
  }
}

