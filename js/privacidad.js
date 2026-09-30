/* Política de privacidad — se muestra solo en  …/#/privacidad */
(function () {
  const cont = document.getElementById('privacidad');
  const CORREO = 'elrecreocentrocristiano@gmail.com';
  const SECCIONES = [
    ['Datos que usa la app',
      'Centro Cristiano el Recreo permite leer la Biblia (incluida la lectura en voz alta), ver devocionales, videos y eventos, escuchar radio, enviar peticiones de oración y participar en el juego de trivia. Para esas funciones, la app puede usar internet, micrófono, notificaciones, el nombre y apellido del jugador, los puntajes del ranking y el texto de las peticiones enviadas.'],
    ['Micrófono',
      'El micrófono se usa solamente cuando el usuario activa la búsqueda por voz para encontrar pasajes bíblicos. La app no graba audio propio ni guarda grabaciones; el reconocimiento de voz lo realiza el servicio de voz del dispositivo, según sus propias políticas.'],
    ['Peticiones y ranking',
      'Las peticiones de oración y los datos del juego se envían a servicios administrados mediante Google Apps Script y Google Sheets. La petición se envía solo con su texto, para que el equipo autorizado de la iglesia pueda recibirla. El nombre y apellido se usan únicamente para identificar al jugador en el ranking. Esta información se guarda en una hoja de cálculo de Google Sheets, a la cual solo tiene acceso el equipo autorizado de la iglesia, y no se comparte con terceros.'],
    ['Videos y radio',
      'Los videos se muestran desde YouTube y la radio se reproduce por internet. Al verlos o escucharlos, esos servicios pueden recibir datos técnicos de la conexión, de acuerdo con sus propias políticas.'],
    ['Notificaciones',
      'La app puede enviar recordatorios y novedades de la iglesia. El usuario puede desactivarlas en cualquier momento desde los ajustes de Android.'],
    ['Donaciones',
      'La sección de donaciones solo muestra los datos de las cuentas de la iglesia para que puedan copiarse. La app no procesa pagos ni guarda información bancaria del usuario.'],
    ['Almacenamiento local',
      'La app guarda en el dispositivo preferencias como modo día/noche, resaltados, versión bíblica seleccionada, textos bíblicos descargados y datos locales del jugador para mantener la experiencia funcionando correctamente.'],
    ['Control del usuario',
      'El usuario puede negar o retirar permisos desde los ajustes de Android. Si retira el permiso de micrófono, la búsqueda por voz dejará de funcionar; si retira el de notificaciones, dejará de recibir recordatorios. El resto de la app seguirá disponible.'],
    ['Eliminación de datos',
      'Si deseas que eliminemos tu nombre, apellido, puntajes del juego o el texto de alguna petición de oración guardados en nuestra base de datos, escríbenos a <a href="mailto:' + CORREO + '">' + CORREO + '</a> indicando el dato que quieres eliminar. Atenderemos tu solicitud y borraremos la información de nuestra base de datos (una hoja de cálculo sencilla) en un plazo máximo de <strong>una semana</strong>.'],
    ['Contacto',
      'Para dudas sobre esta política o el manejo de tus datos, puedes escribirnos a <a href="mailto:' + CORREO + '">' + CORREO + '</a>.']
  ];

  function render() {
    const activo = /^#\/privacidad\/?$/.test(location.hash);
    cont.hidden = !activo;
    if (!activo) { cont.innerHTML = ''; document.title = 'Centro Cristiano El Recreo'; return; }
    document.title = 'Política de privacidad | Centro Cristiano El Recreo';
    if (cont.firstChild) return;
    cont.innerHTML =
      '<article class="priv">' +
      '<header class="priv-cab"><img src="img/logo.png" alt="" width="72" height="72">' +
      '<h1>Política de privacidad</h1><p>Centro Cristiano el Recreo</p></header>' +
      '<p class="priv-intro">Esta política explica cómo la app Centro Cristiano el Recreo usa la información necesaria para ofrecer sus funciones de Biblia, devocionales, radio, videos, peticiones de oración y trivia bíblica.</p>' +
      SECCIONES.map(function (s) { return '<section><h2>' + s[0] + '</h2><p>' + s[1] + '</p></section>'; }).join('') +
      '<p class="priv-fecha">Última actualización: septiembre de 2026</p></article>';
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  render();
})();
