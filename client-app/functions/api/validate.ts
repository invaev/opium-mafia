interface Env {
  BOT_TOKEN: string;
}

interface ValidateResponse {
  ok: boolean;
  user?: Record<string, unknown>;
  error?: string;
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
): Promise<{ valid: boolean; params: Map<string, string> }> {
  const params = parseInitData(initDataRaw);
  const hash = params.get('hash');

  if (!hash) {
    return { valid: false, params };
  }

  const dataCheckString = buildDataCheckString(params);

  const secretKey = await hmacSHA256(
    new TextEncoder().encode('WebAppData'),
    botToken,
  );

  const computedHash = bufferToHex(await hmacSHA256(secretKey, dataCheckString));

  const valid = computedHash.length === hash.length &&
    computedHash === hash;

  return { valid, params };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const initDataRaw = request.headers.get('X-Telegram-Init-Data');
  if (!initDataRaw) {
    return Response.json(
      { ok: false, error: 'Missing X-Telegram-Init-Data header' } satisfies ValidateResponse,
      { status: 401 },
    );
  }

  if (!env.BOT_TOKEN) {
    return Response.json(
      { ok: false, error: 'Server misconfiguration' } satisfies ValidateResponse,
      { status: 500 },
    );
  }

  const { valid, params } = await validateInitData(initDataRaw, env.BOT_TOKEN);

  if (!valid) {
    return Response.json(
      { ok: false, error: 'Invalid initData signature' } satisfies ValidateResponse,
      { status: 401 },
    );
  }

  const authDateStr = params.get('auth_date');
  if (!authDateStr) {
    return Response.json(
      { ok: false, error: 'Missing auth_date' } satisfies ValidateResponse,
      { status: 401 },
    );
  }

  const authDate = parseInt(authDateStr, 10);
  const now = Math.floor(Date.now() / 1000);

  if (now - authDate > MAX_AUTH_AGE_SECONDS) {
    return Response.json(
      { ok: false, error: 'initData expired' } satisfies ValidateResponse,
      { status: 401 },
    );
  }

  let user: Record<string, unknown> | undefined;
  const userStr = params.get('user');
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
    }
  }

  return Response.json({ ok: true, user } satisfies ValidateResponse);
};
