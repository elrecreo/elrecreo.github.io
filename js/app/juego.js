/* Trivia bíblica: registro, 3 dificultades, 10 preguntas locales, cronómetro global de 60 s,
   puntaje (misma fórmula de la app) y ranking guardado en el Apps Script.
   Estilo visual tomado de la app: botones con relieve, degradados y tarjetas con sombra desplazada. */
(function () {
  'use strict';
  const RC = window.RC, h = RC.h;
  const TOTAL_MS = 60000, CIRC = 2 * Math.PI * 40;
  const DIFS = {
    facil: { nombre: 'Fácil', clase: 'f', estrellas: '★', desc: 'Para empezar', color: '#1d9a63' },
    medio: { nombre: 'Medio', clase: 'm', estrellas: '★★', desc: 'Un reto mayor', color: '#e08a1e' },
    dificil: { nombre: 'Difícil', clase: 'd', estrellas: '★★★', desc: 'Solo para expertos', color: '#d64557' }
  };
  let preguntasCache = null;

  function cargarPreguntas() {
    if (!preguntasCache) preguntasCache = fetch('data/preguntas.json').then(function (r) { if (!r.ok) throw new Error('No se pudieron cargar las preguntas'); return r.json(); });
    preguntasCache.catch(function () { preguntasCache = null; });
    return preguntasCache;
  }
  async function preguntasDe(dificultad) {
    const todas = (await cargarPreguntas()).filter(function (p) { return p.dificultad === dificultad; });
    return RC.barajar(todas).slice(0, 10).map(function (p) {
      return { id: p.id, pregunta: p.pregunta, correcta: p.correcta, opciones: RC.barajar([p.correcta, p.opcion_b, p.opcion_c, p.opcion_d]) };
    });
  }
  /** Misma fórmula de JuegoViewModel.calcularYGuardarPuntaje */
  function puntaje(respondidas, correctas, usadoMs) {
    const R = Math.max(1, respondidas), C = correctas;
    const t = Math.max(0, Math.min(TOTAL_MS, usadoMs));
    const precision = C / R, avance = Math.max(0, Math.min(1, R / 10)), rapidez = 1 - t / TOTAL_MS;
    const base = 800 * Math.pow(precision, 1.35) * Math.pow(avance, 0.8);
    const bonus = 200 * precision * avance * Math.pow(rapidez, 0.7);
    return Math.max(0, Math.min(1000, Math.floor(base + bonus)));
  }
  const jugador = function () { return RC.leer('jugador', null); };
  function parseLista(arr, campo) { return (arr || []).map(function (o) { return { nombre: o.nombre || '-', puntaje: parseInt(o[campo], 10) || 0 }; }); }
  async function obtenerRanking() {
    const r = await RC.api('obtener_ranking');
    return { facil: parseLista(r.top_facil, 'p_facil'), medio: parseLista(r.top_medio, 'p_medio'), dificil: parseLista(r.top_dificil, 'p_dificil') };
  }
  const audio = (function () { let a = null; return { pin: function () { try { if (!a) a = new Audio('sonidos/pin.mp3'); a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(function () { }); } catch (e) { } } }; })();
  const esYo = function (nombre) { const j = jugador(); return !!j && RC.norm(j.nombre) === RC.norm(nombre); };
  const logo = function () { return h('div', { class: 'rc-tr-logo' }, h('img', { src: 'img/iconos/icon-192.png', alt: '' })); };
  const NS = 'http://www.w3.org/2000/svg';
  function circulo(attrs) { const c = document.createElementNS(NS, 'circle'); Object.keys(attrs).forEach(function (k) { c.setAttribute(k, attrs[k]); }); return c; }

  // ═══════════════════ Pantalla principal de trivia ═══════════════════
  RC.ruta(/^trivia$/, { profundidad: 0, tab: 'trivia' }, function (ctx) {
    RC.barraRaiz();
    const pag = ctx.pagina;
    const cont = h('div', { class: 'rc-trivia' });
    pag.appendChild(cont);
    let ranking = null, timer = null, raf = null;
    ctx.alSalir(function () { clearInterval(timer); cancelAnimationFrame(raf); });
    function mostrar() { cont.innerHTML = ''; Array.prototype.forEach.call(arguments, function (n) { cont.appendChild(n); }); pag.scrollTo(0, 0); }

    // ── verificando ──
    function verificando() { mostrar(logo(), h('div', { class: 'rc-cargando', style: { padding: '24px 0' } }, h('div', { class: 'rc-spin' }))); }

    // ── registro ──
    function registro() {
      const nombre = h('input', { class: 'rc-input', id: 'tr-nombre', placeholder: 'Nombre', autocomplete: 'given-name', maxlength: '40', 'aria-label': 'Nombre' });
      const apellido = h('input', { class: 'rc-input', id: 'tr-apellido', placeholder: 'Apellido', autocomplete: 'family-name', maxlength: '40', 'aria-label': 'Apellido' });
      const err = h('div', { style: { color: 'var(--mal)', fontSize: '12.8px', minHeight: '18px' }, role: 'alert' });
      const btn = h('button', { class: 'rc-tbtn', text: 'COMENZAR' });
      const hacer = async function () {
        const n = nombre.value.trim(), a = apellido.value.trim();
        if (!n || !a) { err.textContent = 'Ingresa nombre y apellido'; return; }
        err.textContent = ''; btn.disabled = true; btn.textContent = 'Registrando…';
        const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('j' + Date.now() + Math.random().toString(16).slice(2));
        try {
          await RC.api('registrar', { id: id, nombre: n, apellido: a });
          RC.guardar('jugador', { id: id, nombre: n + ' ' + a });
          dificultad(); cargarRanking();
        } catch (e) { err.textContent = e.red ? 'Sin conexión. Revisa tu internet e inténtalo de nuevo.' : (e.message || 'No se pudo registrar'); btn.disabled = false; btn.textContent = 'COMENZAR'; }
      };
      btn.addEventListener('click', hacer);
      apellido.addEventListener('keydown', function (e) { if (e.key === 'Enter') hacer(); });
      mostrar(logo(), h('h1', { text: '¿Cómo te llamas?' }), h('p', { class: 'rc-sub', text: 'Juega, suma puntos y sube en el ranking' }), h('div', { class: 'form' }, nombre, apellido, err, btn));
    }

    // ── dificultad ──
    function dificultad() {
      const j = jugador(); const primer = j ? j.nombre.split(' ')[0] : '';
      const bt = function (clave) {
        const d = DIFS[clave];
        const b = h('button', { class: d.clase, 'data-dif': clave, 'aria-label': 'Dificultad ' + d.nombre },
          h('span', { style: { position: 'relative', zIndex: '1' } }, h('b', { text: d.nombre }), h('small', { text: d.desc + ' · 10 preguntas' })),
          h('span', { class: 'est', text: d.estrellas }), h('i', { class: 'esp' }));
        b.addEventListener('click', function () {
          cont.querySelectorAll('.rc-dif button').forEach(function (x) { x.disabled = true; }); b.classList.add('cargando');
          iniciar(clave).catch(function (e) { RC.aviso(e.message || 'No se pudo iniciar', 'mal'); dificultad(); });
        });
        return b;
      };
      mostrar(logo(), h('h1', { class: 'az', text: '¡Hola, ' + primer + '!' }), h('p', { class: 'rc-sub', text: 'Elige la dificultad · tienes 60 segundos' }),
        h('div', { class: 'rc-dif' }, bt('facil'), bt('medio'), bt('dificil')),
        h('div', { class: 'rc-h-sec', text: 'MEJORES PUNTAJES' }),
        h('div', { class: 'rc-mini-rank', id: 'tr-mini' }),
        h('button', { class: 'rc-tbtn sec', text: 'VER RANKING COMPLETO', onclick: function () { location.hash = '#/ranking'; } }));
      pintarMini();
      if (!ranking) cargarRanking();
    }
    function pintarMini() {
      const box = RC.$('#tr-mini'); if (!box) return;
      box.innerHTML = '';
      ['facil', 'medio', 'dificil'].forEach(function (k) {
        const col = h('div', { class: 'col' }, h('h3', { text: DIFS[k].nombre.toUpperCase(), style: { color: DIFS[k].color } }));
        for (let i = 0; i < 3; i++) {
          const j = ranking && ranking[k][i];
          col.appendChild(j ? h('div', { class: 'it' }, j.nombre.split(' ')[0], h('small', { text: j.puntaje + ' pts' })) : h('div', { class: 'it vacio', text: '—' }));
        }
        box.appendChild(col);
      });
    }
    async function cargarRanking() {
      try { ranking = await obtenerRanking(); if (ctx.vigente()) pintarMini(); return ranking; } catch (e) { return null; /* el ranking falla en silencio */ }
    }

    // ── juego ──
    async function iniciar(dif) {
      const preguntas = await preguntasDe(dif);
      if (!preguntas.length) throw new Error('No hay preguntas disponibles');
      let idx = 0, correctas = 0, bloqueada = false;
      const t0 = Date.now();

      // HUD: pregunta · anillo de tiempo · aciertos
      const numP = h('b'), numA = h('b', { text: '0' });
      const num = h('div', { class: 'num', 'aria-hidden': 'true' });
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 100 100');
      const prog = circulo({ class: 'prog', cx: 50, cy: 50, r: 40, 'stroke-dasharray': CIRC, 'stroke-dashoffset': 0 });
      svg.appendChild(circulo({ class: 'fondo', cx: 50, cy: 50, r: 40 })); svg.appendChild(prog);
      const anillo = h('div', { class: 'rc-anillo', role: 'timer', 'aria-label': 'Tiempo restante' }, svg, num);
      const hud = h('div', { class: 'rc-hud' }, h('div', { class: 'lado' }, 'PREGUNTA', numP), anillo, h('div', { class: 'lado' }, 'ACIERTOS', numA));
      const puntitos = h('div', { class: 'rc-puntitos', 'aria-hidden': 'true' });
      const dots = preguntas.map(function () { const i = h('i'); puntitos.appendChild(i); return i; });
      const zona = h('div');
      mostrar(h('div', { class: 'rc-partida' }, hud, puntitos, zona));

      function tick() {
        const rest = Math.max(0, TOTAL_MS - (Date.now() - t0)), frac = rest / TOTAL_MS;
        num.textContent = Math.ceil(rest / 1000);
        prog.setAttribute('stroke-dashoffset', String(CIRC * (1 - frac)));
        prog.style.stroke = rest > 30000 ? 'var(--prim)' : rest > 15000 ? 'var(--acento)' : 'var(--rojo)';
        anillo.classList.toggle('urge', rest <= 10000 && rest > 0);
        if (rest <= 0) { clearInterval(timer); terminar(idx, TOTAL_MS); }
      }
      function pintar() {
        const p = preguntas[idx]; bloqueada = false;
        numP.textContent = (idx + 1) + '/' + preguntas.length;
        dots.forEach(function (d, i) { d.classList.toggle('act', i === idx); });
        const ops = h('div', { class: 'rc-opciones' });
        const tarjeta = h('div', { class: 'rc-tarjeta-p', 'aria-live': 'polite' }, h('div', { class: 'marca', text: String(idx + 1) }), h('div', { class: 'q', text: p.pregunta }));
        p.opciones.forEach(function (o, k) {
          const b = h('button', { class: 'rc-op' }, h('span', { class: 'let', text: 'ABCD'[k] }), h('span', { class: 'tx', text: o }));
          b.addEventListener('click', function () {
            if (bloqueada) return; bloqueada = true; audio.pin();
            const ok = o === p.correcta; if (ok) { correctas++; numA.textContent = String(correctas); }
            b.classList.add(ok ? 'bien' : 'mal');
            dots[idx].classList.remove('act'); dots[idx].classList.add(ok ? 'ok' : 'no');
            ops.querySelectorAll('button').forEach(function (x) { x.disabled = true; if (!ok && x !== b && x.querySelector('.tx').textContent === p.correcta) x.classList.add('revela'); });
            if (ok) tarjeta.appendChild(h('div', { class: 'rc-flota', text: '✓' }));
            else if (navigator.vibrate) { try { navigator.vibrate(120); } catch (e) { } }
            setTimeout(function () {
              if (!ctx.vigente()) return;
              idx++;
              if (idx < preguntas.length) pintar();
              else { clearInterval(timer); terminar(preguntas.length, Date.now() - t0); }
            }, ok ? 480 : 950);
          });
          ops.appendChild(b);
        });
        zona.innerHTML = ''; zona.appendChild(tarjeta); zona.appendChild(ops);
      }
      function terminar(respondidas, usado) {
        if (!ctx.vigente()) return;
        const pts = puntaje(respondidas, correctas, usado);
        resultado({ pts: pts, dif: dif, correctas: correctas, respondidas: respondidas, usado: usado });
        const j = jugador();
        if (j) {
          RC.api('sumar_puntaje', { id: j.id, puntaje: pts, dificultad: dif })
            .then(cargarRanking).then(function (r) { if (r && ctx.vigente()) anunciarLugar(r, dif, pts); })
            .catch(function () { RC.aviso('Tu puntaje no se pudo guardar en el ranking (sin conexión).', 'mal', 3600); });
        }
      }
      pintar(); tick(); clearInterval(timer); timer = setInterval(tick, 100);
    }

    // ── resultado ──
    function resultado(r) {
      const pts = r.pts, n = pts >= 800 ? 3 : pts >= 500 ? 2 : pts >= 200 ? 1 : 0;
      const msg = pts >= 800 ? '¡Excelente!' : pts >= 500 ? '¡Muy bien!' : pts >= 200 ? '¡Buen intento!' : '¡Sigue practicando!';
      const cifra = h('div', { class: 'rc-puntos', text: '0' });
      const confeti = h('div', { class: 'rc-confeti', 'aria-hidden': 'true' });
      if (pts >= 500) {
        const cols = ['#4AA8FF', '#34D6B8', '#FF6B7A', '#FFB400', '#9b7bff'];
        for (let i = 0; i < 46; i++) {
          const c = h('i'); c.style.left = (Math.random() * 100) + '%'; c.style.background = cols[i % cols.length];
          c.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px'); c.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
          c.style.animationDelay = (Math.random() * .5) + 's'; c.style.animationDuration = (1.8 + Math.random() * 1.2) + 's'; confeti.appendChild(c);
        }
      }
      const seg = Math.round(r.usado / 100) / 10;
      mostrar(h('div', { class: 'rc-res' }, confeti,
        h('img', { src: 'img/nav/juegos.png', alt: '', width: 76, height: 76, style: { margin: '8px auto 0', animation: 'rc-pop .6s cubic-bezier(.3,1.6,.5,1)' } }),
        h('div', { class: 'rc-estrellas', 'aria-label': n + ' de 3 estrellas' }, [0, 1, 2].map(function (i) { return h('span', { class: i < n ? 'on' : '', text: '★' }); })),
        cifra, h('p', { class: 'rc-sub', text: 'PUNTOS' }), h('div', { class: 'rc-mensaje', text: msg }),
        h('div', { class: 'rc-stats' },
          h('div', null, h('b', { text: r.correctas + '/' + r.respondidas }), h('small', { text: 'ACIERTOS' })),
          h('div', null, h('b', { text: seg + ' s' }), h('small', { text: 'TIEMPO' })),
          h('div', null, h('b', { text: DIFS[r.dif].nombre, style: { color: DIFS[r.dif].color } }), h('small', { text: 'MODO' }))),
        h('div', { id: 'tr-lugar' }),
        h('div', { class: 'rc-acciones-col' },
          h('button', { class: 'rc-tbtn', text: 'JUGAR OTRA VEZ', onclick: function () { dificultad(); cargarRanking(); } }),
          h('button', { class: 'rc-tbtn sec', text: 'VER RANKING', onclick: function () { location.hash = '#/ranking'; } }))));
      // contador animado
      const ini = performance.now(), dur = Math.min(1400, 400 + pts * 1.2);
      (function paso(t) { const f = Math.min(1, (t - ini) / dur), e = 1 - Math.pow(1 - f, 3); cifra.textContent = String(Math.round(pts * e)); if (f < 1 && ctx.vigente()) raf = requestAnimationFrame(paso); })(ini);
    }
    function anunciarLugar(r, dif, pts) {
      const lista = r[dif], j = jugador(), caja = RC.$('#tr-lugar'); if (!caja || !j) return;
      const i = lista.findIndex(function (x) { return esYo(x.nombre) && x.puntaje >= pts; });
      if (i >= 0) caja.appendChild(h('div', { class: 'rc-lugar', text: i === 0 ? '¡Eres el número 1 en ' + DIFS[dif].nombre + '!' : 'Estás en el puesto ' + (i + 1) + ' del ranking ' + DIFS[dif].nombre }));
    }

    // ── arranque: ¿ya está registrado? ──
    const j = jugador();
    if (!j) registro();
    else {
      verificando();
      RC.api('obtener_jugador', { id: j.id }).catch(function () { })
        .then(function () { return obtenerRanking().then(function (r) { ranking = r; }).catch(function () { }); })
        .then(function () { if (ctx.vigente()) dificultad(); });
    }
  });

  // ═══════════════════ Ranking completo (pestañas + podio) ═══════════════════
  RC.ruta(/^ranking$/, { profundidad: 1, tab: 'trivia', padre: '#/trivia' }, function (ctx) {
    RC.barra({ atras: true, titulo: 'Ranking', derecha: [] });
    const cont = h('div', { class: 'rc-trivia', style: { textAlign: 'left' } }, h('div', { class: 'rc-cargando' }, h('div', { class: 'rc-spin' })));
    ctx.pagina.appendChild(cont);
    let datos = null, actual = 'facil';
    function pintar() {
      cont.innerHTML = '';
      cont.appendChild(h('div', { class: 'rc-tabs', role: 'tablist' }, ['facil', 'medio', 'dificil'].map(function (k) {
        return h('button', { class: k === actual ? 'act' : '', role: 'tab', 'data-d': k, 'aria-selected': k === actual ? 'true' : 'false', text: DIFS[k].nombre.toUpperCase(), onclick: function () { actual = k; pintar(); } });
      })));
      const lista = datos[actual];
      if (!lista.length) { cont.appendChild(h('div', { class: 'rc-vacio', text: 'Aún no hay puntajes en este nivel.\n¡Sé el primero!' })); return; }
      cont.appendChild(h('div', { class: 'rc-podio' }, [1, 0, 2].map(function (i) {   // 2º · 1º · 3º
        const x = lista[i];
        return h('div', { class: 'pl p' + (i + 1) + (x ? '' : ' vacio') },
          h('div', { class: 'nm', text: x ? x.nombre : '—', style: x && esYo(x.nombre) ? { color: 'var(--prim)' } : null }),
          h('div', { class: 'pt', text: x ? x.puntaje + ' pts' : '' }), h('div', { class: 'base', text: String(i + 1) }));
      })));
      if (lista.length > 3) {
        const tabla = h('div', { class: 'rc-tabla' });
        lista.slice(3).forEach(function (x, i) { tabla.appendChild(h('div', { class: 'rc-fila-rank' + (esYo(x.nombre) ? ' yo' : '') }, h('span', { class: 'pos', text: String(i + 4) }), h('span', { class: 'nom', text: x.nombre }), h('span', { class: 'pts', text: x.puntaje + ' pts' }))); });
        cont.appendChild(tabla);
      }
    }
    obtenerRanking().then(function (r) { if (!ctx.vigente()) return; datos = r; pintar(); }).catch(function (e) {
      if (!ctx.vigente()) return;
      cont.innerHTML = ''; cont.appendChild(h('div', { class: 'rc-vacio', text: e.red ? 'Sin conexión.\nConéctate a internet para ver el ranking.' : 'No se pudo cargar el ranking.' }));
    });
  });
})();
