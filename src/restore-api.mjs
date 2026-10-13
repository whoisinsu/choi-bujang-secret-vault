// 10단계: POST /api/restore — 비공개 가상 메모 사본(public.notes_backup)에서 지정한 한 건만 복원합니다.
// - 로그인한 사람만 부를 수 있고, 사본의 owner_id가 검증된 사용자 ID와 같은 메모만 복원합니다.
// - 본문은 {"id":"<메모 UUID>"}만 받습니다. 브라우저가 보낸 owner_id·role·내용은 쓰지 않습니다.
// - 사본의 ID·소유자·내용 해시를 대조하고, 복원 뒤 notes의 그 한 건을 다시 읽어 ID·소유자·내용 해시가 사본과
//   같은지 확인합니다. 다른 메모는 건드리지 않습니다(id와 owner_id가 모두 맞는 행만 고치거나 새로 넣음).
// - 감사 기록(public.restore_audit)에는 덧붙이기만 합니다. 로그인·대상 id가 확인된 모든 시도는 자료를 바꾸기 전에
//   requested 줄을 먼저 남기고(못 남기면 복원하지 않음), 성공·거부 결과 줄을 덧붙이며 응답에 auditSeq를 돌려줍니다.
//   메모 본문·토큰은 응답·로그·감사 기록에 남기지 않습니다.
// SUPABASE_SECRET_KEY는 서버 전용입니다.
import { createHash } from 'node:crypto';
import { HttpError, isUuid, requireUser } from './notes-api.mjs';

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
// 내용 해시 = sha256(sha256(title) || sha256(body)). supabase/step10_backup.sql과 같은 계산입니다.
export const contentHash = (title, body) => sha256(sha256(title) + sha256(body));

function serverSettings() {
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env;
  let base;
  try {
    base = new URL(url);
  } catch {
    base = null;
  }
  if (!base || base.protocol !== 'https:' || !key) {
    console.error('restore: SUPABASE_URL 또는 SUPABASE_SECRET_KEY 환경변수가 없습니다.');
    throw new HttpError(500, 'SERVER_NOT_CONFIGURED');
  }
  return { base, key };
}

async function rest(key, base, table, { method = 'GET', query, payload, returning = false }) {
  const url = new URL(`/rest/v1/${table}`, base);
  url.search = new URLSearchParams(query).toString();
  const headers = { apikey: key, Accept: 'application/json' };
  if (payload) headers['Content-Type'] = 'application/json';
  if (returning) headers.Prefer = 'return=representation';
  let upstream;
  try {
    upstream = await fetch(url, { method, headers, body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(8000) });
  } catch (error) {
    console.error(`restore: Supabase 요청 실패 (${error.name})`);
    throw new HttpError(502, 'RESTORE_UNAVAILABLE');
  }
  if (!upstream.ok) {
    console.error(`restore: Supabase 응답 ${upstream.status} (${table})`);
    throw new HttpError(502, 'RESTORE_UNAVAILABLE');
  }
  const text = await upstream.text();
  return text ? JSON.parse(text) : [];
}

function readTarget(request) {
  let input = request.body;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      throw new HttpError(400, 'INVALID_JSON');
    }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).join(',') !== 'id'
      || !isUuid(input.id)) {
    throw new HttpError(400, 'RESTORE_TARGET_REQUIRED');
  }
  return input.id.toLowerCase();
}

const sameRow = (row, copy) => row && row.id === copy.id && row.owner_id === copy.owner_id
  && contentHash(row.title, row.body) === copy.content_sha256;

// 감사 기록을 덧붙이고 그 번호(seq)를 돌려줍니다. 남기지 못하면 예외를 던져 복원하지 않습니다.
async function appendAudit(key, base, entry) {
  const rows = await rest(key, base, 'restore_audit', { method: 'POST', payload: entry, returning: true });
  const seq = Array.isArray(rows) ? rows[0]?.seq : undefined;
  if (seq === undefined || seq === null) throw new HttpError(503, 'AUDIT_UNAVAILABLE');
  return String(seq);
}

export async function restoreHandler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  let settings = null;
  let audit = null;
  let auditSeq = null;
  try {
    settings = serverSettings();
    const { base, key } = settings;
    const userId = await requireUser(request, key);
    if (new URL(request.url ?? '', 'http://localhost').search) throw new HttpError(404, 'ROUTE_NOT_ALLOWED');
    const id = readTarget(request);
    // 0) 자료를 바꾸기 전에 복원 요청을 감사 기록에 먼저 덧붙입니다. 남기지 못하면 복원하지 않습니다.
    audit = { note_id: id, owner_id: userId, before_sha256: null };
    try {
      auditSeq = await appendAudit(key, base, { ...audit, result: 'requested' });
    } catch {
      audit = null;
      throw new HttpError(503, 'AUDIT_UNAVAILABLE');
    }
    // 1) 사본: 이 id이면서 owner_id가 검증된 사용자인 사본만 고릅니다. 남의 사본은 없는 것과 같게 404입니다.
    const copies = await rest(key, base, 'notes_backup', { query: {
      select: 'id,owner_id,title,body,content_sha256', id: `eq.${id}`, owner_id: `eq.${userId}` } });
    if (!Array.isArray(copies) || copies.length !== 1) throw new HttpError(404, 'BACKUP_NOT_FOUND');
    const copy = copies[0];
    // 2) 사본 대조: ID·소유자·내용 해시가 맞지 않으면 복원하지 않습니다.
    if (copy.id !== id || copy.owner_id !== userId || contentHash(copy.title, copy.body) !== copy.content_sha256) {
      throw new HttpError(409, 'BACKUP_VERIFY_FAILED');
    }
    // 3) 현재 메모: 같은 id가 다른 사람 소유로 있으면 덮어쓰지 않습니다.
    const current = await rest(key, base, 'notes', { query: { select: 'id,owner_id,title,body', id: `eq.${id}` } });
    if (current.length && current[0].owner_id !== userId) throw new HttpError(409, 'RESTORE_OWNER_CONFLICT');
    audit.before_sha256 = current.length ? contentHash(current[0].title, current[0].body) : null;
    if (current.length) {
      await rest(key, base, 'notes', { method: 'PATCH', query: { id: `eq.${id}`, owner_id: `eq.${userId}` },
        payload: { title: copy.title, body: copy.body, updated_at: new Date().toISOString() } });
    } else {
      await rest(key, base, 'notes', { method: 'POST',
        payload: { id, owner_id: userId, title: copy.title, body: copy.body } });
    }
    // 4) 복원 확인: 그 한 건을 다시 읽어 ID·소유자·내용 해시가 사본과 같아야 합니다.
    const after = await rest(key, base, 'notes', { query: { select: 'id,owner_id,title,body', id: `eq.${id}` } });
    if (after.length !== 1 || !sameRow(after[0], copy)) throw new HttpError(500, 'RESTORE_VERIFY_FAILED');
    const restored = current.length ? 'content' : 'recreated';
    try {
      auditSeq = await appendAudit(key, base, { ...audit,
        result: current.length ? 'restored_content' : 'recreated', after_sha256: copy.content_sha256 });
    } catch {
      console.error('restore: 결과 감사 기록을 남기지 못했습니다(요청 기록은 남음).');
    }
    return response.status(200).json({ id, restored, contentSha256: copy.content_sha256, auditSeq });
  } catch (error) {
    const known = error instanceof HttpError;
    if (audit && settings) {
      // 거부·실패도 결과 줄을 덧붙입니다(기록 실패가 응답을 바꾸지는 않음, 요청 줄은 이미 남음).
      try {
        auditSeq = await appendAudit(settings.key, settings.base, { ...audit,
          result: known ? error.code.toLowerCase() : 'internal_error' });
      } catch {
        console.error('restore: 결과 감사 기록을 남기지 못했습니다(요청 기록은 남음).');
      }
    }
    if (known) {
      if (error.status === 401) response.setHeader('WWW-Authenticate', 'Bearer');
      if (error.status >= 400 && error.status !== 401) console.warn(`restore: 거부 ${error.code}`);
      return response.status(error.status).json(auditSeq ? { error: error.code, auditSeq } : { error: error.code });
    }
    console.error(`restore: 처리 실패 (${error.name})`);
    return response.status(500).json(auditSeq ? { error: 'INTERNAL_ERROR', auditSeq } : { error: 'INTERNAL_ERROR' });
  }
}
