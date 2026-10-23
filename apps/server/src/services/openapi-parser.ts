import SwaggerParser from '@apidevtools/swagger-parser';
import { parse as parseYaml } from 'yaml';
import type { GeneratedRequestDto, HttpMethod } from '@webapi-tester/shared';

export interface OpenApiParseInput {
  url?: string;
  fileContent?: string;
}

export interface OpenApiParseResult {
  title: string;
  version: string;
  requests: GeneratedRequestDto[];
}

export class OpenApiParseError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
  }
}

interface JsonSchema {
  type?: string;
  example?: unknown;
  default?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
}

interface Operation {
  summary?: string;
  description?: string;
  operationId?: string;
  requestBody?: {
    content?: Record<string, { schema?: JsonSchema; example?: unknown }>;
  };
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header';
    required?: boolean;
    schema?: JsonSchema;
    example?: unknown;
  }>;
}

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
] as const;
type MethodLower = (typeof HTTP_METHODS)[number];

//
// WF4: specyfikacja w formacie JSON lub YAML.
function parseSpecContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch (jsonErr) {
    try {
      return parseYaml(content);
    } catch (yamlErr) {
      const detail = yamlErr instanceof Error ? yamlErr.message : 'parse error';
      const fallback = jsonErr instanceof Error ? jsonErr.message : 'parse error';
      throw new OpenApiParseError(
        `Invalid JSON or YAML (JSON: ${fallback}; YAML: ${detail})`,
        400,
      );
    }
  }
}

export async function parseOpenApi(
  input: OpenApiParseInput,
): Promise<OpenApiParseResult> {
  if (!input.url && !input.fileContent) {
    throw new OpenApiParseError('Either url or fileContent is required', 400);
  }

  let rawSpec: unknown;
  let importOrigin: string | null = null;
  if (input.url) {
    try {
      importOrigin = new URL(input.url).origin;
    } catch {
      throw new OpenApiParseError(`Invalid import URL: ${input.url}`, 400);
    }
    try {
      const res = await fetch(input.url);
      if (!res.ok) {
        throw new OpenApiParseError(
          `Failed to fetch spec: ${res.status} ${res.statusText}`,
          502,
        );
      }
      rawSpec = parseSpecContent(await res.text());
    } catch (err) {
      if (err instanceof OpenApiParseError) throw err;
      throw new OpenApiParseError(
        err instanceof Error ? err.message : 'Network error',
        502,
      );
    }
  } else {
    rawSpec = parseSpecContent(input.fileContent!);
  }

  let api: {
    info?: { title?: string; version?: string };
    servers?: Array<{ url?: string }>;
    paths?: Record<string, Record<string, Operation> | undefined>;
  };
  try {
    api = (await SwaggerParser.validate(
      JSON.parse(JSON.stringify(rawSpec)),
    )) as typeof api;
  } catch (err) {
    throw new OpenApiParseError(
      `Invalid OpenAPI spec: ${err instanceof Error ? err.message : 'unknown error'}`,
      400,
    );
  }

  const rawBaseUrl = api.servers?.[0]?.url ?? '';
  const baseUrl = rawBaseUrl;
  const requests: GeneratedRequestDto[] = [];

  if (!api.paths || Object.keys(api.paths).length === 0) {
    return {
      title: api.info?.title ?? 'Untitled',
      version: api.info?.version ?? '0.0.0',
      requests: [],
    };
  }

  for (const [path, methods] of Object.entries(api.paths)) {
    if (!methods || typeof methods !== 'object') continue;

    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method as MethodLower)) continue;
      if (!op || typeof op !== 'object') continue;

      const operation = op as Operation;
      const upperMethod = method.toUpperCase() as HttpMethod;

      let resolvedPath = path;
      const queryParams: Record<string, string> = {};
      const headers: Record<string, string> = {};

      for (const param of operation.parameters ?? []) {
        const exampleValue =
          param.example !== undefined
            ? param.example
            : (param.schema?.example !== undefined
                ? param.schema.example
                : param.schema?.default);
        if (param.in === 'path') {
          const value =
            exampleValue !== undefined
              ? String(exampleValue)
              : String(generateSample(param.schema));
          resolvedPath = resolvedPath.replace(`{${param.name}}`, value);
        } else if (param.in === 'query' && exampleValue !== undefined) {
          queryParams[param.name] = String(exampleValue);
        } else if (param.in === 'header' && exampleValue !== undefined) {
          headers[param.name] = String(exampleValue);
        }
      }

      const queryString = new URLSearchParams(queryParams).toString();
      const fullUrl =
        baseUrl + resolvedPath + (queryString ? `?${queryString}` : '');
      const needsRelativeBase =
        importOrigin !== null &&
        rawBaseUrl !== '' &&
        !rawBaseUrl.startsWith('http://') &&
        !rawBaseUrl.startsWith('https://');

      let body = '';
      const jsonContent = operation.requestBody?.content?.['application/json'];
      if (jsonContent) {
        if (jsonContent.example !== undefined) {
          body = JSON.stringify(jsonContent.example, null, 2);
        } else if (jsonContent.schema) {
          body = JSON.stringify(generateSample(jsonContent.schema), null, 2);
        }
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }

      const name =
        operation.summary || operation.operationId || `${upperMethod} ${path}`;
      const description = operation.description || operation.summary || '';

      const dto: GeneratedRequestDto = {
        name,
        method: upperMethod,
        url: fullUrl,
        headers,
        body,
        bodyEncoding: 'utf-8',
        description,
      };
      if (needsRelativeBase && importOrigin !== null) {
        dto.baseUrl = importOrigin;
      }
      requests.push(dto);
    }
  }

  return {
    title: api.info?.title ?? 'Untitled',
    version: api.info?.version ?? '0.0.0',
    requests,
  };
}

function generateSample(schema: JsonSchema | undefined): unknown {
  if (!schema) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  switch (schema.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'null':
      return null;
    case 'array':
      return schema.items ? [generateSample(schema.items)] : [];
    case 'object': {
      const obj: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
        obj[key] = generateSample(propSchema);
      }
      return obj;
    }
    default:
      return null;
  }
}
