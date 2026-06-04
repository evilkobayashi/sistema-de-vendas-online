// Adicionar tratamento de erro global antes de qualquer coisa
process.on('uncaughtException', (err) => {
  console.error('Erro não capturado:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rejeição não tratada:', reason);
  process.exit(1);
});

// Carregar dotenv
require('dotenv/config');

console.log('Carregando variáveis de ambiente...');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

// Validar variáveis de ambiente com Zod
const { z } = require('zod');

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

  // Tente importar o app apenas se as variáveis estiverem corretas
  console.log('Tentando importar o app...');
  const { createApp } = require('./dist/src/app.js');
  console.log('Importação bem-sucedida!');

  const app = createApp();
  console.log('App criado com sucesso!');

} catch (error) {
  console.error('Erro durante a inicialização:', error.message);
  console.error('Stack:', error.stack);
}