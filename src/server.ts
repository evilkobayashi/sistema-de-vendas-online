console.log('Iniciando servidor...');
console.log('Carregando módulos...');

import 'dotenv/config';
import { createApp } from './app.js';
console.log('Módulo app.js carregado');

import { validateEnv } from './env.js';
console.log('Módulo env.js carregado');

import { disconnectDatabase } from './database.js';
console.log('Módulo database.js carregado');

import { initializeTempDatabase } from './temp-db-init.js';
console.log('Módulo temp-db-init.js carregado');

import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

console.log('Módulos básicos carregados. Validando variáveis de ambiente...');

// Validate env at startup — fail fast if misconfigured
const env = validateEnv();
console.log('Variáveis de ambiente válidas. Porta:', env.PORT);

// Initialize temporary database with sample data
console.log('Inicializando banco de dados temporário com dados de exemplo...');
try {
  await initializeTempDatabase();
  console.log('Banco de dados temporário inicializado com sucesso.');
} catch (error) {
  console.error('Erro ao inicializar banco de dados temporário:', error);
  console.error('Continuando com dados existentes...');
}

const port = env.PORT;
const app = createApp();

const allowedOrigins = env.CORS_ORIGINS.split(',');
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

// Auth middleware for socket connections — reject unauthenticated WebSocket connections
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Token ausente'));

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('ERRO FATAL: JWT_SECRET não está definido nas variáveis de ambiente');
    return next(new Error('Configuração de autenticação inválida'));
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as { id: string; name: string; role: string; employeeCode: string };
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
