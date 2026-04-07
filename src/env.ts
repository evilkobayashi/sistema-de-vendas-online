import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1).describe('Chave secreta para JWT. Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  FEATURE_PATIENTS_V2: z.string().default('true'),
  FEATURE_ELIGIBILITY_GUARD: z.string().default('true'),
  FEATURE_COMMUNICATIONS: z.string().default('true'),
  SHIPPING_FORCE_FAIL: z.string().optional(),
});

export function validateEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    console.error('Variáveis de ambiente inválidas:');
    for (const [key, errors] of Object.entries(details)) {
      for (const err of errors ?? []) {
        console.error(`  ${key}: ${err}`);
      }
    }
    process.exit(1);
  }
  return parsed.data;
}
