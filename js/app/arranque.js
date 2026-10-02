/* Arranque de la app pública (se carga al final, cuando todas las pantallas ya registraron sus rutas). */
(function () {
  'use strict';
  function ir() { if (window.RC && RC.iniciar) RC.iniciar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ir); else ir();
})();
