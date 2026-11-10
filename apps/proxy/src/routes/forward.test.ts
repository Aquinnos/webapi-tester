import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { forwardRouter } from './forward.js';
import { corsMiddleware } from '../services/cors.js';
import { config } from '../config.js';

const VALID_KEY = config.PROXY_SHARED_SECRET;
const METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
] as const;

let app: express.Express;
let fetchMock: ReturnType<typeof vi.fn>;
let lastArgs: unknown[];

function mockUpstream(body: string, contentType = 'application/json') {
  const headers = new Headers({ 'Content-Type': contentType });
  const buffer = new TextEncoder().encode(body).buffer;
  fetchMock = vi.fn().mockImplementation((...args: unknown[]) => {
    lastArgs = args;
    return Promise.resolve({
      status: 200,
      statusText: 'OK',
      headers,
      arrayBuffer: async () => buffer,
    });
  });
  vi.stubGlobal('fetch', fetchMock);
}

const PAYLOAD = {
  method: 'GET',
  url: 'https://example.com/data',
  headers: {},
  body: '',
  bodyEncoding: 'utf-8',
};

beforeEach(() => {
  app = express();
  app.use(corsMiddleware);
  app.use(express.json());
  app.use('/', forwardRouter);
  lastArgs = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('autoryzacja kluczem wspoldzielonym (WNF1)', () => {
  it('odrzuca zadanie bez naglowka X-Proxy-Key', async () => {
    mockUpstream('{}');
    const res = await request(app).post('/forward').send(PAYLOAD);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('odrzuca zadanie z blednym kluczem', async () => {
    mockUpstream('{}');
    const res = await request(app)
      .post('/forward')
      .set('X-Proxy-Key', 'wrong-key-wrong-key')
      .send(PAYLOAD);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('przyjmuje zadanie z poprawnym kluczem', async () => {
    mockUpstream('{"ok":true}');
    const res = await request(app)
      .post('/forward')
      .set('X-Proxy-Key', VALID_KEY)
      .send(PAYLOAD);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('endpoint sesji agenta', () => {
  it('odrzuca probe bez naglowka X-Proxy-Key', async () => {
    const res = await request(app).get('/session');
    expect(res.status).toBe(401);
  });

  it('odrzuca probe z blednym kluczem', async () => {
    const res = await request(app)
      .get('/session')
      .set('X-Proxy-Key', 'wrong-key-wrong-key');
    expect(res.status).toBe(401);
  });

  it('potwierdza poprawny klucz bez zadania do celu', async () => {
    mockUpstream('{}');
    const res = await request(app).get('/session').set('X-Proxy-Key', VALID_KEY);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('obsluguje preflight OPTIONS', async () => {
    const res = await request(app)
      .options('/session')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});

describe('naglowki CORS (WF7)', () => {
  it('dolacza naglowki CORS do odpowiedzi sukcesu', async () => {
    mockUpstream('{}');
    const res = await request(app)
      .post('/forward')
      .set('X-Proxy-Key', VALID_KEY)
      .send(PAYLOAD);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
  });

  it('dolacza naglowki CORS do odpowiedzi 401', async () => {
    mockUpstream('{}');
    const res = await request(app).post('/forward').send(PAYLOAD);
    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('obsluguje preflight OPTIONS', async () => {
    const res = await request(app)
      .options('/forward')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-headers']).toContain(
      'X-Proxy-Key',
    );
  });
});

describe('walidacja ladunku', () => {
  it('odrzuca pusty url', async () => {
    mockUpstream('{}');
    const res = await request(app)
      .post('/forward')
      .set('X-Proxy-Key', VALID_KEY)
      .send({ ...PAYLOAD, url: '' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('odrzuca nieprawidlowa metode', async () => {
    mockUpstream('{}');
    const res = await request(app)
      .post('/forward')
      .set('X-Proxy-Key', VALID_KEY)
      .send({ ...PAYLOAD, method: 'INVALID' });
    expect(res.status).toBe(400);
  });
});

describe('przekazywanie zadania (WF7)', () => {
  it('przekazuje metode, adres i naglowki do celu', async () => {
    mockUpstream('{}');
    await request(app)
      .post('/forward')
      .set('X-Proxy-Key', VALID_KEY)
      .send({
        ...PAYLOAD,
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    expect(lastArgs[0]).toBe('https://example.com/data');
    expect(lastArgs[1]).toMatchObject({
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  });

  it('obsługuje wszystkie siedem metod HTTP', async () => {
    for (const method of METHODS) {
      mockUpstream('{}');
      const body = method === 'GET' || method === 'HEAD' ? '' : '{}';
      const res = await request(app)
        .post('/forward')
        .set('X-Proxy-Key', VALID_KEY)
        .send({ ...PAYLOAD, method, body });
      expect(res.status).toBe(200);
      expect(lastArgs[1]).toMatchObject({ method });
    }
  });

  it('dekoduje cialo base64 do bufora', async () => {
    mockUpstream('{}');
    await request(app)
      .post('/forward')
      .set('X-Proxy-Key', VALID_KEY)
      .send({
        ...PAYLOAD,
        method: 'POST',
        body: Buffer.from([1, 2, 3, 4]).toString('base64'),
        bodyEncoding: 'base64',
      });
    const init = lastArgs[1] as { body: Buffer };
    expect(Buffer.isBuffer(init.body)).toBe(true);
    expect([...init.body]).toEqual([1, 2, 3, 4]);
  });

  it('łączy baseUrl ze ścieżką względną', async () => {
    mockUpstream('{}');
    await request(app)
      .post('/forward')
      .set('X-Proxy-Key', VALID_KEY)
      .send({
        ...PAYLOAD,
        url: '/api/v3/pet/1',
        baseUrl: 'https://petstore3.swagger.io',
      });
    expect(lastArgs[0]).toBe('https://petstore3.swagger.io/api/v3/pet/1');
  });

  it('zwraca kompletne ProxyResponseDto', async () => {
    mockUpstream('{"ok":true}');
    const res = await request(app)
      .post('/forward')
      .set('X-Proxy-Key', VALID_KEY)
      .send(PAYLOAD);
    expect(res.body.status).toBe(200);
    expect(res.body.statusText).toBe('OK');
    expect(res.body.bodyContentType).toContain('application/json');
    expect(res.body.durationMs).toBeGreaterThanOrEqual(0);
    const decoded = Buffer.from(res.body.bodyBase64, 'base64').toString(
      'utf-8',
    );
    expect(JSON.parse(decoded)).toEqual({ ok: true });
  });

  it('tlumaczy blad polaczenia z celem na komunikat po polsku', async () => {
    // Node zglasza nieudane polaczenie jako TypeError o nazwie "TypeError".
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );
    const res = await request(app)
      .post('/forward')
      .set('X-Proxy-Key', VALID_KEY)
      .send(PAYLOAD);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Nie udało się połączyć z podanym adresem');
  });

  it('raportuje blad sieci celu jako 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('fetch failed')),
    );
    const res = await request(app)
      .post('/forward')
      .set('X-Proxy-Key', VALID_KEY)
      .send(PAYLOAD);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('fetch failed');
  });
});
