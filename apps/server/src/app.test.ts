import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  process.env.WEB_DIST_DIR = `${process.cwd()}/test-fixtures/web-dist`;
});

import request from 'supertest';
import { build } from './app.js';

describe('konfiguracja aplikacji', () => {
  it('odpowiada na health check', async () => {
    const res = await request(build()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, service: 'server' });
  });

  it('odpowiada na health check pod prefiksem API', async () => {
    const res = await request(build()).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('zwraca błąd 404 w formacie JSON dla nieznanego zasobu API', async () => {
    const res = await request(build()).get('/api/nieistniejace');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Nie znaleziono zasobu' });
  });

  it('serwuje frontend dla tras aplikacji jednostronicowej', async () => {
    const res = await request(build()).get('/kolekcje');
    expect(res.status).toBe(200);
    expect(res.text).toContain('WebAPI Tester');
  });

  it('serwuje frontend dla ścieżki głównej', async () => {
    const res = await request(build()).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('WebAPI Tester');
  });
});

describe('limit zapytań na logowanie', () => {
  it('odmawia żądań po przekroczeniu limitu', async () => {
    const app = build();
    const payload = { email: 'niepoprawny', password: 'x' };

    let lastStatus = 0;
    for (let attempt = 0; attempt < 61; attempt += 1) {
      const res = await request(app).post('/api/auth/login').send(payload);
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});
