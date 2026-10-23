// ════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ════════════════════════════════════════════════════════════════════════════
const APPS_SCRIPT_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbzqYWpeVtdcFvYrzfEoSIsux8mz7v_D7ovv4gnHQN-TTsnSUUNCDiinjQqWc9smYjXN/exec';
const ADMIN_PASS_HASH_DEFAULT = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'; // admin123
// Valor de arranque: se sobreescribe en cuanto carga inicializarAppsScriptUrl()
// con lo que haya guardado en Supabase (app_config, clave 'appsScriptUrl').
let APPS_SCRIPT_URL = APPS_SCRIPT_URL_DEFAULT;

// ════════════════════════════════════════════════════════════════════════════
// SUPABASE — sustituye a Google Apps Script como backend
// ════════════════════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://wigmejjmavnxhteapkxy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CXFXXjJqtQiCWYnwIVFEJw_PcTM77gF'; // ⚠️ pendiente de completar
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Traductor de peticiones: convierte cada `accion=...` que tu código ya
// sabe pedir en una consulta equivalente a Supabase, y devuelve el JSON con
// la MISMA forma que devolvía Apps Script. Así no hace falta tocar ninguna
// de las funciones que ya llaman a fetch(APPS_SCRIPT_URL, ...).
// Se amplía accion a accion según se van migrando endpoints.
// ════════════════════════════════════════════════════════════════════════════
// Al resolver una incidencia, su avería enlazada (js/mantenimiento.js) se marca
// también como reparada, para no tener que cerrar las dos cosas por separado.
// Nave actual de un vehículo (según la flota cargada) y fecha de hoy (AAAA-MM-DD)
function _registroGrupoActual(matricula) {
  if (typeof GRUPOS === 'undefined') return '';
  const g = GRUPOS.find(x => (x.vehiculos || []).some(v => v.matricula === matricula));
  return g ? g.nombre : '';
}
function _registroHoyISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

async function cerrarAveriaDeIncidencia(incidenciaId, quien, comentario) {
  if (!incidenciaId) return false;
  try {
    const { data, error } = await sb.from('averias').update({
      estado: 'reparada',
      fecha_cierre: new Date().toISOString().substring(0, 10),
      cerrado_por: quien || '',
      comentario_cierre: comentario || 'Incidencia resuelta',
      updated_at: new Date().toISOString()
    }).eq('incidencia_id', incidenciaId).neq('estado', 'reparada').select('id');
    return !error && !!(data && data.length);
  } catch (e) { return false; }
}

async function obtenerDestinatariosPorTipo(tipo) {
  const { data, error } = await sb.from('destinatarios_email').select('email').eq('tipo', tipo);
  if (error || !data) return [];
  return data.map(f => f.email).filter(e => e && e.includes('@'));
}

// Llama de verdad a Apps Script (Gmail) para mandar un correo. Devuelve
// null si fue bien, o el mensaje de error si falló — para que el llamador
// pueda propagarlo como json.emailError, tal y como espera el cliente.
// Llama a Apps Script (Gmail) para mandar el correo de incidencia: solo
// mandamos los datos, el HTML se construye en Apps Script (función
// construirHtmlIncidencia), para que se vea bien en cualquier cliente
// de correo (Outlook, Gmail...). Devuelve null si fue bien, o el mensaje
// de error si falló — para que el llamador pueda propagarlo como
// json.emailError, tal y como espera el cliente.
async function enviarCorreoIncidenciaViaAppsScript(datos) {
  if (!datos.to) return null; // sin destinatarios configurados, no es un error
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'enviarCorreoIncidencia', ...datos }),
      redirect: 'follow'
    });
    const json = await resp.json();
    return json && json.ok ? null : (json && json.error) || 'Error desconocido enviando el correo';
  } catch (e) {
    return e.message || 'Error de conexión al enviar el correo';
  }
}

// Igual que las anteriores, pero para el correo de "Vehículo bloqueado":
// solo mandamos los datos, el HTML se construye en Apps Script
// (función construirHtmlBloqueo).
async function enviarCorreoBloqueoViaAppsScript(datos) {
  if (!datos.to) return null; // sin destinatarios configurados, no es un error
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ accion: 'enviarCorreoBloqueo', ...datos }),
      redirect: 'follow'
    });
    const json = await resp.json();
    return json && json.ok ? null : (json && json.error) || 'Error desconocido enviando el correo';
  } catch (e) {
    return e.message || 'Error de conexión al enviar el correo';
  }
}

async function manejarPeticionSupabase(urlStr, options) {
  options = options || {};
  let accion = '';
  let params = {};

  if (options.method === 'POST' && options.body) {
    try { params = JSON.parse(options.body); } catch(e) { params = {}; }
    accion = params.accion || '';
  } else {
    const u = new URL(urlStr);
    u.searchParams.forEach((v, k) => { params[k] = v; });
    accion = params.accion || '';
  }

  switch (accion) {

    case 'ping': {
      const { error } = await sb.from('app_config').select('clave').limit(1);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'loginResponsable': {
      const { data, error } = await sb.from('responsables')
        .select('*')
        .eq('num_usuario', params.numUsuario)
        .eq('hash_clave', params.hashClave)
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      if (!data) return { ok: false, error: 'Usuario o clave incorrectos' };
      return {
        ok: true,
        responsable: {
          numUsuario: data.num_usuario,
          nombre: data.nombre,
          rol: data.rol || '',
          admin: data.admin ? 'SI' : 'NO'
        }
      };
    }

    case 'cargarFlota': {
      const { data, error } = await sb.from('vehiculos').select('*').order('orden', { ascending: true, nullsFirst: false });
      if (error) return { ok: false, error: error.message };
      const flota = (data || []).map(v => ({
        grupo: v.grupo || '',
        matricula: v.matricula,
        tipo: v.tipo || '',
        nota: v.nota || '',
        orden: v.orden ?? null,
        restringido: v.restringido ? 'SI' : '',
        itv_fin: v.itv_fin || '',
        itv_aviso_enviado: v.itv_aviso_enviado || '',
        archivado: !!v.archivado,
        fecha_archivado: v.fecha_archivado || '',
        bloqueado: !!v.bloqueado,
        motivo_bloqueo: v.motivo_bloqueo || '',
        bloqueado_por: v.bloqueado_por || '',
        fecha_bloqueo: v.fecha_bloqueo || '',
        seguro_aseguradora: v.seguro_aseguradora || '',
        seguro_nombre: v.seguro_nombre || '',
        seguro_cif: v.seguro_cif || '',
        seguro_poliza: v.seguro_poliza || '',
        seguro_vencimiento: v.seguro_vencimiento || '',
        seguro_tel: v.seguro_tel || '',
        tacografo: !!v.tacografo,
        sociedad: v.sociedad || ''
      }));
      return { ok: true, flota };
    }

    case 'cargarConductores': {
      const { data, error } = await sb.from('conductores').select('*');
      if (error) return { ok: false, error: error.message };
      const conductores = (data || []).map(c => ({
        numUsuario: c.num_usuario,
        nombre: c.nombre,
        dni: c.dni || '',
        sociedad: c.sociedad || '',
        nave: c.nave || '',
        turno: (c.turno === 1 || c.turno === 2) ? c.turno : null  // equipo (Asignaciones)
      }));
      return { ok: true, conductores };
    }

    case 'cargar': {
      const { data, error } = await sb.from('registros')
        .select('*')
        .eq('fecha', params.fecha)
        .eq('turno', params.turno)
        .or('reasignado.is.null,reasignado.eq.false');
      if (error) return { ok: false, error: error.message };
      // Postgres devuelve las columnas `time` como HH:MM:SS — recortamos a HH:MM
      const filas = (data || []).map(f => ({
        ...f,
        hora_entrega:    (f.hora_entrega    || '').slice(0, 5),
        hora_devolucion: (f.hora_devolucion || '').slice(0, 5)
      }));
      return { ok: true, filas };
    }

    case 'cargarIncidencias': {
      let q = sb.from('incidencias').select('*');
      if (params.desde) q = q.gte('fecha', params.desde);
      if (params.hasta) q = q.lte('fecha', params.hasta);
      if (params.matricula) q = q.eq('matricula', params.matricula);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      return { ok: true, filas: data || [] };
    }

    case 'cargarReasignaciones': {
      let q = sb.from('reasignaciones').select('*')
        .gte('fecha', params.desde)
        .lte('fecha', params.hasta);
      if (params.matricula) q = q.eq('matricula', params.matricula);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      return { ok: true, filas: data || [] };
    }

    case 'guardarFila': {
      // Nave del vehículo: se guarda con cada registro para que los cuadrantes
      // pasados sigan mostrando la nave que tenía ese día.
      const f = params.fila || {};
      if (!f.matricula || !f.fecha || !f.turno) {
        return { ok: false, error: 'Faltan datos obligatorios (fecha, turno o matrícula)' };
      }
      const payload = {
        fecha:           f.fecha,
        turno:           f.turno,
        matricula:       f.matricula,
        tipo:            f.tipo            || '',
        operario:        f.operario        || '',
        resp_entrega:    f.resp_entrega    || '',
        resp_recibe:     f.resp_recibe     || '',
        hora_entrega:    f.hora_entrega    || null,
        hora_devolucion: f.hora_devolucion || null,
        num_tarjeta:     f.num_tarjeta     || '',
        itv:             f.itv             || '',
        incidencias:     f.incidencias     || ''
      };
      const naveHoy = _registroGrupoActual(f.matricula);
      // En días pasados no se cambia la nave guardada; hoy y futuro, la actual
      const payloadUpd = (f.fecha >= _registroHoyISO() && naveHoy) ? { ...payload, grupo: naveHoy } : payload;
      // Solo tocamos la fila "activa" (no una fila congelada por una reasignación)
      const { data: actualizadas, error: errUpd } = await sb.from('registros')
        .update(payloadUpd)
        .eq('fecha', f.fecha).eq('turno', f.turno).eq('matricula', f.matricula)
        .or('reasignado.is.null,reasignado.eq.false')
        .select('id');
      if (errUpd) return { ok: false, error: errUpd.message };
      if (!actualizadas || !actualizadas.length) {
        const { error: errIns } = await sb.from('registros').insert({ ...payload, grupo: naveHoy || null });
        if (errIns) return { ok: false, error: errIns.message };
      }
      return { ok: true };
    }

    case 'eliminarFila': {
      const f = params.fila || {};
      // Borra TODAS las filas de esa fecha/turno/matrícula, incluidas las congeladas por reasignación
      const { error } = await sb.from('registros').delete()
        .eq('fecha', f.fecha).eq('turno', f.turno).eq('matricula', f.matricula);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'eliminarLog': {
      // Borra una única entrada del Log de Órdenes (fila del listado, no por filtro)
      if (!params.timestamp) return { ok: false, error: 'Falta timestamp' };
      const { error } = await sb.from('log_ordenes').delete()
        .eq('timestamp', params.timestamp);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'eliminarLogPorFiltro': {
      // Borra las entradas del Log de Órdenes (rutas marcadas como "ya impresas")
      // para esta matrícula/turno/fecha. Se usa al borrar una fila del Historial
      // y también al reasignar un vehículo, para que el nuevo conductor no
      // herede el estado "impresa" de las rutas del conductor anterior.
      const { error } = await sb.from('log_ordenes').delete()
        .eq('fecha', params.fecha).eq('turno', params.turno).eq('matricula', params.matricula);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    // ── LOG DE ACCIONES (auditoría del panel admin) ─────────────────────
    case 'registrarAccion': {
      const e = params.entrada || {};
      const { error } = await sb.from('log_acciones').insert({
        timestamp:   e.timestamp || new Date().toISOString(),
        fecha:       e.fecha     || null,
        hora:        e.hora      || null,
        num_usuario: e.numUsuario || '',
        nombre:      e.nombre     || '',
        categoria:   e.categoria  || '',
        accion:      e.accion     || '',
        detalle:     e.detalle    || ''
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'cargarLogAcciones': {
      let q = sb.from('log_acciones').select('*')
        .order('timestamp', { ascending: false });
      if (params.desde)     q = q.gte('fecha', params.desde);
      if (params.hasta)     q = q.lte('fecha', params.hasta);
      if (params.categoria) q = q.eq('categoria', params.categoria);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      let filas = (data || []).map(f => ({
        timestamp:  f.timestamp,
        fecha:      f.fecha,
        hora:       f.hora,
        numUsuario: f.num_usuario,
        nombre:     f.nombre,
        categoria:  f.categoria,
        accion:     f.accion,
        detalle:    f.detalle
      }));
      if (params.filtroUsuario) {
        const fu = String(params.filtroUsuario).trim().toUpperCase();
        filas = filas.filter(f =>
          (f.nombre || '').toUpperCase().includes(fu) ||
          (f.numUsuario || '').toString().toUpperCase().includes(fu)
        );
      }
      return { ok: true, filas };
    }

    case 'eliminarLogAccion': {
      if (!params.timestamp) return { ok: false, error: 'Falta timestamp' };
      const { error } = await sb.from('log_acciones').delete()
        .eq('timestamp', params.timestamp);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'bloquearVehiculo': {
      const fechaBloqueoIso = new Date().toISOString();
      const { error } = await sb.from('vehiculos').update({
        bloqueado:      true,
        motivo_bloqueo: params.motivo        || '',
        bloqueado_por:  params.bloqueado_por || '',
        fecha_bloqueo:  fechaBloqueoIso
      }).eq('matricula', params.matricula);
      if (error) return { ok: false, error: error.message };

      let emailError = null;
      const destinatarios = await obtenerDestinatariosPorTipo('bloqueos');
      if (destinatarios.length) {
        emailError = await enviarCorreoBloqueoViaAppsScript({
          to:            destinatarios.join(','),
          matricula:     params.matricula,
          bloqueado_por: params.bloqueado_por || '',
          motivo:        params.motivo || '',
          fecha:         fechaBloqueoIso
        });
      }
      return { ok: true, emailError, fecha_bloqueo: fechaBloqueoIso };
    }

    case 'desbloquearVehiculo': {
      const { error } = await sb.from('vehiculos').update({
        bloqueado:      false,
        motivo_bloqueo: '',
        bloqueado_por:  '',
        fecha_bloqueo:  null
      }).eq('matricula', params.matricula);
      if (error) return { ok: false, error: error.message };

      // Resolvemos también la incidencia pendiente más reciente de este vehículo,
      // igual que si se resolviera desde el menú de "Incidencias pendientes".
      let incidenciaResuelta = null;
      try {
        const { data: pendientes } = await sb.from('incidencias')
          .select('*')
          .eq('matricula', params.matricula)
          .neq('estado', 'COMPLETADO')
          .order('timestamp', { ascending: false })
          .limit(1);
        if (pendientes && pendientes.length) {
          const inc = pendientes[0];
          const { error: errRes } = await sb.from('incidencias').update({
            estado:                'COMPLETADO',
            resuelto_por:           params.resueltoPor || params.bloqueado_por || '',
            fecha_resolucion:       new Date().toISOString(),
            comentario_resolucion:  params.motivo || 'Vehículo desbloqueado'
          })
            .eq('timestamp', inc.timestamp)
            .eq('matricula', inc.matricula);
          if (!errRes) {
            incidenciaResuelta = inc.timestamp;
            await cerrarAveriaDeIncidencia(inc.id, params.resueltoPor || params.bloqueado_por, params.motivo || 'Vehículo desbloqueado');
          }
        }
      } catch (e) { /* no bloqueante: el desbloqueo ya se ha aplicado */ }

      return { ok: true, incidenciaResuelta };
    }

    case 'registrarReasignacion': {
      const r = params.reasignacion || {};
      const { error } = await sb.from('reasignaciones').insert({
        timestamp:          r.timestamp || new Date().toISOString(),
        fecha:              r.fecha,
        turno:              r.turno,
        matricula:          r.matricula,
        operario:           r.operario           || '',
        resp_entrega:       r.resp_entrega       || '',
        resp_recibe:        r.resp_recibe        || '',
        hora_entrega:       r.hora_entrega        || null,
        hora_reasignacion:  r.hora_reasignacion   || null,
        num_usuario:        r.numUsuario          || '',
        nombre_responsable: r.nombreResponsable   || ''
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'guardarSnapshotReasignacion': {
      const f = params.fila || {};
      const { error } = await sb.from('registros').insert({
        fecha:           f.fecha,
        turno:           f.turno,
        matricula:       f.matricula,
        tipo:            f.tipo            || '',
        operario:        f.operario        || '',
        resp_entrega:    f.resp_entrega    || '',
        resp_recibe:     f.resp_recibe     || '',
        hora_entrega:    f.hora_entrega    || null,
        hora_devolucion: f.hora_devolucion || null,
        num_tarjeta:     f.num_tarjeta     || '',
        itv:             f.itv             || '',
        incidencias:     f.incidencias     || '',
        grupo:           _registroGrupoActual(f.matricula) || null,
        reasignado:      true
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'eliminarReasignacion': {
      const { data: reasig, error: errSel } = await sb.from('reasignaciones')
        .select('*').eq('timestamp', params.timestamp).maybeSingle();
      if (errSel) return { ok: false, error: errSel.message };

      const { error: errDel } = await sb.from('reasignaciones').delete().eq('timestamp', params.timestamp);
      if (errDel) return { ok: false, error: errDel.message };

      // Borra también la fila congelada correspondiente en registros (si la encontramos)
      if (reasig) {
        await sb.from('registros').delete()
          .eq('fecha', reasig.fecha).eq('turno', reasig.turno).eq('matricula', reasig.matricula)
          .eq('operario', reasig.operario).eq('reasignado', true);
      }
      return { ok: true };
    }

    case 'guardarFlota': {
      // Upsert: inserta los vehículos nuevos y actualiza los existentes.
      // Los campos de bloqueo e itv_aviso_enviado NO se tocan aquí: tienen
      // sus propias acciones y así no se pisan con datos antiguos.
      const flota = params.flota || [];
      if (!flota.length) return { ok: true };
      const SI = x => String(x || '').trim().toUpperCase() === 'SI' || x === true;
      const fecha = x => (x && String(x).trim()) ? String(x).trim().substring(0, 10) : null;
      const filas = flota.filter(v => v.matricula).map(v => ({
        matricula:          v.matricula,
        grupo:              v.grupo || '',
        tipo:               v.tipo  || '',
        nota:               v.nota  || '',
        orden:              (v.orden === '' || v.orden === undefined || v.orden === null) ? null : Number(v.orden),
        restringido:        SI(v.restringido),
        itv_fin:            fecha(v.itv_fin),
        archivado:          SI(v.archivado),
        fecha_archivado:    SI(v.archivado) ? fecha(v.fecha_archivado) : null,
        seguro_aseguradora: v.seguro_aseguradora || '',
        seguro_nombre:      v.seguro_nombre || '',
        seguro_cif:         v.seguro_cif || '',
        seguro_poliza:      v.seguro_poliza || '',
        seguro_vencimiento: fecha(v.seguro_vencimiento),
        seguro_tel:         v.seguro_tel || '',
        ...(v.tacografo !== undefined ? { tacografo: SI(v.tacografo) } : {}),
        ...(v.sociedad !== undefined ? { sociedad: String(v.sociedad || '').trim() } : {}),
        updated_at:         new Date().toISOString()
      }));
      const { error } = await sb.from('vehiculos').upsert(filas, { onConflict: 'matricula' });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'renombrarVehiculo': {
      const anterior = String(params.anterior || '').trim();
      const nueva    = String(params.nueva || '').trim().toUpperCase();
      if (!anterior || !nueva) return { ok: false, error: 'Faltan datos para renombrar' };
      if (anterior === nueva) return { ok: true };
      const { data: existe, error: e1 } = await sb.from('vehiculos').select('matricula').eq('matricula', nueva).maybeSingle();
      if (e1) return { ok: false, error: e1.message };
      if (existe) return { ok: false, error: 'Ya existe un vehículo con la matrícula ' + nueva };
      const { data, error } = await sb.from('vehiculos')
        .update({ matricula: nueva, updated_at: new Date().toISOString() })
        .eq('matricula', anterior).select('matricula');
      if (error) {
        if (error.code === '23503') {
          return { ok: false, conHistorial: true, error: 'Este vehículo ya tiene registros (cuadrante, incidencias, repostajes o reasignaciones) con la matrícula ' + anterior + ', así que no se puede renombrar sin cambiar también ese historial.' };
        }
        return { ok: false, error: error.message };
      }
      if (!data || !data.length) return { ok: false, error: 'No se encontró el vehículo ' + anterior + ' en la base de datos' };
      // Choferes habituales: siguen a la matrícula nueva (si la tabla aún no existe, se ignora)
      try { await sb.from('conductores_habituales').update({ matricula: nueva }).eq('matricula', anterior); } catch (e) {}
      return { ok: true };
    }

    case 'guardarConductores': {
      const conductores = params.conductores || [];
      for (const c of conductores) {
        const { error } = await sb.from('conductores').upsert({
          num_usuario: c.numUsuario,
          nombre:      c.nombre  || '',
          dni:         c.dni     || '',
          sociedad:    c.sociedad|| '',
          nave:        c.nave    || ''
        }, { onConflict: 'num_usuario' });
        if (error) return { ok: false, error: error.message };
      }
      return { ok: true };
    }

    case 'eliminarConductor': {
      const { error } = await sb.from('conductores').delete().eq('num_usuario', params.numUsuario);
      if (error) return { ok: false, error: error.message };
      // Quitarlo también de los habituales de las matrículas (si la tabla aún no existe, se ignora)
      try { await sb.from('conductores_habituales').delete().eq('num_usuario', String(params.numUsuario)); } catch (e) {}
      return { ok: true };
    }

    case 'verificarOcupacion': {
      const { data, error } = await sb.from('registros')
        .select('*')
        .eq('matricula', params.matricula)
        .not('hora_entrega', 'is', null)
        .is('hora_devolucion', null)
        .order('fecha', { ascending: true })
        .order('turno', { ascending: true });
      if (error) return { ok: false, vehiculoOcupado: false, error: error.message };

      // Excluir la propia fila que se está editando ahora mismo (mismo turno/fecha)
      const pendientes = (data || []).filter(f => !(f.fecha === params.fecha && f.turno === params.turno));
      if (!pendientes.length) return { ok: true, vehiculoOcupado: false };

      const masAntiguo = pendientes[0];
      return {
        ok: true,
        vehiculoOcupado: true,
        pendientesRestantes: pendientes.length,
        info: {
          fecha:        masAntiguo.fecha,
          turno:        masAntiguo.turno,
          tipo:         masAntiguo.tipo         || '',
          operario:     masAntiguo.operario     || '',
          resp_entrega: masAntiguo.resp_entrega || '',
          hora_entrega: (masAntiguo.hora_entrega || '').slice(0, 5),
          num_tarjeta:  masAntiguo.num_tarjeta   || '',
          itv:          masAntiguo.itv           || '',
          incidencias:  masAntiguo.incidencias   || ''
        }
      };
    }

    case 'cargarLog': {
      let q = sb.from('log_ordenes').select('*');
      if (params.desde) q = q.gte('fecha', params.desde);
      if (params.hasta) q = q.lte('fecha', params.hasta);
      q = q.order('timestamp', { ascending: false });
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      let filas = (data || []).map(f => ({
        timestamp:         f.timestamp,
        numUsuario:        f.num_usuario,
        nombreResponsable: f.nombre_responsable,
        matricula:         f.matricula,
        operario:          f.operario,
        empresa:           f.empresa,
        ruta:              f.ruta,
        turno:             f.turno,
        fecha:             f.fecha
      }));
      if (params.filtroUsuario) {
        const fu = String(params.filtroUsuario).trim().toUpperCase();
        filas = filas.filter(f =>
          (f.nombreResponsable || '').toUpperCase().includes(fu) ||
          (f.numUsuario || '').toString().toUpperCase().includes(fu)
        );
      }
      return { ok: true, filas };
    }

    case 'registrarLog': {
      const l = params.log || {};
      const { error } = await sb.from('log_ordenes').insert({
        timestamp:          l.timestamp || new Date().toISOString(),
        num_usuario:        l.numUsuario        || '',
        nombre_responsable: l.nombreResponsable || '',
        matricula:          l.matricula || '',
        operario:           l.operario  || '',
        empresa:            l.empresa   || '',
        ruta:               l.ruta      || '',
        turno:              l.turno     || '',
        fecha:              l.fecha     || null
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'registrarIncidencia': {
      const inc = params.incidencia || {};
      const { data: incGuardada, error } = await sb.from('incidencias').insert({
        timestamp:   inc.timestamp || new Date().toISOString(),
        fecha:       inc.fecha,
        turno:       inc.turno,
        matricula:   inc.matricula,
        descripcion: inc.descripcion || '',
        responsable: inc.responsable || '',
        estado:      inc.estado || 'PENDIENTE',
        tipo:        inc.tipo || null      // averia | accidente | revision | otro
      }).select('id').single();
      if (error) return { ok: false, error: error.message };

      // Si se pidió bloquear el vehículo, actualizamos también su ficha
      if (params.bloquearVehiculo) {
        const { error: errVeh } = await sb.from('vehiculos').update({
          bloqueado:      true,
          motivo_bloqueo: inc.descripcion || '',
          bloqueado_por:  inc.responsable || '',
          fecha_bloqueo:  inc.timestamp || new Date().toISOString()
        }).eq('matricula', inc.matricula);
        if (errVeh) return { ok: false, error: errVeh.message };
      }

      let emailError = null;
      const destinatarios = await obtenerDestinatariosPorTipo('incidencias');
      if (destinatarios.length) {
        emailError = await enviarCorreoIncidenciaViaAppsScript({
          to:          destinatarios.join(','),
          matricula:   inc.matricula,
          responsable: inc.responsable || '',
          fecha:       inc.fecha,
          turno:       inc.turno,
          descripcion: inc.descripcion || '',
          bloqueado:   !!params.bloquearVehiculo
        });
      }
      return { ok: true, emailError, id: incGuardada ? incGuardada.id : null };
    }

    case 'resolverIncidencia': {
      const { error } = await sb.from('incidencias').update({
        estado:                'COMPLETADO',
        resuelto_por:           params.resueltoPor || '',
        fecha_resolucion:       new Date().toISOString(),
        comentario_resolucion:  params.comentario || ''
      })
        .eq('timestamp', params.timestamp)
        .eq('matricula', params.matricula);
      if (error) return { ok: false, error: error.message };

      // Si el vehículo está bloqueado POR ESTA incidencia (el motivo del bloqueo
      // es su descripción), se desbloquea, salvo que tenga una avería abierta
      // que le impida circular (esa se desbloquea al marcarla como reparada).
      let vehiculoDesbloqueado = false, averiaCerrada = false;
      try {
        const [{ data: inc }, { data: veh }] = await Promise.all([
          sb.from('incidencias').select('id, descripcion').eq('timestamp', params.timestamp).eq('matricula', params.matricula).maybeSingle(),
          sb.from('vehiculos').select('bloqueado, motivo_bloqueo').eq('matricula', params.matricula).maybeSingle()
        ]);
        if (inc) averiaCerrada = await cerrarAveriaDeIncidencia(inc.id, params.resueltoPor, params.comentario);
        const norm = t => String(t || '').replace(/^Avería:\s*/i, '').replace(/\s+/g, ' ').trim().toUpperCase();
        if (inc && veh && veh.bloqueado && norm(veh.motivo_bloqueo) === norm(inc.descripcion)) {
          const { data: averiasInmov } = await sb.from('averias').select('id')
            .eq('matricula', params.matricula).neq('estado', 'reparada').eq('inmoviliza', true).limit(1);
          if (!averiasInmov || !averiasInmov.length) {
            const { error: errDesb } = await sb.from('vehiculos').update({
              bloqueado: false, motivo_bloqueo: '', bloqueado_por: '', fecha_bloqueo: null
            }).eq('matricula', params.matricula);
            if (!errDesb) vehiculoDesbloqueado = true;
          }
        }
      } catch (e) { /* no bloqueante: la incidencia ya está resuelta */ }
      return { ok: true, vehiculoDesbloqueado, averiaCerrada };
    }

    case 'eliminarIncidencia': {
      const { error } = await sb.from('incidencias').delete()
        .eq('timestamp', params.timestamp)
        .eq('matricula', params.matricula);
      if (error) return { ok: false, error: error.message };

      // Si el vehículo de esta incidencia está bloqueado, quitamos también
      // el bloqueo (y su motivo) de la tabla de vehículos, para que no se
      // quede "colgado" en el cuadrante tras borrar la incidencia que lo originó.
      let vehiculoDesbloqueado = false;
      try {
        const { data: veh } = await sb.from('vehiculos')
          .select('bloqueado')
          .eq('matricula', params.matricula)
          .maybeSingle();
        if (veh && veh.bloqueado) {
          const { error: errDesb } = await sb.from('vehiculos').update({
            bloqueado:      false,
            motivo_bloqueo: '',
            bloqueado_por:  '',
            fecha_bloqueo:  null
          }).eq('matricula', params.matricula);
          if (!errDesb) vehiculoDesbloqueado = true;
        }
      } catch (e) { /* no bloqueante: la incidencia ya se ha borrado */ }

      return { ok: true, vehiculoDesbloqueado };
    }

    // ── REPOSTAJES ──────────────────────────────────────────────────────
    case 'cargarRepostajesPendientes': {
      const { data, error } = await sb.from('repostajes')
        .select('*')
        .eq('estado', 'PENDIENTE')
        .order('fecha', { ascending: true })
        .order('hora_entrega', { ascending: true });
      if (error) return { ok: false, error: error.message };
      return { ok: true, filas: data || [] };
    }

    case 'cargarRepostajes': {
      let q = sb.from('repostajes').select('*')
        .order('fecha', { ascending: false })
        .order('hora_entrega', { ascending: false });
      if (params.desde)     q = q.gte('fecha', params.desde);
      if (params.hasta)     q = q.lte('fecha', params.hasta);
      if (params.matricula) q = q.eq('matricula', params.matricula);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      return { ok: true, filas: data || [] };
    }

    case 'registrarRepostaje': {
      const r = params.repostaje || {};
      if (!r.matricula || !r.usuario_chofer || !r.num_tarjeta || !r.hora_entrega) {
        return { ok: false, error: 'Faltan datos obligatorios del repostaje' };
      }

      // Validación de kilometraje: no puede ser menor que el último registrado
      // para este vehículo, ni superar el salto máximo permitido respecto al
      // anterior. El salto permitido depende de los días transcurridos:
      // KM_POR_DIA por cada día (mínimo 1 día), con un tope de KM_SALTO_MAX.
      // Referencia (oct-2026): el máximo histórico entre repostajes era 1.298 km
      // y el máximo por día 399 km.
      if (r.kilometraje !== '' && r.kilometraje !== undefined && r.kilometraje !== null) {
        // Limpia posibles puntos/comas de miles guardados por error, para que
        // no se interpreten como separador decimal al convertir a número.
        const kmNuevo = Number(String(r.kilometraje).replace(/[.,]/g, ''));
        if (!isNaN(kmNuevo)) {
          const { data: ultimos, error: errUlt } = await sb.from('repostajes')
            .select('kilometraje, fecha')
            .eq('matricula', r.matricula)
            .not('kilometraje', 'is', null)
            .order('fecha', { ascending: false })
            .order('hora_entrega', { ascending: false })
            .limit(1);
          if (!errUlt && ultimos && ultimos.length) {
            const kmAnterior = Number(String(ultimos[0].kilometraje).replace(/[.,]/g, ''));
            if (!isNaN(kmAnterior)) {
              if (kmNuevo < kmAnterior) {
                return { ok: false, error: `El kilometraje (${kmNuevo}) es menor que el último registrado para este vehículo. Revisa el dato.` };
              }
              const KM_POR_DIA   = 500;
              const KM_SALTO_MAX = 1800;
              const fNueva    = new Date((r.fecha || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
              const fAnterior = new Date(String(ultimos[0].fecha || '').slice(0, 10) + 'T00:00:00');
              let dias = Math.round((fNueva - fAnterior) / 86400000);
              if (isNaN(dias) || dias < 1) dias = 1;
              const saltoPermitido = Math.min(dias * KM_POR_DIA, KM_SALTO_MAX);
              if (kmNuevo - kmAnterior > saltoPermitido) {
                return { ok: false, error: `El kilometraje (${kmNuevo}) supone un salto de ${kmNuevo - kmAnterior} km respecto al último registrado (${kmAnterior}), y el máximo permitido es ${saltoPermitido} km. Revisa el dato.` };
              }
            }
          }
        }
      }

      const payload = {
        fecha:          r.fecha || null,
        matricula:      r.matricula,
        usuario_chofer: r.usuario_chofer || '',
        kilometraje:    (r.kilometraje !== undefined && r.kilometraje !== '') ? r.kilometraje : null,
        num_tarjeta:    r.num_tarjeta || '',
        hora_entrega:   r.hora_entrega || null,
        gasoil_antes:   r.gasoil_antes !== undefined ? String(r.gasoil_antes) : '',
        adblue_antes:   r.adblue_antes !== undefined ? String(r.adblue_antes) : '',
        resp_entrega:   r.resp_entrega || '',
        estado:         'PENDIENTE'
      };
      const { data, error } = await sb.from('repostajes').insert(payload).select('id').single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: data.id };
    }

    case 'completarRepostaje': {
      const r = params.repostaje || {};
      if (!r.id) return { ok: false, error: 'Falta el id del repostaje' };
      const payload = {
        hora_devolucion: r.hora_devolucion || null,
        gasoil_despues:  r.gasoil_despues !== undefined ? String(r.gasoil_despues) : '',
        adblue_despues:  r.adblue_despues !== undefined ? String(r.adblue_despues) : '',
        ticket_ref:      r.ticket_ref || '',
        ticket_importe:  (r.ticket_importe !== undefined && r.ticket_importe !== '') ? r.ticket_importe : null,
        resp_recibe:     r.resp_recibe || '',
        estado:          'COMPLETADO'
      };
      const { error } = await sb.from('repostajes').update(payload).eq('id', r.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'eliminarRepostaje': {
      if (!params.id) return { ok: false, error: 'Falta el id del repostaje' };
      const { error } = await sb.from('repostajes').delete().eq('id', params.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'cargarConfigAdmin': {
      const { data, error } = await sb.from('app_config')
        .select('valor').eq('clave', 'adminHash').maybeSingle();
      if (error) return { ok: false, error: error.message };
      return { ok: true, adminHash: data ? data.valor : null };
    }

    case 'guardarConfigAdmin': {
      await sb.from('app_config').delete().eq('clave', 'adminHash');
      const { error } = await sb.from('app_config').insert({ clave: 'adminHash', valor: params.adminHash });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'cargarConfigHash': {
      const { data, error } = await sb.from('app_config')
        .select('valor').eq('clave', 'configHash').maybeSingle();
      if (error) return { ok: false, error: error.message };
      return { ok: true, configHash: data ? data.valor : null };
    }

    case 'guardarConfigHash': {
      await sb.from('app_config').delete().eq('clave', 'configHash');
      const { error } = await sb.from('app_config').insert({ clave: 'configHash', valor: params.configHash });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'cargarRutas': {
      // Empresas, ubicaciones y rutas viven en sus propias tablas — ya NO se
      // guarda nada en app_config para esto.
      const [resUbic, resEmp, resRutas] = await Promise.all([
        sb.from('ubicaciones').select('*'),
        sb.from('empresas').select('*'),
        sb.from('rutas').select('*')
      ]);
      if (resUbic.error)  return { ok: false, error: resUbic.error.message };
      if (resEmp.error)   return { ok: false, error: resEmp.error.message };
      if (resRutas.error) return { ok: false, error: resRutas.error.message };

      const ubicaciones = {};
      (resUbic.data || []).forEach(u => {
        ubicaciones[u.codigo] = {
          dir: u.direccion || '',
          pob: u.poblacion || '',
          cp:  u.cp        || '',
          tel: u.telefono  || ''
        };
      });

      const empresas = {};
      (resEmp.data || []).forEach(e => {
        empresas[e.codigo] = {
          label: e.label || '',
          razon: e.razon || '',
          nif:   e.nif   || '',
          rutas: []
        };
      });
      (resRutas.data || []).forEach(r => {
        if (empresas[r.empresa_codigo]) {
          empresas[r.empresa_codigo].rutas.push({
            id: r.id, origen: r.origen, destino: r.destino, label: r.label || ''
          });
        }
      });

      return { ok: true, empresas, ubicaciones };
    }

    case 'guardarRutas': {
      const empresasIn    = params.empresas    || {};
      const ubicacionesIn = params.ubicaciones || {};

      // El frontend manda siempre el estado completo → reemplazamos todo lo
      // existente en las 3 tablas. Rutas primero (tiene FK hacia empresas).
      // (rutas.id es uuid: usamos un filtro "id distinto de all-zero" para
      // poder borrar todas las filas sin pasarle una cadena vacía a una
      // columna uuid, que daría error de tipo)
      const { error: errDelRutas } = await sb.from('rutas')
        .delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (errDelRutas) return { ok: false, error: errDelRutas.message };

      const { error: errDelEmp } = await sb.from('empresas').delete().neq('codigo', '');
      if (errDelEmp) return { ok: false, error: errDelEmp.message };

      const { error: errDelUbic } = await sb.from('ubicaciones').delete().neq('codigo', '');
      if (errDelUbic) return { ok: false, error: errDelUbic.message };

      const filasUbic = Object.entries(ubicacionesIn).map(([codigo, u]) => ({
        codigo, direccion: u.dir || '', poblacion: u.pob || '', cp: u.cp || '', telefono: u.tel || ''
      }));
      if (filasUbic.length) {
        const { error } = await sb.from('ubicaciones').insert(filasUbic);
        if (error) return { ok: false, error: error.message };
      }

      const filasEmp = Object.entries(empresasIn).map(([codigo, e]) => ({
        codigo, label: e.label || '', razon: e.razon || '', nif: e.nif || ''
      }));
      if (filasEmp.length) {
        const { error } = await sb.from('empresas').insert(filasEmp);
        if (error) return { ok: false, error: error.message };
      }

      // rutas.id es uuid autogenerado por la BD — no mandamos el id que
      // tuviera la ruta en memoria (tipo 'jd-g-p'), dejamos que Postgres
      // genere uno nuevo con cada guardado.
      const filasRutas = [];
      Object.entries(empresasIn).forEach(([empKey, e]) => {
        (e.rutas || []).forEach(r => {
          filasRutas.push({
            empresa_codigo: empKey, origen: r.origen, destino: r.destino, label: r.label || ''
          });
        });
      });
      if (filasRutas.length) {
        const { error } = await sb.from('rutas').insert(filasRutas);
        if (error) return { ok: false, error: error.message };
      }

      // Limpieza: borra el resto residual del blob antiguo en app_config, si existía.
      await sb.from('app_config').delete().eq('clave', 'rutas');

      return { ok: true };
    }

    case 'cargarDestinatarios': {
      const { data, error } = await sb.from('destinatarios_email').select('*');
      if (error) return { ok: false, error: error.message };
      const resultado = { incidencias: [], bloqueos: [], itv: [] };
      (data || []).forEach(f => {
        if (resultado[f.tipo]) resultado[f.tipo].push(f.email);
      });
      return { ok: true, ...resultado };
    }

    case 'guardarDestinatarios': {
      const d = params.destinatarios || {};
      const filas = [];
      (d.incidencias || []).forEach(email => filas.push({ tipo: 'incidencias', email }));
      (d.bloqueos    || []).forEach(email => filas.push({ tipo: 'bloqueos',    email }));
      (d.itv         || []).forEach(email => filas.push({ tipo: 'itv',         email }));

      // El frontend manda siempre las 3 listas completas → reemplazamos todo lo existente
      const { error: errDel } = await sb.from('destinatarios_email')
        .delete().in('tipo', ['incidencias', 'bloqueos', 'itv']);
      if (errDel) return { ok: false, error: errDel.message };

      if (filas.length) {
        const { error: errIns } = await sb.from('destinatarios_email').insert(filas);
        if (errIns) return { ok: false, error: errIns.message };
      }
      return { ok: true };
    }

    // ── PRESENCIA (usuarios activos) ────────────────────────────────────
    case 'registrarPresencia': {
      if (!params.numUsuario) return { ok: false, error: 'Falta numUsuario' };
      await sb.from('presencia').delete().eq('num_usuario', params.numUsuario);
      const { error } = await sb.from('presencia').insert({
        num_usuario: params.numUsuario,
        nombre:      params.nombre  || '',
        rol:         params.rol     || 'Responsable',
        version:     params.version || '',
        ultima_vez:  new Date().toISOString()
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'registrarDesconexion': {
      if (!params.numUsuario) return { ok: false, error: 'Falta numUsuario' };
      const { error } = await sb.from('presencia').delete().eq('num_usuario', params.numUsuario);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'cargarPresencia': {
      // Se considera "activo" a quien haya mandado un heartbeat en los últimos 3 minutos
      // (el heartbeat del cliente se envía cada 60s)
      const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const { data, error } = await sb.from('presencia')
        .select('*')
        .gte('ultima_vez', cutoff)
        .order('ultima_vez', { ascending: false });
      if (error) return { ok: false, error: error.message };
      const ahoraMs = Date.now();
      const usuarios = (data || []).map(p => {
        const ts = new Date(p.ultima_vez).getTime();
        const segundos = Math.max(0, Math.round((ahoraMs - ts) / 1000));
        let hace;
        if (segundos < 60) hace = `${segundos}s`;
        else if (segundos < 3600) hace = `${Math.round(segundos / 60)} min`;
        else hace = `${Math.round(segundos / 3600)} h`;
        return {
          numUsuario: p.num_usuario,
          nombre:     p.nombre,
          rol:        p.rol,
          version:    p.version,
          segundos,
          hace,
          ultimaVez:  new Date(p.ultima_vez).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        };
      });
      return { ok: true, usuarios };
    }

    // ── DEVOLUCIONES PENDIENTES DEL TURNO ANTERIOR ──────────────────────
    case 'devolPendientes': {
      if (!params.responsable || !params.hoy) return { ok: true, pendientes: [] };
      const { data, error } = await sb.from('registros')
        .select('*')
        .eq('resp_entrega', params.responsable)
        .lt('fecha', params.hoy)
        .not('operario', 'is', null)
        .neq('operario', '')
        .is('hora_devolucion', null);
      if (error) return { ok: false, error: error.message };
      const filtrados = (data || []).filter(f => f.reasignado === null || f.reasignado === false);
      const pendientes = filtrados.map(f => ({
        ...f,
        hora_entrega:    (f.hora_entrega    || '').slice(0, 5),
        hora_devolucion: (f.hora_devolucion || '').slice(0, 5)
      }));
      return { ok: true, pendientes };
    }

    case 'cargarResponsables': {
      const { data, error } = await sb.from('responsables').select('*').order('nombre');
      if (error) return { ok: false, error: error.message };
      const responsables = (data || []).map(r => ({
        numUsuario: r.num_usuario,
        nombre:     r.nombre,
        rol:        r.rol || '',
        admin:      r.admin ? 'SI' : ''
      }));
      return { ok: true, responsables };
    }

    case 'añadirResponsable': {
      const r = params.responsable || {};
      if (!r.numUsuario || !r.nombre || !r.hashClave) {
        return { ok: false, error: 'Faltan datos obligatorios' };
      }
      const { error } = await sb.from('responsables').insert({
        num_usuario: r.numUsuario,
        nombre:      r.nombre,
        hash_clave:  r.hashClave,
        rol:         r.rol || '',
        admin:       String(r.admin || '').trim().toUpperCase() === 'SI'
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'eliminarResponsable': {
      const { error } = await sb.from('responsables').delete().eq('num_usuario', params.numUsuario);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'cambiarClave': {
      const { error } = await sb.from('responsables')
        .update({ hash_clave: params.hashNueva })
        .eq('num_usuario', params.numUsuario);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    case 'historial': {
      let q = sb.from('registros').select('*');
      if (params.desde) q = q.gte('fecha', params.desde);
      if (params.hasta) q = q.lte('fecha', params.hasta);
      q = q.order('fecha', { ascending: false }).order('turno', { ascending: true });
      if (params.turno) {
        // El selector manda "MAÑANA" con Ñ, pero en la BD se guarda sin tilde
        const turnoNorm = params.turno.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        q = q.eq('turno', turnoNorm);
      }
      if (params.matricula) q = q.eq('matricula', params.matricula);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      return { ok: true, filas: data || [] };
    }

    // ── DIAGNÓSTICO / SALUD DEL SISTEMA ─────────────────────────────────
    // Sustituye al antiguo chequeo de hojas de Google Sheets: para cada
    // tabla de Supabase, comprueba si existe, cuántas filas tiene y cuántas
    // columnas (a partir de una fila de muestra).
    case 'diagnosticoHojas': {
      const tablas = [
        { hoja: 'vehiculos',           nombre: 'Vehículos' },
        { hoja: 'conductores',         nombre: 'Conductores' },
        { hoja: 'registros',           nombre: 'Registros (cuadrante)' },
        { hoja: 'incidencias',         nombre: 'Incidencias' },
        { hoja: 'reasignaciones',      nombre: 'Reasignaciones' },
        { hoja: 'responsables',        nombre: 'Responsables' },
        { hoja: 'log_ordenes',         nombre: 'Log de Órdenes' },
        { hoja: 'log_acciones',        nombre: 'Log de Acciones' },
        { hoja: 'destinatarios_email', nombre: 'Destinatarios de email' },
        { hoja: 'repostajes',          nombre: 'Repostajes' },
        { hoja: 'empresas',            nombre: 'Empresas' },
        { hoja: 'ubicaciones',         nombre: 'Ubicaciones' },
        { hoja: 'rutas',               nombre: 'Rutas' },
        { hoja: 'app_config',          nombre: 'Configuración de la app' },
      ];

      const hojas = await Promise.all(tablas.map(async t => {
        try {
          const { count, error } = await sb.from(t.hoja).select('*', { count: 'exact', head: true });
          if (error) return { ...t, existe: false, filas: 0, columnas: 0 };
          let columnas = 0;
          if (count > 0) {
            const { data: muestra } = await sb.from(t.hoja).select('*').limit(1);
            if (muestra && muestra[0]) columnas = Object.keys(muestra[0]).length;
          }
          return { ...t, existe: true, filas: count || 0, columnas };
        } catch (e) {
          return { ...t, existe: false, filas: 0, columnas: 0 };
        }
      }));

      return { ok: true, hojas, timestamp: new Date().toISOString() };
    }

    default:
      // Todavía no migrado — se irá completando accion a accion.
      console.warn('Acción de Supabase aún no implementada:', accion, params);
      return { ok: false, error: 'Acción no implementada todavía: ' + accion };
  }
}

// ── Interceptor de fetch: cualquier llamada a APPS_SCRIPT_URL se desvía a
// Supabase en vez de salir a la red, EXCEPTO las acciones de la lista blanca
// (gestión de documentos), que siguen yendo de verdad al Apps Script real
// mientras no migremos también los ficheros a Supabase Storage.
// El resto de fetch (CDNs, etc.) sigue funcionando exactamente igual que antes.
const ACCIONES_APPS_SCRIPT = new Set([
  'subirDocumento', 'cargarDocumentos', 'eliminarDocumento', 'proxyDoc',
  'enviarCorreoIncidencia', 'enviarCorreoBloqueo'
]);

function _extraerAccionDePeticion(urlStr, options) {
  try {
    if (options && options.method === 'POST' && options.body) {
      const p = JSON.parse(options.body);
      return p.accion || '';
    }
    const u = new URL(urlStr);
    return u.searchParams.get('accion') || '';
  } catch (e) { return ''; }
}

(function instalarTraductorSupabase() {
  const fetchOriginal = window.fetch;
  window.fetch = async function(...args) {
    const esNuestraApi = typeof args[0] === 'string' && args[0].startsWith(APPS_SCRIPT_URL);
    if (!esNuestraApi) return fetchOriginal.apply(this, args);

    const accion = _extraerAccionDePeticion(args[0], args[1] || {});
    if (ACCIONES_APPS_SCRIPT.has(accion)) {
      // Se deja pasar de verdad a Google Apps Script (documentos / Drive)
      return fetchOriginal.apply(this, args);
    }

    try {
      const data = await manejarPeticionSupabase(args[0], args[1] || {});
      if (data && data.ocupado) mostrarModalOcupado();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      console.error('Error en traductor Supabase:', e);
      return new Response(JSON.stringify({ ok: false, error: e.message || 'Error de conexión con Supabase' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
})();

function mostrarModalOcupado() {
  document.getElementById('modal-sistema-ocupado').classList.add('visible');
}
function cerrarModalOcupado() {
  document.getElementById('modal-sistema-ocupado').classList.remove('visible');
}

