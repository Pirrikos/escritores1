import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PRODUCTION_DOMAIN: z.string().min(1).optional(),
  ADDITIONAL_ALLOWED_ORIGINS: z.string().optional(),
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getValidatedEnv(): z.infer<typeof envSchema> {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment variables: ${issues.join(', ')}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export function assertBackupEnv() {
  const env = getValidatedEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for backup operations');
  }
}