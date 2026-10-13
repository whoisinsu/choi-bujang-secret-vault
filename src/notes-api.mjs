// /api/notes 경로들이 함께 쓰는 로그인 검사와 Supabase REST 호출입니다.
// 로그인 여부는 시작 틀의 src/verify-login.mjs가 확인한 사용자 ID만 믿습니다.
// 브라우저가 보낸 userId·role·owner_id는 쓰지 않습니다.
// 4단계: 모든 읽기·추가·수정·삭제는 확인된 사용자 ID와 DB의 owner_id가 같은 행에만 적용합니다.
// SUPABASE_SECRET_KEY는 서버 전용입니다. 응답·로그·브라우저 파일에 값을 넣지 않습니다.
import { readFileSync } from 'node:fs';
import { createLoginVerifier } from './verify-login.mjs';
import { resourceFor, ZONES } from './resources.mjs';

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

// 본문에 소유자를 가리키는 값이 있는지 봅니다. 확인된 사용자와 다른 값이면 소유자 변경 시도입니다.
const OWNER_FIELDS = ['owner_id', 'ownerId', 'owner', 'userId', 'user_id'];
export function requestsOtherOwner(request, userId) {
  let input = request.body;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      return false;
    }
  }
  if (!input || typeof input !== 'object') return false;
  return OWNER_FIELDS.some((field) => Object.hasOwn(input, field)
    && String(input[field]).toLowerCase() !== userId.toLowerCase());
}

// 제목·본문만 받습니다. 본문에 owner_id·userId·role이 있어도 저장에 쓰지 않습니다.
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
// 8단계 API 구역 확인: 판정기와 따로, 이 API가 다시 대조합니다.
// - 메모 API는 my_notes 구역의 다섯 경로만 받습니다. 다른 구역(강사 공지 등)은 403 ZONE_FORBIDDEN입니다.
//   강사 권한은 검증된 로그인(student·judge)이나 DB 어디에도 저장돼 있지 않으므로 공지 수정은 누구도 할 수 없습니다.
// - 경로의 :id와 서버가 받은 id가 다르거나 쿼리가 붙으면 404 ROUTE_NOT_ALLOWED입니다(쿼리로 기능을 고르지 않음).
// - 본문의 role·역할·구역 값은 믿지 않고 403 ROLE_FIELD_REJECTED로 거부합니다(화면 메뉴와 무관).
// - 소유자는 기존처럼 DB의 owner_id와 검증된 사용자 ID로 대조합니다(다른 사람 메모는 404 NOTE_NOT_FOUND).
// 거부 사유는 코드와 경로 모양만 로그에 남기고 토큰·사용자 ID·메모 내용은 남기지 않습니다.
const NOTE_ROUTES = new Set(['GET /notes', 'POST /notes', 'GET /notes/:id', 'PUT /notes/:id', 'DELETE /notes/:id']);
const ROLE_FIELDS = ['role', 'roles', 'aleph_role', 'isAdmin', 'is_admin', 'isInstructor', 'is_instructor',
  'instructor', 'admin', 'zone', 'scope', 'permissions'];

function requestBody(request) {
  let input = request.body;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      return null;
    }
  }
  return input && typeof input === 'object' && !Array.isArray(input) ? input : null;
}

function checkZone(request, resource) {
  if (!resource) throw new HttpError(404, 'ROUTE_NOT_ALLOWED');
  if (resource.zone !== ZONES.MY_NOTES) throw new HttpError(403, 'ZONE_FORBIDDEN');
  if (!NOTE_ROUTES.has(resource.route)) throw new HttpError(404, 'ROUTE_NOT_ALLOWED');
  // Vercel은 /api/notes/:id의 :id를 request.query.id와 주소의 ?id=로 함께 넘깁니다.
  // 한 건 경로에서는 경로의 id와 같은 id 쿼리만 받고, 그 밖의 쿼리와 목록 경로의 쿼리는 모두 거부합니다.
  const pathId = resource.route.endsWith('/:id') ? resource.resourceId.slice('notes/'.length) : null;
  const sameId = value => pathId !== null && typeof value === 'string' && value.toLowerCase() === pathId;
  const { id, ...extraQuery } = request.query ?? {};
  const urlQuery = new URL(request.url ?? '', 'http://localhost').searchParams;
  if (Object.keys(extraQuery).length || [...urlQuery.keys()].some(key => key !== 'id')
      || !urlQuery.getAll('id').every(sameId)) {
    throw new HttpError(404, 'ROUTE_NOT_ALLOWED');
  }
  if (pathId !== null ? !sameId(id) : id !== undefined) throw new HttpError(404, 'ROUTE_NOT_ALLOWED');
  const body = requestBody(request);
  if (body && ROLE_FIELDS.some(field => Object.hasOwn(body, field))) {
    throw new HttpError(403, 'ROLE_FIELD_REJECTED');
  }
}

function requestPath(request) {
  try {
    return new URL(request.url ?? '', 'http://localhost').pathname;
  } catch {
    return '';
  }
}

export function notesHandler(handlers) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (!Object.hasOwn(handlers, request.method)) {
      response.setHeader('Allow', Object.keys(handlers).join(', '));
      return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    let resource = null;
    try {
      const { base, key } = serverSettings();
      const userId = await requireUser(request, key);
      // 8단계: 요청 동작·경로로 구역과 자원 ID를 붙입니다(src/resources.mjs).
      resource = resourceFor(request.method, requestPath(request));
      checkZone(request, resource);
      return await handlers[request.method]({ request, response, userId, base, key, resource });
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 403 || error.status === 404) {
          console.warn(`notes: 거부 ${error.code} ${resource?.route ?? `${request.method} 알 수 없는 경로`}`);
        }
        if (error.status === 401) response.setHeader('WWW-Authenticate', 'Bearer');
        return response.status(error.status).json({ error: error.code });
      }
      console.error(`notes: 처리 실패 (${error.name})`);
      return response.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
}
