import { createHmac } from 'crypto';
import { initTracer, flushTracer, trace, context, propagation, SpanStatusCode } from '../packages/shared/src/tracer.js';

process.env.SERVICE_NAME = 'test-script';
const tracer = initTracer();

const LOCAL_URL = `http://127.0.0.1:${process.env.PORT ?? 3001}`;
const AWS_URL = process.env.AWS_API_URL ?? '';

// First arg: --local | --aws | (omitted → local)
const targetArg = process.argv[2]?.startsWith('--') ? process.argv[2] : undefined;
const ITEM_ID = (targetArg ? process.argv[3] : process.argv[2]) ?? 'item-001';

function resolveBaseUrl(): string {
  if (targetArg === '--aws') {
    if (!AWS_URL) {
      console.error('AWS_API_URL is not set in .env.local');
      process.exit(1);
    }
    return AWS_URL.replace(/\/$/, '');
  }
  // --local or default
  return LOCAL_URL;
}

const BASE_URL = process.env.API_URL ?? resolveBaseUrl();
const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret';

function makeJwt(secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'test-user',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

async function get(path: string, token: string): Promise<unknown> {
  return tracer.startActiveSpan(`GET ${path}`, async (span) => {
    const url = `${BASE_URL}${path}`;
    console.log(`\nGET ${url}`);

    // Inject W3C traceparent so the API spans link to this trace
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    propagation.inject(context.active(), headers);

    try {
      const res = await fetch(url, { headers });
      console.log(`→ HTTP ${res.status}`);
      span.setAttribute('http.status_code', res.status);
      span.setAttribute('http.url', url);
      const body = await res.json();
      console.log(JSON.stringify(body, null, 2));
      span.setStatus({ code: res.ok ? SpanStatusCode.OK : SpanStatusCode.ERROR });
      return body;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function main() {
  await tracer.startActiveSpan('test-run', async (rootSpan) => {
    try {
      const token = makeJwt(JWT_SECRET);
      console.log(`Base URL : ${BASE_URL}`);
      console.log(`Token    : ${token.slice(0, 40)}…`);

      await get('/items', token);
      await get(`/items/${ITEM_ID}`, token);

      rootSpan.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      rootSpan.end();
      await flushTracer();
    }
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
