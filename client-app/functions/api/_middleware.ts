interface Env {
  BOT_TOKEN: string;
}

const MAX_AUTH_AGE_SECONDS = 3600;

function parseInitData(initData: string): Map<string, string> {
  const params = new URLSearchParams(initData);
  const map = new Map<string, string>();
  for (const [key, value] of params.entries()) {
    map.set(key, value);
  }
  return map;
}

function buildDataCheckString(params: Map<string, string>): string {
  const entries: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    entries.push(`${key}=${value}`);
  }
  entries.sort();
  return entries.join('\n');
}

async function hmacSHA256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function validateInitData(
  initDataRaw: string,
  botToken: string,
): Promise<boolean> {
  const params = parseInitData(initDataRaw);
  const hash = params.get('hash');
  if (!hash) return false;

  const dataCheckString = buildDataCheckString(params);
  const secretKey = await hmacSHA256(
    new TextEncoder().encode('WebAppData'),
    botToken,
  );
  const computedHash = bufferToHex(await hmacSHA256(secretKey, dataCheckString));

  if (computedHash.length !== hash.length || computedHash !== hash) {
    return false;
  }

  const authDateStr = params.get('auth_date');
  if (!authDateStr) return false;
  const authDate = parseInt(authDateStr, 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AUTH_AGE_SECONDS) return false;

  return true;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (url.pathname === '/api/validate' && request.method === 'POST') {
    return next();
  }

  const initDataRaw = request.headers.get('X-Telegram-Init-Data');
  if (!initDataRaw) {
    return Response.json(
      { ok: false, error: 'Authentication required' },
      { status: 401 },
    );
  }

  if (!env.BOT_TOKEN) {
    return Response.json(
      { ok: false, error: 'Server misconfiguration' },
      { status: 500 },
    );
  }

  const valid = await validateInitData(initDataRaw, env.BOT_TOKEN);
  if (!valid) {
    return Response.json(
      { ok: false, error: 'Invalid or expired authentication' },
      { status: 401 },
    );
  }

  return next();
};
