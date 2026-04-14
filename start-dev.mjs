import 'dotenv/config';
import { createApp } from './src/app.js';
import { validateEnv } from './src/env.js';
import { disconnectDatabase } from './src/database.js';
import { initializeTempDatabase } from './src/temp-db-init.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

console.log('Iniciando servidor...');

const env = validateEnv();
console.log('Porta:', env.PORT);

console.log('Inicializando banco de dados temporário...');
try {
  await initializeTempDatabase();
  console.log('Banco de dados inicializado.');
} catch (error) {
  console.error('Erro ao inicializar banco de dados:', error);
}

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: env.CORS_ORIGINS.split(','), methods: ['GET', 'POST'] }
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Token ausente'));
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return next(new Error('JWT_SECRET não definido'));
  try {
    const payload = jwt.verify(token, jwtSecret);
    (socket as any).data.user = payload;
    next();
  } catch {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  const user = (socket as any).data.user;
  console.log(`WebSocket conectado: ${socket.id} | ${user?.name}`);
  socket.on('disconnect', () => console.log(`WebSocket desconectado: ${socket.id}`));
});

app.set('io', io);

const server = httpServer.listen(env.PORT, () => {
  console.log(`Servidor 4bio iniciado em http://localhost:${env.PORT}`);
});

process.on('SIGTERM', async () => {
  console.log('Shutdown...');
  server.close(() => disconnectDatabase().then(() => process.exit(0)));
});
