// 3단계: 로그인 토큰을 시작 틀의 src/verify-login.mjs로 검사한 뒤에만 가상 메모를 돌려줍니다.
// 브라우저가 보낸 userId·role·쿼리·본문은 쓰지 않고, Authorization 헤더의 토큰 검사 결과만 믿습니다.
// SUPABASE_SECRET_KEY는 서버 전용입니다. 응답·로그·브라우저 파일에 값을 넣지 않습니다.
// 다른 계정의 자료를 막는 일(owner_id 대조)은 4단계에서 합니다.
import { readFileSync } from 'node:fs';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
let verifyLogin;

function loginVerifier(key) {
  verifyLogin ??= createLoginVerifier({ config, supabaseSecretKey: key });
  return verifyLogin;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env;
  let base;
  try {
    base = new URL(url);
  } catch {
    base = null;
  }
  if (!base || base.protocol !== 'https:' || !key) {
    console.error('notes: SUPABASE_URL 또는 SUPABASE_SECRET_KEY 환경변수가 없습니다.');
    return response.status(500).json({ error: 'SERVER_NOT_CONFIGURED' });
  }
  let principal;
  try {
    principal = await loginVerifier(key)(request.headers?.authorization);
  } catch (error) {
    console.error(`notes: 로그인 검사 설정 오류 (${error.message})`);
    return response.status(500).json({ error: 'SERVER_NOT_CONFIGURED' });
  }
  if (!principal) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    return response.status(401).json({ error: 'LOGIN_REQUIRED' });
  }
  try {
    const upstream = await fetch(new URL('/rest/v1/vault_notes?select=title,content&order=id', base), {
      headers: { apikey: key, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      console.error(`notes: Supabase 응답 ${upstream.status}`);
      return response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
    }
    const rows = await upstream.json();
    const notes = Array.isArray(rows)
      ? rows.map(({ title, content }) => ({ title: String(title), content: String(content) }))
      : [];
    return response.status(200).json({ notes });
  } catch (error) {
    console.error(`notes: Supabase 요청 실패 (${error.name})`);
    return response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
  }
}
