/* Núcleo de la app pública: utilidades, tema, avisos, API del script, router y estructura (barra superior,
   navegación inferior, menú lateral). Todo cuelga de window.RC. */
(function () {
  'use strict';
  const RC = window.RC = {};
  const D = window.RCDATA;

  // ─────────────────────────── utilidades ───────────────────────────
  function h(tag, props) {
    const e = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;       // solo con texto propio de la app, nunca con datos del script
        else if (k === 'text') e.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    for (let i = 2; i < arguments.length; i++) añadir(e, arguments[i]);
    return e;
  }
  function añadir(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { añadir(e, x); }); return; }
    e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  RC.h = h;
  RC.$ = function (s, r) { return (r || document).querySelector(s); };
  RC.pausa = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  RC.barajar = function (a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; }
    return r;
  };
  RC.norm = function (t) {
    return String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  };
  RC.libro = function (id) { return D.LIBROS[id - 1]; };

  // Almacenamiento local (con try/catch: en modo privado puede fallar)
  RC.leer = function (k, def) {
    try { const v = localStorage.getItem('rc:' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  };
  RC.guardar = function (k, v) { try { localStorage.setItem('rc:' + k, JSON.stringify(v)); } catch (e) { /* sin espacio / modo privado */ } };
  RC.borrar = function (k) { try { localStorage.removeItem('rc:' + k); } catch (e) { } };

  // Íconos (SVG de trazo, 24x24)
  const IC = {
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    atras: '<polyline points="15 18 9 12 15 6"/>',
    adelante: '<polyline points="9 18 15 12 9 6"/>',
    eventos: '<rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    compartir: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
    escuchar: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
    pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>',
    cerrar: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
    fuente: '<path d="M3 20 8.5 5 14 20"/><path d="M5 15h7"/><path d="M15 20l3-8 3 8"/><path d="M16 18h4"/>',
    libro: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    mas: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    pausa: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
    ant: '<path d="M6 5h2v14H6zM20 5v14L9 12z"/>',
    sig: '<path d="M16 5h2v14h-2zM4 5v14l11-7z"/>',
    descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    devocional: '<path d="M12 2v20"/><path d="M5 8h14"/>',
    video: '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
    trivia: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    peticiones: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    escuela: '<path d="M22 10 12 5 2 10l10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    donar: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9"/><line x1="12" y1="8" x2="12" y2="21"/><path d="M12 8H7.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8zM12 8h4.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8z"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/>',
    check: '<polyline points="20 6 9 17 4 12"/>'
  };
  RC.ico = function (n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || '') + '</svg>'; };

  // ─────────────────────────── tema claro / oscuro ───────────────────────────
  const tema = RC.tema = {
    actual: function () { return document.documentElement.dataset.rcTema === 'oscuro' ? 'oscuro' : 'claro'; },
    aplicar: function (t) {
      document.documentElement.dataset.rcTema = t;
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', t === 'oscuro' ? '#0B0F1E' : '#EEF3FF');
    },
    poner: function (t) { RC.guardar('tema', t); tema.aplicar(t); RC.emitir('tema'); },
    alternar: function () { tema.poner(tema.actual() === 'oscuro' ? 'claro' : 'oscuro'); },
    iniciar: function () {
      let t = RC.leer('tema', null);
      if (!t) t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'oscuro' : 'claro';
      tema.aplicar(t);
    }
  };

  // Eventos internos muy simples
  const oyentes = {};
  RC.en = function (n, f) { (oyentes[n] = oyentes[n] || []).push(f); };
  RC.emitir = function (n, d) { (oyentes[n] || []).forEach(function (f) { try { f(d); } catch (e) { console.error(e); } }); };

  // ─────────────────────────── avisos (toasts) ───────────────────────────
  RC.aviso = function (texto, tipo, ms) {
    const cont = RC.$('#rc-avisos'); if (!cont) return;
    const a = h('div', { class: 'rc-aviso ' + (tipo || ''), role: 'status', text: texto });
    cont.appendChild(a);
    setTimeout(function () { a.style.transition = 'opacity .25s'; a.style.opacity = '0'; setTimeout(function () { a.remove(); }, 260); }, ms || 2600);
  };

  // ─────────────────────────── conexión con el script ───────────────────────────
  /** POST a Apps Script como text/plain (evita el preflight CORS). Nunca envía la clave de administración. */
  RC.api = async function (action, datos, opts) {
    const ctl = new AbortController();
    const t = setTimeout(function () { ctl.abort(); }, (opts && opts.timeout) || 25000);
    try {
      const res = await fetch(CONFIG.SCRIPT_URL, { method: 'POST', body: JSON.stringify(Object.assign({ action: action }, datos || {})), signal: ctl.signal });
      let json;
      try { json = await res.json(); } catch (e) { throw new Error('El servidor no respondió como se esperaba.'); }
      if (json && json.ok === false) throw new Error(json.error || 'Error desconocido');
      return json;
    } catch (e) {
      if (e.name === 'AbortError') { const x = new Error('Tiempo de espera agotado.'); x.red = true; throw x; }
      if (e instanceof TypeError) { const x = new Error('Sin conexión.'); x.red = true; throw x; }
      throw e;
    } finally { clearTimeout(t); }
  };

  // Política de sincronización (SyncPolicy.kt): la marca vive solo en memoria
  const ultimaSync = {};
  RC.sync = {
    BARRA_DEVOCIONAL: 3 * 3600e3, BARRA_VIDEOS: 6 * 3600e3,
    debeBarra: function (clave, ms) { const t = ultimaSync[clave]; return !t || Date.now() - t > ms; },
    marcar: function (clave) { ultimaSync[clave] = Date.now(); },
    barra: function () {   // línea delgada de "actualizando": siempre dura lo mismo (3,2 s)
      const b = RC.$('#rc-sync'); if (!b) return;
      b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    },
    detener: function () { const b = RC.$('#rc-sync'); if (b) b.classList.remove('on'); },
    spinner: function (on) { const s = RC.$('#rc-spin-top'); if (s) s.classList.toggle('rc-oculto', !on); }
  };

  /** Pone la primera imagen que cargue de verdad. Si ninguna carga, llama a alFallar. */
  RC.imagen = function (img, urls, alCargar, alFallar) {
    let i = 0;
    img.referrerPolicy = 'no-referrer';
    (function probar() {
      if (i >= urls.length) { if (alFallar) alFallar(); return; }
      let hecho = false;
      const sig = function () { if (hecho) return; hecho = true; clearTimeout(t); probar(); };
      const t = setTimeout(sig, 9000);
      const prueba = new Image(); prueba.referrerPolicy = 'no-referrer';
      prueba.onerror = sig;
      prueba.onload = function () {
        if (hecho) return;
        if (prueba.naturalWidth < 2) { sig(); return; }
        hecho = true; clearTimeout(t); img.src = prueba.src; if (alCargar) alCargar(img);
      };
      prueba.src = urls[i++];
    })();
  };
  /** Links posibles de una imagen de Drive (del más liviano al original). */
  RC.urlsDrive = function (url, ancho) {
    const id = idDrive(url), l = [];
    if (id) { l.push('https://lh3.googleusercontent.com/d/' + id + '=w' + ancho); l.push('https://drive.google.com/thumbnail?id=' + id + '&sz=w' + ancho); }
    if (url) l.push(url);
    return l;
  };
  RC.copiar = async function (texto) {
    try { await navigator.clipboard.writeText(texto); return true; }
    catch (e) {
      const t = h('textarea', { style: { position: 'fixed', opacity: '0' } }); t.value = texto; document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (x) { } t.remove(); return ok;
    }
  };
  RC.compartirTexto = async function (titulo, texto, url) {
    const datos = { title: titulo, text: texto }; if (url) datos.url = url;
    if (navigator.share) {
      try { await navigator.share(datos); return 'compartido'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelado'; }
    }
    const ok = await RC.copiar(texto + (url ? '\n' + url : ''));
    RC.aviso(ok ? 'Copiado al portapapeles' : 'No se pudo compartir', ok ? 'ok' : 'mal');
    return ok ? 'copiado' : 'error';
  };

  /** Entrada escalonada de tarjetas (ItemEntranceAnimator.kt). */
  RC.entrada = function (nodos, desde) {
    Array.prototype.forEach.call(nodos, function (n, i) {
      n.classList.remove('rc-ent'); void n.offsetWidth;
      n.style.setProperty('--i', Math.min(i + (desde || 0), 6)); n.classList.add('rc-ent');
    });
  };

  // ─────────────────────────── capas: velo, modal, hoja, popup ───────────────────────────
  RC.velo = function (clase, contenido, alCerrar) {
    const root = RC.$('#recreo');
    const v = h('div', { class: 'rc-velo ' + clase }, contenido);
    const cerrar = function () { if (!v.isConnected) return; v.remove(); document.removeEventListener('keydown', esc); if (alCerrar) alCerrar(); };
    const esc = function (e) { if (e.key === 'Escape') cerrar(); };
    v.addEventListener('mousedown', function (e) { if (e.target === v) cerrar(); });
    document.addEventListener('keydown', esc);
    root.appendChild(v);
    return { el: v, cerrar: cerrar };
  };
  RC.modal = function (titulo, cuerpo, botones) {
    const caja = h('div', { class: 'rc-modal', role: 'dialog', 'aria-modal': 'true' }, titulo ? h('h2', { text: titulo }) : null, cuerpo);
    const v = RC.velo('centro', caja);
    if (botones && botones.length) {
      caja.appendChild(h('div', { class: 'botones' }, botones.map(function (b) {
        return h('button', { class: 'rc-btn' + (b.sec ? ' sec' : ''), text: b.texto, onclick: function () { if (!b.fn || b.fn() !== false) v.cerrar(); } });
      })));
    }
    return v;
  };
  RC.hoja = function (titulo, cuerpo) {
    const caja = h('div', { class: 'rc-hoja', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'asa' }), titulo ? h('h2', { text: titulo, style: { marginBottom: '10px', fontSize: '18px', color: 'var(--titulo)' } }) : null, cuerpo);
    return RC.velo('abajo', caja);
  };
  /** Menú emergente anclado a un botón. items: [{texto, icono, fn, activo}] */
  RC.popup = function (ancla, items, ancho) {
    const root = RC.$('#recreo'), r = ancla.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const pop = h('div', { class: 'rc-popup', role: 'menu' }, items.map(function (it) {
      return h('button', { class: it.activo ? 'act' : '', role: 'menuitem', onclick: function () { cerrar(); it.fn(); } },
        it.icono ? h('span', { html: RC.ico(it.icono), style: { display: 'contents' } }) : null, it.texto);
    }));
    if (ancho) pop.style.minWidth = ancho + 'px';
    const velo = h('div', { style: { position: 'absolute', inset: '0', zIndex: '60' }, onmousedown: function () { cerrar(); } });
    function cerrar() { velo.remove(); pop.remove(); }
    root.appendChild(velo); root.appendChild(pop);
    const w = pop.offsetWidth;
    pop.style.top = Math.min(rr.height - pop.offsetHeight - 8, r.bottom - rr.top + 4) + 'px';
    pop.style.left = Math.max(8, Math.min(rr.width - w - 8, r.right - rr.left - w)) + 'px';
    return { cerrar: cerrar };
  };

  // ─────────────────────────── estructura (shell) ───────────────────────────
  const TABS = [
    { id: 'biblia', texto: 'Biblia', icono: 'libro', ruta: '#/biblia' },
    { id: 'devocional', texto: 'Devocional', icono: 'devocional', ruta: '#/devocional' },
    { id: 'videos', texto: 'Videos', icono: 'video', ruta: '#/videos' },
    { id: 'trivia', texto: 'Trivia', icono: 'trivia', ruta: '#/trivia' }
  ];
  let barraTop, zonaMain, navEl, root;
  let salidaVista = null;

  function montarShell() {
    root = RC.$('#recreo');
    root.innerHTML = '';
    barraTop = h('header', { class: 'rc-top', id: 'rc-top' });
    zonaMain = h('main', { class: 'rc-main', id: 'rc-main' });
    navEl = h('nav', { class: 'rc-nav', 'aria-label': 'Secciones' }, TABS.map(function (t) {
      return h('button', { dataset: { tab: t.id }, onclick: function () { if (location.hash !== t.ruta) location.hash = t.ruta; else RC.emitir('tab-repetida', t.id); }, html: RC.ico(t.icono) + '<span>' + t.texto + '</span>' });
    }));
    root.appendChild(h('div', { class: 'rc-sync', id: 'rc-sync' }));
    root.appendChild(barraTop);
    root.appendChild(zonaMain);
    root.appendChild(navEl);
    root.appendChild(h('div', { class: 'rc-avisos', id: 'rc-avisos', 'aria-live': 'polite' }));
    root.appendChild(h('div', { class: 'rc-splash', id: 'rc-splash' }, h('img', { src: 'img/iconos/icon-192.png', alt: '' })));
  }

  /** Configura la barra superior. o: {atras, marca, titulo, clic, derecha:[{id,icono,titulo,fn,clase,badge}]} */
  RC.barra = function (o) {
    barraTop.innerHTML = '';
    if (o.atras) barraTop.appendChild(h('button', { class: 'rc-btn-ico', 'aria-label': 'Volver', html: RC.ico('atras'), onclick: RC.atras }));
    if (o.marca) {
      barraTop.appendChild(h('div', { class: 'rc-marca' }, h('img', { src: 'img/iconos/logo-128.png', alt: '' }), h('strong', { text: D.APP_NOMBRE })));
    } else {
      const t = h('div', { class: 'rc-titulo' + (o.clic ? ' clic' : ''), role: o.clic ? 'button' : null, tabindex: o.clic ? '0' : null },
        h('span', { text: o.titulo || '' }), o.clic ? h('span', { class: 'chev', text: '▾' }) : null,
        h('i', { class: 'rc-spin-mini rc-oculto', id: 'rc-spin-top', 'aria-label': 'Sincronizando' }));
      if (o.clic) { t.addEventListener('click', o.clic); t.addEventListener('keydown', function (e) { if (e.key === 'Enter') o.clic(); }); }
      barraTop.appendChild(t);
    }
    (o.derecha || []).forEach(function (b) {
      if (b.texto) {
        barraTop.appendChild(h('button', { class: 'rc-btn-txt', id: b.id, onclick: function (e) { b.fn(e.currentTarget); }, text: b.texto }));
        return;
      }
      const btn = h('button', { class: 'rc-btn-ico ' + (b.clase || ''), id: b.id, 'aria-label': b.titulo, title: b.titulo, html: RC.ico(b.icono), onclick: function (e) { b.fn(e.currentTarget); } });
      if (b.badge != null) btn.appendChild(h('span', { class: 'rc-badge', text: String(b.badge) }));
      barraTop.appendChild(btn);
    });
  };
  /** Burbuja del ícono de Eventos. n = null/0 oculta. */
  RC.badgeEventos = function (n) {
    RC.novedades = n || 0;
    const b = RC.$('#rc-btn-eventos'); if (!b) return;
    let s = b.querySelector('.rc-badge');
    if (!n) { if (s) s.remove(); return; }
    if (!s) { s = h('span', { class: 'rc-badge' }); b.appendChild(s); s.classList.add('pop'); }
    s.textContent = n > 9 ? '9+' : String(n);
  };
  /** Botones habituales de la barra en pantallas raíz. */
  RC.barraRaiz = function () {
    RC.barra({
      marca: true, derecha: [
        { id: 'rc-btn-eventos', icono: 'eventos', titulo: 'Eventos', fn: function () { location.hash = '#/eventos'; }, badge: RC.novedades ? (RC.novedades > 9 ? '9+' : RC.novedades) : null },
        { id: 'rc-btn-menu', icono: 'menu', titulo: 'Menú', fn: RC.menu }
      ]
    });
  };

  // ─────────────────────────── router ───────────────────────────
  const rutas = [];
  /** RC.ruta(/^biblia$/, { profundidad: 0, tab: 'biblia', padre: '#/biblia' }, function (ctx, ...grupos) {...}) */
  RC.ruta = function (re, opts, vista) { rutas.push({ re: re, o: opts || {}, vista: vista }); };

  let idx = 0, rutaActual = null, pagActual = null, primera = true, versionNav = 0;
  const hooksRuta = [];
  RC.alCambiarRuta = function (f) { hooksRuta.push(f); };

  function esExterna(hash) { return /^#admin/.test(hash) || /^#\/privacidad/.test(hash); }
  /** Cambia de ruta sin añadir al historial (p. ej. pasar de capítulo). dir: 'adelante' | 'atras' | 'fade' */
  RC.reemplazar = function (hash, dir) { RC.soloReemplazo = true; RC.dirForzada = dir || 'fade'; location.replace(hash); };
  RC.atras = function () {
    if (idx > 0) history.back();
    else location.replace(rutaActual && rutaActual.o.padre ? rutaActual.o.padre : '#/biblia');
  };

  function resolver() {
    const h0 = location.hash || '';
    const p = h0.replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '') || 'biblia';
    for (let i = 0; i < rutas.length; i++) {
      const m = rutas[i].re.exec(p);
      if (m) return { r: rutas[i], grupos: m.slice(1), path: p };
    }
    return null;
  }

  function alHash() {
    if (esExterna(location.hash)) { root.hidden = true; return; }
    const eraOculto = root.hidden; root.hidden = false;
    const st = history.state; let dirIdx = 'adelante';
    if (st && typeof st.rc === 'number') { dirIdx = st.rc < idx ? 'atras' : (st.rc > idx ? 'adelante' : 'fade'); idx = st.rc; }
    else if (!primera) { if (!RC.soloReemplazo) idx += 1; history.replaceState({ rc: idx }, ''); }
    else { history.replaceState({ rc: 0 }, ''); idx = 0; }
    const res = resolver();
    if (!res) { location.replace('#/biblia'); return; }
    const mismaPag = rutaActual && rutaActual.path === res.path && !eraOculto;
    if (mismaPag) { RC.soloReemplazo = false; RC.dirForzada = null; return; }
    const prev = rutaActual;
    let dir = 'fade';
    if (!primera && !eraOculto && prev) {
      const dp = res.r.o.profundidad || 0, dq = prev.r.o.profundidad || 0;
      dir = dp > dq ? 'adelante' : (dp < dq ? 'atras' : (dp === 0 ? 'fade' : dirIdx));
    }
    if (RC.dirForzada) { dir = RC.dirForzada; RC.dirForzada = null; }
    RC.soloReemplazo = false;
    montarVista(res, dir, primera || eraOculto);
    primera = false;
  }

  function montarVista(res, dir, sinAnim) {
    const nav = ++versionNav;
    if (salidaVista) { try { salidaVista(); } catch (e) { console.error(e); } salidaVista = null; }
    document.title = D.APP_NOMBRE;
    const vieja = pagActual;
    const raiz = (res.r.o.profundidad || 0) === 0;
    const pag = h('section', { class: 'rc-page ' + (raiz ? 'con-nav' : 'sin-nav') + (sinAnim ? '' : ' rc-in-' + (dir === 'adelante' ? 'der' : dir === 'atras' ? 'izq' : 'fade')) });
    zonaMain.appendChild(pag);
    if (vieja) { vieja.classList.add('rc-out'); setTimeout(function () { vieja.remove(); }, 230); }
    pagActual = pag; rutaActual = res;
    navEl.classList.toggle('fuera', !raiz && !res.r.o.nav);
    Array.prototype.forEach.call(navEl.children, function (b) { b.classList.toggle('act', b.dataset.tab === res.r.o.tab); b.setAttribute('aria-current', b.dataset.tab === res.r.o.tab ? 'page' : 'false'); });
    RC.sync.detener(); RC.sync.spinner(false);
    const ctx = { pagina: pag, barra: RC.barra, sync: RC.sync, raiz: raiz, alSalir: function (f) { salidaVista = f; }, vigente: function () { return nav === versionNav; } };
    try {
      const r = res.r.vista.apply(null, [ctx].concat(res.grupos));
      if (r && typeof r.then === 'function') r.catch(function (e) { console.error(e); });
    } catch (e) { console.error(e); pag.appendChild(h('div', { class: 'rc-vacio', text: 'Algo salió mal al abrir esta pantalla.' })); }
    hooksRuta.forEach(function (f) { try { f(res); } catch (e) { console.error(e); } });
  }
  RC.rutaActual = function () { return rutaActual; };
  RC.ocultarSplash = function () { const s = RC.$('#rc-splash'); if (s) { s.classList.add('fuera'); setTimeout(function () { s.remove(); }, 400); } };

  // ─────────────────────────── menú lateral ───────────────────────────
  RC.menu = function () {
    const nS = RC.notif ? RC.notif.estado() : 'no-soportado';
    const tile = function (icono, texto, color, ruta, activo) {
      return h('button', { class: 'rc-tile' + (activo ? ' on' : ''), onclick: function () { v.cerrar(); location.hash = ruta; } },
        h('span', { class: 'ic', style: { background: color }, html: RC.ico(icono) }), texto);
    };
    const fila = function (texto, sub, fn, sw) {
      return h('button', { class: 'rc-fila-menu', onclick: fn }, h('span', null, texto, sub ? h('small', { text: sub }) : null), sw != null ? h('i', { class: 'rc-sw' + (sw ? ' on' : '') }) : null);
    };
    const filas = [];
    filas.push(fila('Sobre nuestra iglesia', null, function () { v.cerrar(); location.hash = '#/acerca'; }));
    filas.push(fila('Compartir app', null, function () { v.cerrar(); RC.compartirApp(); }));
    filas.push(fila(tema.actual() === 'oscuro' ? 'Modo claro' : 'Modo oscuro', null, function () { tema.alternar(); v.cerrar(); }));
    if (nS !== 'no-soportado') {
      const sub = nS === 'bloqueadas' ? 'Bloqueadas en el navegador: actívalas en los ajustes del sitio' : (nS === 'activas' ? 'Recordatorios de servicios, palabra del día y eventos' : 'Recordatorios de servicios, palabra del día y eventos');
      filas.push(fila('Notificaciones', sub, async function (e) {
        const sw = e.currentTarget.querySelector('.rc-sw');
        if (RC.notif.estado() === 'activas') { RC.notif.desactivar(); sw.classList.remove('on'); RC.aviso('Notificaciones desactivadas'); }
        else { const ok = await RC.notif.activar(); sw.classList.toggle('on', ok); }
      }, nS === 'activas'));
    }
    if (RC.puedeInstalar && RC.puedeInstalar()) filas.push(fila('Instalar la app', 'Ábrela como una app, sin el navegador', function () { v.cerrar(); RC.instalar(); }));
    filas.push(fila('Descargar en Google Play', null, function () { v.cerrar(); window.open(D.PLAY_STORE, '_blank', 'noopener'); }));
    filas.push(fila('Política de privacidad', null, function () { v.cerrar(); location.hash = '#/privacidad'; }));
    const radioOn = RC.radio && RC.radio.suena();
    const drawer = h('aside', { class: 'rc-drawer', role: 'dialog', 'aria-label': 'Menú' },
      h('h2', { text: 'Menú' }),
      h('div', { class: 'rc-tiles' },
        tile('peticiones', 'Peticiones', '#FF6B7A', '#/peticiones'),
        tile('escuela', 'Escuela', '#4AA8FF', '#/escuela'),
        tile('donar', 'Donaciones', '#34D6B8', '#/donaciones'),
        tile('radio', 'Radio', '#9b7bff', '#/radio', radioOn)),
      filas);
    const v = RC.velo('der', drawer);
  };
  RC.compartirApp = function () {
    return RC.compartirTexto(D.APP_NOMBRE, 'Centro Cristiano el Recreo: Biblia, devocional, videos, radio y más.', location.origin + location.pathname);
  };

  // Instalar como app (PWA)
  let eventoInstalar = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); eventoInstalar = e; });
  window.addEventListener('appinstalled', function () { eventoInstalar = null; RC.aviso('¡App instalada!', 'ok'); });
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esStandalone = function () { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; };
  RC.esStandalone = esStandalone; RC.esIOS = esIOS;
  RC.puedeInstalar = function () { return !esStandalone() && (!!eventoInstalar || esIOS); };
  RC.instalar = async function () {
    if (eventoInstalar) { eventoInstalar.prompt(); try { await eventoInstalar.userChoice; } catch (e) { } eventoInstalar = null; return; }
    if (esIOS) RC.modal('Instalar en iPhone / iPad', h('p', { text: 'Toca el botón Compartir de Safari y elige «Añadir a pantalla de inicio». Así podrás recibir notificaciones y abrir la app a pantalla completa.' }), [{ texto: 'Entendido' }]);
  };

  // ─────────────────────────── arranque ───────────────────────────
  RC.iniciar = function () {
    tema.iniciar();
    montarShell();
    window.addEventListener('hashchange', alHash);
    alHash();
    setTimeout(RC.ocultarSplash, 650);
    if (RC.notif && RC.notif.iniciar) RC.notif.iniciar();
  };
})();
