// server.js
// Servidor Express + Socket.IO. Carga la modalidad de juego desde 'modalities/'.

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
// Serve static files from `public/`. Use `login.html` as the default index.
app.use(express.static('public', { index: 'login.html' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Cargar la modalidad NORMAL (toda la lógica fue movida a modalities/normal.js)
require('./modalities/normal')(io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});