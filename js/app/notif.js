/* Eventos + novedades (burbuja roja) + notificaciones.
   Portado de NotificationScheduler / NovedadesManager / NovedadesPollScheduler de la app Android.

   LÍMITE REAL DEL NAVEGADOR: una web no puede despertar el teléfono con la app cerrada sin un servidor de notificaciones push.
   Por eso: los recordatorios fijos y el sondeo cada 30 min funcionan mientras la web/app instalada esté abierta (o en segundo
   plano), al abrirla se recuperan los recordatorios de las últimas 3 horas que se hayan perdido y, en Chrome/Android con la app
   instalada, el service worker revisa «Nuevo evento» de vez en cuando aunque esté cerrada (Periodic Background Sync). */
(function () {
  'use strict';
  const RC = window.RC, D = window.RCDATA;
  const MAX_IDS = 300, SONDEO_MS = 30 * 60 * 1000, VENTANA_RECUPERAR_MS = 3 * 3600 * 1000;

  // ═══════════════════ Eventos (script) ═══════════════════
  const nov = function () { return RC.leer('nov', { vistos: [], notificados: [], init: false }); };
  const guardarNov = function (n) {
    n.vistos = n.vistos.slice(-MAX_IDS); n.notificados = n.notificados.slice(-MAX_IDS);
    RC.guardar('nov', n); avisarSW();
  };
  RC.eventos = {
    /** Eventos activos, más recientes primero. Guarda copia local. */
    obtener: async function () {
      const r = await RC.api('obtener_eventos', null, { timeout: 15000 });
      const lista = (r.eventos || []).filter(function (e) { return e.activo !== false; }).map(function (e) {
        return { id: String(e.id || ''), etiqueta: e.etiqueta || '', imagenUrl: e.imagenUrl || '', activo: true, fecha: e.fecha || '' };
      });
      if (lista.length) RC.guardar('eventos', lista); else RC.borrar('eventos');
      return lista;
    },
    contarNuevos: function (ids) { const v = nov().vistos; return ids.filter(function (i) { return i && v.indexOf(i) < 0; }).length; },
    marcarVistos: function (ids) {
      ids = ids.filter(Boolean); const n = nov();
      ids.forEach(function (i) { if (n.vistos.indexOf(i) < 0) n.vistos.push(i); if (n.notificados.indexOf(i) < 0) n.notificados.push(i); });
      n.init = true; guardarNov(n); RC.badgeEventos(0);
    }
  };

  // ═══════════════════ Notificaciones ═══════════════════
  const soportado = 'Notification' in window;
  let reg = null;
  const N = RC.notif = {};
  N.estado = function () {
    if (!soportado) return 'no-soportado';
    if (Notification.permission === 'denied') return 'bloqueadas';
    return (Notification.permission === 'granted' && RC.leer('notif', false)) ? 'activas' : 'inactivas';
  };
  async function swReg() {
    if (reg) return reg;
    if (!('serviceWorker' in navigator)) return null;
    try { reg = await navigator.serviceWorker.ready; } catch (e) { reg = null; }
    return reg;
  }
  /** Muestra una notificación (con el service worker si existe: es lo único que funciona en Android). */
  N.mostrar = async function (titulo, cuerpo, tag, ruta) {
    if (N.estado() !== 'activas') return false;
    const opciones = { body: cuerpo, tag: tag, icon: 'img/iconos/icon-192.png', badge: 'img/iconos/icon-192.png', vibrate: [0, 300, 200, 300], data: { ruta: ruta || '#/biblia' }, renotify: true };
    try {
      const r = await swReg();
      if (r && r.showNotification) { await r.showNotification(titulo, opciones); return true; }
      const n = new Notification(titulo, opciones); n.onclick = function () { window.focus(); location.hash = (ruta || '#/biblia'); n.close(); }; return true;
    } catch (e) { console.warn('Notificación no mostrada', e); return false; }
  };
  N.activar = async function () {
    if (!soportado) { RC.aviso('Este navegador no permite notificaciones.', 'mal'); return false; }
    let p = Notification.permission;
    if (p === 'default') { try { p = await Notification.requestPermission(); } catch (e) { p = 'denied'; } }
    if (p !== 'granted') { RC.aviso(p === 'denied' ? 'Notificaciones bloqueadas: actívalas en los ajustes del sitio.' : 'No se activaron las notificaciones.', 'mal', 3800); return false; }
    RC.guardar('notif', true);
    const ult = {}; SLOTS.forEach(function (s) { ult[s.id] = Date.now(); }); RC.guardar('notif_ult', ult);  // no disparar recordatorios viejos
    avisarSW(); programar(); registrarSyncPeriodico();
    N.mostrar('Centro Cristiano el Recreo', 'Notificaciones activadas. Te avisaremos de los servicios, la palabra del día y los eventos.', 'rc-activadas', '#/biblia');
    RC.aviso('Notificaciones activadas', 'ok');
    return true;
  };
  N.desactivar = function () { RC.guardar('notif', false); clearTimeout(timer); avisarSW(); };

  // Recordatorios fijos (dow: 0 = domingo … 6 = sábado; null = todos los días)
  const SLOTS = [
    { id: 105, dow: null, h: 7, m: 0, msg: 'Ya está disponible la Palabra del día', ruta: '#/devocional' },
    { id: 101, dow: 2, h: 19, m: 0, msg: 'Este miércoles te esperamos en nuestro Servicio de Oración, 7:00 p. m.', ruta: '#/eventos' },
    { id: 102, dow: 5, h: 19, m: 0, msg: 'Este sábado te esperamos en nuestro Ayuno, 8:00 a. m.', ruta: '#/eventos' },
    { id: 103, dow: 6, h: 14, m: 0, msg: 'Este sábado te esperamos en Juventud CCR, 6:30 p. m.', ruta: '#/eventos' },
    { id: 104, dow: 6, h: 19, m: 0, msg: 'Este domingo te esperamos en nuestros Servicios de Exaltación, 8:00 a. m. y 10:30 a. m.', ruta: '#/eventos' }
  ];
  N.SLOTS = SLOTS;
  function ocurrencia(s, desde, haciaAtras) {   // última (<= desde) o próxima (> desde) ocurrencia del recordatorio
    const d = new Date(desde); d.setHours(s.h, s.m, 0, 0);
    for (let i = 0; i < 9; i++) {
      const ok = (s.dow == null || d.getDay() === s.dow) && (haciaAtras ? d.getTime() <= desde : d.getTime() > desde);
      if (ok) return d.getTime();
      d.setDate(d.getDate() + (haciaAtras ? -1 : 1));
    }
    return null;
  }
  let timer = null;
  async function dispararPendientes() {
    if (N.estado() !== 'activas') return;
    const ahora = Date.now(), ult = RC.leer('notif_ult', {});
    for (let i = 0; i < SLOTS.length; i++) {
      const s = SLOTS[i], t = ocurrencia(s, ahora, true);
      if (t && ahora - t <= VENTANA_RECUPERAR_MS && (ult[s.id] || 0) < t) {
        ult[s.id] = ahora; RC.guardar('notif_ult', ult);
        await N.mostrar('Centro Cristiano el Recreo', s.msg, 'rc-slot-' + s.id, s.ruta);
      }
    }
  }
  function programar() {
    clearTimeout(timer);
    if (N.estado() !== 'activas') return;
    const ahora = Date.now(); let prox = Infinity;
    SLOTS.forEach(function (s) { const t = ocurrencia(s, ahora, false); if (t && t < prox) prox = t; });
    const espera = Math.min(Math.max(1000, prox - ahora + 500), 30 * 60 * 1000);   // se reevalúa al menos cada 30 min
    timer = setTimeout(function () { dispararPendientes().then(programar); }, espera);
  }

  // ═══════════════════ Novedades de eventos (sondeo cada 30 min) ═══════════════════
  let sondeando = false;
  async function revisarEventos() {
    if (sondeando || !navigator.onLine) return;
    sondeando = true;
    try {
      const lista = await RC.eventos.obtener(), ids = lista.map(function (e) { return e.id; }).filter(Boolean), n = nov();
      if (!n.init) { n.vistos = n.vistos.concat(ids); n.notificados = n.notificados.concat(ids); n.init = true; guardarNov(n); RC.badgeEventos(0); return; }   // primera vez: nada histórico
      RC.badgeEventos(RC.eventos.contarNuevos(ids));
      const porNotificar = ids.filter(function (i) { return n.vistos.indexOf(i) < 0 && n.notificados.indexOf(i) < 0; });
      if (porNotificar.length) {
        porNotificar.forEach(function (i) { n.notificados.push(i); }); guardarNov(n);
        if (document.visibilityState === 'visible' && RC.rutaActual() && RC.rutaActual().path !== 'eventos') RC.aviso('Nuevo evento publicado', 'ok', 3600);
        await N.mostrar('Centro Cristiano el Recreo', 'Nuevo evento publicado', 'rc-evento-nuevo', '#/eventos');
      }
    } catch (e) { /* un fallo de red se reintenta en el siguiente ciclo */ } finally { sondeando = false; }
  }

  // ═══════════════════ Service worker ═══════════════════
  function avisarSW() {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
    const n = nov();
    navigator.serviceWorker.controller.postMessage({ tipo: 'estado', activas: N.estado() === 'activas', vistos: n.vistos, notificados: n.notificados, init: n.init, script: CONFIG.SCRIPT_URL });
  }
  async function registrarSyncPeriodico() {
    try {
      const r = await swReg();
      if (!r || !('periodicSync' in r)) return;
      const estado = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (estado.state === 'granted') await r.periodicSync.register('rc-revisar', { minInterval: 12 * 3600 * 1000 });
    } catch (e) { /* no soportado: se ignora */ }
  }
  function registrarSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }).then(function () { avisarSW(); if (N.estado() === 'activas') registrarSyncPeriodico(); }).catch(function (e) { console.warn('SW', e); });
    navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.tipo === 'ir' && e.data.ruta) location.hash = e.data.ruta; });
  }

  // ═══════════════════ Arranque ═══════════════════
  N.iniciar = function () {
    registrarSW();
    // Burbuja de Eventos: una consulta al abrir, otra al volver a primer plano y cada 30 min con la app abierta
    const cached = RC.leer('eventos', []), n = nov();
    if (n.init && cached.length) RC.badgeEventos(RC.eventos.contarNuevos(cached.map(function (e) { return e.id; })));
    revisarEventos();
    setInterval(function () { if (document.visibilityState === 'visible') revisarEventos(); }, SONDEO_MS);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { dispararPendientes().then(programar); revisarEventos(); } });
    window.addEventListener('online', function () { revisarEventos(); });
    dispararPendientes().then(programar);
    // Primera visita: ofrecer los recordatorios una sola vez (no se pide el permiso a ciegas)
    if (soportado && Notification.permission === 'default' && !RC.leer('notif_pregunta', false)) {
      setTimeout(function () {
        RC.guardar('notif_pregunta', true);
        RC.modal('¿Quieres recibir recordatorios?', RC.h('p', { text: 'Te avisaremos de la Palabra del día y de los servicios de la iglesia, y cuando se publique un evento nuevo. Puedes cambiarlo cuando quieras desde el menú.' }),
          [{ texto: 'Ahora no', sec: true }, { texto: 'Activar', fn: function () { N.activar(); } }]);
      }, 9000);
    }
  };
})();
