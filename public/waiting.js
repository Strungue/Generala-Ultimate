const urlParams = new URLSearchParams(window.location.search);
// const nick = urlParams.get('nick') || 'Jugador';
// const avatar = urlParams.get('avatar') || 'player01.png';
const nick = sessionStorage.getItem('nick') || 'Jugador';
const avatar = sessionStorage.getItem('avatar') || 'player01.png';
const playerInfo = document.getElementById('playerInfo');
const logoutBtn = document.getElementById('logoutBtn');

playerInfo.textContent = `Conectado como: ${nick}`;

// Conectar al servidor
const socket = io();

//console.log('Join exitoso:', nick, avatar); 

// Enviar join para registrarse
socket.on('connect', () => {
    socket.emit('join', { nick, avatar });
});

// Cuando el primer jugador inicia el juego, el servidor envía gameStarted
socket.on('gameStarted', ({ modo, abajos, abajosObligados }) => {
    // Redirigir a game.html con los parámetros necesarios
    //const gameUrl = `game.html?nick=${encodeURIComponent(nick)}&avatar=${encodeURIComponent(avatar)}&modo=${encodeURIComponent(modo || 'NORMAL')}&abajos=${abajos || false}`;
    //console.log('Redirigiendo a game.html con modo:', modo, 'y abajos:', abajos);
    sessionStorage.setItem('modoJuego', modo);
    sessionStorage.setItem('abajos', abajos);
    sessionStorage.setItem('abajosObligados', abajosObligados);
    const gameUrl = `game.html`;
    window.location.href = gameUrl;
});

// Si el servidor responde al join con joined y el juego ya está iniciado,
// también redirigimos (caso de reconexión tardía después de start)
socket.on('joined', ({ nick: officialNick, isFirstPlayer, gameStarted, modo, abajos }) => {
  if (gameStarted) {
    //const gameUrl = `game.html?nick=${encodeURIComponent(officialNick || nick)}&avatar=${encodeURIComponent(avatar)}&modo=${encodeURIComponent(modo || 'NORMAL')}&abajos=${abajos || false}`;
    //console.log('Redirigiendo a game.html con modo:', modo, 'y abajos:', abajos);
    sessionStorage.setItem('modoJuego', modo);
    sessionStorage.setItem('abajos', abajos);
    sessionStorage.setItem('abajosObligados', "false");
    const gameUrl = `game.html`;
    window.location.href = gameUrl;
  }
});

logoutBtn.addEventListener('click', () => {
  try {
    socket.emit('leave');   // liberar nick en servidor
    socket.disconnect();    // corta la conexión
  } catch (e) {}
  sessionStorage.removeItem('nick');
  sessionStorage.removeItem('avatar');   
  window.location.href = 'login.html'; // vuelve al login
});