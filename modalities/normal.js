// modalities/normal.js
// Lógica de la modalidad NORMAL movida desde server.js

module.exports = function(io) {
  // ---------- Configuración de avatares permitidos ----------
  const ALLOWED_AVATARS = Array.from({ length: 10 }, (_, i) => `player${String(i + 1).padStart(2, '0')}.png`);

  // ---------- Estado del juego ----------
  const CATEGORIES = ['1','2','3','4','5','6','TRIO','ESC','FULL','POKER','GEN','D GEN'];
  const UPPER = new Set(['1','2','3','4','5','6']);
  const BONUSABLE = new Set(['TRIO','ESC','FULL','POKER','GEN','D GEN']); // +5 si en el primer tiro

  const game = {
    started: false,
    players: new Map(), // nick -> { socketId, nick, avatar, connected, scores, used, total }
    order: [],          // array de nicks en orden de turno
    currentIndex: 0,    // índice en order
    dice: [0,0,0,0,0],  // 0 = “no tirado”
    rolls: 0            // lanzamientos en el turno actual (0..3)
  };

  function resetTurn() {
    game.dice = [0,0,0,0,0];
    game.rolls = 0;
  }

  function counts(dice) {
    const c = new Array(7).fill(0);
    for (const d of dice) c[d]++;
    return c;
  }

  function isStraight(dice) {
    const set = new Set(dice);
    if (set.size !== 5) return false;
    for (let start = 1; start <= 3; start++) {
      let ok = true;
      for (let k = 0; k < 5; k++) {
        const v = ((start - 1 + k) % 6) + 1;
        if (!set.has(v)) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  function hasFull(dice) {
    const c = counts(dice);
    let has3 = false, has2 = false;
    for (let v=1; v<=6; v++) {
      if (c[v] === 3) has3 = true;
      if (c[v] === 2) has2 = true;
    }
    return has3 && has2;
  }

  function maxCount(dice) {
    const c = counts(dice);
    let m = 0;
    for (let v=1; v<=6; v++) m = Math.max(m, c[v]);
    return m;
  }

  function computeScoreForCategory(dice, category, rolls, playerState) {
    const bonus = (BONUSABLE.has(category) && rolls === 1) ? 5 : 0;
    const c = counts(dice);

    if (UPPER.has(category)) {
      const face = parseInt(category, 10);
      return face * c[face];
    }

    switch (category) {
      case 'TRIO':
        return (maxCount(dice) >= 3) ? (40 + bonus) : 0;
      case 'ESC':
        return isStraight(dice) ? (50 + bonus) : 0;
      case 'FULL':
        return hasFull(dice) ? (60 + bonus) : 0;
      case 'POKER':
        return (maxCount(dice) >= 4) ? (70 + bonus) : 0;
      case 'GEN': {
        const isGen = (maxCount(dice) === 5);
        return isGen ? (100 + bonus) : 0;
      }
      case 'D GEN': {
        const isGen = (maxCount(dice) === 5);
        const genUsed = playerState.used.has('GEN'); // lógica por defecto: requiere GEN
        return (isGen && genUsed) ? (200 + bonus) : 0;
      }
      default:
        return 0;
    }
  }

  function allCategoriesUsed(playerState) {
    return CATEGORIES.every(cat => playerState.used.has(cat));
  }

  function buildStatePayload(forNick = null) {
    const playersArr = game.order.map(nick => {
      const p = game.players.get(nick);
      return {
        nick: p.nick,
        total: p.total,
        connected: p.connected,
        avatar: p.avatar || ALLOWED_AVATARS[0]
      };
    });

    const scores = {};
    for (const nick of game.order) {
      const p = game.players.get(nick);
      scores[nick] = {};
      for (const cat of CATEGORIES) {
        scores[nick][cat] = p.scores[cat] ?? null;
      }
    }

    let options = null;
    if (game.started) {
      const currentNick = game.order[game.currentIndex];
      if (currentNick && forNick === currentNick) {
        const ps = game.players.get(currentNick);
        options = {};
        for (const cat of CATEGORIES) {
          if (!ps.used.has(cat)) {
            options[cat] = computeScoreForCategory(game.dice, cat, game.rolls, ps);
          }
        }
      }
    }

    return {
      started: game.started,
      players: playersArr,
      scores,
      currentTurn: game.started ? game.order[game.currentIndex] : null,
      dice: game.dice,
      rolls: game.rolls,
      categories: CATEGORIES,
      options
    };
  }

  function broadcastState() {
    for (const nick of game.order) {
      const socketId = game.players.get(nick).socketId;
      io.to(socketId).emit('state', buildStatePayload(nick));
    }
  }

  function endGameWithWinner(winnerNick, reason='GEN servida') {
    const winnerPlayer = game.players.get(winnerNick);
    const winnerScore = winnerPlayer ? winnerPlayer.total : 0;
    const winnerAvatar = winnerPlayer ? winnerPlayer.avatar : 'player01.png';
    io.emit('gameOver', { winner: winnerNick, score: winnerScore, avatar: winnerAvatar, reason });
    for (const nick of game.order) {
      const p = game.players.get(nick);
      p.scores = {};
      p.used = new Set();
      p.total = 0;
    }
    game.started = false;
    game.currentIndex = 0;
    resetTurn();
    broadcastState();
  }

  function checkNormalEnd() {
    for (const nick of game.order) {
      const p = game.players.get(nick);
      if (!allCategoriesUsed(p)) return false;
    }
    let best = -Infinity, winner = null;
    for (const nick of game.order) {
      const p = game.players.get(nick);
      if (p.total > best) { best = p.total; winner = nick; }
    }
    const winnerPlayer = game.players.get(winner);
    const winnerScore = winnerPlayer ? winnerPlayer.total : 0;
    const winnerAvatar = winnerPlayer ? winnerPlayer.avatar : 'player01.png';
    io.emit('gameOver', { winner, score: winnerScore, avatar: winnerAvatar, reason: 'Fin de planilla' });

    for (const nick of game.order) {
      const p = game.players.get(nick);
      p.scores = {};
      p.used = new Set();
      p.total = 0;
    }
    game.started = false;
    game.currentIndex = 0;
    resetTurn();
    broadcastState();
    return true;
  }

  // ---------- Socket.IO ----------
  io.on('connection', (socket) => {
    socket.on('join', ({ nick, avatar }) => {
      if (!nick || typeof nick !== 'string') {
        socket.emit('joinRejected', { reason: 'Nick inválido' });
        return;
      }
      const norm = nick.trim();
      if (!norm) {
        socket.emit('joinRejected', { reason: 'Nick vacío' });
        return;
      }

      let chosenAvatar = (typeof avatar === 'string') ? avatar.trim() : '';
      if (!ALLOWED_AVATARS.includes(chosenAvatar)) {
        chosenAvatar = ALLOWED_AVATARS[0];
      }

      const existingNick = game.order.find(n => n.toLowerCase() === norm.toLowerCase());
      if (existingNick) {
        const p = game.players.get(existingNick);
        if (p && p.connected) {
          socket.emit('joinRejected', { reason: 'Nick ya en uso' });
          return;
        }
        p.socketId = socket.id;
        p.connected = true;
        socket.join('room');
        const isFirst = game.order.length > 0 && game.order[0] === existingNick;
        socket.emit('joined', { nick: existingNick, isFirstPlayer: isFirst, gameStarted: game.started, modo: game.modo, abajos: game.abajos });
        broadcastState();
        return;
      }

      const isFirstPlayer = game.order.length === 0;

      const player = {
        socketId: socket.id,
        nick: norm,
        connected: true,
        avatar: chosenAvatar,
        scores: {},
        used: new Set(),
        total: 0
      };
      game.players.set(norm, player);
      game.order.push(norm);

      socket.join('room');
      socket.emit('joined', { nick: norm, isFirstPlayer, gameStarted: game.started, modo: game.modo, abajos: game.abajos });
      broadcastState();
    });

    socket.on('requestState', () => {
      const nicks = game.order;
      for (const nick of nicks) {
        const p = game.players.get(nick);
        if (p && p.socketId === socket.id) {
          socket.emit('state', buildStatePayload(nick));
          return;
        }
      }
    });

    socket.on('startGameWithOptions', ({ modo, abajos, abajosObligados }) => {
      if (game.started) return;
      if (game.order.length === 0) return;

      game.modo = modo;
      game.abajos = abajos;
      game.abajosObligados = abajosObligados;

      game.started = true;
      game.currentIndex = 0;
      resetTurn();

      io.emit('gameStarted', { modo: game.modo, abajos: game.abajos, abajosObligados: game.abajosObligados });

      broadcastState();
    });

    socket.on('startGame', () => {
      if (game.started) return;
      if (game.order.length === 0) return;
      game.started = true;
      game.currentIndex = 0;
      resetTurn();
      broadcastState();
    });

    socket.on('playAgain', () => {
      let requester = null;
      for (const nick of game.order) {
        const p = game.players.get(nick);
        if (p && p.socketId === socket.id) { requester = nick; break; }
      }
      if (!requester) return;

      if (game.order[0] !== requester) {
        socket.emit('playAgainRejected');
        return;
      }

      const modo = game.modo || 'NORMAL';
      const abajos = game.abajos;
      const abajosObligados = game.abajosObligados;

      game.started = true;
      game.currentIndex = 0;
      resetTurn();

      io.emit('gameStarted', { modo, abajos, abajosObligados });
      broadcastState();
    });

    socket.on('roll', ({ holds }) => {
      if (!game.started) return;
      const currentNick = game.order[game.currentIndex];
      const p = game.players.get(currentNick);
      if (!p || p.socketId !== socket.id) return;
      if (game.rolls >= 3) return;

      const holdSet = new Set(Array.isArray(holds) ? holds : []);
      for (let i = 0; i < 5; i++) {
        if (!holdSet.has(i)) {
          game.dice[i] = 1 + Math.floor(Math.random() * 6);
        }
      }
      game.rolls = game.rolls + 1;

      broadcastState();
    });

    socket.on('chooseCategory', ({ category }) => {
      if (!game.started) return;
      if (!CATEGORIES.includes(category)) return;

      const currentNick = game.order[game.currentIndex];
      const p = game.players.get(currentNick);
      if (!p || p.socketId !== socket.id) return;

      if (game.rolls === 0) return;

      if (p.used.has(category)) return;

      const points = computeScoreForCategory(game.dice, category, game.rolls, p);
      p.scores[category] = points;
      p.used.add(category);
      p.total = Object.values(p.scores).reduce((a,b)=>a+(b||0), 0);

      const scoresPayload = {};
      for (const nick of game.order) {
        const pp = game.players.get(nick);
        scoresPayload[nick] = {};
        for (const cat of CATEGORIES) {
          scoresPayload[nick][cat] = pp.scores[cat] ?? null;
        }
      }
      const playersArr = game.order.map(nick => {
        const pp = game.players.get(nick);
        return { nick: pp.nick, total: pp.total, connected: pp.connected, avatar: pp.avatar || ALLOWED_AVATARS[0] };
      });
      io.emit('scoresUpdated', { scores: scoresPayload, players: playersArr });

      if (category === 'GEN' && maxCount(game.dice) === 5 && game.rolls === 1) {
        endGameWithWinner(currentNick, 'GEN en un solo tiro');
        return;
      }

      game.currentIndex = (game.currentIndex + 1) % game.order.length;
      resetTurn();

      if (checkNormalEnd()) return;

      broadcastState();
    });

    socket.on('disconnect', () => {
      for (const nick of game.order) {
        const p = game.players.get(nick);
        if (p && p.socketId === socket.id) {
          p.connected = false;
          break;
        }
      }
      broadcastState();
    });

    socket.on('leave', () => {
      let leavingNick = null;
      for (const nick of game.order) {
        const p = game.players.get(nick);
        if (p && p.socketId === socket.id) {
          leavingNick = nick;
          break;
        }
      }
      if (!leavingNick) return;

      const idx = game.order.indexOf(leavingNick);
      const isCurrent = game.started && (game.currentIndex === idx);

      game.order.splice(idx, 1);
      game.players.delete(leavingNick);

      if (game.order.length === 0) {
        game.started = false;
        game.currentIndex = 0;
        resetTurn();
      } else if (isCurrent) {
        game.currentIndex = (idx % game.order.length);
        resetTurn();
      } else if (idx < game.currentIndex) {
        game.currentIndex -= 1;
      }

      broadcastState();
    });

    socket.on('openNewGame', () => {
      let requester = null;
      for (const nick of game.order) {
        const p = game.players.get(nick);
        if (p && p.socketId === socket.id) { requester = nick; break; }
      }
      if (!requester) return;

      if (game.order[0] !== requester) return;

      // Reset scores for all players so the new game starts with a clean slate
      for (const nick of game.order) {
        const p = game.players.get(nick);
        if (p) {
          p.scores = {};
          p.used = new Set();
          p.total = 0;
        }
      }

      game.started = false;
      game.currentIndex = 0;
      resetTurn();
      broadcastState();

      for (const nick of game.order) {
        if (nick === requester) continue;
        const p = game.players.get(nick);
        if (p && p.socketId) {
          io.to(p.socketId).emit('redirect', { url: 'waiting.html' });
        }
      }
    });
  });
};
