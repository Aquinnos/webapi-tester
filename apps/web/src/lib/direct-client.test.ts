import { describe, it, expect, afterEach, vi } from 'vitest';
import { directForward } from './direct-client.js';
import { ForwardError } from './forward-error.js';
import { decodeBase64ToText } from './body.js';
import type { ProxyForwardRequestDto } from '@webapi-tester/shared';

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

function mockFetch(response: Response) {
  const mock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('wysylanie bezposrednie z przegladarki', () => {
  it('mapuje odpowiedz na ProxyResponseDto', async () => {
    mockFetch(
      new Response('{"ok":true}', {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      }),
    );
    const result = await directForward(DTO);
    expect(result.status).toBe(200);
    expect(result.statusText).toBe('OK');
    expect(result.bodyContentType).toContain('application/json');
    expect(decodeBase64ToText(result.bodyBase64)).toBe('{"ok":true}');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('lacznie buduje adres z adresu bazowego', async () => {
    const mock = mockFetch(new Response('{}', { status: 200 }));
    await directForward({
      ...DTO,
      url: '/api/v3/pet/1',
      baseUrl: 'https://petstore3.swagger.io',
    });
    expect(mock.mock.calls[0][0]).toBe(
      'https://petstore3.swagger.io/api/v3/pet/1',
    );
  });

  it('odrzuca adres wzgledny bez adresu bazowego', async () => {
    mockFetch(new Response('{}', { status: 200 }));
    await expect(
      directForward({ ...DTO, url: '/api/v3/pet/1' }),
    ).rejects.toMatchObject({ kind: 'config' });
  });

  it('nie wysyla ciała dla metody GET', async () => {
    const mock = mockFetch(new Response('{}', { status: 200 }));
    await directForward(DTO);
    expect(mock.mock.calls[0][1]).toMatchObject({ body: undefined });
  });

  it('wysyla cialo dla metody POST', async () => {
    const mock = mockFetch(new Response('{}', { status: 200 }));
    await directForward({ ...DTO, method: 'POST', body: '{"a":1}' });
    expect(mock.mock.calls[0][1]).toMatchObject({ body: '{"a":1}' });
  });

  it('tlumaczy zablokowane przez przegladarke zadanie na komunikat o CORS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    const error = await directForward(DTO).catch((err) => err);
    expect(error).toBeInstanceOf(ForwardError);
    expect(error.kind).toBe('cors');
    expect(error.hint).toContain('agenta proxy');
  });
});
