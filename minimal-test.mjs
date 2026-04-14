// Teste mínimo para identificar o problema
import('dotenv/config')
  .then(() => console.log('dotenv carregado'))
  .catch(err => console.error('Erro ao carregar dotenv:', err));

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

async function test() {
  try {
    console.log('Processando variáveis de ambiente...');
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

    const parsed = envSchema.parse(process.env);
    console.log('Variáveis válidas!');

    // Em vez de importar o app completo, vamos testar partes específicas
    console.log('Tentando importar apenas funções específicas...');

    // Testar importação de funções básicas
    const { setupApp } = await import('./dist/src/app.js');
    console.log('setupApp importado com sucesso');

  } catch (error) {
    console.error('Erro:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();