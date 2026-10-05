import { z } from 'zod';

const configSchema = z.object({
  SERVER_PORT: z.coerce.number().int().positive().default(3001),
  POSTGRES_URL: z.string().url(),
  JWT_SECRET_KEY: z.string().min(32, 'JWT_SECRET_KEY must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  return parsed.data;
}

export const config: Config = loadConfig();