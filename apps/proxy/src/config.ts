import { z } from 'zod';
import {
  MIN_KEY_LENGTH,
  resolveAgentKey,
  type AgentKey,
} from './services/agent-key.js';

const configSchema = z.object({
  PROXY_PORT: z.coerce.number().int().positive().default(3002),
  PROXY_BIND_HOST: z.string().min(1).default('127.0.0.1'),
  PROXY_KEY_FILE: z.string().min(1).default('.webapi-tester-agent-key'),
  PROXY_SHARED_SECRET: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().min(MIN_KEY_LENGTH).optional(),
  ),
});

export type Config = Omit<
  z.infer<typeof configSchema>,
  'PROXY_SHARED_SECRET'
> & {
  PROXY_SHARED_SECRET: string;
};

export interface LoadedConfig {
  config: Config;
  agentKey: AgentKey;
}

export function loadConfig(): LoadedConfig {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  const agentKey = resolveAgentKey(
    parsed.data.PROXY_SHARED_SECRET,
    parsed.data.PROXY_KEY_FILE,
  );
  return {
    config: { ...parsed.data, PROXY_SHARED_SECRET: agentKey.value },
    agentKey,
  };
}

const loaded = loadConfig();

export const config: LoadedConfig['config'] = loaded.config;
export const agentKey: LoadedConfig['agentKey'] = loaded.agentKey;
