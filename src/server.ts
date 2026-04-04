import { createApp } from './app.js';
import { createServer } from 'http';
import { Server } from 'socket.io';

const port = Number(process.env.PORT || 3000);
const app = createApp();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  console.log(`Nova conexão WebSocket: ${socket.id}`);
  socket.on('disconnect', () => console.log(`WebSocket desconectado: ${socket.id}`));
});

// Attach io to the app so we can emit from routes if needed
app.set('io', io);

httpServer.listen(port, () => {
  console.log(`Servidor 4bio iniciado com WebSockets em http://localhost:${port}`);
});
