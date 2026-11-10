import { describe, it, expect, afterEach, vi } from 'vitest';
import { agentForward, probeAgent } from './agent-client.js';
import { ForwardError } from './forward-error.js';
import type { ProxyForwardRequestDto } from '@webapi-tester/shared';

const SETTINGS = { url: 'http://127.0.0.1:3002', key: 'klucz-agenta' };

const DTO: ProxyForwardRequestDto = {
  method: 'GET',
  url: 'https://example.com/data',
  headers: {},
  body: '',
  bodyEncoding: 'utf-8',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init)),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('rozmowa z agentem proxy', () => {
  it('rozpoznaje agenta, ktory odpowiada', async () => {
    mockFetch((url) =>
      url.endsWith('/health')
        ? new Response('{"ok":true}', { status: 200 })
        : new Response('{"ok":true}', { status: 200 }),
    );
    const status = await probeAgent(SETTINGS);
    expect(status.reachable).toBe(true);
    expect(status.authorized).toBe(true);
  });

  it('rozpoznaje agenta bez klucza', async () => {
    mockFetch(() => new Response('{"ok":true}', { status: 200 }));
    const status = await probeAgent({ url: SETTINGS.url, key: '' });
    expect(status.reachable).toBe(true);
    expect(status.authorized).toBe(false);
  });

  it('rozpoznaje bledny klucz', async () => {
    mockFetch((url) =>
      url.endsWith('/health')
        ? new Response('{"ok":true}', { status: 200 })
        : new Response('{"error":"zly klucz"}', { status: 401 }),
    );
    const status = await probeAgent(SETTINGS);
    expect(status.reachable).toBe(true);
    expect(status.authorized).toBe(false);
  });

  it('zgłasza agenta, ktory nie odpowiada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    const status = await probeAgent(SETTINGS);
    expect(status).toEqual({ reachable: false, authorized: false });
  });
});

describe('przekazywanie zadania przez agenta', () => {
  it('wymaga klucza', async () => {
    const error = await agentForward(DTO, {
      url: SETTINGS.url,
      key: '',
    }).catch((err) => err);
    expect(error).toBeInstanceOf(ForwardError);
    expect(error.kind).toBe('config');
  });

  it('wysyla naglowek X-Proxy-Key', async () => {
    const mock = mockFetch(() =>
      new Response('{"status":200}', { status: 200 }),
    );
    await agentForward(DTO, SETTINGS);
    const init = mock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ 'X-Proxy-Key': SETTINGS.key });
  });

  it('tlumaczy odpowiedz 401 na problem z kluczem', async () => {
    mockFetch(() =>
      new Response('{"error":"Nieprawidłowy klucz"}', { status: 401 }),
    );
    const error = await agentForward(DTO, SETTINGS).catch((err) => err);
    expect(error).toBeInstanceOf(ForwardError);
    expect(error.status).toBe(401);
    expect(error.kind).toBe('config');
  });

  it('tlumaczy brak odpowiedzi agenta na blad sieciowy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    const error = await agentForward(DTO, SETTINGS).catch((err) => err);
    expect(error).toBeInstanceOf(ForwardError);
    expect(error.isNetwork).toBe(true);
    expect(error.hint).toContain('docker run');
  });
});
