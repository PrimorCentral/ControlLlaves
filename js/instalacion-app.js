(function() {
  function appEstaInstalada() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true; // iOS Safari
  }

  var modal          = document.getElementById('modal-requiere-instalacion');
  var btnInstalar     = document.getElementById('btn-instalar-app');
  var btnYaInstalado  = document.getElementById('btn-ya-instalado');
  var deferredPrompt  = null;

  function mostrarPasosSegunDispositivo() {
    var ua = navigator.userAgent || '';
    var esIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    document.getElementById('ri-pasos-ios').style.display      = esIOS ? 'block' : 'none';
    document.getElementById('ri-pasos-chrome').style.display   = (!esIOS && deferredPrompt) ? 'block' : 'none';
    document.getElementById('ri-pasos-generico').style.display = (!esIOS && !deferredPrompt) ? 'block' : 'none';
  }

  function comprobarInstalacion() {
    // Bypass para pruebas en desarrollo: añade "-desarrollo" al final de la URL
    if (window.location.href.endsWith('-desarrollo')) {
      modal.classList.remove('visible');
      document.body.style.overflow = '';
      return;
    }
    if (appEstaInstalada()) {
      modal.classList.remove('visible');
      document.body.style.overflow = '';
    } else {
      mostrarPasosSegunDispositivo();
      modal.classList.add('visible');
      document.body.style.overflow = 'hidden';
    }
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    btnInstalar.style.display = 'block';
    mostrarPasosSegunDispositivo();
  });

  btnInstalar.addEventListener('click', async function() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    var resultado = await deferredPrompt.userChoice;
    if (resultado.outcome === 'accepted') {
      deferredPrompt = null;
      setTimeout(comprobarInstalacion, 800);
    }
  });

  btnYaInstalado.addEventListener('click', function() {
    location.reload();
  });

  window.addEventListener('appinstalled', function() {
    setTimeout(comprobarInstalacion, 500);
  });

  document.addEventListener('DOMContentLoaded', comprobarInstalacion);
  if (document.readyState !== 'loading') comprobarInstalacion();
})();
