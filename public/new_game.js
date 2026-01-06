// new_game.js
// Maneja la selección del tipo de juego y las opciones

// const modalidad = document.getElementById('modoJuego');
// const abajos = document.getElementById('abajos');
// const abajosObligados = document.getElementById('abajosObligados');

const startBtn = document.getElementById('startBtn');

// Obtener parámetros de la URL (nick y avatar)
const urlParams = new URLSearchParams(window.location.search);
// let nick = urlParams.get('nick');
// let avatar = urlParams.get('avatar');
let nick = sessionStorage.getItem('nick');
let avatar = sessionStorage.getItem('avatar');

//console.log('URL params - nick:', nick, 'avatar:', avatar);

// Validar que tenemos los parámetros necesarios
if (!nick || !avatar) {
  console.warn('Parámetros inválidos. Redirigiendo al login...');
  alert('Datos de jugador inválidos. Redirigiendo al login...');
  window.location.href = 'login.html';
}

// (debug) visible display removed: keep console.log for debugging only

// Conectar a Socket.IO
const socket = io();

// Registrarse al conectar
socket.on('connect', () => {
  socket.emit('join', { nick, avatar });
});

// Manejar el click en el botón "Iniciar partida"
startBtn.addEventListener('click', () => {
  const modoJuego = document.getElementById('modoJuego').value;
  const abajosVal = document.getElementById('abajos').value;
  const abajosObligadosVal = document.getElementById('abajosObligados').checked;

  if (modoJuego !== 'NORMAL') {
    return
  }
  //console.log('new_game.html: modoJuego ', modoJuego, ' abajos ', abajosVal, ' abajosObligados ', abajosObligadosVal);

  sessionStorage.setItem('modoJuego', modoJuego);
  sessionStorage.setItem('abajos', abajosVal);
  sessionStorage.setItem('abajosObligados', abajosObligadosVal);

  //console.log('Iniciando partida con:', { nick, avatar, modoJuego, abajos, abajosObligadosVal });

  // Emitir startGameWithOptions al servidor con modo y opciones
  socket.emit('startGameWithOptions', { modo: modoJuego, abajos: abajosVal, abajosObligados: abajosObligadosVal });

  // Construir URL con los parámetros - usando ruta relativa
  // const gameUrl = `game.html?nick=${encodeURIComponent(nick)}&avatar=${encodeURIComponent(avatar)}&modo=${encodeURIComponent(modoJuego)}&abajos=${abajos}`;
  const gameUrl = `game.html`;

  // Redirigir a game.html
  window.location.href = gameUrl;
});

const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', () => {
  try {
    socket.emit('leave');   // liberar nick en servidor
    socket.disconnect();    // corta la conexión
  } catch (e) { }
  sessionStorage.removeItem('nick');
  sessionStorage.removeItem('avatar');
  window.location.href = 'login.html'; // vuelve al login
});
