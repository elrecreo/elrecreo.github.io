/* Trivia bíblica: registro, 3 dificultades, 10 preguntas locales, cronómetro global de 60 s,
   puntaje (misma fórmula de la app) y ranking guardado en el Apps Script. */
(function () {
  'use strict';
  const RC = window.RC, h = RC.h;
  const TOTAL_MS = 60000;
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

  // ═══════════════════ Pantalla principal de trivia ═══════════════════
  RC.ruta(/^trivia$/, { profundidad: 0, tab: 'trivia' }, function (ctx) {
    RC.barraRaiz();
    const pag = ctx.pagina;
    const cont = h('div', { class: 'rc-trivia' });
    pag.appendChild(cont);
    let ranking = null, timer = null, partidas = 0;
    ctx.alSalir(function () { clearInterval(timer); });

    function logo() { return h('img', { class: 'logo', src: 'img/iconos/icon-192.png', alt: '' }); }
    function mostrar() { cont.innerHTML = ''; Array.prototype.forEach.call(arguments, function (n) { cont.appendChild(n); }); pag.scrollTo(0, 0); }

    // ── verificando ──
    function verificando() { mostrar(logo(), h('div', { class: 'rc-cargando', style: { padding: '24px 0' } }, h('div', { class: 'rc-spin' }))); }

    // ── registro ──
    function registro() {
      const nombre = h('input', { class: 'rc-input', id: 'tr-nombre', placeholder: 'Nombre', autocomplete: 'given-name', maxlength: '40', 'aria-label': 'Nombre' });
      const apellido = h('input', { class: 'rc-input', id: 'tr-apellido', placeholder: 'Apellido', autocomplete: 'family-name', maxlength: '40', 'aria-label': 'Apellido' });
      const err = h('div', { style: { color: 'var(--mal)', fontSize: '13px', minHeight: '18px' }, role: 'alert' });
      const btn = h('button', { class: 'rc-btn ancho', text: 'COMENZAR' });
      const hacer = async function () {
        const n = nombre.value.trim(), a = apellido.value.trim();
        if (!n || !a) { err.textContent = 'Ingresa nombre y apellido'; return; }
        err.textContent = ''; btn.disabled = true; btn.textContent = 'Registrando…';
        const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('j' + Date.now() + Math.random().toString(16).slice(2));
        try {
          await RC.api('registrar', { id: id, nombre: n, apellido: a });
          RC.guardar('jugador', { id: id, nombre: n + ' ' + a });
          partidas = 0; dificultad(); cargarRanking();
        } catch (e) { err.textContent = e.red ? 'Sin conexión. Revisa tu internet e inténtalo de nuevo.' : (e.message || 'No se pudo registrar'); btn.disabled = false; btn.textContent = 'COMENZAR'; }
      };
      btn.addEventListener('click', hacer);
      apellido.addEventListener('keydown', function (e) { if (e.key === 'Enter') hacer(); });
      mostrar(logo(), h('h1', { text: '¿Cómo te llamas?' }), h('div', { class: 'form' }, nombre, apellido, err, btn));
    }

    // ── dificultad ──
    function dificultad() {
      const j = jugador(); const primer = j ? j.nombre.split(' ')[0] : '';
      const bt = function (clase, texto, dif) {
        const b = h('button', { class: clase, 'data-dif': dif }, h('span', { text: texto }), h('i', { class: 'esp' }));
        b.addEventListener('click', function () { cont.querySelectorAll('.rc-dif button').forEach(function (x) { x.disabled = true; }); b.classList.add('cargando'); iniciar(dif).catch(function (e) { RC.aviso(e.message || 'No se pudo iniciar', 'mal'); dificultad(); }); });
        return b;
      };
      const rankBox = h('div', { class: 'rc-mini-rank', id: 'tr-mini' });
      mostrar(logo(), h('h1', { class: 'az', text: '¡Hola, ' + primer + '!' }), h('p', { class: 'rc-sub', text: 'Elige la dificultad' }),
        h('div', { class: 'rc-dif' }, bt('f', 'Fácil', 'facil'), bt('m', 'Medio', 'medio'), bt('d', 'Difícil', 'dificil')),
        rankBox,
        h('div', { class: 'rc-acciones-col', style: { marginTop: '4px' } }, h('button', { class: 'rc-btn sec', text: 'VER RANKING', onclick: function () { location.hash = '#/ranking'; } })));
      pintarMini();
      if (!ranking) cargarRanking();
    }
    function pintarMini() {
      const box = RC.$('#tr-mini'); if (!box) return;
      box.innerHTML = '';
      [['FÁCIL', 'facil', '#1d9a63'], ['MEDIO', 'medio', '#e08a1e'], ['DIFÍCIL', 'dificil', '#d64557']].forEach(function (c) {
        const col = h('div', { class: 'col' }, h('h3', { text: c[0], style: { color: c[2] } }));
        const medallas = ['🥇', '🥈', '🥉'];
        for (let i = 0; i < 3; i++) {
          const j = ranking && ranking[c[1]][i];
          col.appendChild(h('div', { class: 'it' }, medallas[i] + ' ', j ? [j.nombre.split(' ')[0], h('small', { text: j.puntaje + ' pts' })] : '-'));
        }
        box.appendChild(col);
      });
    }
    async function cargarRanking() {
      try { ranking = await obtenerRanking(); if (ctx.vigente()) pintarMini(); } catch (e) { /* el ranking falla en silencio */ }
    }

    // ── juego ──
    async function iniciar(dif) {
      const preguntas = await preguntasDe(dif);
      if (!preguntas.length) throw new Error('No hay preguntas disponibles');
      let idx = 0, correctas = 0, bloqueada = false;
      const t0 = Date.now();
      const crono = h('div', { class: 'rc-cron', 'aria-live': 'off' });
      const barra = h('i'); const marco = h('div', { class: 'rc-barra-t', role: 'progressbar', 'aria-label': 'Tiempo restante' }, barra);
      const contador = h('div', { class: 'rc-contador' });
      const pregunta = h('div', { class: 'rc-pregunta', 'aria-live': 'polite' });
      const ops = h('div', { class: 'rc-opciones' });
      mostrar(crono, marco, contador, pregunta, ops);

      function tick() {
        const rest = Math.max(0, TOTAL_MS - (Date.now() - t0));
        crono.textContent = (rest / 1000).toFixed(1);
        barra.style.transform = 'scaleX(' + (rest / TOTAL_MS) + ')';
        crono.style.color = rest > 30000 ? 'var(--prim)' : rest > 15000 ? 'var(--acento)' : 'var(--rojo)';
        if (rest <= 0) { clearInterval(timer); terminar(idx, TOTAL_MS); }
      }
      function pintar() {
        const p = preguntas[idx]; bloqueada = false;
        contador.textContent = 'PREGUNTA ' + (idx + 1) + ' DE ' + preguntas.length;
        pregunta.textContent = p.pregunta; pregunta.style.animation = 'none'; void pregunta.offsetWidth; pregunta.style.animation = '';
        ops.innerHTML = '';
        p.opciones.forEach(function (o) {
          const b = h('button', { class: 'rc-op', text: o });
          b.addEventListener('click', function () {
            if (bloqueada) return; bloqueada = true; audio.pin();
            const ok = o === p.correcta; if (ok) correctas++;
            b.classList.add(ok ? 'bien' : 'mal');
            ops.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
            setTimeout(function () {
              if (!ctx.vigente()) return;
              idx++;
              if (idx < preguntas.length) pintar();
              else { clearInterval(timer); terminar(preguntas.length, Date.now() - t0); }
            }, 350);
          });
          ops.appendChild(b);
        });
      }
      function terminar(respondidas, usado) {
        if (!ctx.vigente()) return;
        const pts = puntaje(respondidas, correctas, usado);
        partidas++;
        resultado(pts, dif);
        const j = jugador();
        if (j) RC.api('sumar_puntaje', { id: j.id, puntaje: pts, dificultad: dif }).then(cargarRanking).catch(function () { RC.aviso('Tu puntaje no se pudo guardar en el ranking (sin conexión).', 'mal', 3600); });
      }
      pintar(); tick(); clearInterval(timer); timer = setInterval(tick, 100);
    }

    // ── resultado ──
    function resultado(pts, dif) {
      const etiq = { facil: 'Modo FÁCIL', medio: 'Modo MEDIO', dificil: 'Modo DIFÍCIL' }[dif] || '';
      mostrar(logo(), h('h1', { class: 'az', text: '¡Terminaste!' }), h('div', { class: 'rc-puntos', text: String(pts) }),
        h('p', { class: 'rc-sub', text: 'puntos esta partida' }), h('p', { style: { fontWeight: '800', color: 'var(--rojo)', letterSpacing: '.08em' }, text: etiq.toUpperCase() }),
        h('div', { class: 'rc-acciones-col' },
          h('button', { class: 'rc-btn', text: 'JUGAR OTRA VEZ', onclick: function () { dificultad(); cargarRanking(); } }),
          h('button', { class: 'rc-btn sec', text: 'VER RANKING', onclick: function () { location.hash = '#/ranking'; } })));
    }

    // ── arranque: ¿ya está registrado? ──
    const j = jugador();
    if (!j) registro();
    else {
      verificando();
      RC.api('obtener_jugador', { id: j.id }).then(function (r) { partidas = parseInt(r.partidas, 10) || 0; }).catch(function () { })
        .then(function () { return obtenerRanking().then(function (r) { ranking = r; }).catch(function () { }); })
        .then(function () { if (ctx.vigente()) dificultad(); });
    }
  });

  // ═══════════════════ Ranking completo ═══════════════════
  RC.ruta(/^ranking$/, { profundidad: 1, tab: 'trivia', padre: '#/trivia' }, function (ctx) {
    RC.barra({ atras: true, titulo: 'Ranking', derecha: [] });
    const cont = h('div', { class: 'rc-trivia', style: { textAlign: 'left' } }, h('div', { class: 'rc-cargando' }, h('div', { class: 'rc-spin' })));
    ctx.pagina.appendChild(cont);
    obtenerRanking().then(function (r) {
      if (!ctx.vigente()) return;
      cont.innerHTML = '';
      [['FÁCIL', 'facil', '#1d9a63'], ['MEDIO', 'medio', '#e08a1e'], ['DIFÍCIL', 'dificil', '#d64557']].forEach(function (c) {
        const lista = r[c[1]], tabla = h('div', { class: 'tabla' });
        if (!lista.length) tabla.appendChild(h('div', { class: 'rc-fila-rank', style: { color: 'var(--txt2)' }, text: 'Aún no hay puntajes.' }));
        lista.forEach(function (j, i) { tabla.appendChild(h('div', { class: 'rc-fila-rank' }, h('span', { class: 'pos', text: ['🥇', '🥈', '🥉'][i] || String(i + 1) }), h('span', { class: 'nom', text: j.nombre }), h('span', { class: 'pts', text: j.puntaje + ' pts' }))); });
        cont.appendChild(h('section', { class: 'rc-rank-sec' }, h('h2', { text: c[0], style: { color: c[2] } }), tabla));
      });
      RC.entrada(cont.children, 0);
    }).catch(function (e) {
      if (!ctx.vigente()) return;
      cont.innerHTML = ''; cont.appendChild(h('div', { class: 'rc-vacio', text: e.red ? 'Sin conexión.\nConéctate a internet para ver el ranking.' : 'No se pudo cargar el ranking.' }));
    });
  });
})();
