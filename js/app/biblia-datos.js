/* Datos de la Biblia para la app: versiones, comentarios (Biblia de estudio), búsqueda por texto y por voz.
   Lógica portada de BibliaRepository.kt / SuggestionManager.kt de la app Android. */
(function () {
  'use strict';
  const RC = window.RC, D = window.RCDATA;
  const B = RC.biblia = {};

  const cacheLibros = {};     // 'RV1960:43' -> Promise<[[v1,v2..],..]>
  const cacheVersion = {};    // 'NVI' -> Promise<{libroId: [[..]]}>  (versiones descargadas, ya partidas por libro)

  B.versiones = function () { return D.VERSIONES; };
  B.version = function (id) { return D.VERSIONES.find(function (v) { return v.id === id; }) || D.VERSIONES[0]; };
  B.versionActiva = function () { return B.version(RC.leer('version', 'RV1960')).id; };
  B.ponerVersion = function (id) { RC.guardar('version', id); };
  /** ¿La versión ya está lista sin descargar? (RV1960 siempre; las demás si ya se bajaron en esta sesión o están guardadas). */
  B.disponible = function (id) { return id === 'RV1960' || !!cacheVersion[id] || RC.leer('descargada:' + id, false); };

  function limpiar(t) { return String(t || '').replace(/\/n/g, ' ').replace(/ {2,}/g, ' ').trim(); }

  /** Convierte {libros, versiculos} (formato de la app) a { libroId: [[v1..],[..]] } */
  function partir(json) {
    const por = {};
    (json.versiculos || []).forEach(function (v) {
      const l = por[v.libro_id] = por[v.libro_id] || [];
      const c = l[v.capitulo - 1] = l[v.capitulo - 1] || [];
      c[v.versiculo - 1] = limpiar(v.texto);
    });
    Object.keys(por).forEach(function (k) { for (let i = 0; i < por[k].length; i++) { por[k][i] = (por[k][i] || []).map(function (t) { return t || ''; }); } });
    return por;
  }

  /** Descarga una versión (primero data/versiones/<archivo>, luego la URL original). */
  B.descargarVersion = function (id) {
    if (cacheVersion[id]) return cacheVersion[id];
    const v = B.version(id);
    const p = (async function () {
      const fuentes = [];
      if (v.archivo) fuentes.push('data/versiones/' + v.archivo);
      if (v.url) fuentes.push(v.url);
      let ultimo;
      for (let i = 0; i < fuentes.length; i++) {
        try {
          const r = await fetch(fuentes[i]);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const t = await r.text();
          const por = partir(JSON.parse(t));
          if (!Object.keys(por).length) throw new Error('Archivo vacío');
          RC.guardar('descargada:' + id, true);
          return por;
        } catch (e) { ultimo = e; }
      }
      throw new Error('No se pudo descargar ' + v.completo + '. ' + (ultimo && ultimo.message ? '(' + ultimo.message + ')' : ''));
    })();
    cacheVersion[id] = p;
    p.catch(function () { delete cacheVersion[id]; });
    return p;
  };

  /** Capítulos de un libro: [[v1, v2…], …] (índice 0 = capítulo 1). */
  B.libro = function (libroId, version) {
    version = version || B.versionActiva();
    const k = version + ':' + libroId;
    if (!cacheLibros[k]) {
      cacheLibros[k] = (version === 'RV1960'
        ? fetch('data/rv1960/' + libroId + '.json').then(function (r) { if (!r.ok) throw new Error('No se pudo cargar el libro'); return r.json(); }).then(function (j) { return j.c; })
        : B.descargarVersion(version).then(function (por) { return por[libroId] || []; }));
      cacheLibros[k].catch(function () { delete cacheLibros[k]; });
    }
    return cacheLibros[k];
  };
  B.capitulo = async function (libroId, cap, version) {
    const l = await B.libro(libroId, version);
    return l[cap - 1] || [];
  };

  // ── Comentarios (Matthew Henry): [[cap, vIni, vFin, titulo, texto], …] por libro ──
  const cacheCom = {};
  B.comentarios = function (libroId) {
    if (!cacheCom[libroId]) {
      cacheCom[libroId] = fetch('data/comentarios/' + libroId + '.json').then(function (r) {
        if (r.status === 404) return [];
        if (!r.ok) throw new Error('No se pudo cargar la Biblia de estudio');
        return r.json();
      });
      cacheCom[libroId].catch(function () { delete cacheCom[libroId]; });
    }
    return cacheCom[libroId];
  };

  // ── Búsqueda por texto en toda la RV1960 ──
  let indice = null;
  B.cargarIndice = function () {
    if (!indice) {
      indice = Promise.all(D.LIBROS.map(function (l) { return B.libro(l.id, 'RV1960'); })).then(function (todos) {
        const out = [];
        todos.forEach(function (caps, i) {
          caps.forEach(function (vs, c) { vs.forEach(function (t, v) { out.push({ l: i + 1, c: c + 1, v: v + 1, t: t, n: ' ' + RC.norm(t) + ' ' }); }); });
        });
        return out;
      });
      indice.catch(function () { indice = null; });
    }
    return indice;
  };
  let famosos = null;
  function cargarFamosos() {
    if (!famosos) famosos = fetch('data/famosos.json').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
    return famosos;
  }
  B.precargarBusqueda = function () { B.cargarIndice().catch(function () { }); cargarFamosos(); };

  async function buscarFamoso(norm) {
    const palabras = norm.split(/\s+/).filter(function (p) { return p.length >= 3; });
    if (!palabras.length) return null;
    const todos = await cargarFamosos();
    let mejor = null;
    todos.forEach(function (f) {
      const pf = f[0].split(/\s+/).filter(function (p) { return p.length >= 3; });
      if (!pf.length) return;
      const coinc = palabras.filter(function (ph) { return pf.some(function (x) { return x === ph || x.startsWith(ph) || ph.startsWith(x); }); }).length;
      const pct = coinc / palabras.length;
      if (pct >= 0.6 && (!mejor || pct > mejor.pct || (pct === mejor.pct && f[4] > mejor.f[4]))) mejor = { f: f, pct: pct };
    });
    return mejor ? mejor.f : null;
  }
  async function buscarContenido(norm) {
    const palabras = norm.split(' ').filter(function (p) { return p.length >= 3; });
    if (!palabras.length) return null;
    const idx = await B.cargarIndice();
    const frase = ' ' + palabras.slice(0, 5).join(' ') + ' ';
    let r = idx.find(function (x) { return x.n.indexOf(frase) >= 0; });
    if (r) return r;
    const ord = palabras.slice().sort(function (a, b) { return b.length - a.length; });
    for (let n = Math.min(3, ord.length); n >= 1; n--) {
      const ws = ord.slice(0, n);
      r = idx.find(function (x) { return ws.every(function (w) { return x.n.indexOf(w) >= 0; }); });
      if (r) return r;
    }
    return null;
  }

  /** Devuelve { referencia, texto, libroId, capitulo, versiculo, prioridad } o null. */
  B.sugerir = async function (texto) {
    const norm = RC.norm(texto);
    if (!norm) return null;
    // 1) referencia directa
    if (BibliaWeb.esReferencia(texto)) {
      const ref = BibliaWeb.parsearReferencia(texto);
      if (ref) {
        const l = D.LIBROS[ref.libroId - 1];
        if (ref.capitulo >= 1 && ref.capitulo <= l.caps) {
          const vs = await B.capitulo(ref.libroId, ref.capitulo, 'RV1960');
          const v = ref.versiculo || 1;
          if (vs[v - 1]) return { referencia: l.nombre + ' ' + ref.capitulo + ':' + v, texto: vs[v - 1], libroId: ref.libroId, capitulo: ref.capitulo, versiculo: v, prioridad: 1 };
        }
      }
    }
    // 2) versículo famoso
    const f = await buscarFamoso(norm);
    if (f) {
      const vs = await B.capitulo(f[1], f[2], 'RV1960');
      if (vs[f[3] - 1]) return { referencia: D.LIBROS[f[1] - 1].nombre + ' ' + f[2] + ':' + f[3], texto: vs[f[3] - 1], libroId: f[1], capitulo: f[2], versiculo: f[3], prioridad: 2 };
    }
    // 3) búsqueda por contenido (mínimo 10 caracteres)
    if (norm.length >= 10) {
      const r = await buscarContenido(norm);
      if (r) return { referencia: D.LIBROS[r.l - 1].nombre + ' ' + r.c + ':' + r.v, texto: r.t, libroId: r.l, capitulo: r.c, versiculo: r.v, prioridad: 3 };
    }
    return null;
  };

  // ── Resaltados (HighlightStore) ──
  B.resaltados = function (libroId, cap) {
    const todo = RC.leer('resaltados', {}), out = {}, pre = libroId + '_' + cap + '_';
    Object.keys(todo).forEach(function (k) { if (k.indexOf(pre) === 0) out[parseInt(k.slice(pre.length), 10)] = todo[k]; });
    return out;
  };
  B.resaltar = function (libroId, cap, versos, color) {
    const todo = RC.leer('resaltados', {});
    versos.forEach(function (v) { const k = libroId + '_' + cap + '_' + v; if (color) todo[k] = color; else delete todo[k]; });
    RC.guardar('resaltados', todo);
  };

  // ── Última lectura ──
  B.ultimaLectura = function () { return RC.leer('ultima', null); };
  B.marcarLectura = function (libroId, cap) { RC.guardar('ultima', { l: libroId, c: cap }); };

  // ── Tamaño de letra (ReadingFontPrefs) ──
  B.fuentePaso = function () { return Math.max(-4, Math.min(4, RC.leer('fuente_biblia', 0))); };
  B.ponerFuentePaso = function (n) { RC.guardar('fuente_biblia', Math.max(-4, Math.min(4, n))); };
  B.tamano = function (base, paso) { return Math.max(10, base + paso * 1.5); };
})();
