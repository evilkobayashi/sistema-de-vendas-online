import { createApp } from './app.js';
import { validateEnv } from './env.js';
import { disconnectDatabase } from './database.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

// Validate env at startup — fail fast if misconfigured
const env = validateEnv();

const port = env.PORT;
const app = createApp();

const allowedOrigins = env.CORS_ORIGINS.split(',');
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
});

// Auth middleware for socket connections — reject unauthenticated WebSocket connections
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Token ausente'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? crypto.randomUUID()) as { id: string; name: string; role: string; employeeCode: string };
    (socket as any).data.user = payload;
    next();
  } catch {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  const user = (socket as any).data.user;
  console.log(`Nova conexão WebSocket: ${socket.id} | Usuário: ${user?.name}`);
  socket.on('disconnect', () => console.log(`WebSocket desconectado: ${socket.id}`));
});

// Attach io to the app so we can emit from routes if needed
app.set('io', io);

const server = httpServer.listen(port, () => {
  console.log(`Servidor 4bio iniciado com WebSockets em http://localhost:${port}`);
});

async function gracefulShutdown() {
  console.log('Iniciando shutdown gracioso...');

  // Stop accepting new connections
  server.close(async () => {
    console.log('Servidor HTTP encerrado.');

    // Disconnect all socket.io clients
    io.close(async () => {
      console.log('WebSocket encerrado.');
    });

    // Disconnect Prisma client to free SQLite file handle
    await disconnectDatabase();
    console.log('Banco de dados desconectado.');

    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown fails
  setTimeout(() => {
    console.error('Forçando saída após timeout de shutdown.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
