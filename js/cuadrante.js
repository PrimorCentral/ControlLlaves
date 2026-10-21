// ════════════════════════════════════════════════════════════════════════════
// TABLA — dropdown de conductores
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// BUSCADOR INTERACTIVO DE OPERARIO / CHOFER
// ════════════════════════════════════════════════════════════════════════════
let _buscadorInputActivo = null; // referencia al input que tiene el dropdown abierto

function highlight(texto, query) {
  if (!query) return esc(texto);
  const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return esc(texto).replace(re, '<mark>$1</mark>');
}

// ── Estado del buscador ──────────────────────────────────────────────────────
let _ddMat           = '';      // matrícula del input activo
let _ddResultados    = [];      // array de conductores filtrados actualmente
let _ddSeleccionando = false;   // true mientras el puntero está dentro del dropdown

// ── Inicializar listeners del dropdown (se llama una vez al arrancar) ─────────
function initBuscadorOperario() {
  const dd   = document.getElementById('operario-dropdown');
  const list = document.getElementById('operario-dropdown-list');

  // Mientras el ratón esté sobre el dropdown no cerramos al perder foco
  dd.addEventListener('mouseenter', () => { _ddSeleccionando = true;  });
  dd.addEventListener('mouseleave', () => { _ddSeleccionando = false; });

  // Delegación de clicks sobre los items
  list.addEventListener('click', e => {
    const item = e.target.closest('.operario-dropdown-item');
    if (!item) return;
    const idx = parseInt(item.dataset.idx, 10);
    const conductor = _ddResultados[idx];
    if (!conductor) return;
    _cerrarDd();
    _procesarSeleccionOperario(_ddMat, conductor.nombre);
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('mousedown', e => {
    if (!dd.classList.contains('open')) return;
    if (dd.contains(e.target)) return;
    if (e.target.classList.contains('operario-search-input')) return;
    _cerrarDd(true); // restaurar valor
  });

  // Cerrar al hacer scroll (pero no dentro del propio dropdown)
  document.addEventListener('scroll', e => {
    if (dd.contains(e.target)) return;
    _cerrarDd(true);
  }, true);
}

function abrirBuscadorOperario(input) {
  _ddMat = input.dataset.mat;
  _buscadorInputActivo = input;
  _renderDd(input, input.value.trim());
}

function filtrarBuscadorOperario(input) {
  _ddMat = input.dataset.mat;
  _buscadorInputActivo = input;
  _renderDd(input, input.value.trim());
}

function _renderDd(input, query) {
  const dd   = document.getElementById('operario-dropdown');
  const list = document.getElementById('operario-dropdown-list');
  const hdr  = document.getElementById('operario-dropdown-header');

  // Posicionar debajo del input (fixed → coordenadas de viewport)
  // Si no hay espacio abajo, se abre hacia arriba
  const rect = input.getBoundingClientRect();
  const ddH  = 260; // max-height del dropdown
  const spaceBelow = window.innerHeight - rect.bottom - 4;
  const spaceAbove = rect.top - 4;
  if (spaceBelow >= ddH || spaceBelow >= spaceAbove) {
    dd.style.top    = (rect.bottom + 4) + 'px';
    dd.style.bottom = 'auto';
  } else {
    dd.style.top    = 'auto';
    dd.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
  }
  dd.style.left  = rect.left + 'px';
  dd.style.width = Math.max(rect.width, 290) + 'px';

  const q = query.toUpperCase();
  // Choferes habituales de esta matrícula para el turno abierto: van primero y marcados
  const habituales = (typeof habitualesCuadrante === 'function') ? habitualesCuadrante(_ddMat) : new Set();
  const esHab = c => habituales.has(String(c.numUsuario));
  _ddResultados = CONDUCTORES.filter(c =>
    !q ||
    c.nombre.toUpperCase().includes(q) ||
    (c.dni || '').toUpperCase().includes(q) ||
    String(c.numUsuario || '').includes(q)
  );
  if (habituales.size) {
    _ddResultados = [..._ddResultados.filter(esHab), ..._ddResultados.filter(c => !esHab(c))];
  }
  _ddResultados = _ddResultados.slice(0, 60);
  const nHab = _ddResultados.filter(esHab).length;
  const equipo = (typeof equipoDelCuadrante === 'function') ? equipoDelCuadrante() : null;
  const txtHab = nHab ? ` · ★ ${nHab} habitual${nHab !== 1 ? 'es' : ''}${equipo ? ' (turno ' + equipo + ')' : ''}` : '';

  hdr.textContent = q
    ? `${_ddResultados.length} resultado${_ddResultados.length !== 1 ? 's' : ''} para "${query}"${txtHab}`
    : `${CONDUCTORES.length} conductores${txtHab || ' — nombre, DNI o Nº'}`;

  if (!_ddResultados.length) {
    list.innerHTML = `<div class="operario-dropdown-empty">Sin resultados para "${esc(query)}"</div>`;
  } else {
    list.innerHTML = _ddResultados.map((c, idx) => `
      <div class="operario-dropdown-item${esHab(c) ? ' habitual' : ''}" data-idx="${idx}">
        <div class="operario-item-nombre">${esHab(c) ? '<span class="estrella-hab">★</span> ' : ''}${highlight(c.nombre, query)}${esHab(c) ? '<span class="tag-habitual">Habitual</span>' : ''}</div>
        <div class="operario-item-meta">
          DNI: ${highlight(c.dni || '—', query)} &nbsp;·&nbsp;
          Nº ${highlight(String(c.numUsuario || '—'), query)}
          ${c.sociedad ? ' &nbsp;·&nbsp; ' + esc(c.sociedad) : ''}
          ${(() => { const otra = esHab(c) ? _matriculaYaAsignada(c.nombre, _ddMat) : null;
                     return otra ? ` &nbsp;·&nbsp; <span class="operario-item-ocupado">ya en ${esc(otra)}</span>` : ''; })()}
        </div>
      </div>`).join('');
  }

  dd.classList.add('open');
}

function _cerrarDd(restaurar) {
  const dd = document.getElementById('operario-dropdown');
  dd.classList.remove('open');
  _ddSeleccionando  = false;
  if (restaurar && _buscadorInputActivo) {
    const dato = getDato(_ddMat).operario || '';
    if (_buscadorInputActivo.value.trim() !== dato) {
      _buscadorInputActivo.value = dato;
    }
  }
  _buscadorInputActivo = null;
}

// Alias público que usa el atributo onblur del input
function cerrarBuscadorOperario() {
  if (_ddSeleccionando) return; // el usuario está interactuando con la lista
  _cerrarDd(true);
}

// ── Comprueba si `nombre` ya está asignado a otro vehículo activo (excluyendo `matExcluida`) ──
// Devuelve la matrícula del vehículo donde ya está asignado, o null si está libre.
function _matriculaYaAsignada(nombre, matExcluida) {
  const nombreNorm = nombre.trim().toUpperCase();
  let encontrada = null;
  GRUPOS.forEach(g => g.vehiculos.forEach(v => {
    if (encontrada) return;
    if (v.matricula === matExcluida) return;
    const d = getDato(v.matricula);
    if (!d.operario || !d.operario.trim()) return;
    // Si ya está devuelto (resp_recibe relleno) el vehículo se considera libre de nuevo
    if (d.resp_recibe && d.resp_recibe.trim()) return;
    if (d.operario.trim().toUpperCase() === nombreNorm) {
      encontrada = v.matricula;
    }
  }));
  return encontrada;
}

function mostrarAvisoYaAsignado(mat, nombre, otraMat) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:4000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:32px 28px 24px;width:380px;box-shadow:0 24px 64px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🚫</div>
      <div style="font-size:17px;font-weight:900;color:#c62020;margin-bottom:8px;">CONDUCTOR YA ASIGNADO</div>
      <div style="font-size:13px;font-weight:700;color:#1a1a2e;background:#ffe4e4;border-radius:8px;padding:6px 14px;display:inline-block;margin-bottom:10px;">${esc(nombre)}</div>
      <div style="font-size:13px;color:#556;line-height:1.5;margin-bottom:6px;">
        Este conductor ya está asignado al vehículo:
      </div>
      <div style="font-size:14px;font-weight:800;color:#c62020;background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:7px 14px;white-space:nowrap;display:inline-block;margin-bottom:18px;">${esc(otraMat)}</div>
      <div style="text-align:left;background:#f4f5f8;border-radius:10px;padding:14px 16px;margin-bottom:22px;">
        <div style="font-size:11px;font-weight:800;color:#1a1a2e;letter-spacing:0.3px;margin-bottom:8px;">Para asignarlo a ${esc(mat)}, elige una opción:</div>
        <div style="font-size:12.5px;color:#445;line-height:1.5;margin-bottom:8px;">
          <strong style="color:#1a1a2e;">1.</strong> Si el conductor sigue con ${esc(otraMat)}, hazle una <strong>reasignación</strong> en ese vehículo (esto lo libera y queda en el historial) y después asígnalo aquí.
        </div>
        <div style="font-size:12.5px;color:#445;line-height:1.5;">
          <strong style="color:#1a1a2e;">2.</strong> Si ya ha devuelto ${esc(otraMat)}, confirma la <strong>devolución de llaves</strong> en esa matrícula y después asígnalo aquí.
        </div>
      </div>
      <button id="btn-ya-asignado-cerrar" style="width:100%;padding:12px;background:#1a1a2e;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">Entendido</button>
    </div>`;
  document.body.appendChild(overlay);

  const cerrar = () => {
    if (document.body.contains(overlay)) document.body.removeChild(overlay);
    const inp = document.querySelector(`.operario-search-input[data-mat="${CSS.escape(mat)}"]`);
    if (inp) inp.value = getDato(mat).operario || '';
  };
  overlay.querySelector('#btn-ya-asignado-cerrar').onclick = cerrar;
  overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });
}

async function _procesarSeleccionOperario(mat, nombre) {
  if (!nombre || !nombre.trim()) {
    setDato(mat, 'operario', '');
    actualizarStats(); renderTabla(); programarGuardado();
    return;
  }

  // ── Feedback inmediato: que quede claro que el clic sí se ha registrado ────
  // mientras se comprueba en el servidor si el vehículo tiene llaves pendientes.
  const inputEl = document.querySelector(`.operario-search-input[data-mat="${CSS.escape(mat)}"]`);
  const wrapEl  = inputEl ? inputEl.closest('.operario-search-wrap') : null;
  const iconoEl = wrapEl ? wrapEl.querySelector('.operario-search-icon') : null;
  const iconoOriginal = iconoEl ? iconoEl.innerHTML : '';

  if (inputEl) {
    inputEl.value = nombre;
    inputEl.disabled = true;
    inputEl.style.opacity = '0.55';
    inputEl.style.cursor = 'wait';
  }
  if (iconoEl) {
    iconoEl.innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px;display:inline-block;vertical-align:middle;"></span>';
  }

  const restaurarFeedback = () => {
    if (inputEl) {
      inputEl.disabled = false;
      inputEl.style.opacity = '';
      inputEl.style.cursor = '';
    }
    if (iconoEl) iconoEl.innerHTML = iconoOriginal;
  };

  // ── Bloquear si el vehículo tiene alguna llave sin recepcionar de un turno anterior ──
  const ocupacion = await verificarVehiculoOcupado(mat);
  restaurarFeedback();

  if (ocupacion && ocupacion.vehiculoOcupado) {
    mostrarModalVehiculoOcupado(mat, nombre, ocupacion.info, ocupacion.pendientesRestantes, () => _procesarSeleccionOperario(mat, nombre));
    return;
  }

  _continuarProcesoAsignacion(mat, nombre);
}

function _continuarProcesoAsignacion(mat, nombre) {
  // ── Bloquear si el operario ya está asignado a OTRO vehículo activo ────────
  const otraMat = _matriculaYaAsignada(nombre, mat);
  if (otraMat) {
    mostrarAvisoYaAsignado(mat, nombre, otraMat);
    return;
  }

  // ── Bloquear si ITV caducada ──────────────────────────────────────────────
  const itv = itvCaducada(mat);
  if (itv.caducada) {
    mostrarModalITVCaducada(mat, itv.fecha);
    const inp = document.querySelector(`.operario-search-input[data-mat="${CSS.escape(mat)}"]`);
    if (inp) inp.value = '';
    return;
  }

  // ── Aviso si vehículo restringido ─────────────────────────────────────────
  const esRestringido = GRUPOS.some(g => g.vehiculos.some(v => v.matricula === mat && v.restringido));
  if (esRestringido) {
    mostrarAvisoRestringido(mat, nombre, () => _abrirConfirmarAsignacion(mat, nombre));
    return;
  }

  _abrirConfirmarAsignacion(mat, nombre);
}

// ── Comprueba si el vehículo `mat` sigue con la llave sin recepcionar del ──
// turno inmediatamente anterior (el de hoy si estamos en TARDE, o el de ayer
// TARDE si estamos en MANANA). Consulta siempre al servidor porque esa fila
// no está cargada en el cuadrante que se ve en pantalla (es de otro turno).
async function verificarVehiculoOcupado(mat) {
  if (!APPS_SCRIPT_URL || !fechaActual || !turnoActual) return { ok: true, vehiculoOcupado: false };
  try {
    const url = `${APPS_SCRIPT_URL}?accion=verificarOcupacion&matricula=${encodeURIComponent(mat)}&fecha=${encodeURIComponent(fechaActual)}&turno=${encodeURIComponent(turnoActual)}`;
    const resp = await fetch(url, { redirect: 'follow' });
    const json = await resp.json();
    return json;
  } catch(e) {
    // Sin conexión: no bloqueamos la asignación por un fallo de red
    return { ok: false, vehiculoOcupado: false };
  }
}

function mostrarModalVehiculoOcupado(mat, nombre, info, pendientesRestantes, onResuelto) {
  const restaurarInput = () => {
    const inp = document.querySelector(`.operario-search-input[data-mat="${CSS.escape(mat)}"]`);
    if (inp) inp.value = getDato(mat).operario || '';
  };

  const turnoLabel = info.turno === 'MANANA' ? 'Mañana' : 'Tarde';
  const fechaLabel = (info.fecha || '').split('-').reverse().join('/');
  const hayMas     = pendientesRestantes > 1;

  // ── Hora de devolución sugerida ──────────────────────────────────────────
  // NO usamos "la hora actual" como valor por defecto: si esto se registra al
  // día siguiente (o hitas más tarde), la hora actual da lugar a rangos sin
  // sentido (p.ej. entrega 13:20 → devolución 05:30 del día siguiente, porque
  // el responsable dejó el valor que venía puesto sin fijarse).
  // En su lugar, proponemos la hora aproximada de fin del turno en que se
  // entregó el vehículo, y dejamos que el responsable la ajuste si lo sabe con
  // más precisión.
  const FIN_TURNO_SUGERIDO = { MANANA: '13:00', TARDE: '21:00' };
  const horaSugerida = FIN_TURNO_SUGERIDO[info.turno] || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:4000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:32px 28px 24px;width:400px;box-shadow:0 24px 64px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🔑</div>
      <div style="font-size:17px;font-weight:900;color:#c62020;margin-bottom:8px;">VEHÍCULO SIN RECEPCIONAR</div>
      <div style="font-size:13px;font-weight:700;color:#1a1a2e;background:#ffe4e4;border-radius:8px;padding:6px 14px;display:inline-block;margin-bottom:14px;">${esc(mat)}</div>
      <div style="text-align:left;background:#f4f5f8;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
        <div style="font-size:12.5px;color:#445;line-height:1.6;">
          Este vehículo se entregó a <strong style="color:#1a1a2e;">${esc(info.operario || '—')}</strong>
          en el turno <strong style="color:#1a1a2e;">${turnoLabel}</strong> del <strong style="color:#1a1a2e;">${fechaLabel}</strong>,
          a las <strong style="color:#1a1a2e;">${esc(info.hora_entrega || '—')}</strong>, y aún no consta la devolución de llaves.
        </div>
        ${hayMas ? `<div style="font-size:11px;color:#b07040;font-weight:700;margin-top:8px;">⚠️ Hay ${pendientesRestantes} devoluciones acumuladas sin registrar de este vehículo. Se te pedirán una a una, empezando por la más antigua.</div>` : ''}
      </div>
      <div style="font-size:12px;font-weight:800;color:#1a1a2e;letter-spacing:0.3px;margin-bottom:4px;text-align:left;">Registrar devolución de llaves ahora</div>
      <div style="font-size:11px;color:#8899aa;margin-bottom:8px;text-align:left;">Hora aproximada a la que se devolvieron las llaves (no la hora actual)</div>
      <input type="time" id="voc-hora-devolucion" value="${horaSugerida}"
        style="width:100%;box-sizing:border-box;padding:11px;border:1.5px solid #dde1e8;border-radius:9px;font-family:Barlow,sans-serif;font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:6px;text-align:center;">
      <div id="voc-error-hora" style="display:none;font-size:11px;color:#c62020;font-weight:700;margin-bottom:8px;text-align:left;"></div>
      <button id="btn-voc-admin" style="display:none;width:100%;padding:9px;background:#fff5f5;color:#c62020;border:1.5px solid #f5b5b5;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;margin-bottom:12px;">🔑 Autorizar como admin</button>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:4px;">
        <button id="btn-voc-cancel" style="flex:1;padding:11px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>
        <button id="btn-voc-ok" style="flex:1;padding:11px;background:#c62020;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">✓ Registrar devolución</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#btn-voc-cancel').onclick = () => {
    document.body.removeChild(overlay);
    restaurarInput();
  };

  // Guarda la fila de devolución. forzarAdmin=true salta solo el tope de 8h
  // (el tope de "no anterior a la entrega" nunca se salta: no tiene sentido válido).
  const guardarDevolucion = async (horaDevolucion, forzarAdmin) => {
    const btn = overlay.querySelector('#btn-voc-ok');
    btn.disabled = true;
    btn.textContent = '⏳ Guardando…';
    try {
      const fila = {
        fecha:           info.fecha,
        turno:           info.turno,
        matricula:       mat,
        tipo:            info.tipo || '',
        operario:        info.operario     || '',
        resp_entrega:    info.resp_entrega || '',
        resp_recibe:     usuarioActual ? usuarioActual.nombre : '',
        hora_entrega:    info.hora_entrega || '',
        hora_devolucion: horaDevolucion,
        num_tarjeta:     info.num_tarjeta  || '',
        itv:             info.itv          || '',
        incidencias:     info.incidencias  || '',
      };
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, redirect: 'follow',
        body: JSON.stringify({ accion: 'guardarFila', fila }),
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Error al guardar');

      registrarAccion('CUADRANTE', forzarAdmin ? 'Recepción de llaves (turno anterior, autorizado por admin)' : 'Recepción de llaves (turno anterior)',
        `${mat} · turno ${info.turno} · ${info.fecha} · conductor: ${info.operario} · hora devolución: ${horaDevolucion}`);

      document.body.removeChild(overlay);
      mostrarToast(`✓ Llaves de ${mat} recepcionadas`, 'success');
      onResuelto();
    } catch(e) {
      btn.disabled = false;
      btn.textContent = '✓ Registrar devolución';
      mostrarToast('No se pudo registrar la devolución. Inténtalo de nuevo.', 'error');
    }
  };

  overlay.querySelector('#btn-voc-ok').onclick = async () => {
    const horaDevolucion = document.getElementById('voc-hora-devolucion').value;
    const errEl    = document.getElementById('voc-error-hora');
    const btnAdmin = document.getElementById('btn-voc-admin');
    errEl.style.display    = 'none';
    btnAdmin.style.display = 'none';

    if (!horaDevolucion) {
      mostrarToast('Introduce la hora de devolución', 'error');
      return;
    }

    // ── Validación: la devolución no puede ser anterior a la entrega ────────
    // (mismo día de referencia: si el vehículo se entregó a las 13:20, no
    // tiene sentido registrar una devolución a las 05:30 — esa hora suele
    // colarse porque es "la hora actual" en el momento de rellenar el modal,
    // no la hora real en que se devolvieron las llaves). Esta comprobación
    // NUNCA se puede saltar, ni siquiera como admin.
    if (info.hora_entrega && horaDevolucion < info.hora_entrega) {
      errEl.textContent = `La hora de devolución (${horaDevolucion}) no puede ser anterior a la hora de entrega (${info.hora_entrega}). Pon la hora aproximada real a la que se devolvieron las llaves, no la hora actual.`;
      errEl.style.display = 'block';
      return;
    }

    // ── Validación: la devolución no puede ser más de 8 horas después de la entrega ──
    // Evita registros técnicamente "válidos" pero absurdos (p.ej. entrega 05:35 →
    // devolución 23:00), que igualmente suelen deberse a dejar puesta una hora
    // que no es la real. Esta sí se puede saltar con autorización de admin, por
    // si alguna vez es un caso legítimo (turno alargado, incidencia, etc.).
    if (info.hora_entrega) {
      const [hE, mE] = info.hora_entrega.split(':').map(Number);
      const [hD, mD] = horaDevolucion.split(':').map(Number);
      const diffMin = (hD * 60 + mD) - (hE * 60 + mE);
      const MAX_DIFF_MIN = 8 * 60; // 8 horas
      if (diffMin > MAX_DIFF_MIN) {
        const horasStr = (diffMin / 60).toFixed(1).replace('.0', '');
        errEl.textContent = `Han pasado ${horasStr} horas desde la entrega (${info.hora_entrega}) hasta la hora indicada (${horaDevolucion}) — más de las 8 horas habituales de un turno. Comprueba que sea la hora real de devolución, no la hora actual.`;
        errEl.style.display    = 'block';
        btnAdmin.style.display = 'block';
        return;
      }
    }

    guardarDevolucion(horaDevolucion, false);
  };

  overlay.querySelector('#btn-voc-admin').onclick = () => {
    const horaDevolucion = document.getElementById('voc-hora-devolucion').value;
    const inp = document.getElementById('inp-admin-password');
    if (inp) inp.value = '';
    const errAdmin = document.getElementById('admin-error-msg');
    if (errAdmin) errAdmin.style.display = 'none';
    _pendingAdminCallback = async () => {
      guardarDevolucion(horaDevolucion, true);
    };
    document.getElementById('modal-login-admin').classList.add('open');
    setTimeout(() => { if (inp) inp.focus(); }, 100);
  };

  overlay.addEventListener('click', e => { if (e.target === overlay) { document.body.removeChild(overlay); restaurarInput(); } });
}

function _fmtFechaHoraBloqueo(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const fecha = d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });
    const hora  = d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
    return `${fecha} · ${hora}`;
  } catch(e) { return ''; }
}

function mostrarInfoBloqueo(mat, motivo, bloqueado_por, fecha_bloqueo) {
  const fechaLabel = _fmtFechaHoraBloqueo(fecha_bloqueo);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:4000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:32px 28px 24px;width:380px;box-shadow:0 24px 64px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">⛔</div>
      <div style="font-size:17px;font-weight:900;color:#e84545;margin-bottom:8px;">VEHÍCULO NO DISPONIBLE</div>
      <div style="font-size:13px;font-weight:700;color:#1a1a2e;background:#ffe4e4;border-radius:8px;padding:6px 14px;display:inline-block;margin-bottom:18px;">${esc(mat)}</div>
      <div style="text-align:left;background:#fff5f5;border:1px solid #fecaca;border-left:4px solid #e84545;border-radius:8px;padding:14px 16px;margin-bottom:18px;">
        <div style="font-size:9px;font-weight:800;color:#b91c1c;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Motivo</div>
        <div style="font-size:13px;color:#1a1a2e;line-height:1.6;">${esc(motivo || 'Sin especificar')}</div>
      </div>
      <div style="text-align:left;display:flex;flex-direction:column;gap:4px;margin-bottom:18px;font-size:11px;color:#8899aa;">
        ${bloqueado_por ? `<div>Bloqueado por <strong style="color:#556">${esc(bloqueado_por)}</strong></div>` : ''}
        ${fechaLabel ? `<div>Fecha de bloqueo: <strong style="color:#556">${esc(fechaLabel)}</strong></div>` : ''}
      </div>
      <div style="display:flex;gap:8px;">
        <button id="btn-info-bloqueo-cerrar" style="flex:1;padding:12px;background:#f0f2f5;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">Cerrar</button>
        <button id="btn-info-bloqueo-desbloquear" style="flex:1;padding:12px;background:#2ecc71;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">✓ Desbloquear</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-info-bloqueo-cerrar').onclick = () => document.body.removeChild(overlay);
  overlay.querySelector('#btn-info-bloqueo-desbloquear').onclick = () => {
    document.body.removeChild(overlay);
    confirmarDesbloqueoRapido(mat);
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
}

function confirmarDesbloqueoRapido(mat) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:4000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:32px 28px 24px;width:400px;box-shadow:0 24px 64px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🔓</div>
      <div style="font-size:16px;font-weight:900;color:#1a1a2e;margin-bottom:10px;">¿Desbloquear vehículo?</div>
      <div style="font-size:13px;font-weight:700;color:#1a1a2e;background:#eafaf1;border-radius:8px;padding:6px 14px;display:inline-block;margin-bottom:14px;">${esc(mat)}</div>
      <div style="font-size:13px;color:#556;line-height:1.6;margin-bottom:16px;text-align:left;">
        Vas a desbloquear este vehículo y quedará disponible para asignar conductores. Esto también marcará como <strong>resuelta</strong> la incidencia pendiente asociada.
      </div>
      <label style="font-size:10px;font-weight:800;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:5px;text-align:left;">Motivo del desbloqueo *</label>
      <textarea id="desbloqueo-motivo-input" rows="3" placeholder="Ej: Reparado en taller, vehículo revisado…"
        style="width:100%;padding:10px;border:1.5px solid #dde1ea;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;color:#1a1a2e;outline:none;resize:vertical;margin-bottom:18px;box-sizing:border-box;"></textarea>
      <div style="display:flex;gap:8px;">
        <button id="btn-desbloqueo-cancel" style="flex:1;padding:12px;background:#f0f2f5;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">Cancelar</button>
        <button id="btn-desbloqueo-ok" style="flex:1;padding:12px;background:#2ecc71;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">✓ Sí, desbloquear</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-desbloqueo-cancel').onclick = () => document.body.removeChild(overlay);
  overlay.querySelector('#btn-desbloqueo-ok').onclick = async () => {
    const motivoInput = overlay.querySelector('#desbloqueo-motivo-input');
    const motivo = motivoInput.value.trim();
    if (!motivo) { motivoInput.style.borderColor = '#e84545'; motivoInput.focus(); return; }

    overlay.querySelector('#btn-desbloqueo-ok').textContent = '⏳ Desbloqueando…';
    overlay.querySelector('#btn-desbloqueo-ok').disabled = true;
    try {
      const resueltoPor = usuarioActual ? (usuarioActual.nombre || usuarioActual.numUsuario) : '—';
      const resp = await fetch(APPS_SCRIPT_URL, {
        method:'POST', headers:{'Content-Type':'text/plain'},
        body: JSON.stringify({ accion:'desbloquearVehiculo', matricula: mat, motivo, resueltoPor }),
        redirect:'follow'
      });
      const json = await resp.json();
      if (json.ok) {
        // Actualizar GRUPOS en memoria
        GRUPOS.forEach(g => g.vehiculos.forEach(v => {
          if (v.matricula === mat) { v.bloqueado = false; v.motivo_bloqueo = ''; v.bloqueado_por = ''; v.fecha_bloqueo = ''; }
        }));
        // Sincronizar con la caché de incidencias del panel admin si está cargada
        if (json.incidenciaResuelta && typeof incidenciasCache !== 'undefined' && incidenciasCache.length) {
          const inc = incidenciasCache.find(f => f.timestamp === json.incidenciaResuelta && f.matricula === mat);
          if (inc) { inc.estado = 'COMPLETADO'; inc.resuelto_por = resueltoPor; inc.comentario_resolucion = motivo; }
        }
        document.body.removeChild(overlay);
        renderTabla();
        actualizarBotonIncidenciasPendientes();
        if (typeof mantCargarResumen === 'function') mantCargarResumen(); // su avería también se cierra
        mostrarToast(`✓ ${mat} desbloqueado`, 'success');
      } else {
        mostrarToast('Error al desbloquear: ' + (json.error||''), 'error');
        overlay.querySelector('#btn-desbloqueo-ok').textContent = '✓ Sí, desbloquear';
        overlay.querySelector('#btn-desbloqueo-ok').disabled = false;
      }
    } catch(e) {
      mostrarToast('Error de conexión', 'error');
      overlay.querySelector('#btn-desbloqueo-ok').textContent = '✓ Sí, desbloquear';
      overlay.querySelector('#btn-desbloqueo-ok').disabled = false;
    }
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
}

function abrirModalBloqueoRapido() {
  // Recopilar vehículos no bloqueados ni archivados
  const vehiculos = [];
  GRUPOS.forEach(g => g.vehiculos.forEach(v => {
    if (!v.bloqueado && !v.archivado) vehiculos.push({ matricula: v.matricula, grupo: g.nombre });
  }));
  if (vehiculos.length === 0) { mostrarToast('No hay vehículos disponibles para bloquear', 'error'); return; }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:4000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:28px 24px 22px;width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;">
      <div style="font-size:36px;text-align:center;margin-bottom:10px;">⛔</div>
      <div style="font-size:16px;font-weight:900;color:#e84545;text-align:center;margin-bottom:4px;">Bloquear vehículo</div>
      <div style="font-size:12px;color:#8899aa;text-align:center;margin-bottom:18px;">El vehículo quedará no disponible para asignación</div>
      <label style="font-size:10px;font-weight:800;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:5px;">Vehículo *</label>
      <select id="bloqueo-rapido-mat" style="width:100%;padding:10px;border:1.5px solid #dde1ea;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;color:#1a1a2e;outline:none;margin-bottom:14px;background:white;">
        <option value="">— Selecciona un vehículo —</option>
        ${vehiculos.map(v => `<option value="${esc(v.matricula)}">${esc(v.matricula)} · ${esc(v.grupo)}</option>`).join('')}
      </select>
      <label style="font-size:10px;font-weight:800;color:#556;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:5px;">Motivo del bloqueo *</label>
      <textarea id="bloqueo-rapido-motivo" rows="3" placeholder="Ej: Avería, en taller…"
        style="width:100%;padding:10px;border:1.5px solid #dde1ea;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;color:#1a1a2e;outline:none;resize:vertical;margin-bottom:18px;box-sizing:border-box;"></textarea>
      <div style="display:flex;gap:8px;">
        <button id="btn-bloqueo-rapido-cancel" style="flex:1;padding:11px;background:#f0f2f5;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">Cancelar</button>
        <button id="btn-bloqueo-rapido-ok" style="flex:1;padding:11px;background:#e84545;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">⛔ Bloquear</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-bloqueo-rapido-cancel').onclick = () => document.body.removeChild(overlay);
  overlay.querySelector('#btn-bloqueo-rapido-ok').onclick = async () => {
    const mat    = overlay.querySelector('#bloqueo-rapido-mat').value.trim();
    const motivo = overlay.querySelector('#bloqueo-rapido-motivo').value.trim();
    if (!mat)    { overlay.querySelector('#bloqueo-rapido-mat').style.borderColor='#e84545'; return; }
    if (!motivo) { overlay.querySelector('#bloqueo-rapido-motivo').style.borderColor='#e84545'; return; }
    const bloqueado_por = usuarioActual?.nombre || 'Responsable';
    const btnOk = overlay.querySelector('#btn-bloqueo-rapido-ok');
    btnOk.textContent = '⏳ Bloqueando…'; btnOk.disabled = true;
    try {
      const resp = await fetch(APPS_SCRIPT_URL, {
        method:'POST', headers:{'Content-Type':'text/plain'},
        body: JSON.stringify({ accion:'bloquearVehiculo', matricula: mat, motivo, bloqueado_por }),
        redirect:'follow'
      });
      const json = await resp.json();
      if (json.ok) {
        GRUPOS.forEach(g => g.vehiculos.forEach(v => {
          if (v.matricula === mat) { v.bloqueado = true; v.motivo_bloqueo = motivo; v.bloqueado_por = bloqueado_por; v.fecha_bloqueo = json.fecha_bloqueo || new Date().toISOString(); }
        }));
        document.body.removeChild(overlay);
        renderTabla();
        mostrarToast(`⛔ ${mat} bloqueado`, 'error');
        if (json.emailError) {
          appAlert(`El vehículo se ha bloqueado correctamente, pero no se pudo enviar el correo de aviso.<br><br><span style="color:#8899aa;font-size:12px">${json.emailError}</span>`, { titulo: 'Fallo al enviar correo electrónico', icono: '✉️⚠️' });
        }
      } else {
        mostrarToast('Error al bloquear: ' + (json.error||''), 'error');
        btnOk.textContent = '⛔ Bloquear'; btnOk.disabled = false;
      }
    } catch(e) {
      mostrarToast('Error de conexión', 'error');
      btnOk.textContent = '⛔ Bloquear'; btnOk.disabled = false;
    }
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
}

function mostrarAvisoRestringido(mat, nombre, onContinuar) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:4000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:32px 28px 24px;width:380px;box-shadow:0 24px 64px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
      <div style="font-size:17px;font-weight:900;color:#c62020;margin-bottom:8px;">VEHÍCULO RESTRINGIDO</div>
      <div style="font-size:13px;font-weight:700;color:#1a1a2e;background:#ffe4e4;border-radius:8px;padding:6px 14px;display:inline-block;margin-bottom:14px;">${esc(mat)}</div>
      <div style="font-size:13px;color:#556;line-height:1.6;margin-bottom:22px;">
        Este vehículo <strong style="color:#c62020">solo puede ser conducido por personal autorizado</strong>.<br>
        ¿Deseas continuar con la asignación de <strong>${esc(nombre)}</strong>?
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="btn-restringido-cancel" style="flex:1;padding:11px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>
        <button id="btn-restringido-ok" style="flex:1;padding:11px;background:#c62020;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">Continuar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#btn-restringido-cancel').onclick = () => {
    document.body.removeChild(overlay);
    const inp = document.querySelector(`.operario-search-input[data-mat="${CSS.escape(mat)}"]`);
    if (inp) inp.value = getDato(mat).operario || '';
  };
  overlay.querySelector('#btn-restringido-ok').onclick = () => {
    document.body.removeChild(overlay);
    onContinuar();
  };
}

// Modal que se muestra cuando se intenta asignar un conductor en un hueco vacío
// del turno MAÑANA fuera de horario (mismo criterio que la reasignación)
function mostrarModalAsignacionBloqueada(mat, nombre) {
  const restaurarInput = () => {
    const inp = document.querySelector(`.operario-search-input[data-mat="${CSS.escape(mat)}"]`);
    if (inp) inp.value = getDato(mat).operario || '';
  };

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:3000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:0;width:600px;max-width:96vw;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;overflow:hidden;">

      <!-- CABECERA ROJA -->
      <div style="background:#dc2626;padding:22px 28px 18px;display:flex;align-items:center;gap:14px;">
        <div style="background:rgba(255,255,255,0.18);border-radius:50%;width:50px;height:50px;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">🚫</div>
        <div>
          <div style="font-size:19px;font-weight:900;color:#fff;line-height:1.2;">Asignación no disponible</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.8);font-weight:600;margin-top:2px;">Vehículo: ${esc(mat)} · Conductor: ${esc(nombre)}</div>
        </div>
      </div>

      <!-- CUERPO -->
      <div style="padding:24px 28px 22px;">
        <div style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:10px;padding:14px 16px;margin-bottom:18px;display:flex;gap:12px;align-items:flex-start;">
          <span style="font-size:24px;flex-shrink:0;">☀️🌆</span>
          <div>
            <div style="font-size:13px;font-weight:900;color:#1d4ed8;margin-bottom:4px;">El turno de mañana está a punto de finalizar</div>
            <div style="font-size:12px;color:#1e3a5f;line-height:1.6;">A partir de las <strong>12:00</strong> no se puede asignar un conductor dentro del cuadrante de <strong>mañana</strong>. Si vas a poner un conductor de <strong>tarde</strong>, cambia primero al cuadrante de tarde y asígnalo desde allí.</div>
          </div>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:nowrap;">
          <button id="btn-asigblq-admin" style="padding:11px 14px;background:#f4f5f8;color:#556;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🔑 Autorizar como admin</button>
          <button id="btn-asigblq-cancel" style="padding:11px 18px;background:#f4f5f8;color:#556;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">Cancelar</button>
          <button id="btn-asigblq-turno" style="padding:11px 20px;background:#1d4ed8;color:white;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;">Ir al cuadrante de tarde →</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#btn-asigblq-cancel').onclick = () => {
    document.body.removeChild(overlay);
    restaurarInput();
  };

  overlay.querySelector('#btn-asigblq-turno').onclick = () => {
    document.body.removeChild(overlay);
    restaurarInput();
    const btnTarde = document.querySelector('.turno-btn[data-turno="TARDE"]');
    if (btnTarde) seleccionarTurno(btnTarde);
  };

  overlay.querySelector('#btn-asigblq-admin').onclick = () => {
    document.body.removeChild(overlay);
    const inp = document.getElementById('inp-admin-password');
    if (inp) inp.value = '';
    const errEl = document.getElementById('admin-error-msg');
    if (errEl) errEl.style.display = 'none';
    _pendingAdminCallback = async () => {
      _abrirConfirmarAsignacion(mat, nombre, true); // true = forzarAdmin, salta el bloqueo horario
    };
    document.getElementById('modal-login-admin').classList.add('open');
    setTimeout(() => { if (inp) inp.focus(); }, 100);
  };
}

function _abrirConfirmarAsignacion(mat, nombre, forzarAdmin) {
  // ─── Bloqueo: no permitir asignar dentro de MAÑANA a partir de las 11:00 ───
  // (mismo criterio que en pedirReasignacion, para el hueco vacío en vez del ya asignado)
  if (!forzarAdmin && turnoActual === 'MANANA' && esFechaHoy()) {
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const MIN_BLOQUEO_ASIG_MANANA = 12 * 60; // 12:00
    if (minutosAhora >= MIN_BLOQUEO_ASIG_MANANA) {
      mostrarModalAsignacionBloqueada(mat, nombre);
      return;
    }
  }

  const respEntrega = (usuarioActual && usuarioActual.nombre)
    ? usuarioActual.nombre
    : (usuarioActual ? usuarioActual.numUsuario : '—');

  document.getElementById('confirmar-asig-matricula').textContent = mat;
  document.getElementById('confirmar-asig-chofer').textContent    = nombre;
  document.getElementById('confirmar-asig-resp').textContent      = respEntrega;

  const overlay = document.getElementById('modal-confirmar-asignacion');
  overlay.classList.add('open');

  document.getElementById('btn-confirmar-asig-cancel').onclick = () => {
    overlay.classList.remove('open');
    const inp = document.querySelector(`.operario-search-input[data-mat="${CSS.escape(mat)}"]`);
    if (inp) inp.value = getDato(mat).operario || '';
  };

  document.getElementById('btn-confirmar-asig-ok').onclick = () => {
    overlay.classList.remove('open');
    setDato(mat, 'operario', nombre);
    if (usuarioActual && !getDato(mat).resp_entrega) {
      setDato(mat, 'resp_entrega', respEntrega);
      const ahora = new Date();
      setDato(mat, 'hora_entrega', ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    }
    actualizarStats(); renderTabla();
    abrirModalOrden(mat, true);
    guardarTodoSilencioso(); // inmediato al asignar
  };
}

function renderTabla() {
  const wrap = document.getElementById('table-wrap');
  const empty = document.getElementById('empty-state');
  if (empty) empty.remove();

  // Determinar si el cuadrante está bloqueado (fecha != hoy y no desbloqueado por admin)
  const cuadranteBloqueado = !esFechaHoy() && !cuadranteDesbloqueadoPorAdmin;

  let asignados = 0, total = 0;
  GRUPOS.forEach(g => g.vehiculos.forEach(v => {
    total++;
    const d = getDato(v.matricula);
    if (d.operario && d.operario.trim()) asignados++;
  }));
  document.getElementById('stat-asignados').textContent = asignados;
  document.getElementById('stat-total').textContent = total;
  const bar1 = document.getElementById('sb-stats-bar');
  if (bar1) bar1.style.width = (total > 0 ? Math.round(asignados / total * 100) : 0) + '%';

  const esHoy = esFechaHoy();
  let html = `<table><thead><tr>
    <th class="col-mat" style="width:185px">Matrícula</th>
    <th style="min-width:175px">Operario / Chofer</th>
    ${COLUMNAS.map(c => {
      if (c.key === 'itv' && !esHoy) return '';
      return `<th>${c.label}</th>`;
    }).join('')}
    ${esHoy ? '<th>Orden</th>' : ''}
  </tr></thead><tbody>`;

  const colCount = 2 + COLUMNAS.filter(c => !(c.key === 'itv' && !esHoy)).length + (esHoy ? 1 : 0);
  let hayRestringidos = false;
  GRUPOS.forEach((grupo, gi) => {
    html += `<tr class="group-header ${gi===0?'first':''}"><td colspan="${colCount}">${grupo.nombre}</td></tr>`;
    grupo.vehiculos.forEach(v => {
      // Vehículos archivados: solo visibles en fechas pasadas donde tuvieron actividad
      if (v.archivado) {
        const hoyStr = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
        if (fechaActual >= hoyStr) return; // ocultar en hoy y futuro
        const d = getDato(v.matricula);
        if (!d.operario && !d.resp_entrega && !d.hora_entrega && !d.resp_recibe) return; // ocultar si no hubo actividad ese día
      }
      const d        = getDato(v.matricula);
      const asignado = d.operario && d.operario.trim();
      const devuelto = asignado && d.resp_recibe && d.resp_recibe.trim();
      // "reasignado" = operario original existe pero está marcado como reasignado
      const reasignado = d._reasignado && d._operarioAnterior;
      // El bloqueo solo aplica si la fecha visualizada es HOY.
      // En cuadrantes históricos, el vehículo puede no estar bloqueado.
      const esBloqueado = !!v.bloqueado && esFechaHoy();
      const rowClass = esBloqueado ? 'vehiculo-bloqueado' : (devuelto ? 'devuelto' : (asignado ? 'asignado' : ''));
      if (v.restringido) hayRestringidos = true;

      const extraClass = (!esBloqueado && asignado) ? ' bloqueada' : '';
      const reasigStyle = reasignado ? ' style="background:#fff8f0!important;"' : '';
      html += `<tr class="${rowClass}${extraClass}" data-mat="${esc(v.matricula)}"${reasigStyle}>`;

      // Columna matrícula
      html += `<td style="min-width:175px"><div class="col-mat-cell">
        <div class="estado-dot ${devuelto?'asignado':''} ${!devuelto&&asignado&&!esBloqueado?'pendiente':''}"></div>
        <div class="mat-badge" onclick="abrirFichaVehiculo('${esc(v.matricula)}')" title="Ver ficha del vehículo">${esc(v.matricula)}${_matBadgeInfoHtml(v.matricula)}</div>
        <div class="tipo-tag">${esc(v.tipo)}${v.nota?' · '+v.nota:''}${esBloqueado?` <span class="badge-no-disponible">⛔ NO DISPONIBLE</span>`:''}${reasignado?` <span class="badge-reasig" onclick="verDetalleReasignacion('${esc(v.matricula)}')" style="cursor:pointer" title="Ver asignación anterior">↺ Reasignado</span>`:''}</div>
      </div></td>`;

      // Columna operario
      if (esBloqueado) {
        // VEHÍCULO BLOQUEADO: la matrícula ya lleva el badge "NO DISPONIBLE",
        // así que aquí solo mostramos un acceso a los detalles (sin repetir el texto).
        html += `<td><div class="operario-locked" style="cursor:pointer;opacity:0.85" onclick="mostrarInfoBloqueo('${esc(v.matricula)}','${esc(v.motivo_bloqueo||'')}','${esc(v.bloqueado_por||'')}','${esc(v.fecha_bloqueo||'')}')">
          <span class="operario-locked-name" style="color:#c63030">ℹ️ Ver motivo del bloqueo</span>
        </div></td>`;
      } else if (cuadranteBloqueado) {
        html += `<td><div class="operario-locked" style="opacity:0.6">
          <span class="operario-locked-name">${asignado ? esc(d.operario) : '<span style="color:#aaa">—</span>'}</span>
          <span title="Cuadrante bloqueado" style="font-size:13px;color:#aaa">🔒</span>
        </div></td>`;
      } else if (asignado) {
        // Asignado y editable: botón de reasignar con confirmación
        html += `<td><div class="operario-locked">
          <span class="operario-locked-name" title="${esc(d.operario)}">${esc(d.operario)}</span>
          <button class="btn-unlock" title="Re-asignar a otro conductor"
            onclick="pedirReasignacion('${esc(v.matricula)}')">⏏️</button>
        </div></td>`;
      } else {
        html += `<td><div class="operario-search-wrap">
          <input class="operario-search-input"
            data-mat="${esc(v.matricula)}"
            value="${esc(d.operario||'')}"
            placeholder="Buscar nombre, DNI…"
            autocomplete="off"
            onfocus="abrirBuscadorOperario(this)"
            oninput="filtrarBuscadorOperario(this)"
            onblur="cerrarBuscadorOperario()">
          <span class="operario-search-icon">🔍</span>
        </div></td>`;
      }

      // Columnas de datos adicionales
      COLUMNAS.forEach(col => {
        const val = d[col.key] || '';
        // resp_entrega: siempre readonly (auto-rellena al asignar), pero MUESTRA el valor real
        // Campos que SIEMPRE son solo lectura (se rellenan automáticamente)
        const CAMPOS_AUTO = ['resp_entrega', 'resp_recibe', 'hora_entrega', 'hora_devolucion'];
        const esCampoAuto = CAMPOS_AUTO.includes(col.key);

        // ── Campo NUM_TARJETA: badge según estado del repostaje ──────────────
        if (col.key === 'num_tarjeta') {
          const repoInfo  = _repostajesPendientesMat[v.matricula];  // pendiente activo (hoy)
          const repoFecha = _repostajesFechaMat[v.matricula];       // cualquier repostaje del día
          // Fallback: num_tarjeta que viene directamente de la hoja Registros (cargarCuadrante)
          const numTarjetaLocal = (d.num_tarjeta || '').trim();

          if (repoInfo) {
            // Tarjeta entregada HOY y pendiente de devolución → badge amarillo, abre modal devolución directa
            html += `<td style="text-align:center;padding:4px 6px;"><span style="display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:12px;font-weight:900;color:#92600a;background:#fffbeb;border:2px solid #f59e0b;border-radius:8px;padding:5px 12px;white-space:nowrap;cursor:pointer;box-shadow:0 0 0 3px rgba(245,158,11,0.15);animation:badge-pulse 2s ease-in-out infinite;width:100%;box-sizing:border-box;"
              onclick="abrirDevolucionDirecta(${JSON.stringify(repoInfo).replace(/"/g,'&quot;')})" title="Tarjeta pendiente — click para registrar devolución">
              ⛽ ${esc(repoInfo.num_tarjeta||'GASOIL')}
            </span></td>`;

          } else if (repoFecha && repoFecha.num_tarjeta) {
            // Hay repostaje registrado este día (completado o pendiente histórico)
            const devuelta = repoFecha.hora_devolucion && repoFecha.hora_devolucion.trim();
            if (devuelta) {
              // Completado → número limpio clickable para PDF
              html += `<td style="text-align:center;padding:4px 6px;"><span
                onclick="generarPDFRepostajeDirecto(${JSON.stringify(repoFecha).replace(/"/g,'&quot;')})"
                title="Repostaje completado — click para generar PDF"
                style="display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:12px;font-weight:900;color:#1a6635;background:#eafaf1;border:2px solid #a9dfbf;border-radius:8px;padding:5px 12px;white-space:nowrap;cursor:pointer;width:100%;box-sizing:border-box;transition:background 0.15s,border-color 0.15s"
                onmouseover="this.style.background='#d6f5e3';this.style.borderColor='#7ccba6'" onmouseout="this.style.background='#eafaf1';this.style.borderColor='#a9dfbf'">
                ⛽ ${esc(repoFecha.num_tarjeta)}
              </span></td>`;
            } else {
              // Entregada pero sin devolución (pendiente histórico) → fondo amarillo, abre devolución directa
              html += `<td style="text-align:center;padding:4px 6px;"><span
                onclick="abrirDevolucionDirecta(${JSON.stringify(repoFecha).replace(/"/g,'&quot;')})"
                title="Tarjeta pendiente de devolución — click para registrar devolución"
                style="display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:12px;font-weight:900;color:#92600a;background:#fffbeb;border:2px solid #f59e0b;border-radius:8px;padding:5px 12px;white-space:nowrap;cursor:pointer;box-shadow:0 0 0 3px rgba(245,158,11,0.15);animation:badge-pulse 2s ease-in-out infinite;width:100%;box-sizing:border-box;">
                ⛽ ${esc(repoFecha.num_tarjeta)}
              </span></td>`;
            }

          } else if (numTarjetaLocal) {
            // Fallback desde hoja Registros: usar hora_devolucion para saber el estado
            const horaDevLocal = (d.hora_devolucion || '').trim();
            if (horaDevLocal) {
              // Completado (tiene hora devolución) → clickable para PDF
              // Construimos un objeto mínimo con los datos que tenemos en local
              const repoLocal = {
                matricula:       v.matricula,
                num_tarjeta:     numTarjetaLocal,
                usuario_chofer:  d.operario || '',
                kilometraje:     '',
                hora_entrega:    d.hora_entrega || '',
                hora_devolucion: horaDevLocal,
                gasoil_antes:    '',
                adblue_antes:    '',
                gasoil_despues:  '',
                adblue_despues:  '',
                resp_entrega:    d.resp_entrega || '',
                resp_recibe:     d.resp_recibe || '',
                fecha:           fechaActual || '',
                estado:          'COMPLETADO',
              };
              html += `<td style="text-align:center;padding:4px 6px;"><span
                onclick="generarPDFRepostajeDirecto(${JSON.stringify(repoLocal).replace(/"/g,'&quot;')})"
                title="Repostaje completado — click para generar PDF"
                style="display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:12px;font-weight:900;color:#1a6635;background:#eafaf1;border:2px solid #a9dfbf;border-radius:8px;padding:5px 12px;white-space:nowrap;cursor:pointer;width:100%;box-sizing:border-box;transition:background 0.15s,border-color 0.15s"
                onmouseover="this.style.background='#d6f5e3';this.style.borderColor='#7ccba6'" onmouseout="this.style.background='#eafaf1';this.style.borderColor='#a9dfbf'">
                ⛽ ${esc(numTarjetaLocal)}
              </span></td>`;
            } else {
              // Sin hora devolución → pendiente, abre modal devolución directa si es hoy
              if (esHoy) {
                // Construimos objeto mínimo para el modal de devolución
                const repoLocal = {
                  id:             '',
                  matricula:      v.matricula,
                  num_tarjeta:    numTarjetaLocal,
                  usuario_chofer: d.operario || '',
                  kilometraje:    '',
                  hora_entrega:   d.hora_entrega || '',
                  gasoil_antes:   '',
                  adblue_antes:   '',
                  resp_entrega:   d.resp_entrega || '',
                };
                html += `<td style="text-align:center;padding:4px 6px;"><span
                  style="display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:12px;font-weight:900;color:#92600a;background:#fffbeb;border:2px solid #f59e0b;border-radius:8px;padding:5px 12px;white-space:nowrap;cursor:pointer;box-shadow:0 0 0 3px rgba(245,158,11,0.15);animation:badge-pulse 2s ease-in-out infinite;width:100%;box-sizing:border-box;"
                  onclick="abrirDevolucionDirecta(${JSON.stringify(repoLocal).replace(/"/g,'&quot;')})"
                  title="Tarjeta pendiente — click para registrar devolución">
                  ⛽ ${esc(numTarjetaLocal)}
                </span></td>`;
              } else {
                // Histórico sin devolución → solo texto
                html += `<td><span style="font-size:11px;font-weight:800;color:#1a1a2e;padding:2px 4px;">⛽ ${esc(numTarjetaLocal)}</span></td>`;
              }
            }

          } else if (esHoy) {
            if (asignado) {
              // Hoy, sin ningún repostaje registrado y con conductor asignado → botón Registrar
              html += `<td><button class="btn-print-row" style="background:#2a2a1a;color:#ffd54a;border-color:#5a5a2a;font-size:10px;padding:4px 8px;"
                onclick="abrirModalRepostajeConMat('${esc(v.matricula)}')"
                title="Registrar entrega de tarjeta GASOIL">
                ⛽ Asignar tarjeta
              </button></td>`;
            } else {
              // Hoy, sin conductor asignado → nada que registrar todavía
              html += `<td><span style="font-size:11px;color:#c0c5cf;">—</span></td>`;
            }

          } else {
            // Día histórico sin repostaje → input vacío de solo lectura
            html += `<td><input class="cell-input-locked num" value="${esc(val)}" readonly tabindex="-1"></td>`;
          }
          return;
        }

        // ── Campo INCIDENCIAS: solo botón "Ver" si tiene incidencia (solo editable si es hoy) ─
        if (col.key === 'incidencias') {
          const tieneIncid = val && val.trim();
          // Botón "Añadir Incidencia" → ventana "¿Qué quieres añadir?" (js/mantenimiento.js):
          // incidencia del turno, avería, fotos, documentos y, para admin, mantenimiento y revisión.
          const btnAnadir = `<button class="btn-print-row btn-anadir" type="button" aria-haspopup="dialog"
              onclick="event.stopPropagation();mantMenuAnadir(this,'${esc(v.matricula)}')"
              title="Añadir incidencia, avería, fotos…">Añadir Incidencia</button>`;
          if (tieneIncid) {
            // Siempre mostrar "Ver" si hay incidencia registrada, y al lado el menú
            html += `<td><div class="celda-incid"><button class="btn-print-row" style="background:#fff8ec;color:#c47d00;border-color:#fde68a;font-size:10px;padding:4px 8px;"
              onclick="abrirModalIncidencia('${esc(v.matricula)}')"
              title="${esc(val)}">
              ⚠️ INCIDENCIA
            </button><button class="btn-print-row btn-anadir solo-icono" type="button" aria-haspopup="dialog" aria-label="Añadir"
              onclick="event.stopPropagation();mantMenuAnadir(this,'${esc(v.matricula)}')" title="Añadir avería, fotos…">+</button></div></td>`;
          } else {
            html += `<td>${btnAnadir}</td>`;
          }
          return;
        }

        // ── Campo ITV: mostrar badge según estado (solo si es hoy) ──────
        if (col.key === 'itv') {
          if (!esHoy) return; // no mostrar columna ITV en cuadrantes de otro día
          const itvInfo = itvCaducada(v.matricula);
          if (itvInfo.caducada) {
            html += `<td><span style="font-size:9px;font-weight:700;color:#e84545;background:#fff0f0;border:1px solid #fcc;border-radius:5px;padding:2px 6px;">⛔ Caducada</span></td>`;
            return;
          }
          // Buscar el vehículo para comprobar si tiene ITV en vigor
          let itvFin = '';
          for (const g of GRUPOS) {
            const veh = g.vehiculos.find(x => x.matricula === v.matricula);
            if (veh && veh.itv_fin) { itvFin = veh.itv_fin; break; }
          }
          if (itvFin) {
            html += `<td><span style="font-size:9px;font-weight:700;color:#2ecc71;background:#eafaf1;border:1px solid #a9dfbf;border-radius:5px;padding:2px 6px;">✅ En vigor</span></td>`;
            return;
          }
        }

        // ── Resp. Recibe: botón inline si asignado y pendiente de recibir ──
        if (col.key === 'resp_recibe' && esHoy && asignado && !devuelto && !cuadranteBloqueado) {
          html += `<td style="padding:4px 6px;">
            <button
              onclick="pedirConfirmacionRecibirLlave('${esc(v.matricula)}')"
              style="display:inline-flex;align-items:center;justify-content:center;gap:5px;width:100%;padding:5px 10px;background:#1a3a2a;color:#4ade80;border:1.5px solid #2a5a3a;border-radius:7px;font-family:Barlow,sans-serif;font-size:11px;font-weight:800;cursor:pointer;letter-spacing:0.5px;transition:background .15s,box-shadow .15s;box-sizing:border-box;"
              onmouseover="this.style.background='#143022';this.style.boxShadow='0 0 0 3px rgba(74,222,128,0.2)'"
              onmouseout="this.style.background='#1a3a2a';this.style.boxShadow='none'"
              title="Confirmar recepción de llaves">
              🔑 Registrar devolución
            </button>
          </td>`;
          return;
        }

        if (cuadranteBloqueado || asignado || esCampoAuto) {
          // Placeholder y estilo según si tiene valor o no
          const placeholder = '';
          const dimStyle    = '';
          const titles = {
            resp_entrega:    'Responsable que entrega — se rellena automáticamente al asignar operario',
            resp_recibe:     'Responsable que recibe — se rellena al pulsar "Recibir llaves"',
            hora_entrega:    'Hora de entrega — se registra automáticamente al asignar operario',
            hora_devolucion: 'Hora de devolución — se registra automáticamente al recibir llaves',
          };
          // Si el campo tiene un valor, mostramos ese valor completo en el tooltip
          // (para poder leerlo entero al pasar el ratón cuando se corta visualmente);
          // si está vacío, mostramos la explicación genérica del campo.
          const titleAttr = esCampoAuto ? ` title="${val ? esc(val) : (titles[col.key] || '')}"` : '';
          html += `<td><input class="cell-input-locked ${col.clase}"
            value="${esc(val)}" placeholder="${placeholder}" readonly tabindex="-1"${titleAttr}${dimStyle}></td>`;
        } else {
          html += `<td><input class="cell-input ${col.clase}"
            data-mat="${esc(v.matricula)}" data-col="${col.key}"
            value="${esc(val)}" placeholder="—"
            oninput="onCellInput(this)" onblur="onCellBlur(this)"></td>`;
        }
      });

      // Botón imprimir orden (solo si es hoy)
      if (esHoy) {
        const disabled = (asignado && !cuadranteBloqueado) ? '' : 'disabled';
        const yaImpresa = _ordenesImpresas.has(`${(v.matricula||'').trim().toUpperCase()}|${turnoActual.toUpperCase()}|${fechaActual}`);
        const claseOrden = yaImpresa ? 'impresa' : (asignado ? 'pendiente' : '');
        html += `<td><button class="btn-print-row ${claseOrden}" ${disabled}
          data-mat="${esc(v.matricula)}"
          onclick="abrirModalOrden('${esc(v.matricula)}', false)"
          title="${yaImpresa ? '✓ Orden ya impresa' : (asignado ? 'Pendiente de imprimir' : 'Imprimir orden de trabajo')}">🖨️ Orden</button></td>`;
      }

      html += `</tr>`;
    });
  });


  html += `</tbody></table>`;
  wrap.innerHTML = html;
}

function getDato(matricula) {
  return datos[`${matricula}|${turnoActual}|${fechaActual}`] || {};
}
function setDato(matricula, campo, valor) {
  const key = `${matricula}|${turnoActual}|${fechaActual}`;
  if (!datos[key]) datos[key] = {};
  datos[key][campo] = valor;
  pendientesGuardar.add(key);
}
// ─── MODALES DE SISTEMA (reemplazo de confirm/alert/prompt nativos) ───────────
function _crearOverlayModal(html) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
  ov.innerHTML = `<div style="background:white;border-radius:18px;padding:32px 28px 24px;width:400px;max-width:95vw;box-shadow:0 32px 80px rgba(0,0,0,0.4);font-family:Barlow,sans-serif;animation:nv-in 0.2s cubic-bezier(.34,1.56,.64,1)">${html}</div>`;
  document.body.appendChild(ov);
  return ov;
}

// appConfirm(msg, {titulo, icono, labelOk, colorOk}) → Promise<boolean>
function appConfirm(msg, opts = {}) {
  return new Promise(resolve => {
    const { titulo = '¿Confirmar acción?', icono = '⚠️', labelOk = 'Confirmar', colorOk = '#e84545', peligro = false } = opts;
    const advertencia = peligro ? `<div style="font-size:11px;color:#e84545;font-weight:700;margin-bottom:20px;">⚠️ Esta acción no se puede deshacer.</div>` : '';
    const ov = _crearOverlayModal(`
      <div style="font-size:36px;margin-bottom:10px">${icono}</div>
      <div style="font-size:15px;font-weight:900;color:#1a1a2e;margin-bottom:8px">${titulo}</div>
      <div style="font-size:13px;color:#556;margin-bottom:20px;line-height:1.5">${msg}</div>
      ${advertencia}
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="_ac-cancel" style="padding:10px 22px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer">Cancelar</button>
        <button id="_ac-ok" style="padding:10px 22px;background:${colorOk};color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer">${labelOk}</button>
      </div>`);
    ov.querySelector('#_ac-cancel').onclick = () => { document.body.removeChild(ov); resolve(false); };
    ov.querySelector('#_ac-ok').onclick    = () => { document.body.removeChild(ov); resolve(true); };
    ov.querySelector('#_ac-ok').focus();
  });
}

// appAlert(msg, {titulo, icono}) → Promise<void>
function appAlert(msg, opts = {}) {
  return new Promise(resolve => {
    const { titulo = 'Aviso', icono = 'ℹ️' } = opts;
    const ov = _crearOverlayModal(`
      <div style="font-size:36px;margin-bottom:10px">${icono}</div>
      <div style="font-size:15px;font-weight:900;color:#1a1a2e;margin-bottom:8px">${titulo}</div>
      <div style="font-size:13px;color:#556;margin-bottom:24px;line-height:1.5">${msg}</div>
      <div style="display:flex;justify-content:flex-end">
        <button id="_aa-ok" style="padding:10px 28px;background:#1a1a2e;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer">Entendido</button>
      </div>`);
    ov.querySelector('#_aa-ok').onclick = () => { document.body.removeChild(ov); resolve(); };
    ov.querySelector('#_aa-ok').focus();
  });
}

// appPrompt(pregunta, {titulo, icono, placeholder, mayusculas}) → Promise<string|null>
function appPrompt(pregunta, opts = {}) {
  return new Promise(resolve => {
    const { titulo = 'Introduce un valor', icono = '✏️', placeholder = '', mayusculas = false } = opts;
    const ov = _crearOverlayModal(`
      <div style="font-size:32px;margin-bottom:10px">${icono}</div>
      <div style="font-size:15px;font-weight:900;color:#1a1a2e;margin-bottom:6px">${titulo}</div>
      <div style="font-size:12px;color:#8899aa;margin-bottom:14px">${pregunta}</div>
      <input id="_ap-input" type="text" placeholder="${placeholder}" style="width:100%;box-sizing:border-box;padding:10px 13px;border:1.5px solid #dde1e8;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:600;color:#1a1a2e;outline:none;margin-bottom:18px" />
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="_ap-cancel" style="padding:10px 22px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer">Cancelar</button>
        <button id="_ap-ok" style="padding:10px 22px;background:#1a1a2e;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer">Aceptar</button>
      </div>`);
    const input = ov.querySelector('#_ap-input');
    if (mayusculas) input.addEventListener('input', () => { const p = input.selectionStart; input.value = input.value.toUpperCase(); input.setSelectionRange(p,p); });
    const ok = () => { const v = input.value.trim(); document.body.removeChild(ov); resolve(v || null); };
    const cancel = () => { document.body.removeChild(ov); resolve(null); };
    ov.querySelector('#_ap-cancel').onclick = cancel;
    ov.querySelector('#_ap-ok').onclick = ok;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); });
    setTimeout(() => input.focus(), 50);
  });
}
// ─────────────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════════════════════════════
// EDICIÓN
// ════════════════════════════════════════════════════════════════════════════

// Pedir confirmación antes de re-asignar un conductor (guarda historial)
// Modal que se muestra cuando se intenta reasignar en turno MAÑANA fuera de horario
function mostrarModalReasignacionBloqueada(matricula) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:3000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:0;width:600px;max-width:96vw;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;overflow:hidden;">

      <!-- CABECERA ROJA -->
      <div style="background:#dc2626;padding:22px 28px 18px;display:flex;align-items:center;gap:14px;">
        <div style="background:rgba(255,255,255,0.18);border-radius:50%;width:50px;height:50px;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">🚫</div>
        <div>
          <div style="font-size:19px;font-weight:900;color:#fff;line-height:1.2;">Reasignación no disponible</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.8);font-weight:600;margin-top:2px;">Vehículo: ${esc(matricula)}</div>
        </div>
      </div>

      <!-- CUERPO -->
      <div style="padding:24px 28px 22px;">
        <div style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:10px;padding:14px 16px;margin-bottom:18px;display:flex;gap:12px;align-items:flex-start;">
          <span style="font-size:24px;flex-shrink:0;">☀️🌆</span>
          <div>
            <div style="font-size:13px;font-weight:900;color:#1d4ed8;margin-bottom:4px;">El turno de mañana está a punto de finalizar</div>
            <div style="font-size:12px;color:#1e3a5f;line-height:1.6;">A partir de las <strong>12:00</strong> no se puede reasignar un conductor dentro del cuadrante de <strong>mañana</strong>. Si vas a poner un conductor de <strong>tarde</strong>, cambia primero al cuadrante de tarde y asígnalo desde allí.</div>
          </div>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:nowrap;">
          <button id="btn-reasigblq-admin" style="padding:11px 14px;background:#f4f5f8;color:#556;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🔑 Autorizar como admin</button>
          <button id="btn-reasigblq-cancel" style="padding:11px 18px;background:#f4f5f8;color:#556;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">Cancelar</button>
          <button id="btn-reasigblq-turno" style="padding:11px 20px;background:#1d4ed8;color:white;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;">Ir al cuadrante de tarde →</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#btn-reasigblq-cancel').onclick = () => document.body.removeChild(overlay);

  overlay.querySelector('#btn-reasigblq-turno').onclick = () => {
    document.body.removeChild(overlay);
    const btnTarde = document.querySelector('.turno-btn[data-turno="TARDE"]');
    if (btnTarde) seleccionarTurno(btnTarde);
  };

  overlay.querySelector('#btn-reasigblq-admin').onclick = () => {
    document.body.removeChild(overlay);
    // Reutiliza el modal de login de admin ya existente en la app
    const inp = document.getElementById('inp-admin-password');
    if (inp) inp.value = '';
    const errEl = document.getElementById('admin-error-msg');
    if (errEl) errEl.style.display = 'none';
    _pendingAdminCallback = async () => {
      pedirReasignacion(matricula, true); // true = forzarAdmin, salta el bloqueo horario
    };
    document.getElementById('modal-login-admin').classList.add('open');
    setTimeout(() => { if (inp) inp.focus(); }, 100);
  };
}

function pedirReasignacion(matricula, forzarAdmin) {
  const d = getDato(matricula);
  const nombre = d.operario || '';

  // ─── Bloqueo: no permitir reasignar dentro de MAÑANA a partir de las 11:00 ───
  // (12:00, una hora antes de que finalice el turno de mañana a las 13:00)
  // Evita que el responsable de tarde, al no cambiar de turno, meta al conductor de
  // tarde reasignando el camión dentro del cuadrante de mañana.
  if (!forzarAdmin && turnoActual === 'MANANA' && esFechaHoy()) {
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const MIN_BLOQUEO_REASIG_MANANA = 12 * 60; // 12:00
    if (minutosAhora >= MIN_BLOQUEO_REASIG_MANANA) {
      mostrarModalReasignacionBloqueada(matricula);
      return;
    }
  }

  // Modal de confirmación personalizado
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:3000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:0;width:520px;max-width:96vw;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;overflow:hidden;">

      <!-- CABECERA ÁMBAR — visualmente distinta al rojo de devolución -->
      <div style="background:#b45309;padding:22px 28px 18px;display:flex;align-items:center;gap:14px;">
        <div style="background:rgba(255,255,255,0.18);border-radius:50%;width:50px;height:50px;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">↺</div>
        <div>
          <div style="font-size:20px;font-weight:900;color:#fff;line-height:1.2;">Cambio de conductor en mismo turno</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.75);font-weight:600;margin-top:2px;">Vehículo: ${esc(matricula)}</div>
        </div>
      </div>

      <!-- CUERPO -->
      <div style="padding:24px 28px 22px;">

        <!-- Conductor actual -->
        <div style="background:#fff8f0;border:1.5px solid #fcd34d;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:800;color:#b45309;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:5px;">Conductor a sustituir en el mismo turno:</div>
          <div style="font-size:17px;font-weight:900;color:#1a1a2e;">${esc(nombre)}</div>
        </div>

        <!-- Aviso claro de lo que NO es esto -->
        <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:13px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:flex-start;">
          <span style="font-size:20px;line-height:1.4;flex-shrink:0;">🚫</span>
          <div>
            <div style="font-size:13px;font-weight:900;color:#dc2626;margin-bottom:3px;">Esto NO es una devolución de llaves</div>
            <div style="font-size:12px;color:#7f1d1d;line-height:1.6;">Solo cambia el conductor asignado al vehículo. Para registrar que las llaves han sido devueltas, usa el botón <strong>«🔑 Registrar devolución»</strong>.</div>
          </div>
        </div>

        <!-- Desvío: ¿querías cambiar de turno? — solo visible si estamos en MAÑANA -->
        ${turnoActual === 'MANANA' ? `
        <div style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:10px;padding:14px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:center;">
          <span style="font-size:24px;flex-shrink:0;">☀️🌆</span>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:900;color:#1d4ed8;margin-bottom:4px;">¿Quieres asignar este vehículo en el turno de tarde?</div>
            <div style="font-size:12px;color:#1e3a5f;line-height:1.6;">Reasignar NO cambia el turno. Para asignar un conductor distinto en el turno de <strong>tarde</strong>, primero cambia al cuadrante de tarde y asígnalo desde allí.</div>
          </div>
          <button id="btn-reasig-ir-turno" style="flex-shrink:0;padding:10px 16px;background:#1d4ed8;color:white;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;">
            Ir al cuadrante →
          </button>
        </div>` : ''}

        <!-- Info historial -->
        <div style="font-size:12px;color:#8899aa;background:#f8faff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:22px;">
          ℹ️ La asignación anterior quedará registrada en el historial de reasignaciones.
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="btn-reasig-cancel" style="padding:11px 22px;background:#f4f5f8;color:#556;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>
          <button id="btn-reasig-confirm" style="padding:11px 24px;background:#b45309;color:white;border:none;border-radius:8px;font-family:Barlow,sans-serif;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:8px;">
            <span style="font-size:17px;">↺</span> Sí, cambiar conductor
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-reasig-cancel').onclick = () => document.body.removeChild(overlay);
  const btnIrTurno = overlay.querySelector('#btn-reasig-ir-turno');
  if (btnIrTurno) btnIrTurno.onclick = () => {
    document.body.removeChild(overlay);
    // Reutilizar seleccionarTurno() para respetar el bloqueo horario del turno de tarde
    const btnTarde = document.querySelector('.turno-btn[data-turno="TARDE"]');
    if (btnTarde) seleccionarTurno(btnTarde);
  };
  overlay.querySelector('#btn-reasig-confirm').onclick = async () => {
    document.body.removeChild(overlay);
    const operarioAnterior = d.operario || '';

    // Modal de carga mientras se procesa
    const loadingOverlay = document.createElement('div');
    loadingOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:4000;display:flex;align-items:center;justify-content:center;';
    loadingOverlay.innerHTML = `
      <div style="background:white;border-radius:14px;padding:32px 36px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Barlow,sans-serif;min-width:260px;">
        <svg width="36" height="36" viewBox="0 0 36 36" style="animation:spin 0.75s linear infinite;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;">
          <circle cx="18" cy="18" r="14" fill="none" stroke="#f0f2f5" stroke-width="4"/>
          <path d="M18 4 A14 14 0 0 1 32 18" fill="none" stroke="#e84545" stroke-width="4" stroke-linecap="round"/>
        </svg>
        <div style="font-size:14px;font-weight:800;color:#1a1a2e;margin-bottom:4px;">Registrando reasignación…</div>
        <div style="font-size:11px;color:#8899aa;">Un momento por favor...</div>
      </div>`;
    document.body.appendChild(loadingOverlay);

    try {
      const horaReasig = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      // 1) Registrar en hoja Reasignaciones (separada del Log de Órdenes)
      if (operarioAnterior) {
        await registrarReasignacion(matricula, operarioAnterior, horaReasig);
        registrarAccion('CUADRANTE', 'Reasignar vehículo', `${matricula} · turno ${turnoActual} · conductor anterior: ${operarioAnterior}`);
      }

      // 2) Guardar snapshot histórico en Registros (fila congelada, marcada como reasignada)
      //    Incluye la hora de devolución = momento de la reasignación
      if (operarioAnterior) {
        const dActual = getDato(matricula);
        let tipo = '';
        GRUPOS.forEach(g => g.vehiculos.forEach(v => { if (v.matricula === matricula) tipo = v.tipo; }));
        const snapshot = {
          fecha:           fechaActual,
          turno:           turnoActual,
          matricula,
          tipo,
          operario:        operarioAnterior,
          resp_entrega:    dActual.resp_entrega    || '',
          resp_recibe:     usuarioActual ? usuarioActual.nombre : (dActual.resp_recibe || ''),
          hora_entrega:    dActual.hora_entrega    || '',
          hora_devolucion: horaReasig,   // ← hora exacta de la reasignación
          num_tarjeta:     dActual.num_tarjeta     || '',
          itv:             dActual.itv             || '',
          incidencias:     dActual.incidencias     || '',
          reasignado:      'SI',
        };
        await guardarSnapshotReasignacion(snapshot);
      }

      // 2b) Borrar el Log de Órdenes (rutas "ya impresas") de este vehículo/turno/fecha.
      //     Si no se hace, el nuevo conductor hereda las órdenes marcadas como impresas
      //     del conductor anterior y la app sigue mostrando la orden de trabajo vieja.
      try {
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST', redirect: 'follow',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            accion: 'eliminarLogPorFiltro',
            matricula, fecha: fechaActual, turno: turnoActual
          })
        });
      } catch(e) { console.warn('No se pudo limpiar el log de órdenes al reasignar:', e); }
      // Limpiar también el estado local para que el botón "Orden" se ponga
      // en pendiente al instante, sin esperar al sync periódico
      const _impKeyReasig = `${matricula.trim().toUpperCase()}|${turnoActual.toUpperCase()}|${fechaActual}`;
      _ordenesImpresas.delete(_impKeyReasig);
      document.querySelectorAll(`.btn-print-row[data-mat="${CSS.escape(matricula.trim().toUpperCase())}"]`).forEach(b => {
        b.classList.remove('impresa');
        b.classList.remove('pendiente');
        b.title = 'Imprimir orden de trabajo';
      });

      // 3) Limpiar datos activos en memoria (la fila activa queda vacía para el nuevo conductor)
      setDato(matricula, '_reasignado', 'SI');
      setDato(matricula, '_operarioAnterior', operarioAnterior);
      // Guardar datos completos para el modal de detalle
      const dActualPost = getDato(matricula);
      const reasigObj = {
        operario:         operarioAnterior,
        resp_entrega:     dActualPost.resp_entrega  || '',
        resp_recibe:      usuarioActual ? usuarioActual.nombre : '',
        hora_entrega:     dActualPost.hora_entrega  || '',
        hora_reasignacion: horaReasig,
        timestamp:        new Date().toISOString(),
      };
      const reasigList = getDato(matricula)._reasignaciones || [];
      reasigList.push(reasigObj);
      setDato(matricula, '_reasignaciones', reasigList);
      setDato(matricula, 'operario', '');
      setDato(matricula, 'resp_entrega', '');
      setDato(matricula, 'hora_entrega', '');
      setDato(matricula, 'resp_recibe', '');
      setDato(matricula, 'hora_devolucion', '');
      setDato(matricula, 'num_tarjeta', '');
      setDato(matricula, 'itv', '');
      setDato(matricula, 'incidencias', '');

      // 4) Guardar cuadrante activo — la fila vacía se borra de Registros (el snapshot ya está guardado)
      clearTimeout(saveTimer);
      saveTimer = null;
      await guardarTodo();

    } finally {
      document.body.removeChild(loadingOverlay);
      renderTabla();
      mostrarToast('Conductor anterior registrado en historial. Asigna el nuevo.', 'info');
    }
  };
}

// Formatea cualquier valor de hora: HH:MM, ISO string o Date → "HH:MM"
function fmtHora(val) {
  if (!val || val === '—') return '—';
  if (/^\d{1,2}:\d{2}$/.test(String(val).trim())) return String(val).trim();
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
  } catch(e) {}
  return String(val);
}

function verDetalleReasignacion(matricula) {
  const d = getDato(matricula);
  const lista = d._reasignaciones || [];

  const filas = lista.map((r, i) => {
    const horaTs   = r.timestamp ? new Date(r.timestamp).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }) : '—';
    const horaResg = fmtHora(r.hora_reasignacion) !== '—' ? fmtHora(r.hora_reasignacion) : horaTs;
    const horaEnt  = fmtHora(r.hora_entrega);
    const numBadge = lista.length > 1
      ? `<span style="background:#b45309;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;margin-right:8px;flex-shrink:0">${i+1}</span>`
      : '';
    return `
    <div style="background:#fff;border:1.5px solid #e2e5ec;border-radius:14px;padding:20px 22px;margin-bottom:${i < lista.length-1?'14px':'0'};box-shadow:0 2px 8px rgba(26,26,46,0.06)">
      <div style="display:flex;align-items:center;font-size:11px;font-weight:800;color:#b45309;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #f0f2f5">
        ${numBadge}Asignación anterior &nbsp;·&nbsp; <span style="color:#1a1a2e;font-size:13px;margin-left:4px">${horaTs}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 20px;">
        <div style="grid-column:1/-1">
          <div style="font-size:10px;font-weight:700;color:#8899aa;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:5px">Conductor</div>
          <div style="font-size:16px;font-weight:900;color:#e84545;line-height:1.25">${esc(r.operario||'—')}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#8899aa;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:5px">Hora reasignación</div>
          <div style="font-size:22px;font-weight:900;color:#1a1a2e;font-variant-numeric:tabular-nums;line-height:1">${horaResg}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#8899aa;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:5px">Hora entrega</div>
          <div style="font-size:22px;font-weight:900;color:#1a1a2e;font-variant-numeric:tabular-nums;line-height:1">${horaEnt}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#8899aa;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:5px">Resp. entrega</div>
          <div style="font-size:13px;font-weight:700;color:#1a1a2e">${esc(r.resp_entrega||'—')}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#8899aa;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:5px">Resp. recibe</div>
          <div style="font-size:13px;font-weight:700;color:#1a1a2e">${esc(r.resp_recibe||'—')}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,30,0.65);z-index:3000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  overlay.innerHTML = `
    <div style="background:#f4f5f8;border-radius:20px;width:560px;max-width:96vw;max-height:88vh;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;display:flex;flex-direction:column;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1)">
      <!-- Cabecera -->
      <div style="background:#1a1a2e;padding:22px 24px 20px;flex-shrink:0">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="background:#b45309;border-radius:10px;width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">↺</span>
            <div>
              <div style="font-size:17px;font-weight:900;color:#fff;line-height:1.2;margin-bottom:5px">Historial de reasignaciones</div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="background:#2a2a4a;color:#e0e4f0;border-radius:6px;padding:3px 12px;font-size:13px;font-weight:800;letter-spacing:0.5px">${esc(matricula)}</span>
                <span style="font-size:12px;color:#6b7a94;font-weight:600">${lista.length} reasignación${lista.length!==1?'es':''}</span>
              </div>
            </div>
          </div>
          <button id="btn-reasig-detail-close" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:10px;width:36px;height:36px;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">✕</button>
        </div>
      </div>
      <!-- Contenido -->
      <div style="padding:20px 22px;overflow-y:auto;flex:1">
        ${lista.length ? filas : '<div style="text-align:center;padding:40px 24px;color:#8899aa;font-size:14px">Sin datos de reasignación</div>'}
      </div>
      <!-- Pie -->
      <div style="padding:16px 22px;background:#fff;border-top:1.5px solid #e8eaef;flex-shrink:0">
        <button id="btn-reasig-detail-ok" style="width:100%;padding:13px;background:#1a1a2e;color:#fff;border:none;border-radius:11px;font-family:Barlow,sans-serif;font-size:14px;font-weight:900;cursor:pointer;letter-spacing:0.5px;transition:background 0.15s" onmouseover="this.style.background='#2a2a4e'" onmouseout="this.style.background='#1a1a2e'">Cerrar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-reasig-detail-close').onclick = () => document.body.removeChild(overlay);
  overlay.querySelector('#btn-reasig-detail-ok').onclick    = () => document.body.removeChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
}

// Cuando se elige un operario en el dropdown
function onCellInput(input) {
  setDato(input.dataset.mat, input.dataset.col, input.value);
  actualizarStats();
  programarGuardado();
}

function onCellBlur(input) {
  clearTimeout(saveTimer);
  saveTimer = null;
  guardarTodoSilencioso();
}

function actualizarStats() {
  let asignados = 0;
  GRUPOS.forEach(g => g.vehiculos.forEach(v => {
    const d = getDato(v.matricula);
    if (d.operario && d.operario.trim()) asignados++;
  }));
  document.getElementById('stat-asignados').textContent = asignados;
  const totalActual = parseInt(document.getElementById('stat-total').textContent, 10) || 0;
  const bar2 = document.getElementById('sb-stats-bar');
  if (bar2) bar2.style.width = (totalActual > 0 ? Math.round(asignados / totalActual * 100) : 0) + '%';
}

function programarGuardado() {
  setSaveIndicator('saving', '⏳ Guardando…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => guardarTodoSilencioso(), 800);
}

