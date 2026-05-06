import { createHmac } from 'crypto';

const BASE_URL = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}`;
const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret';
const ITEM_ID = process.argv[2] ?? 'item-001';

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
  const url = `${BASE_URL}${path}`;
  console.log(`\nGET ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`→ HTTP ${res.status}`);
  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));
  return body;
}

const token = makeJwt(JWT_SECRET);
console.log(`Base URL : ${BASE_URL}`);
console.log(`Token    : ${token.slice(0, 40)}…`);

await get('/items', token);
await get(`/items/${ITEM_ID}`, token);
