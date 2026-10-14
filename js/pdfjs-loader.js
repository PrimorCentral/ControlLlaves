    // Carga diferida de PDF.js (compatible con module y non-module)
    window._pdfjs = null;
    import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs')
      .then(m => {
        window._pdfjs = m;
        window._pdfjs.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
      })
      .catch(() => {
        // Fallback: intentar con versión anterior si el CDN falla
        import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js').then(m => {
          window._pdfjs = m;
          window._pdfjs.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        });
      });
