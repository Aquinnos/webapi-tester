import { z } from 'zod';

const configSchema = z.object({
  PROXY_PORT: z.coerce.number().int().positive().default(3002),
  PROXY_SHARED_SECRET: z.string().min(16, 'PROXY_SHARED_SECRET must be at least 16 characters'),
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