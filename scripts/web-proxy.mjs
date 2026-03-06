import http from 'node:http';
import process from 'node:process';

const TARGET_ORIGIN = process.env.UNQX_PROXY_TARGET ?? 'https://unqx.uz';
const PORT = Number(process.env.UNQX_PROXY_PORT ?? 8787);

const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:8081',
  'http://localhost:8081',
  'http://127.0.0.1:19006',
  'http://localhost:19006',
]);

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-csrf-token, Accept, Origin, Referer, User-Agent',
  );
}

function rewriteSetCookie(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  if (!raw.length) {
    return [];
  }

  return raw.map((cookie) =>
    cookie
      .replace(/;\s*Domain=[^;]+/gi, '')
      .replace(/;\s*Secure/gi, ''),
  );
}

function copyRequestHeaders(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (lower === 'host' || lower === 'origin' || lower === 'referer' || lower === 'content-length') {
      continue;
    }
    if (Array.isArray(value)) {
      headers.set(key, value.join('; '));
    } else {
      headers.set(key, value);
    }
  }
  headers.set('origin', TARGET_ORIGIN);
  headers.set('referer', `${TARGET_ORIGIN}/`);
  return headers;
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const path = req.url || '/';
    const targetUrl = `${TARGET_ORIGIN}${path}`;
    const method = req.method || 'GET';
    const headers = copyRequestHeaders(req);

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : req,
      duplex: method === 'GET' || method === 'HEAD' ? undefined : 'half',
      redirect: 'manual',
    });

    res.statusCode = upstream.status;

    for (const [key, value] of upstream.headers.entries()) {
      const lower = key.toLowerCase();
      if (
        lower === 'set-cookie' ||
        lower === 'access-control-allow-origin' ||
        lower === 'content-length' ||
        lower === 'content-encoding' ||
        lower === 'transfer-encoding' ||
        lower === 'connection' ||
        lower === 'cross-origin-resource-policy' ||
        lower === 'cross-origin-opener-policy' ||
        lower === 'cross-origin-embedder-policy'
      ) {
        continue;
      }
      res.setHeader(key, value);
    }

    const setCookies = rewriteSetCookie(upstream.headers);
    if (setCookies.length) {
      res.setHeader('Set-Cookie', setCookies);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Length', String(buf.length));
    res.end(buf);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Proxy request failed',
        message: error instanceof Error ? error.message : 'Unknown proxy error',
      }),
    );
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[unqx-web-proxy] listening at http://127.0.0.1:${PORT} -> ${TARGET_ORIGIN}`);
});
