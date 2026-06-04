// Script para depuração completa do problema
import 'dotenv/config';

// Tratamento de erros global
process.on('uncaughtException', (err) => {
  console.error('Exceção não capturada:', err);
  console.error('Stack:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rejeição de promessa não tratada:', reason);
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
  process.exit(1);
});

console.log('=== INICIANDO DEBUG DO SERVIDOR ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET (length: ' + process.env.JWT_SECRET.length + ')' : 'NOT SET');

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
  console.log('\n1. Validando variáveis de ambiente...');
  const parsed = envSchema.parse(process.env);
  console.log('✓ Variáveis de ambiente válidas');

  console.log('\n2. Tentando importar createApp...');
  const { createApp } = await import('./dist/src/app.js');
  console.log('✓ createApp importado com sucesso');

  console.log('\n3. Criando aplicação...');
  const app = createApp();
  console.log('✓ Aplicação criada com sucesso');

  console.log('\n4. Tentando importar outros módulos necessários...');
  const { disconnectDatabase } = await import('./dist/src/database.js');
  const { createServer } = await import('http');
  const { Server } = await import('socket.io');
  console.log('✓ Módulos necessários importados');

  console.log('\n5. Configurando servidor HTTP...');
  const port = parsed.PORT;
  const allowedOrigins = parsed.CORS_ORIGINS.split(',');
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
  });

  console.log('\n6. Configurando autenticação WebSocket...');
  const jwt = await import('jsonwebtoken');

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

  console.log('\n7. Iniciando servidor...');
  httpServer.listen(port, () => {
    console.log(`\n✅ Servidor 4bio iniciado com WebSockets em http://localhost:${port}`);
  });

  console.log('\n8. Configurando shutdown gracioso...');
  async function gracefulShutdown() {
    console.log('Iniciando shutdown gracioso...');

    httpServer.close(async () => {
      console.log('Servidor HTTP encerrado.');

      io.close(async () => {
        console.log('WebSocket encerrado.');
      });

      await disconnectDatabase();
      console.log('Banco de dados desconectado.');

      process.exit(0);
    });

    setTimeout(() => {
      console.error('Forçando saída após timeout de shutdown.');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  console.log('\n🎉 Servidor iniciado com sucesso! Aguardando conexões...');

} catch (error) {
  console.error('\n❌ Erro crítico ao iniciar o servidor:');
  console.error('Mensagem:', error.message);
  console.error('Nome:', error.name);
  if (error.cause) {
    console.error('Causa:', error.cause);
  }
  console.error('Stack completo:', error.stack);

  // Tentar identificar o tipo específico de erro
  if (error.code) {
    console.error('Código do erro:', error.code);
  }

  process.exit(1);
}