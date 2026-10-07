// 2단계: 학습용 Supabase의 vault_notes에서 가상 메모를 서버에서 읽어 돌려줍니다.
// SUPABASE_SECRET_KEY는 서버 전용입니다. 응답·로그·브라우저 파일에 값을 넣지 않습니다.
// 아직 로그인 검사가 없어 누구나 이 주소를 부를 수 있습니다. 3단계에서 막습니다.
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
