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
