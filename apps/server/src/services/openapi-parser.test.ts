import { describe, it, expect, afterEach, vi } from 'vitest';
import { parseOpenApi, OpenApiParseError } from './openapi-parser.js';

// Wymaganie WF4: specyfikacja w formacie JSON lub YAML, plik albo adres URL;
// po walidacji generuje kolekcję z metodą, adresem URL i przykładowym ciałem.
const SPEC_JSON = {
  openapi: '3.0.0',
  info: { title: 'Pet Store', version: '1.0.0' },
  servers: [{ url: 'https://petstore.example.com/v1' }],
  paths: {
    '/pets': {
      get: {
        summary: 'List pets',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 10 } },
        ],
        responses: { '200': { description: 'ok' } },
      },
      post: {
        summary: 'Create pet',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Buddy' },
                  age: { type: 'integer', example: 5 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'created' } },
      },
    },
    '/pets/{petId}': {
      get: {
        summary: 'Get pet',
        parameters: [
          { name: 'petId', in: 'path', required: true, schema: { type: 'integer', example: 42 } },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
};

const SPEC_YAML = `openapi: 3.0.0
info:
  title: Pet Store
  version: 1.0.0
servers:
  - url: https://petstore.example.com/v1
paths:
  /pets:
    get:
      summary: List pets
      responses:
        "200":
          description: ok
`;

function findRequest(
  requests: Array<{ method: string; url: string }>,
  method: string,
  urlPart: string,
) {
  const match = requests.find((r) => r.method === method && r.url.includes(urlPart));
  if (!match) throw new Error(`No generated request ${method} ${urlPart}`);
  return match;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseOpenApi from file content (WF4)', () => {
  it('generates one request per endpoint with method and URL', async () => {
    const result = await parseOpenApi({ fileContent: JSON.stringify(SPEC_JSON) });

    expect(result.title).toBe('Pet Store');
    expect(result.version).toBe('1.0.0');
    expect(result.requests).toHaveLength(3);
    findRequest(result.requests, 'GET', '/pets?limit=10');
    findRequest(result.requests, 'POST', '/pets');
    findRequest(result.requests, 'GET', '/pets/42');
  });

  it('fills an example request body derived from requestBody schema', async () => {
    const result = await parseOpenApi({ fileContent: JSON.stringify(SPEC_JSON) });
    const post = findRequest(result.requests, 'POST', '/pets');

    expect(post).toHaveProperty('body');
    expect(JSON.parse((post as { body: string }).body)).toEqual({
      name: 'Buddy',
      age: 5,
    });
    expect((post as { headers: Record<string, string> }).headers['Content-Type']).toBe(
      'application/json',
    );
  });

  it('builds a sample body from schema types when no example is given', async () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Typed', version: '1.0.0' },
      paths: {
        '/items': {
          post: {
            summary: 'Create item',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      count: { type: 'integer' },
                      active: { type: 'boolean' },
                      tags: { type: 'array', items: { type: 'string' } },
                      state: { type: 'string', enum: ['now', 'later'] },
                    },
                  },
                },
              },
            },
            responses: { '201': { description: 'created' } },
          },
        },
      },
    };

    const result = await parseOpenApi({ fileContent: JSON.stringify(spec) });
    const post = findRequest(result.requests, 'POST', '/items');

    expect(JSON.parse((post as { body: string }).body)).toEqual({
      label: 'string',
      count: 0,
      active: false,
      tags: ['string'],
      state: 'now',
    });
  });

  it('returns an empty list for a valid spec with no endpoints', async () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Empty', version: '1.0.0' },
      paths: {},
    };
    const result = await parseOpenApi({ fileContent: JSON.stringify(spec) });
    expect(result.requests).toEqual([]);
  });

  it('reports a diagnostic cause for malformed JSON', async () => {
    await expect(parseOpenApi({ fileContent: '{ to jest nie json' })).rejects.toThrow(
      /Nieprawidłowy JSON lub YAML/,
    );
  });

  it('reports a diagnostic cause for a structurally invalid spec', async () => {
    const broken = JSON.stringify({ openapi: '3.0.0', info: { title: 'No paths' } });
    await expect(parseOpenApi({ fileContent: broken })).rejects.toBeInstanceOf(
      OpenApiParseError,
    );
  });

  it('accepts a YAML specification', async () => {
    const result = await parseOpenApi({ fileContent: SPEC_YAML });

    expect(result.title).toBe('Pet Store');
    expect(result.requests).toHaveLength(1);
    findRequest(result.requests, 'GET', '/pets');
  });

  it('requires either url or fileContent', async () => {
    await expect(parseOpenApi({})).rejects.toThrow(/Wymagane jest pole url lub fileContent/);
  });
});

describe('parseOpenApi from URL (WF4)', () => {
  it('fetches the spec and generates requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(SPEC_JSON), { status: 200 })),
    );

    const result = await parseOpenApi({ url: 'https://specs.example.com/openapi.json' });

    expect(result.requests).toHaveLength(3);
    findRequest(result.requests, 'GET', 'https://petstore.example.com/v1/pets?limit=10');
  });

  it('rejects a malformed import URL', async () => {
    await expect(parseOpenApi({ url: 'to nie jest url' })).rejects.toThrow(
      /Nieprawidłowy adres importu/,
    );
  });

  it('surfaces the status code when the spec cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 404, statusText: 'Not Found' })),
    );

    await expect(parseOpenApi({ url: 'https://specs.example.com/missing.json' })).rejects.toThrow(
      /404/,
    );
  });

  it('exposes the import origin as baseUrl when the server url is relative', async () => {
    const relativeSpec = {
      openapi: '3.0.0',
      info: { title: 'Relative', version: '1.0.0' },
      servers: [{ url: '/v1' }],
      paths: {
        '/things': {
          get: { summary: 'List things', responses: { '200': { description: 'ok' } } },
        },
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(relativeSpec), { status: 200 })),
    );

    const result = await parseOpenApi({ url: 'https://api.example.com/openapi.json' });
    const get = findRequest(result.requests, 'GET', '/things');

    expect((get as { baseUrl?: string }).baseUrl).toBe('https://api.example.com');
    expect(get.url).toBe('/v1/things');
  });
});