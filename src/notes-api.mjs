// 3단계: /api/notes 경로들이 함께 쓰는 로그인 검사와 Supabase REST 호출입니다.
// 로그인 여부는 시작 틀의 src/verify-login.mjs가 확인한 사용자 ID만 믿습니다.
// 브라우저가 보낸 userId·role·owner_id는 쓰지 않습니다.
// 아직 소유자 검사는 하지 않습니다. 한 건 조회·수정·삭제는 로그인만 확인하므로
// 다른 계정의 메모도 id만 알면 바뀝니다. 이 허점은 4단계에서 막습니다.
// SUPABASE_SECRET_KEY는 서버 전용입니다. 응답·로그·브라우저 파일에 값을 넣지 않습니다.
import { readFileSync } from 'node:fs';
import { createLoginVerifier } from './verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const TITLE_MAX = 200;
const BODY_MAX = 5000;
let verifyLogin;

export class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export const isUuid = (value) => typeof value === 'string' && UUID.test(value);

function serverSettings() {
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env;
  let base;
  try {
    base = new URL(url);
  } catch {
    base = null;
  }
  if (!base || base.protocol !== 'https:' || !key) {
    console.error('notes: SUPABASE_URL 또는 SUPABASE_SECRET_KEY 환경변수가 없습니다.');
    throw new HttpError(500, 'SERVER_NOT_CONFIGURED');
  }
  return { base, key };
}

// 로그인한 사용자의 ID를 돌려줍니다. 토큰이 없거나 검사에 실패하면 401입니다.
export async function requireUser(request, key) {
  let principal;
  try {
    verifyLogin ??= createLoginVerifier({ config, supabaseSecretKey: key });
    principal = await verifyLogin(request.headers?.authorization);
  } catch (error) {
    console.error(`notes: 로그인 검사 설정 오류 (${error.message})`);
    throw new HttpError(500, 'SERVER_NOT_CONFIGURED');
  }
  if (!principal || !isUuid(principal.userId)) throw new HttpError(401, 'LOGIN_REQUIRED');
  return principal.userId;
}

// 제목·본문만 받습니다. 본문에 owner_id·userId·role이 있어도 무시합니다.
export function readNoteInput(request) {
  let input = request.body;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      throw new HttpError(400, 'INVALID_JSON');
    }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'INVALID_NOTE');
  const { title, body = '' } = input;
  if (typeof title !== 'string' || !title.trim() || title.length > TITLE_MAX
      || typeof body !== 'string' || body.length > BODY_MAX) {
    throw new HttpError(400, 'INVALID_NOTE');
  }
  return { id: input.id, title: title.trim(), body };
}

export async function notesRequest(key, base, { method = 'GET', query, payload, returning = false }) {
  const url = new URL('/rest/v1/notes', base);
  url.search = new URLSearchParams(query).toString();
  const headers = { apikey: key, Accept: 'application/json' };
  if (payload) headers['Content-Type'] = 'application/json';
  if (returning) headers.Prefer = 'return=representation';
  let upstream;
  try {
    upstream = await fetch(url, {
      method, headers, body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error(`notes: Supabase 요청 실패 (${error.name})`);
    throw new HttpError(502, 'NOTES_UNAVAILABLE');
  }
  if (upstream.status === 409) throw new HttpError(409, 'NOTE_ID_EXISTS');
  if (!upstream.ok) {
    console.error(`notes: Supabase 응답 ${upstream.status}`);
    throw new HttpError(502, 'NOTES_UNAVAILABLE');
  }
  // 추가(POST)는 본문 없이 201로 끝나므로 빈 본문은 빈 배열로 봅니다.
  const text = await upstream.text();
  return text ? JSON.parse(text) : [];
}

export const publicNote = ({ id, title, body }) => ({ id, title, body });

// 공통 응답 처리: 캐시 금지, 허용 메서드 검사, 서버 설정과 로그인 확인, 오류를 JSON으로 바꿉니다.
export function notesHandler(handlers) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (!Object.hasOwn(handlers, request.method)) {
      response.setHeader('Allow', Object.keys(handlers).join(', '));
      return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    try {
      const { base, key } = serverSettings();
      const userId = await requireUser(request, key);
      return await handlers[request.method]({ request, response, userId, base, key });
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 401) response.setHeader('WWW-Authenticate', 'Bearer');
        return response.status(error.status).json({ error: error.code });
      }
      console.error(`notes: 처리 실패 (${error.name})`);
      return response.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}
