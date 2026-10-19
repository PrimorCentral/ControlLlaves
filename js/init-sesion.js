// ════════════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════════════
// Renovar sesión automáticamente con cualquier interacción
['click','keydown','touchstart'].forEach(evt => {
  document.addEventListener(evt, () => {
    if (usuarioActual && _sesionTimer && !_sesionModalAbierto) {
      // Solo renovar si quedan más de SESION_AVISO segundos
      // (si ya está en aviso, dejar que el usuario confirme manualmente)
      if (_sesionSegundos > SESION_AVISO) {
        _sesionSegundos = SESION_DURACION;
        actualizarPillCountdown();
      }
    }
  }, { passive: true });
});

// ─── RELOJ TIEMPO REAL ───
(function() {
  function actualizarReloj() {
    const el = document.getElementById('sb-clock-time');
    if (!el) return;
    const ahora = new Date();
    const hh = String(ahora.getHours()).padStart(2,'0');
    const mm = String(ahora.getMinutes()).padStart(2,'0');
    const ss = String(ahora.getSeconds()).padStart(2,'0');
    el.innerHTML = `${hh}:${mm}<span class="sb-clock-secs">:${ss}</span>`;
  }
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
})();

// Carga la URL del Apps Script desde Supabase (tabla app_config, clave
// 'appsScriptUrl'). Si no hay nada guardado ahí todavía, se queda con la
// que viene hardcodeada como valor por defecto (APPS_SCRIPT_URL_DEFAULT).
async function inicializarAppsScriptUrl() {
  try {
    const { data, error } = await sb.from('app_config')
      .select('valor').eq('clave', 'appsScriptUrl').maybeSingle();
    if (!error && data && data.valor) {
      APPS_SCRIPT_URL = data.valor;
      localStorage.setItem('llaves_script_url', data.valor);
    }
  } catch (e) {
    // Sin conexión a Supabase todavía: nos quedamos con la URL por defecto
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const hoy = new Date();
  fechaActual = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
  document.getElementById('fecha-input').value = fechaActual;
  document.getElementById('fecha-input').addEventListener('change', e => {
    const nuevaFecha = e.target.value;
    if (!nuevaFecha) return;
    // Mostrar modal de selección de turno
    const label = document.getElementById('modal-selturno-fecha-label');
    if (label) {
      const fechaFormateada = new Date(nuevaFecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      label.textContent = `¿Qué cuadrante quieres ver el ${fechaFormateada}?`;
    }
    // Guardar la fecha pendiente en una variable temporal y abrir el modal
    window._fechaPendienteModal = nuevaFecha;

    // Aplicar bloqueo de turno según la fecha elegida
    const btnM = document.getElementById('btn-selturno-manana');
    const btnT = document.getElementById('btn-selturno-tarde');
    const hoy2 = new Date();
    const fechaHoy2 = `${hoy2.getFullYear()}-${String(hoy2.getMonth()+1).padStart(2,'0')}-${String(hoy2.getDate()).padStart(2,'0')}`;
    const esHoy = nuevaFecha === fechaHoy2;

    // Resetear estado
    [btnM, btnT].forEach(b => {
      b.disabled = false;
      b.style.opacity = '1';
      b.style.cursor = 'pointer';
      b.style.filter = '';
      const lk = b.querySelector('.selturno-lock');
      if (lk) lk.remove();
    });

    if (esHoy) {
      const checkM = turnoPermitidoParaFecha('MANANA', nuevaFecha);
      const checkT = turnoPermitidoParaFecha('TARDE',  nuevaFecha);
      [{ btn: btnM, check: checkM, turno: 'MANANA' }, { btn: btnT, check: checkT, turno: 'TARDE' }].forEach(({ btn, check, turno }) => {
        if (turno === 'MANANA') { btn.onclick = () => elegirTurnoEnModal('MANANA'); return; } // Mañana nunca bloqueado
        if (!check.permitido) {
          btn.disabled = true;
          btn.style.opacity = '0.45';
          btn.style.cursor = 'not-allowed';
          btn.style.filter = 'grayscale(60%)';
          btn.onclick = (ev) => {
            ev.preventDefault();
            const turnoLabel = btn === btnM ? 'Mañana ☀️' : 'Tarde 🌆';
            document.getElementById('modal-turno-msg').innerHTML =
              `<strong>${turnoLabel}</strong><br><br>${check.motivo}`;
            document.getElementById('modal-seleccionar-turno').classList.remove('open');
            document.getElementById('modal-confirmar-turno').classList.add('open');
          };
          const lock = document.createElement('span');
          lock.className = 'selturno-lock';
          lock.style.cssText = 'font-size:11px;color:#e84545;font-weight:800;display:block;margin-top:2px;';
          lock.textContent = '🔒 No disponible';
          btn.appendChild(lock);
        } else {
          btn.onclick = () => elegirTurnoEnModal(btn === btnM ? 'MANANA' : 'TARDE');
        }
      });
    }

    document.getElementById('modal-seleccionar-turno').classList.add('open');
  });

  // Función reutilizable para abrir el modal de selección de turno (usada también desde reasignación)
  window.abrirModalSeleccionarTurno = function() {
    const label = document.getElementById('modal-selturno-fecha-label');
    if (label) label.textContent = '¿Qué cuadrante quieres visualizar?';
    document.getElementById('modal-seleccionar-turno').classList.add('open');
  };

  // Función que se llama al elegir turno en el modal
  window.elegirTurnoEnModal = function(turno) {
    document.getElementById('modal-seleccionar-turno').classList.remove('open');
    const nuevaFecha = window._fechaPendienteModal;
    if (!nuevaFecha) return;
    fechaActual = nuevaFecha;
    cuadranteDesbloqueadoPorAdmin = false;
    _ordenesImpresas.clear();
    // Actualizar turno seleccionado
    turnoActual = turno;
    document.querySelectorAll('.turno-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.turno === turnoActual);
    });
    actualizarHeader();
    actualizarBloqueoCuadrante();
    if (usuarioActual) cargarCuadrante();
    window._fechaPendienteModal = null;
  };

  // ── Turno automático según hora ──────────────────────────────────────────
  // MAÑANA: siempre disponible   |   TARDE disponible desde 11:00 (2h antes)
const horaActual = hoy.getHours() * 60 + hoy.getMinutes(); // minutos desde medianoche
const esTarde = horaActual >= (12 * 60 + 30) && horaActual <= (23 * 60 + 59);
turnoActual = esTarde ? 'TARDE' : 'MANANA';
document.querySelectorAll('.turno-btn').forEach(b => {
  b.classList.toggle('active', b.dataset.turno === turnoActual);
});
// Aplicar bloqueo visual en botones del sidebar para la fecha de hoy
(function aplicarBloqueoSidebar() {
  document.querySelectorAll('.turno-btn').forEach(b => {
    const t = b.dataset.turno;
    // El turno de mañana nunca se bloquea visualmente
    if (t === 'MANANA') {
      b.style.opacity = '';
      b.style.filter = '';
      b.title = '';
      return;
    }
    const check = turnoPermitidoParaFecha(t, fechaActual);
    if (!check.permitido) {
      b.style.opacity = '0.45';
      b.style.filter = 'grayscale(60%)';
      b.title = check.motivo ? check.motivo.replace(/<[^>]+>/g, '') : 'No disponible';
    } else {
      b.style.opacity = '';
      b.style.filter = '';
      b.title = '';
    }
  });
})();

  actualizarHeader();
  actualizarBloqueoCuadrante();

  // ── Arranque con splash animado: cada paso real mueve el camión ──
  const _pausa   = ms => new Promise(r => setTimeout(r, ms));
  const _limite  = (p, ms, porDefecto) => Promise.race([p, _pausa(ms).then(() => porDefecto)]);
  const PASO_MIN = 380; // ms mínimos por paso para que la animación se lea

  setSplashProgreso(8);
  setSplashMsg('Cargando configuración…');
  await Promise.all([inicializarAppsScriptUrl(), _pausa(PASO_MIN)]);
  marcarSplashPaso('config');
  setSplashProgreso(35);

  setSplashMsg('Conectando con el servidor…');
  const [servidorOk] = await Promise.all([_limite(verificarConfig(), 4000, false), _pausa(PASO_MIN)]);
  marcarSplashPaso('servidor', servidorOk ? 'hecho' : 'aviso');
  setSplashProgreso(65);
  initBuscadorOperario();

  setSplashMsg('Comprobando versión…');
  const _versionLista = window.APP_VERSION ? Promise.resolve(true)
    : new Promise(r => document.addEventListener('app-version', () => r(true), { once: true }));
  await Promise.all([_limite(_versionLista, 2000, false), _pausa(PASO_MIN)]);
  marcarSplashPaso('version');
  setSplashProgreso(88);

  // Datos de la pantalla de login: versión y fecha de hoy
  const _vBadge = document.getElementById('login-version-badge');
  if (_vBadge) {
    const _vMeta = document.querySelector('meta[name="app-version"]');
    if (_vMeta) _vBadge.textContent = 'v ' + _vMeta.getAttribute('content');
  }
  const _fHoy = document.getElementById('login-fecha-hoy');
  if (_fHoy) _fHoy.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

  marcarSplashPaso('acceso');
  setSplashProgreso(100);
  setSplashMsg(servidorOk ? 'Todo listo' : 'Listo · sin conexión con el servidor', servidorOk);

  // Duración mínima total para que la animación no parezca un parpadeo
  const _resta = 2200 - (Date.now() - SPLASH_INICIO);
  await _pausa(Math.max(450, _resta));

  mostrarPantallaLogin(true);
  ocultarSplash();
});

// ════════════════════════════════════════════════════════════════════════════
// PANTALLA LOGIN — mostrar / ocultar
// ════════════════════════════════════════════════════════════════════════════
function mostrarPantallaLogin(visible) {
  const el = document.getElementById('pantalla-login');
  if (visible) {
    el.classList.remove('oculto');
    setTimeout(() => { const i = document.getElementById('mlr-num'); if (i) i.focus(); }, 150);
  } else {
    el.classList.add('oculto');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// LOGIN RESPONSABLE
// ════════════════════════════════════════════════════════════════════════════
async function loginResponsable() {
  const numU  = document.getElementById('mlr-num').value.trim();
  const clave = document.getElementById('mlr-clave').value;
  const errEl = document.getElementById('mlr-error');
  errEl.style.display = 'none';

  if (!numU || !clave) {
    errEl.textContent = 'Introduce número de usuario y clave';
    errEl.style.display = 'block';
    return;
  }
  if (!APPS_SCRIPT_URL) {
    errEl.textContent = 'Sin conexión configurada. Usa el enlace de administrador de abajo.';
    errEl.style.display = 'block';
    return;
  }

  const btnEntrar  = document.getElementById('btn-mlr-entrar');
  const loadingDiv = document.getElementById('mlr-loading');
  const loadingMsg = document.getElementById('mlr-loading-msg');
  if (btnEntrar)  { btnEntrar.disabled = true; }
  if (loadingDiv) { loadingDiv.style.display = 'block'; }
  if (loadingMsg) { loadingMsg.textContent = 'Verificando identidad…'; }

  try {
    const hashClave = await hashStr(clave);
    const url = `${APPS_SCRIPT_URL}?accion=loginResponsable&numUsuario=${encodeURIComponent(numU)}&hashClave=${encodeURIComponent(hashClave)}`;

    const loginResp = await fetch(url, { redirect: 'follow' }).then(r => r.json());

    if (loginResp.ok && loginResp.responsable) {
      usuarioActual = loginResp.responsable;
      usuarioActual.hash = hashClave;
      usuarioActual.num  = numU;

      // Actualizar sidebar
      document.getElementById('user-pill').style.display = 'flex';
      document.getElementById('user-pill-name').textContent = loginResp.responsable.nombre;
      document.getElementById('user-pill-sub').textContent  = loginResp.responsable.rol || 'Responsable';

      // Mostrar botón admin solo si el usuario tiene permiso
      const btnAdmin = document.getElementById('btn-panel-admin');
      if (btnAdmin) btnAdmin.style.display = String(loginResp.responsable.admin||'').trim().toUpperCase() === 'SI' ? 'block' : 'none';

      // Ocultar pantalla login con transición
      mostrarPantallaLogin(false);

      // Cargar todo (flota, conductores, cuadrante, etc.) ahora que el usuario ha entrado
      await cargarCuadrante();
      if (typeof mantCargarResumen === 'function') mantCargarResumen(); // aviso de averías y revisiones
      actualizarBotonIncidenciasPendientes();
      mostrarToast(`✓ Bienvenido, ${loginResp.responsable.nombre.split(' ')[0]}`, 'success');
      registrarAccion('SESION', 'Login', `Acceso correcto · Usuario ${loginResp.responsable.numUsuario}`);
      setTimeout(comprobarDevolPendientes, 1500); // esperar a que el cuadrante se pinte
      iniciarSync();
      iniciarTemporizadorSesion();
      iniciarHeartbeat();
    } else {
      const i1 = document.getElementById('mlr-num');
      const i2 = document.getElementById('mlr-clave');
      i1.classList.add('error'); i2.classList.add('error');
      errEl.textContent = loginResp.error || 'Usuario o clave incorrectos';
      errEl.style.display = 'block';
      setTimeout(() => { i1.classList.remove('error'); i2.classList.remove('error'); }, 500);
      document.getElementById('mlr-clave').value = '';
    }
  } catch(e) {
    errEl.textContent = '⚠️ Error de conexión: ' + e.message;
    errEl.style.display = 'block';
  } finally {
    if (btnEntrar)  { btnEntrar.disabled = false; }
    if (loadingDiv) { loadingDiv.style.display = 'none'; }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// EXPIRACIÓN DE SESIÓN
// ════════════════════════════════════════════════════════════════════════════
const SESION_DURACION   = 10 * 60;  // 10 min en segundos
const SESION_AVISO      = 60;       // avisar cuando queden 60 segundos
let _sesionTimer        = null;     // intervalo de cuenta atrás
let _sesionSegundos     = 0;        // segundos restantes
let _sesionModalAbierto = false;
let _sesionExpCountdown = null;     // intervalo del modal

function iniciarTemporizadorSesion() {
  detenerTemporizadorSesion();
  _sesionSegundos = SESION_DURACION;
  _sesionModalAbierto = false;
  actualizarPillCountdown();
  _sesionTimer = setInterval(() => {
    _sesionSegundos--;
    actualizarPillCountdown();
    if (_sesionSegundos <= SESION_AVISO && !_sesionModalAbierto) {
      abrirModalExpiracion();
    }
    if (_sesionSegundos <= 0) {
      expirarSesion();
    }
  }, 1000);
}

function detenerTemporizadorSesion() {
  if (_sesionTimer) { clearInterval(_sesionTimer); _sesionTimer = null; }
  if (_sesionExpCountdown) { clearInterval(_sesionExpCountdown); _sesionExpCountdown = null; }
  const cd = document.getElementById('session-countdown');
  if (cd) cd.textContent = '';
}

function renovarSesion() {
  // Resetear la sesión a 10 minutos completos
  _sesionSegundos = SESION_DURACION;
  _sesionModalAbierto = false;
  if (_sesionExpCountdown) { clearInterval(_sesionExpCountdown); _sesionExpCountdown = null; }
  document.getElementById('modal-sesion-expira').classList.remove('open');
  actualizarPillCountdown();
}

function abrirModalExpiracion() {
  _sesionModalAbierto = true;
  let cuentaModal = _sesionSegundos;
  const counterEl = document.getElementById('exp-counter');
  if (counterEl) counterEl.textContent = cuentaModal;
  document.getElementById('modal-sesion-expira').classList.add('open');
  // Cuenta atrás dentro del modal (independiente del timer principal)
  _sesionExpCountdown = setInterval(() => {
    cuentaModal--;
    if (counterEl) counterEl.textContent = Math.max(0, cuentaModal);
  }, 1000);
}

function actualizarPillCountdown() {
  const cd = document.getElementById('session-countdown');
  if (!cd || !usuarioActual) return;
  const min = Math.floor(_sesionSegundos / 60);
  const seg = _sesionSegundos % 60;
  cd.textContent = `Sesión: ${min}:${String(seg).padStart(2,'0')}`;
  cd.className = 'session-countdown' +
    (_sesionSegundos <= 60 ? ' danger' : _sesionSegundos <= 180 ? ' warning' : '');
}

function expirarSesion() {
  detenerTemporizadorSesion();
  document.getElementById('modal-sesion-expira').classList.remove('open');
  _sesionModalAbierto = false;
  // Cerrar sesión sin confirmación (es automático)
  _cerrarSesionInterno();
}

function cerrarSesionManual() {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,12,30,0.72);z-index:10600;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
  ov.innerHTML = `
    <div style="background:white;border-radius:18px;padding:32px 28px 24px;width:360px;max-width:94vw;box-shadow:0 32px 80px rgba(0,0,0,0.45);font-family:Barlow,sans-serif;animation:nv-in 0.25s cubic-bezier(.34,1.56,.64,1);text-align:center;">
      <div style="font-size:42px;margin-bottom:12px;">⏏️</div>
      <div style="font-size:17px;font-weight:900;color:#1a1a2e;margin-bottom:6px;">¿Cerrar sesión?</div>
      <div style="font-size:12px;color:#8899aa;margin-bottom:24px;line-height:1.5;">Se cerrará tu sesión actual.<br>Tendrás que volver a identificarte para acceder.</div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="btn-logout-cancel" style="padding:11px 28px;background:#f4f5f8;color:#556;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>
        <button id="btn-logout-ok" style="padding:11px 28px;background:#e84545;color:white;border:none;border-radius:9px;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:0.5px;">⏏ Cerrar sesión</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#btn-logout-cancel').onclick = () => document.body.removeChild(ov);
  ov.querySelector('#btn-logout-ok').onclick = () => {
    document.body.removeChild(ov);
    detenerTemporizadorSesion();
    registrarAccion('SESION', 'Logout', 'Cierre de sesión manual');
    _cerrarSesionInterno();
  };
}

function _cerrarSesionInterno() {
  detenerSync();
  detenerTemporizadorSesion();
  detenerHeartbeat();
  enviarDesconexion();
  usuarioActual = null;
  datos = {};
  pendientesGuardar.clear();
  document.getElementById('mlr-num').value = '';
  document.getElementById('mlr-clave').value = '';
  document.getElementById('mlr-error').style.display = 'none';
  document.getElementById('login-preload-fill').style.width = '0%';
  document.getElementById('login-preload-msg').textContent = '';
  document.getElementById('user-pill').style.display = 'none';
  const btnAdmin = document.getElementById('btn-panel-admin');
  if (btnAdmin) btnAdmin.style.display = 'none';
  mostrarPantallaLogin(true);
  renderTabla();
}

function cerrarSesion() {
  // Alias para compatibilidad — delegar a la nueva función manual
  cerrarSesionManual();
}

// ════════════════════════════════════════════════════════════════════════════
// HEADER
// ════════════════════════════════════════════════════════════════════════════
async function verificarConfig() {
  const dot    = document.getElementById('status-dot');
  const title  = document.getElementById('status-title');
  const sub    = document.getElementById('status-sub');
  const ltitle = document.getElementById('login-status-title');
  const lsub   = document.getElementById('login-status-sub');

  function setStatus(ok, t, s) {
    if (dot)    dot.className    = 'status-dot ' + (ok ? 'ok' : 'warn');
    if (title)  title.textContent = t;
    if (sub)    sub.textContent   = s;
    if (ltitle) ltitle.textContent = t;
    if (lsub)   lsub.textContent   = s;
    const loginDot = document.querySelector('.login-brand-badge-dot');
    if (loginDot) {
      loginDot.style.background = ok ? '#2ecc71' : '#e84545';
      loginDot.style.animation  = ok ? 'none' : 'blink 1.2s infinite';
    }
  }

  if (!APPS_SCRIPT_URL) {
    setStatus(false, 'Servidor', 'No iniciado');
    return false;
  }
  setStatus(false, 'Servidor', 'Conectando...');
  try {
    const resp = await fetch(APPS_SCRIPT_URL + '?accion=ping', { redirect: 'follow' });
    await resp.json();
    setStatus(true, 'Servidor', 'Conectado');
    return true;
  } catch(e) {
    setStatus(false, 'Servidor', 'Sin conexión');
    return false;
  }
}

// ── Utilidad: comprueba si un turno está permitido para una fecha dada ───────
// Para fechas pasadas: siempre permitido (consulta histórica).
// Para hoy: MAÑANA siempre disponible; TARDE solo desde las 11:00.
//   · MAÑANA disponible: siempre
//   · TARDE  disponible: 11:00 – 23:59  (2h antes = desde las 11:00)
// Devuelve { permitido: bool, horaDesde: string|null }
function turnoPermitidoParaFecha(turno, fecha) {
  const hoy = new Date();
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
  if (fecha < fechaHoy) return { permitido: true }; // fecha pasada: libre
  if (fecha > fechaHoy) return { permitido: true }; // fecha futura: libre (admin)
  // Es hoy → aplicar ventana horaria
  const minutos = hoy.getHours() * 60 + hoy.getMinutes();
  if (turno === 'MANANA') {
    // Mañana: siempre disponible
    return { permitido: true };
  } else {
    // Tarde: disponible desde las 11:00 (2h antes de las 13:00)
    const MIN_TARDE = 11 * 60; // 11:00
    if (minutos >= MIN_TARDE) return { permitido: true };
    const hFalta = Math.floor((MIN_TARDE - minutos) / 60);
    const mFalta = (MIN_TARDE - minutos) % 60;
    const faltaStr = hFalta > 0 ? `${hFalta}h ${mFalta}min` : `${mFalta} minutos`;
    return {
      permitido: false,
      motivo: `El turno de tarde estará disponible a partir de las <strong>11:00</strong>.<br>Faltan <strong>${faltaStr}</strong>.`
    };
  }
}

function seleccionarTurno(btn) {
  const turnoElegido = btn.dataset.turno;
  const check = turnoPermitidoParaFecha(turnoElegido, fechaActual);

  if (!check.permitido) {
    const turnoLabel = turnoElegido === 'MANANA' ? 'Mañana ☀️' : 'Tarde 🌆';
    document.getElementById('modal-turno-msg').innerHTML =
      `<strong>${turnoLabel}</strong><br><br>${check.motivo}`;
    document.getElementById('modal-confirmar-turno').classList.add('open');
    return;
  }

  document.querySelectorAll('.turno-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  turnoActual = turnoElegido;
  actualizarHeader();
  actualizarBloqueoCuadrante();
  if (usuarioActual) cargarCuadrante();
}

function actualizarHeader() {
  // Pastilla de turno/fecha en el sidebar
  const sbTexto  = document.getElementById('sb-turno-texto');
  const sbFecha  = document.getElementById('sb-fecha-texto');
  const sbBadge  = document.getElementById('sb-turno-badge');
  const esTarde  = turnoActual !== 'MANANA';
  const turnoLabel = esTarde ? 'TARDE' : 'MAÑANA';
  const color      = esTarde ? '#f97316' : '#f59e0b';
  if (sbTexto)  sbTexto.textContent = 'TURNO DE: ' + turnoLabel;
  if (sbBadge)  sbBadge.style.color = color;
  const sbDot    = document.getElementById('sb-turno-dot');
  const sbAcento = document.getElementById('sb-acento');
  if (sbDot)    sbDot.style.background = color;
  if (sbAcento) sbAcento.style.background = color;
  if (sbFecha) {
    sbFecha.textContent = fechaActual
      ? new Date(fechaActual + 'T12:00:00').toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
      : '—';
  }
  // Badge topbar móvil — se actualiza aquí siempre que cambie el turno
  const mobBadge = document.getElementById('mob-badge');
  if (mobBadge) {
    mobBadge.textContent = esTarde ? '🌆 TARDE' : '☀️ MAÑANA';
    mobBadge.style.color = color;
  }
}

// ─── BLOQUEO DE CUADRANTE POR FECHA ─────────────────────────────────────────
// Devuelve true si la fecha seleccionada es HOY
function esFechaHoy() {
  const n = new Date();
  const hoyStr = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  return fechaActual === hoyStr;
}

// Actualiza el banner de bloqueo y activa/desactiva la edición
function actualizarBloqueoCuadrante() {
  const esHoy    = esFechaHoy();
  const bloqueado = !esHoy && !cuadranteDesbloqueadoPorAdmin;

  // Banner
  let banner = document.getElementById('banner-bloqueo-fecha');
  if (bloqueado) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'banner-bloqueo-fecha';
      banner.style.cssText = 'position:sticky;top:0;z-index:20;background:#fff3cd;border-bottom:2px solid #f39c12;padding:9px 16px;display:flex;align-items:center;gap:10px;font-family:Barlow,sans-serif;font-size:12px;font-weight:700;color:#856404;';
      banner.innerHTML = '<span style="font-size:16px">🔒</span><span>Este cuadrante está <strong>bloqueado</strong> porque no corresponde a la jornada de hoy.</span><button onclick="pedirClaveAdminParaDesbloquear()" style="margin-left:auto;padding:5px 14px;border-radius:7px;border:1.5px solid #f39c12;background:white;color:#856404;font-family:Barlow,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">🚛 Desbloquear</button>';
      const wrap = document.getElementById('table-wrap');
      wrap.insertBefore(banner, wrap.firstChild);
    }
  } else {
    if (banner) banner.remove();
  }
}

// El admin introduce su clave para desbloquear la edición de un día diferente a hoy
function pedirClaveAdminParaDesbloquear() {
  const inp = document.getElementById('inp-admin-password');
  if (inp) inp.value = '';
  const errEl = document.getElementById('admin-error-msg');
  if (errEl) errEl.style.display = 'none';
  // Guardamos callback en variable temporal
  _pendingAdminCallback = async () => {
    cuadranteDesbloqueadoPorAdmin = true;
    actualizarBloqueoCuadrante();
    renderTabla();
    mostrarToast('✓ Cuadrante desbloqueado para edición', 'success');
  };
  document.getElementById('modal-login-admin').classList.add('open');
  setTimeout(() => { if (inp) inp.focus(); }, 100);
}
let _pendingAdminCallback = null;

