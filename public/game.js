// game.js
// Cliente del juego: avatares, dados con imágenes, opciones y planilla.
// Requisitos cubiertos:
// - Panel superior de jugadores con avatar
// - Dados con img/0.png..6.png (0 antes del primer tiro)
// - Opciones al lado de planilla
// - Opciones solo clicables cuando started && myTurn && rolls > 0
// - Botón Salir: desconecta y vuelve al login

const urlParams = new URLSearchParams(window.location.search);

// const nick = urlParams.get('nick') || 'Invitado';
// const avatarParam = urlParams.get('avatar') || 'player01.png';

const nick = sessionStorage.getItem('nick');
const avatarParam = sessionStorage.getItem('avatar') || 'player01.png';

//console.log('Juego iniciado con nick:', nick, 'avatar:', avatarParam);

const socket = io(); // mismo host/puerto que sirvió esta página

// Elementos del DOM
const topPlayersEl = document.getElementById('topPlayers');
const diceRowEl = document.getElementById('diceRow');
const rollBtn = document.getElementById('rollBtn');
const exitBtn = document.getElementById('exitBtn');
const newGameBtn = document.getElementById('newGameBtn');
const rollsInfoEl = document.getElementById('rollsInfo');
//const gameMsgEl = document.getElementById('gameMsg'); // puede ser null
const labelGameMode = document.getElementById('labelGameMode');

// Panels that should be shown/hidden for all players when game starts
const dicePanelEl = document.getElementById('dicePanel');
const mainLayoutEl = document.getElementById('mainLayout');
const gameOptionsEl = document.getElementById('gameOptions');

const optionsBodyEl = document.getElementById('optionsBody');
const planillaContainerEl = document.getElementById('planilla-container');

let state = null;
let holds = new Set(); // índices retenidos (0..4)

// Si venimos de `new_game.html` con parámetros de juego, mostrar los paneles
// inmediatamente para evitar pantalla en blanco mientras llega el estado del servidor.
if (urlParams.get('modo')) {
  if (dicePanelEl) dicePanelEl.style.display = '';
  if (mainLayoutEl) mainLayoutEl.style.display = '';
}

// Por defecto ocultar el botón Nuevo salvo que el servidor indique lo contrario
if (newGameBtn) newGameBtn.style.display = 'none';

// Mostrar modalidad y si es con/sin abajos según parámetros de la URL
(() => {
  // const modoJuego = urlParams.get('modo');
  // const abajosParam = urlParams.get('abajos');
  const modoJuego = sessionStorage.getItem('modoJuego');
  const abajos = sessionStorage.getItem('abajos');
  const abajosObligados = sessionStorage.getItem('abajosObligados');

  //console.log('game.html: modoJuego, abajos, abajosObligados', modoJuego, abajos, abajosObligados);
  // if (!labelGameMode || !modoJuego) return;

  // function titleCase(s) {
  //   return s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  // }

  // const modoText = titleCase(modoJuego);
  // const conAbajos = abajosParam === 'true' || abajosParam === '1';
  //labelGameMode.textContent = `${modoText} ${conAbajos ? 'con abajos' : 'sin abajos'}`;

  // Mapas de texto
  //const modos = ["NORMAL", "ORDENADA", "ORDENADA INVERSA"];
  //const abajosTxt = ["sin abajos", "con abajos (1 DADO)", "con abajos (2 DADOS)", "con abajos (3 DADOS)"];

  // Construcción del texto
  //let partes = [];

  //partes.push(modos[modoJuego]);
  //partes.push(abajosTxt[abajos]);
  /*if (abajos > 0 && abajosObligados === "true") { 
    partes.push("obligados"); 
  }*/
  //partes.push(`(${abajosParam} DADO${abajosParam > 1 ? "S" : ""})`);

  //labelGameMode.textContent = partes.join(" ");
  let str;
  if (abajos !== "SIN ABAJOS") {
    str = modoJuego + " con abajos (" + abajos + ")"; 
    if (abajosObligados === "true") { str = str + " obligados"; }
  } else {
    str = modoJuego + " sin abajos";
  }
  labelGameMode.textContent = str;
})();

// ---------- Render: panel superior de jugadores ----------
function renderTopPlayers() {
  topPlayersEl.innerHTML = '';
  if (!state || !state.players) return;

  state.players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'player-card';

    // Destacar jugador en turno
    if (state.started && state.currentTurn === p.nick) {
      card.classList.add('turn');
    }

    const img = document.createElement('img');
    img.className = 'player-avatar';
    img.src = `img/${p.avatar || 'player01.png'}`;
    img.alt = p.nick;

    const name = document.createElement('div');
    name.className = 'player-name';

    name.textContent = p.nick + (p.connected ? '' : ' 🔌');

    // const total = document.createElement('div');
    // total.className = 'player-total';
    // total.textContent = `Total: ${p.total}`;

    card.appendChild(img);
    card.appendChild(name);
    //card.appendChild(total);

    topPlayersEl.appendChild(card);
  });
}

// ---------- Render: dados con imágenes ----------
function renderDice() {
  // Clear previous dice from the 9 grid cells
  for (let n = 1; n <= 9; n++) {
    const cell = document.getElementById(`cell-${n}`);
    if (cell) {
      // Remove only the die imgs
      const dies = cell.querySelectorAll('.die-img');
      dies.forEach(d => d.remove());
      // Remove held class from cell
      cell.classList.remove('held');
    }
  }
  if (!state || !state.dice) return;

  const started = !!state.started;
  const myTurn = started && state.currentTurn === nick;
  const hasRolled = started && state.rolls > 0;

  // Desired positions for the five dice: cells 1,3,5,7,9
  const positions = [1, 3, 5, 7, 9];

  state.dice.forEach((v, i) => {
    const displayVal = hasRolled ? v : 0;

    const img = document.createElement('img');
    img.src = `img/${displayVal}.png`;
    img.alt = `Dado ${displayVal}`;
    img.className = 'die-img';

    img.addEventListener('click', () => {
      if (!started) return;
      if (!myTurn) return;
      if (state.rolls === 0) return;
      if (holds.has(i)) holds.delete(i); else holds.add(i);
      renderDice();
    });

    const pos = positions[i] || 1;
    const cell = document.getElementById(`cell-${pos}`);
    if (cell) {
      cell.appendChild(img);
      // Apply held class to the cell if this die is held
      if (holds.has(i)) {
        cell.classList.add('held');
      }
    } else {
      diceRowEl.appendChild(img);
    }
  });
}

// ---------- Render: opciones de puntuación ----------
function renderOptions() {
  optionsBodyEl.innerHTML = '';
  if (!state) return;

  const started = !!state.started;
  const myTurn = started && state.currentTurn === nick;
  const hasRolled = started && state.rolls > 0;

  const cats = state.categories || [];
  const myScores = (state.scores && state.scores[nick]) ? state.scores[nick] : {};
  const options = state.options || {}; // servidor solo envía opciones al jugador en turno

  cats.forEach(cat => {
    // Ocultar categorías ya usadas por mí
    if (myScores[cat] !== null && myScores[cat] !== undefined) return;

    const tr = document.createElement('tr');
    const clickable = started && myTurn && hasRolled;
    tr.className = clickable ? 'clickable' : '';

    const displayCat = cat === 'GEN' ? 'GEN I' : cat === 'D GEN' ? 'GEN II' : cat;
    const pts = (clickable && (cat in options)) ? options[cat] : '—';
    tr.innerHTML = `<td class="cat">${displayCat}</td><td class="pts">${pts}</td>`;

    if (clickable) {
      tr.addEventListener('click', () => {
        socket.emit('chooseCategory', { category: cat });
      });
    }

    optionsBodyEl.appendChild(tr);
  });

  // Mensaje informativo bajo la tabla (opcional)
  // if (gameMsgEl) {
  //   if (!started) {
  //     gameMsgEl.textContent = 'Pulsa "Iniciar partida" para comenzar.';
  //   } else if (started && !myTurn) {
  //     gameMsgEl.textContent = `Turno de: ${state.currentTurn}`;
  //   } else if (started && myTurn && state.rolls >= 3) {
  //     gameMsgEl.textContent = 'Has usado los 3 lanzamientos. Selecciona una categoría para terminar tu turno.';
  //   } else if (started && myTurn && !hasRolled) {
  //     gameMsgEl.textContent = 'Primero debes tirar los dados.';
  //   } else {
  //     // Sin mensaje adicional
  //   }
  // }
}

// ---------- Render: planilla de puntuaciones ----------
function renderSheet() {
  if (!state) return;

  const scores = state.scores || {};
  const players = Array.isArray(state.players) ? state.players : [];
  const cats = state.categories || [];
  const head = ['Categoría', ...players.map(p => p.nick)];

  let html = '<table class="score-table"><thead><tr>';
  head.forEach(h => html += `<th>${h}</th>`);
  html += '</tr></thead><tbody>';

  cats.forEach(cat => {
    const displayCat = cat === 'GEN' ? 'GEN I' : cat === 'D GEN' ? 'GEN II' : cat;
    html += `<tr><td class="cat">${displayCat}</td>`;
    players.forEach(p => {
      const sc = (scores[p.nick] && (cat in scores[p.nick])) ? scores[p.nick][cat] : null;
      if (sc === null || sc === undefined) {
        html += `<td class="used">—</td>`;
      } else {
        html += `<td class="score" style="text-align:center">${sc}</td>`;
      }
    });
    html += '</tr>';
  });

  // Render TOTAL row with each player's total (fallback to sum of scores if p.total missing)
  html += '<tr><td class="cat">TOTAL</td>';
  players.forEach(p => {
    const total = (p.total !== undefined && p.total !== null)
      ? p.total
      : (scores[p.nick] ? Object.values(scores[p.nick]).reduce((a, b) => a + (b || 0), 0) : 0);
    html += `<td class="score" style="text-align:center">${total}</td>`;
  });
  html += '</tr>';
  html += '</tbody></table>';

  // Buscar y eliminar la tabla anterior si existe
  let existingTable = planillaContainerEl.querySelector('table');
  if (existingTable) {
    existingTable.remove();
  }
  // Insertar la nueva tabla
  planillaContainerEl.insertAdjacentHTML('beforeend', html);
}

// ---------- Sincronizar botones ----------
function syncButtons() {
  const started = !!state?.started;
  const myTurn = started && state.currentTurn === nick;
  // Show the roll button only to the player whose turn it is; hide for others
  if (rollBtn) {
    const canRoll = myTurn && (state?.rolls ?? 0) < 3;
    rollBtn.style.display = canRoll ? '' : 'none';
    rollBtn.disabled = !myTurn || (state?.rolls ?? 0) >= 3;
  }
  // startBtn solo existe en new_game.html
  // if (startBtn) startBtn.disabled = started;

  // Actualizar íconos de tiros disponibles
  const rollsUsed = state?.rolls ?? 0;
  for (let i = 1; i <= 3; i++) {
    const icon = document.getElementById(`roll-${i}`);
    if (icon) {
      if (i <= (3 - rollsUsed)) {
        icon.classList.add('active');
      } else {
        icon.classList.remove('active');
      }
    }
  }
}

// ---------- Render general ----------
function renderAll() {
  // Ensure layout visibility follows shared game state
  const started = !!state?.started;
  if (gameOptionsEl) gameOptionsEl.style.display = started ? 'none' : '';
  if (dicePanelEl) dicePanelEl.style.display = started ? '' : 'none';
  if (mainLayoutEl) mainLayoutEl.style.display = started ? '' : 'none';
  renderDice();
  renderOptions();
  renderSheet();
  syncButtons();
}

// ---------- Eventos UI ----------
rollBtn.addEventListener('click', () => {
  socket.emit('roll', { holds: [...holds] });
});

// startBtn no existe en game.html, solo en new_game.html
// startBtn.addEventListener('click', () => {
//   socket.emit('startGame');
// });

exitBtn.addEventListener('click', () => {
  try {
    socket.emit('leave');   // liberar nick en servidor
    socket.disconnect();    // corta la conexión
  } catch (e) { }
  sessionStorage.removeItem('nick');
  sessionStorage.removeItem('avatar');
  window.location.href = 'login.html'; // vuelve al login
});

// ---------- Socket.IO ----------
socket.on('connect', () => {
  // Enviar avatar por si entra directo a game.html
  socket.emit('join', { nick, avatar: avatarParam });
});

socket.on('joined', ({ nick: officialNick }) => {
  //if (gameMsgEl) gameMsgEl.textContent = `Conectado como ${officialNick}`;
  // Request initial state to display player in topPlayers panel
  socket.emit('requestState');

  // Si el servidor indicó que este cliente es el primer jugador, mostrar el botón
  // El servidor envía `isFirstPlayer` en el evento 'joined'
  // Nota: algunos navegadores pueden omitir este campo si la versión del servidor es vieja
  // en ese caso la visibilidad se corregirá cuando llegue el 'state'.
  try {
    // Releer payload para extraer isFirstPlayer (compatibilidad segura)
    // (La desestructuración original no incluía isFirstPlayer; volver a recibirlo)
  } catch (e) { }

  // Si venimos de new_game.html con modo seleccionado, solicitar al servidor
  // que inicie la partida automáticamente.
  if (urlParams.get('modo')) {
    try {
      socket.emit('startGame');
    } catch (e) {
      console.warn('No se pudo emitir startGame', e);
    }
  }
});

socket.on('joinRejected', ({ reason }) => {
  //if (gameMsgEl) gameMsgEl.innerHTML = `<span class="error">Conexión rechazada: ${reason}</span>`;
});

socket.on('state', (st) => {
  state = st;

  // Mostrar el botón Nuevo solo si el primer jugador en la lista es este cliente
  if (newGameBtn) {
    const firstNick = state?.players && state.players.length > 0 ? state.players[0].nick : null;
    newGameBtn.style.display = (firstNick === nick) ? '' : 'none';
  }

  // Al no ser mi turno o antes del primer tiro, limpia holds
  const myTurn = state.started && state.currentTurn === nick;
  if (!myTurn || state.rolls === 0) holds.clear();

  renderTopPlayers();
  renderAll();
});

// Si el servidor pide redirigir al cliente, navegar a la URL indicada
socket.on('redirect', ({ url }) => {
  //console.log(url);

  if (typeof url === 'string' && url) {

    // Solo limpiar si la URL es exactamente "waiting.html"
    if (url !== 'waiting.html') {
      try {
        sessionStorage.removeItem('nick');
        sessionStorage.removeItem('avatar');
      } catch (e) { }
    }

    window.location.href = url;
  }
});


// Merge scores updates broadcast from server into local state and re-render
socket.on('scoresUpdated', ({ scores, players }) => {
  if (!state) state = {};
  state.scores = scores;
  if (Array.isArray(players)) state.players = players;
  // Ajustar visibilidad del botón Nuevo si cambió el orden de jugadores
  if (newGameBtn) {
    const firstNick = state?.players && state.players.length > 0 ? state.players[0].nick : null;
    newGameBtn.style.display = (firstNick === nick) ? '' : 'none';
  }
  renderTopPlayers();
  renderAll();
});

socket.on('gameOver', ({ winner, score, avatar, reason }) => {
  //if (gameMsgEl) gameMsgEl.innerHTML = `<span class="winner">Ganador: ${winner}</span> <span class="small">(${reason})</span>`;

  // Redirigir a la página del ganador después de 2 segundos
  // setTimeout(() => {
  //   //const winnerUrl = `winner.html?nick=${encodeURIComponent(nick)}&winner=${encodeURIComponent(winner)}&score=${score || 0}&avatar=${encodeURIComponent(avatar || 'player01.png')}`;
  //   const winnerUrl = `winner.html`
  //   window.location.href = winnerUrl;
  // }, 250);

  sessionStorage.setItem('winner', winner);
  sessionStorage.setItem('winnerScore', score || 0);
  sessionStorage.setItem('winnerAvatar', avatar || 'player01.png');
  sessionStorage.setItem('winReason', reason || '');  
  const winnerUrl = `winner.html`
  window.location.href = winnerUrl;
});

// Desconexión limpia al cerrar/recargar pestaña (opcional)
window.addEventListener('beforeunload', () => {
  try { socket.disconnect(); } catch { }
});


if (newGameBtn) {
  newGameBtn.addEventListener('click', () => {
    // avisar al servidor para que los demás jugadores vayan a waiting.html
    try { socket.emit('openNewGame'); } catch (e) { }
    // navega el administrador a la página de configuración de la nueva partida
    window.location.href = 'new_game.html';
  });
}