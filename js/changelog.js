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
