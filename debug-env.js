import 'dotenv/config';

console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
console.log('PORT:', process.env.PORT || 'NOT SET');

// Tentar validar com o schema
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

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.flatten().fieldErrors;
  console.log('Erros de validação:');
  for (const [key, errors] of Object.entries(details)) {
    for (const err of errors ?? []) {
      console.log(`  ${key}: ${err}`);
    }
  }
} else {
  console.log('Variáveis de ambiente válidas!');
}