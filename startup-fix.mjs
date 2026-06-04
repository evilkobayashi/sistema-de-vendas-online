// Este script serve para contornar problemas de resolução de módulos no Node.js
// Carrega dotenv e configura o ambiente antes de iniciar o servidor

// Configurar resolução de módulos
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Carregar dotenv
import('dotenv/config');

// Aguardar um pouco para garantir que o dotenv seja carregado
await new Promise(resolve => setTimeout(resolve, 100));

console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

// Validar variáveis de ambiente
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  FEATURE_PATIENTS_V2: z.string().default('true'),
  FEATURE_ELIGIBILITY_GUARD: z.string().default('true'),
  FEATURE_COMMUNICATIONS: z.string().default('true'),
  SHIPPING_FORCE_FAIL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RUNTIME_STORE_DIR: z.string().optional(),
  COMM_FORCE_FAIL: z.string().optional()
});

try {
  const parsed = envSchema.parse(process.env);
  console.log('Variáveis de ambiente válidas!');

  // Importar o app usando require para contornar problemas de resolução de módulos
  const { createApp } = await import('./dist/src/app.js');
  console.log('App importado com sucesso');

  const app = createApp();
  console.log('App criado com sucesso');

  // Se chegou até aqui, tentar iniciar o servidor
  const { createServer } = await import('http');
  const { Server } = await import('socket.io');
  const jwt = await import('jsonwebtoken');

  const port = parsed.PORT;
  const allowedOrigins = parsed.CORS_ORIGINS.split(',');
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
  });

  // Middleware de autenticação para WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token ausente'));

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('ERRO FATAL: JWT_SECRET não está definido nas variáveis de ambiente');
      return next(new Error('Configuração de autenticação inválida'));
    }

    try {
      const payload = jwt.default.verify(token, jwtSecret);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`Nova conexão WebSocket: ${socket.id} | Usuário: ${user?.name}`);
    socket.on('disconnect', () => console.log(`WebSocket desconectado: ${socket.id}`));
  });

  app.set('io', io);

  httpServer.listen(port, () => {
    console.log(`Servidor 4bio iniciado com WebSockets em http://localhost:${port}`);
  });

} catch (error) {
  console.error('Erro crítico:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}