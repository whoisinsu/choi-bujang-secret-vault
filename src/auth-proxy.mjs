// 5단계: 로그인·토큰 갱신·로그아웃을 서버 함수가 Supabase Auth에 대신 요청합니다.
// 브라우저 코드에는 Supabase 주소와 키를 두지 않습니다. 키는 서버 환경변수에만 있습니다.
// SUPABASE_PUBLISHABLE_KEY(공개용)로 Auth만 부르고, 서버 전용 secret key는 여기서 쓰지 않습니다.
// 비밀번호·토큰은 저장하거나 로그에 남기지 않습니다.

const EMAIL_MAX = 320;
const PASSWORD_MAX = 1024;
const TOKEN_MAX = 8192;
const PASSED_CODES = new Set([
  'invalid_credentials', 'email_not_confirmed', 'user_banned', 'validation_failed',
  'over_request_rate_limit', 'refresh_token_not_found', 'refresh_token_already_used', 'session_expired',
]);

export class AuthError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function authSettings() {
  const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = process.env;
  let base;
  try {
    base = new URL(url);
  } catch {
    base = null;
  }
  if (!base || base.protocol !== 'https:' || !key) {
    console.error('auth: SUPABASE_URL 또는 SUPABASE_PUBLISHABLE_KEY 환경변수가 없습니다.');
    throw new AuthError(500, 'SERVER_NOT_CONFIGURED');
  }
  return { base, key };
}

export function readJsonBody(request) {
  let input = request.body;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      throw new AuthError(400, 'INVALID_JSON');
    }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AuthError(400, 'INVALID_REQUEST');
  return input;
}

export function readLogin(request) {
  const { email, password } = readJsonBody(request);
  if (typeof email !== 'string' || !email.trim() || email.length > EMAIL_MAX
      || typeof password !== 'string' || !password || password.length > PASSWORD_MAX) {
    throw new AuthError(400, 'validation_failed');
  }
  return { email: email.trim(), password };
}

export function readRefreshToken(request) {
  const { refresh_token: token } = readJsonBody(request);
  if (typeof token !== 'string' || !token || token.length > TOKEN_MAX) throw new AuthError(400, 'validation_failed');
  return token;
}

export function readBearer(request) {
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u.exec(request.headers?.authorization ?? '');
  if (!match || match[1].length > TOKEN_MAX) throw new AuthError(401, 'LOGIN_REQUIRED');
  return match[1];
}

// Supabase Auth(GoTrue) REST를 부릅니다. 실패하면 Supabase의 오류 코드 중 알려진 것만 그대로 넘깁니다.
export async function authRequest(path, { query, payload, bearer } = {}) {
  const { base, key } = authSettings();
  const url = new URL(`/auth/v1/${path}`, base);
  if (query) url.search = new URLSearchParams(query).toString();
  const headers = { apikey: key, Accept: 'application/json' };
  if (payload) headers['Content-Type'] = 'application/json';
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST', headers, body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error(`auth: Supabase Auth 요청 실패 (${error.name})`);
    throw new AuthError(502, 'AUTH_UNAVAILABLE');
  }
  const text = await upstream.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!upstream.ok) {
    const code = data?.error_code ?? data?.code;
    if (typeof code === 'string' && PASSED_CODES.has(code)) {
      throw new AuthError(upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : 400, code);
    }
    console.error(`auth: Supabase Auth 응답 ${upstream.status}`);
    throw new AuthError(upstream.status === 429 ? 429 : 502, upstream.status === 429 ? 'over_request_rate_limit' : 'AUTH_UNAVAILABLE');
  }
  return data;
}

// 브라우저에 돌려줄 세션: 토큰과 만료 시각, 화면 표시에 쓸 이메일만 담습니다.
export function publicSession(data) {
  if (typeof data?.access_token !== 'string' || typeof data?.refresh_token !== 'string') {
    console.error('auth: Supabase Auth 세션 형식이 예상과 다릅니다.');
    throw new AuthError(502, 'AUTH_UNAVAILABLE');
  }
  const expiresAt = Number.isSafeInteger(data.expires_at) ? data.expires_at
    : Math.floor(Date.now() / 1000) + (Number.isSafeInteger(data.expires_in) ? data.expires_in : 3600);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    user: { email: typeof data.user?.email === 'string' ? data.user.email : '' },
  };
}

export function authHandler(handle) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    try {
      return await handle({ request, response });
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.status === 401) response.setHeader('WWW-Authenticate', 'Bearer');
        return response.status(error.status).json({ error: error.code });
      }
      console.error(`auth: 처리 실패 (${error.name})`);
      return response.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}
