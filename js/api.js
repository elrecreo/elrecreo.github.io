/** Llamada al Apps Script. Se envía como text/plain para evitar el preflight CORS. */
async function llamar(action, datos) {
  const cuerpo = Object.assign({ action: action, adminKey: CONFIG.ADMIN_KEY }, datos || {});
  const res = await fetch(CONFIG.SCRIPT_URL, { method: 'POST', body: JSON.stringify(cuerpo) });
  let json;
  try { json = await res.json(); } catch (e) { throw new Error('El script no respondió JSON. ¿Publicaste la nueva versión?'); }
  if (json && json.ok === false) throw new Error(json.error || 'Error desconocido');
  return json;
}

/** Archivo -> { base64, tipo, nombre } */
function leerArchivoBase64(archivo) {
  return new Promise(function (resolve, reject) {
    const r = new FileReader();
    r.onload = function () {
      const s = String(r.result);
      resolve({ base64: s.split(',')[1], tipo: archivo.type || 'image/jpeg', nombre: archivo.name });
    };
    r.onerror = function () { reject(new Error('No se pudo leer el archivo')); };
    r.readAsDataURL(archivo);
  });
}

function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** "Salmos 34 : 1" -> "salmos-34-1" (para nombres de archivo). */
function nombreArchivo(texto, respaldo) {
  const s = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || respaldo || 'imagen';
}

function descargarBlob(blob, nombre) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

/** Id del archivo de Drive dentro de un link (uc?id=…, /d/…, lh3.googleusercontent.com/d/…). '' si no se reconoce. */
function idDrive(url) {
  const u = String(url || '');
  const m = u.match(/[?&]id=([\w-]{10,})/) || u.match(/\/d\/([\w-]{10,})/) || u.match(/googleusercontent\.com\/([\w-]{20,})/);
  return m ? m[1] : '';
}

/** Descarga una imagen ya publicada, tal cual quedó en Drive. Nunca la abre en una pestaña. */
async function descargarDesdeUrl(url, nombre) {
  const id = idDrive(url);
  const candidatas = (id ? ['https://lh3.googleusercontent.com/d/' + id + '=s0'] : []).concat([url]);
  for (let i = 0; i < candidatas.length; i++) {
    try {
      const res = await fetch(candidatas[i], { credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!/^image\//.test(blob.type)) continue;
      descargarBlob(blob, nombre + (/png/.test(blob.type) ? '.png' : /webp/.test(blob.type) ? '.webp' : '.jpg'));
      return;
    } catch (e) { /* el navegador no deja leerla: se prueba la siguiente vía */ }
  }
  // Vía directa de Drive: responde como archivo adjunto, así que se descarga sin salir de la página.
  const a = document.createElement('a');
  a.href = id ? 'https://drive.google.com/uc?export=download&id=' + id : url;
  a.rel = 'noopener'; a.download = nombre + '.jpg';
  document.body.appendChild(a); a.click(); a.remove();
}

/** Posibles links de miniatura para una imagen de Drive, de la más liviana a la original. */
function urlsMiniatura(url, ancho) {
  const id = idDrive(url), w = ancho || 240, lista = [];
  if (id) {
    lista.push('https://drive.google.com/thumbnail?id=' + id + '&sz=w' + w);
    lista.push('https://lh3.googleusercontent.com/d/' + id + '=w' + w);
  }
  if (url) lista.push(url);
  return lista;
}

/**
 * Pone la miniatura dentro de `slot` solo si alguna de las urls carga de verdad.
 * Si ninguna carga, quita el espacio de la miniatura y la fila queda solo con el texto (nunca se ve un ícono roto).
 */
function cargarMiniatura(slot, urls) {
  let i = 0;
  (function probar() {
    if (i >= urls.length) {
      const li = slot.closest('li'); if (li) li.classList.add('sin-mini');
      slot.remove(); return;
    }
    const img = new Image(); let hecho = false;
    const siguiente = function () { if (hecho) return; hecho = true; clearTimeout(t); img.onload = img.onerror = null; probar(); };
    const t = setTimeout(siguiente, 8000);
    img.referrerPolicy = 'no-referrer'; img.alt = '';
    img.onerror = siguiente;
    img.onload = function () {
      if (hecho) return;
      if (img.naturalWidth < 2) { siguiente(); return; }
      hecho = true; clearTimeout(t); slot.classList.add('lista'); slot.appendChild(img);
    };
    img.src = urls[i++];
  })();
}

/** Link de YouTube -> id de 11 caracteres ('' si no es válido). */
function idYoutube(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
