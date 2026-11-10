import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { openapiRouter } from './openapi.js';
import { errorHandler } from '../middleware/error.js';

// Testy używają fikcyjnych hostów, więc rozwiązywanie nazw podmieniamy
// na jeden adres publiczny, który przechodzi kontrolę SSRF.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

let app: express.Express;

const SAMPLE_SPEC = {
  openapi: '3.0.0',
  info: { title: 'Pet Store', version: '1.0.0' },
  servers: [{ url: 'https://petstore.example.com/v1' }],
  paths: {
    '/pets': {
      get: {
        summary: 'List pets',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', example: 10 },
          },
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
          {
            name: 'petId',
            in: 'path',
            required: true,
            schema: { type: 'integer', example: 42 },
          },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
};

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(openapiRouter);
  app.use(errorHandler);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('POST /openapi/import (file)', () => {
  it('parses valid spec and returns generated requests', async () => {
    const res = await request(app)
      .post('/openapi/import')
      .send({ fileContent: JSON.stringify(SAMPLE_SPEC) });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Pet Store');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.requests).toHaveLength(3);

    const list = res.body.requests.find(
      (r: { name: string }) => r.name === 'List pets',
    );
    expect(list.method).toBe('GET');
    expect(list.url).toBe('https://petstore.example.com/v1/pets?limit=10');

    const create = res.body.requests.find(
      (r: { name: string }) => r.name === 'Create pet',
    );
    expect(create.method).toBe('POST');
    expect(create.url).toBe('https://petstore.example.com/v1/pets');
    expect(create.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(create.body);
    expect(body).toEqual({ name: 'Buddy', age: 5 });

    const get = res.body.requests.find(
      (r: { name: string }) => r.name === 'Get pet',
    );
    expect(get.url).toBe('https://petstore.example.com/v1/pets/42');
  });

  it('returns diagnostic on invalid JSON', async () => {
    const res = await request(app)
      .post('/openapi/import')
      .send({ fileContent: '{not valid json' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Nie udało się przetworzyć specyfikacji OpenAPI');
    expect(res.body.details).toMatch(/Nieprawidłowy JSON lub YAML/);
  });

  it('returns diagnostic on valid JSON but invalid spec', async () => {
    const res = await request(app)
      .post('/openapi/import')
      .send({
        fileContent: JSON.stringify({ openapi: '3.0.0' /* no info, no paths */ }),
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Nie udało się przetworzyć specyfikacji OpenAPI');
  });

  it('returns empty requests for valid spec with no endpoints', async () => {
    const res = await request(app)
      .post('/openapi/import')
      .send({
        fileContent: JSON.stringify({
          openapi: '3.0.0',
          info: { title: 'Empty', version: '0' },
          paths: {},
        }),
      });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Empty');
    expect(res.body.requests).toEqual([]);
  });

  it('returns 400 when neither url nor fileContent is provided', async () => {
    const res = await request(app).post('/openapi/import').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Nieprawidłowe żądanie');
  });

  it('handles relative server url (path-only base)', async () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Pet Store v3', version: '1.0.0' },
      servers: [{ url: '/api/v3' }],
      paths: {
        '/pet/findByStatus': {
          get: {
            summary: 'Find pets by status',
            parameters: [
              {
                name: 'status',
                in: 'query',
                schema: { type: 'string', default: 'available' },
              },
            ],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const res = await request(app)
      .post('/openapi/import')
      .send({ fileContent: JSON.stringify(spec) });
    expect(res.status).toBe(200);
    const req = res.body.requests[0];
    expect(req.url).toBe('/api/v3/pet/findByStatus?status=available');
  });

  it('exposes baseUrl from URL-import origin when servers is relative', async () => {
    const origin = 'https://petstore3.swagger.io';
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Pet Store v3', version: '1.0.0' },
      servers: [{ url: '/api/v3' }],
      paths: {
        '/pet': {
          get: {
            summary: 'List pets',
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const text = JSON.stringify(spec);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => spec,
        text: async () => text,
        arrayBuffer: async () => new TextEncoder().encode(text).buffer,
      }),
    );
    try {
      const res = await request(app)
        .post('/openapi/import')
        .send({ url: `${origin}/api/v3/openapi.json` });
      expect(res.status).toBe(200);
      const req = res.body.requests[0];
      expect(req.url).toBe('/api/v3/pet');
      expect(req.baseUrl).toBe(origin);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('POST /openapi/import (url)', () => {
  it('returns diagnostic when URL is unreachable', async () => {
    const res = await request(app)
      .post('/openapi/import')
      .send({ url: 'http://invalid.example.test/spec.json' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Nie udało się przetworzyć specyfikacji OpenAPI');
  });

  it('returns generated requests from mocked URL', async () => {
    const text = JSON.stringify(SAMPLE_SPEC);
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => SAMPLE_SPEC,
      text: async () => text,
      arrayBuffer: async () => new TextEncoder().encode(text).buffer,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const res = await request(app)
      .post('/openapi/import')
      .send({ url: 'https://example.com/spec.json' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Pet Store');
    expect(res.body.requests).toHaveLength(3);

    vi.unstubAllGlobals();
  });
});
