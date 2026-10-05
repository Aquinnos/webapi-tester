import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { forwardRequest } from './proxy-forward.js';

let server: Server;
let baseUrl: string;

// 
beforeAll(async () => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ hello: 'world' }));
   return;
      }
      if (req.url === '/echo' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const body = Buffer.concat(chunks);
          res.writeHead(200, {
            'Content-Type': req.headers['content-type'] ?? 'application/octet-stream',
          });
          res.end(body);
        });
        return;
      }
      if (req.url === '/slow') {
        setTimeout(() => {
          res.writeHead(200);
          res.end('done');
        }, 2000);
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });
  
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('proxy-forward service', () => {
    it('forwards a GET and returns status, headers, body, duration', async () => {
      const result = await forwardRequest({
        method: 'GET',
        url: `${baseUrl}/json`,
        headers: {},
        body: '',
        bodyEncoding: 'utf-8',
      });
      expect(result.status).toBe(200);
      expect(result.statusText).toBe('OK');
      expect(result.headers['content-type']).toContain('application/json');
      expect(Buffer.from(result.bodyBase64, 'base64').toString('utf-8')).toBe(
        '{"hello":"world"}',
      );
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('forwards POST with utf-8 body', async () => {
      const result = await forwardRequest({
        method: 'POST',
        url: `${baseUrl}/echo`,
        headers: { 'Content-Type': 'application/json' },
        body: '{"a":1}',
        bodyEncoding: 'utf-8',
      });
      expect(result.status).toBe(200);
      expect(Buffer.from(result.bodyBase64, 'base64').toString('utf-8')).toBe('{"a":1}');
    });
  
    it('handles binary body via base64 encoding', async () => {
      const result = await forwardRequest({
        method: 'POST',
        url: `${baseUrl}/echo`,
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from([0x00, 0x01, 0x02]).toString('base64'),
        bodyEncoding: 'base64',
      });
      expect(result.status).toBe(200);
      const echoed = Buffer.from(result.bodyBase64, 'base64');
      expect(Array.from(echoed)).toEqual([0x00, 0x01, 0x02]);
    });

    it('times out on slow upstream', async () => {
      await expect(
        forwardRequest(
          {
            method: 'GET',
            url: `${baseUrl}/slow`,
            headers: {},
            body: '',
            bodyEncoding: 'utf-8',
          },
          { timeoutMs: 100 },
        ),
      ).rejects.toThrow(/timed/i);
    });

    it('propagates upstream 4xx status', async () => {
      const result = await forwardRequest({
        method: 'GET',
        url: `${baseUrl}/missing`,
        headers: {},
        body: '',
        bodyEncoding: 'utf-8',
      });
      expect(result.status).toBe(404);
    });

    it('throws on network errors', async () => {
      await expect(
        forwardRequest({
          method: 'GET', 
          url: 'http://127.0.0.1:1',
          headers: {},
          body: '',
          bodyEncoding: 'utf-8',
        }),
      ).rejects.toThrow();
    });
  });
