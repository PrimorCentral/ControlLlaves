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
