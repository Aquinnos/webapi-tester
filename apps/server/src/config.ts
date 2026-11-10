import { z } from 'zod';

const optionalText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVER_PORT: z.coerce.number().int().positive().default(3001),
  // Platforma chmurowa (Render) wstrzykuje PORT, lokalnie używamy SERVER_PORT.
  PORT: z.coerce.number().int().positive().optional(),
  BIND_HOST: z.string().min(1).default('0.0.0.0'),
  // Lista originów frontu, dla których API dopuszcza żądania CORS.
  WEB_ORIGIN: optionalText,
  // Katalog ze zbudowanym frontendem, gdy serwer podaje go sam.
  WEB_DIST_DIR: optionalText,
  // Pusta lista oznacza, że import OpenAPI przyjmuje dowolny host publiczny.
  OPENAPI_IMPORT_ALLOWED_HOSTS: optionalText,
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  // Schemat bazy jest idempotentny, więc można go stosować przy starcie usługi.
  RUN_MIGRATIONS_ON_START: z
    .string()
    .optional()
    .transform((value) => value !== 'false'),
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

export const port: number = config.PORT ?? config.SERVER_PORT;

export const allowedOrigins: string[] = (config.WEB_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

export const allowedImportHosts: string[] = (
  config.OPENAPI_IMPORT_ALLOWED_HOSTS ?? ''
)
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter((host) => host.length > 0);
