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

/** Descarga una imagen ya publicada tal cual está en Drive. Si el navegador no deja leerla, la abre en otra pestaña. */
async function descargarDesdeUrl(url, nombre) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('http ' + res.status);
    const blob = await res.blob();
    descargarBlob(blob, nombre + (/png/.test(blob.type) ? '.png' : '.jpg'));
  } catch (e) {
    window.open(url, '_blank', 'noopener');
  }
}

/** Link de YouTube -> id de 11 caracteres ('' si no es válido). */
function idYoutube(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
