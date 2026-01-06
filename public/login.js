// login.js
// Valida nick y avatar desde login antes de navegar a game.html.
// Genera los 10 avatares automáticamente y envía el seleccionado en el join.

//const hostInput = document.getElementById('host');
const nickInput = document.getElementById('nick');
const connectBtn = document.getElementById('connectBtn');
const msg = document.getElementById('msg');
const avatarGrid = document.getElementById('avatarGrid');

let tempSocket = null;

// Puerto constante del servidor (cambiar si el servidor usa otro puerto)
const DEFAULT_PORT = 3000;

// --- Generar los 10 avatares (player01.png ... player10.png) ---
const AVATARS = Array.from({ length: 10 }, (_, i) => `player${String(i + 1).padStart(2, '0')}.png`);
let selectedAvatar = AVATARS[0]; // por defecto

let baseURL = ''

document.addEventListener("DOMContentLoaded", () => {
  const url = window.location.href;
  if (url.includes("localhost")) {
    baseURL = `http://172.20.238.213:${DEFAULT_PORT}`;
  } else {
    baseURL = `https://generala-ultimate.onrender.com`;
  }
});

function renderAvatarButtons() {
  avatarGrid.innerHTML = '';
  AVATARS.forEach((file, idx) => {
    const btnEl = document.createElement('button');
    btnEl.className = 'avatar-btn' + (idx === 0 ? ' selected' : '');
    btnEl.dataset.file = file;

    const img = document.createElement('img');
    img.src = `img/${file}`;
    img.alt = file.replace('.png', '');

    btnEl.appendChild(img);
    avatarGrid.appendChild(btnEl);
  });
}

renderAvatarButtons();

// Manejo de selección
avatarGrid.addEventListener('click', (ev) => {
  const button = ev.target.closest('.avatar-btn');
  if (!button) return;
  selectedAvatar = button.dataset.file;
  document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('selected'));
  button.classList.add('selected');
});

// --- Conectar (pre-validación) ---
connectBtn.addEventListener('click', async () => {
  // Deshabilita para evitar clics repetidos
  connectBtn.disabled = true;

  //const host = (hostInput.value || '').trim();
  const nick = (nickInput.value || '').trim();
  msg.textContent = '';

  if (!nick) {
    msg.textContent = 'El nick es obligatorio.';
    connectBtn.disabled = false;
    return;
  }

  sessionStorage.setItem('nick', nick);
  sessionStorage.setItem('avatar', selectedAvatar);

  // Normaliza host (sin http://) y fuerza el puerto constante
  //const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  //const hostOnly = cleanHost.split(':')[0];
  //const baseURL = `http://${hostOnly}:${DEFAULT_PORT}`;
  //const baseURL = `http://172.20.238.213:${DEFAULT_PORT}`;
  //let baseURL = 'https://generala-ultimate.onrender.com';

  // Cierra socket previo si existía
  try { if (tempSocket && tempSocket.connected) tempSocket.disconnect(); } catch { }

  // Crea socket temporal para validar el join
  tempSocket = io(baseURL, {
    transports: ['websocket', 'polling'],
    reconnection: false,
    timeout: 4000
  });

  msg.textContent = 'Conectando…';

  tempSocket.on('connect', () => {
    // Enviar avatar elegido junto con el nick
    tempSocket.emit('join', { nick, avatar: selectedAvatar });
  });

  tempSocket.on('joined', ({ nick: officialNick, isFirstPlayer, gameStarted, modo, abajos }) => {
    msg.textContent = 'Nick aceptado. Entrando…';
    try { tempSocket.disconnect(); } catch { }

    let redirectUrl, url;

    //console.log('Join exitoso:', nick, selectedAvatar); 

    // Si el juego ya ha comenzado, redirigir a game.html (reconexión de jugador)
    if (gameStarted) {
      //url = `game.html?nick=${encodeURIComponent(officialNick)}&avatar=${encodeURIComponent(selectedAvatar)}&modo=${encodeURIComponent(modo || 'NORMAL')}&abajos=${abajos || false}`;
      url = `game.html`
    }
    // Si es el primer jugador, va a new_game.html
    else if (isFirstPlayer) {
      // url = `new_game.html?nick=${encodeURIComponent(officialNick)}&avatar=${encodeURIComponent(selectedAvatar)}`;
      url = `new_game.html`;
    }
    // Si no, va a waiting.html
    else {
      //url = `waiting.html?nick=${encodeURIComponent(officialNick)}&avatar=${encodeURIComponent(selectedAvatar)}`;
      url = `waiting.html`;
    }

    window.location.href = url;
  });

  tempSocket.on('joinRejected', ({ reason }) => {
    msg.innerHTML = `<span class="error">Conexión rechazada: ${reason}</span>`;
    try { tempSocket.disconnect(); } catch { }
    connectBtn.disabled = false;
  });

  tempSocket.on('connect_error', (err) => {
    msg.innerHTML = `<span class="error">No se pudo conectar: ${err.message || err}</span>`;
    try { tempSocket.disconnect(); } catch { }
    connectBtn.disabled = false;
  });

  tempSocket.on('connect_timeout', () => {
    msg.innerHTML = `<span class="error">Tiempo de espera agotado.</span>`;
    try { tempSocket.disconnect(); } catch { }
    connectBtn.disabled = false;
  });
});
