const urlParams = new URLSearchParams(window.location.search);
// const nick = urlParams.get('nick') || '';
// const winner = urlParams.get('winner') || 'Desconocido';
// const score = urlParams.get('score') || '0';
// const avatar = urlParams.get('avatar') || 'player01.png';

const nick = sessionStorage.getItem('nick') || '';
const winner = sessionStorage.getItem('winner') || 'Desconocido';
const score = sessionStorage.getItem('winnerScore') || '0';
const avatar = sessionStorage.getItem('avatar') || 'player01.png';
const winnerAvatar = sessionStorage.getItem('winnerAvatar') || 'player01.png';


document.getElementById('winnerName').textContent = winner;
document.getElementById('winnerScore').textContent = score;
document.getElementById('winnerAvatar').src = `img/${winnerAvatar}`;

// Socket.IO connection to allow play-again and selecting game
const socket = io();
let amIFirst = false;

const playAgainBtn = document.getElementById('playAgainBtn');
const selectGameBtn = document.getElementById('selectGameBtn');
const backBtn = document.getElementById('backBtn');

// Hide privileged buttons until we know if user is first
playAgainBtn.style.display = 'none';
selectGameBtn.style.display = 'none';

socket.on('connect', () => {
    if (nick) socket.emit('join', { nick, avatar });
});

socket.on('joined', ({ nick: officialNick, isFirstPlayer, gameStarted, modo, abajos }) => {
    amIFirst = !!isFirstPlayer;
    if (amIFirst) {
        playAgainBtn.style.display = '';
        selectGameBtn.style.display = '';
        backBtn.textContent = 'Salir';
    } else {
        // non-first users only see Salir
        playAgainBtn.style.display = 'none';
        selectGameBtn.style.display = 'none';
        backBtn.textContent = 'Salir';
    }

    // If the server reports game already started, redirect back to game
    if (gameStarted) {
        //const gameUrl = `game.html?nick=${encodeURIComponent(officialNick)}&avatar=${encodeURIComponent(avatar)}&modo=${encodeURIComponent(modo || 'NORMAL')}&abajos=${abajos || false}`;
        const gameUrl = `game.html`;
        window.location.href = gameUrl;
    }
});

socket.on('gameStarted', ({ modo, abajos }) => {
    //const gameUrl = `game.html?nick=${encodeURIComponent(nick)}&avatar=${encodeURIComponent(avatar)}&modo=${encodeURIComponent(modo || 'NORMAL')}&abajos=${abajos || false}`;
    const gameUrl = `game.html`;
    window.location.href = gameUrl;
});

socket.on('playAgainRejected', () => {
    // not allowed to play again -> go to waiting page
    //window.location.href = `waiting.html?nick=${encodeURIComponent(nick)}&avatar=${encodeURIComponent(avatar)}`;
    window.location.href = `waiting.html`;
});

playAgainBtn.addEventListener('click', () => {
    socket.emit('playAgain');
});

selectGameBtn.addEventListener('click', () => {
    if (amIFirst) {
        //window.location.href = `new_game.html?nick=${encodeURIComponent(nick)}&avatar=${encodeURIComponent(avatar)}`;
        window.location.href = `new_game.html`; 
    } else {
        //window.location.href = `waiting.html?nick=${encodeURIComponent(nick)}&avatar=${encodeURIComponent(avatar)}`;
        window.location.href = `waiting.html`;
    }
});

backBtn.addEventListener('click', () => {
    try { socket.emit('leave'); } catch (e) { }
    try { socket.disconnect(); } catch (e) { }
    sessionStorage.removeItem('nick');
    sessionStorage.removeItem('avatar');    
    window.location.href = 'login.html';
});
