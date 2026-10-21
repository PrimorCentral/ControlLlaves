// ---------------------------------------------------------------
// FLOTA PRIMOR · js/changelog.js — Historial de versiones (pestaña
// "Novedades" de la ventana "Acerca de", js/acerca-de.js).
//
// Con cada versión nueva: añadir una entrada ARRIBA del todo (la más
// reciente primero) y subir version.json al mismo número.
// tipo: 'nuevo' | 'mejora' | 'correccion'
// fecha: 'AAAA-MM-DD'
// Redacción en impersonal (la lee todo el equipo).
// ---------------------------------------------------------------
const CHANGELOG_FLOTA = [
  {
    version: '3.9.0',
    fecha: '2026-10-21',
    cambios: [
      { tipo: 'nuevo',  texto: 'Nueva sección "Asignaciones" en el Panel Admin: choferes habituales de cada vehículo, separados por turno, y suplentes para cuando no puede ir el habitual. Se puede descargar en PDF' },
      { tipo: 'nuevo',  texto: 'Los conductores tienen turno (Turno 1, Turno 2 o sin turno). Los dos turnos se alternan mañana y tarde cada lunes, solos' },
      { tipo: 'nuevo',  texto: 'Al asignar un chofer en el cuadrante salen primero los habituales de ese vehículo para el turno abierto (★) y después los suplentes, antes que el resto' },
      { tipo: 'mejora', texto: 'Panel Admin › Conductores rediseñado: lista en tabla y ficha de cada conductor en una ventana al pulsarlo' },
      { tipo: 'nuevo',  texto: 'Nuevo apartado "Tacógrafo" en la ficha: próxima revisión con su semáforo y barra, revisiones realizadas con factura y certificado, y aviso cuando está a punto de caducar. Los vehículos sin tacógrafo lo indican y no dan avisos' },
      { tipo: 'nuevo',  texto: 'ITV: el informe se sube desde el propio apartado ITV y la app lee del PDF escaneado la fecha de la próxima inspección y pregunta si se guarda. Avisa si la matrícula no coincide o el resultado no es favorable. La fecha solo se edita a mano si no se ha podido leer' },
      { tipo: 'mejora', texto: 'En ITV se ve el informe actual y los anteriores quedan en un historial plegado; la tarjeta ITV del Resumen lleva barra de días, como la del seguro' },
      { tipo: 'nuevo',  texto: 'Los datos del vehículo se editan desde la propia ficha (botón Editar) y la nueva pestaña "Gestión" (solo administradores) reúne bloquear, restringir y dar de baja o de alta' },
      { tipo: 'mejora', texto: 'Panel Admin › Vehículos: al pulsar una fila se abre su ficha, y el orden del cuadrante se cambia con las flechas ↑↓ de cada fila' },
      { tipo: 'nuevo',  texto: 'Los vehículos tienen Sociedad, y Nave, Propiedad y Sociedad se eligen en listas desplegables (con opción de añadir una nueva)' },
      { tipo: 'mejora', texto: 'Nueva cabecera de la ficha: título en franja roja y, junto a la matrícula, vehículo, nave, propiedad y sociedad' },
      { tipo: 'mejora', texto: 'Documentos muestra solo lo esencial (ficha técnica, permiso y póliza) en tarjetas grandes, sin los informes de ITV; "Subir documento" abre una ventana sencilla para elegir el tipo y el archivo' },
      { tipo: 'mejora', texto: 'Las facturas y certificados de los mantenimientos se guardan con su mantenimiento y no en Documentos; cada mantenimiento puede llevar factura y certificado' },
      { tipo: 'mejora', texto: 'Las ventanas ya no se cierran al pulsar fuera de ellas: solo con la ✕ o su botón de cerrar' },
      { tipo: 'correccion', texto: 'Las filas del cuadrante con datos tienen la misma altura que las vacías, para que quepan más vehículos sin desplazar la pantalla; el botón "Asignar tarjeta" sale centrado' }
    ]
  },
  {
    version: '3.8.1',
    fecha: '2026-10-19',
    cambios: [
      { tipo: 'nuevo',  texto: 'Nueva pestaña "Mantenimiento" en la ficha del vehículo, con sus averías, las próximas revisiones y el historial de mantenimientos' },
      { tipo: 'nuevo',  texto: 'Cualquier responsable puede dar parte de una avería. Si se marca que el vehículo no puede circular, pasa a NO DISPONIBLE en el cuadrante (con el correo de aviso) hasta que se marca como reparada' },
      { tipo: 'nuevo',  texto: 'Los administradores pueden pasar una avería a taller y marcarla como reparada, con taller, coste y qué se ha hecho; al repararla, el vehículo vuelve a estar disponible' },
      { tipo: 'nuevo',  texto: 'Registro de mantenimientos (revisiones, aceite, neumáticos, frenos…) con fecha, kilómetros, taller, coste y factura; la factura queda también en Documentos' },
      { tipo: 'nuevo',  texto: 'Revisiones programadas por fecha o por kilómetros, que avisan 15 días o 1.000 km antes; el kilometraje actual sale del último repostaje' },
      { tipo: 'nuevo',  texto: 'Aviso en el cuadrante: una llave junto a la matrícula indica una avería abierta o una revisión vencida (roja) o próxima (naranja); al pulsarla se abre la ficha en Mantenimiento' },
      { tipo: 'mejora', texto: 'El botón "Añadir Incidencia" del cuadrante abre una ventana "¿Qué quieres añadir?": incidencia del turno, avería, fotos y documentos para todos, y mantenimiento y revisiones para administradores, sin entrar al Panel Admin' },
      { tipo: 'mejora', texto: 'Desde el cuadrante se pueden subir fotos y documentos; borrarlos sigue siendo solo para administradores' },
      { tipo: 'nuevo',  texto: 'Las incidencias tienen tipo (Avería, Accidente, Revisión u Otro), que se elige al registrarlas; si es una avería, queda también en Mantenimiento, enlazada a la incidencia' },
      { tipo: 'nuevo',  texto: 'En Incidencias pendientes se ve y se puede cambiar el tipo de cada incidencia, el estado de su avería (abierta, en taller o reparada) y hay un botón "Pasar a avería"' },
      { tipo: 'mejora', texto: 'Al marcar una avería como reparada, la incidencia de la que viene se resuelve sola con el comentario de la reparación' },
      { tipo: 'mejora', texto: 'La pestaña Mantenimiento muestra también las incidencias pendientes del vehículo (accidentes, revisiones…), y la llave del cuadrante avisa de ellas' },
      { tipo: 'mejora', texto: '"Dar parte de avería" registra también la incidencia (tipo Avería) con su correo de aviso, para que aparezca en Incidencias pendientes junto con todo lo pendiente' }
    ]
  },
  {
    version: '3.8.0',
    fecha: '2026-10-19',
    cambios: [
      { tipo: 'nuevo',  texto: 'Ventana "Acerca de" al pulsar el logo (en el login, en la barra lateral o en la barra superior del móvil), con la licencia y estas Novedades, igual que en SALIDAS y GIDT' },
      { tipo: 'nuevo',  texto: 'Nueva pantalla de carga animada: el camión avanza por la carretera a medida que se comprueban la configuración, el servidor y la versión, y al terminar se convierte en la pantalla de acceso' },
      { tipo: 'mejora', texto: 'Nueva pantalla de acceso más clara: marca a la izquierda con un camión en movimiento y el formulario a la derecha, con el estado del servidor, la fecha y la versión a la vista' },
      { tipo: 'mejora', texto: 'Si no hay conexión con el servidor al arrancar, se avisa en la pantalla de carga y en la de acceso' },
      { tipo: 'mejora', texto: 'Los usuarios con permiso de administrador entran al panel de administración directamente, sin contraseña' }
    ]
  }
];
