// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 2, 3].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  if (config.step === 2) return runStep2Checks(app);
  if (config.step === 3) return runStep3Checks(app);
  const response = await fetch(new URL('/data.json', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let visible = false;
  if (response.ok) {
    try {
      const data = await response.json();
      visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
        && data.notes.length > 0;
    } catch {
      // A non-JSON response is a failed check, not a successful deployment.
    }
  }
  return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
    observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
}

// 2단계: 실제로 보낸 비로그인 요청의 결과만 기록합니다. 메모 본문은 남기지 않고 건수만 셉니다.
async function anonymousNoteCount(app, path) {
  try {
    const response = await fetch(new URL(path, app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    let count = null;
    if (response.ok) {
      try {
        const data = await response.json();
        if (Array.isArray(data?.notes)) count = data.notes.length;
      } catch {
        // JSON이 아니면 메모 건수를 읽을 수 없습니다.
      }
    }
    return { status: response.status, count };
  } catch (error) {
    return { status: `요청 실패(${error.name})`, count: null };
  }
}

async function runStep2Checks(app) {
  const staticFile = await anonymousNoteCount(app, '/data.json');
  const api = await anonymousNoteCount(app, '/api/notes');
  return [
    { attackId: 'anonymous_static_note_read', expected: '비로그인으로 /data.json을 열면 404이거나 가상 메모가 없음',
      observed: staticFile.status === 404 ? '비로그인 요청 HTTP 404, 정적 자료 파일 없음'
        : `비로그인 요청 HTTP ${staticFile.status}, 메모 ${staticFile.count ?? '확인 불가'}건` },
    { attackId: 'anonymous_api_note_read', expected: '3단계 전까지 남은 약점: 비로그인 /api/notes 요청이 아직 거부되지 않음',
      observed: `비로그인 요청 HTTP ${api.status}, 메모 ${api.count ?? '확인 불가'}건` },
  ];
}

// 3단계: 로그인 없는 요청과 위조 토큰 요청을 실제로 보내 HTTP 상태와 메모 건수만 기록합니다.
// 비밀번호와 진짜 토큰은 점검 코드에 넣지 않으므로 로그인 뒤 동작은 미실행으로 남깁니다.
const PROBE_ID = '00000000-0000-4000-8000-000000000000';
const FORGED_TOKEN = 'Bearer aaaa.bbbb.cccc';

async function probe(app, path, { method = 'GET', authorization } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authorization) headers.Authorization = authorization;
  try {
    const response = await fetch(new URL(path, app), {
      method, headers, redirect: 'error', signal: AbortSignal.timeout(10000),
      body: method === 'GET' || method === 'DELETE' ? undefined
        : JSON.stringify({ title: '자기 점검', body: '', userId: PROBE_ID, role: 'admin' }),
    });
    let notes = 0;
    try {
      const data = await response.json();
      notes = Array.isArray(data) ? data.length : Array.isArray(data?.notes) ? data.notes.length
        : data?.title ? 1 : 0;
    } catch {
      // 본문이 JSON이 아니면 메모 0건으로 셉니다.
    }
    return `HTTP ${response.status}, 메모 ${notes}건`;
  } catch (error) {
    return `요청 실패(${error.name})`;
  }
}

async function runStep3Checks(app) {
  const staticFile = await anonymousNoteCount(app, '/data.json');
  const one = `/api/notes/${PROBE_ID}`;
  return [
    { attackId: 'anonymous_static_note_read', expected: '비로그인으로 /data.json을 열면 404이거나 가상 메모가 없음',
      observed: staticFile.status === 404 ? '비로그인 요청 HTTP 404, 정적 자료 파일 없음'
        : `비로그인 요청 HTTP ${staticFile.status}, 메모 ${staticFile.count ?? '확인 불가'}건` },
    { attackId: 'anonymous_api_note_list', expected: '토큰 없는 GET /api/notes는 401, 메모 0건',
      observed: `토큰 없는 요청 ${await probe(app, '/api/notes')}` },
    { attackId: 'anonymous_api_note_create', expected: '토큰 없는 POST /api/notes(본문 userId·role=admin)는 401',
      observed: `토큰 없는 요청 ${await probe(app, '/api/notes', { method: 'POST' })}` },
    { attackId: 'anonymous_api_note_update', expected: '토큰 없는 PUT /api/notes/:id는 401',
      observed: `토큰 없는 요청 ${await probe(app, one, { method: 'PUT' })}` },
    { attackId: 'anonymous_api_note_delete', expected: '토큰 없는 DELETE /api/notes/:id는 401',
      observed: `토큰 없는 요청 ${await probe(app, one, { method: 'DELETE' })}` },
    { attackId: 'forged_token_note_list', expected: '서명이 맞지 않는 토큰의 GET /api/notes는 401, 메모 0건',
      observed: `위조 토큰 요청 ${await probe(app, '/api/notes', { authorization: FORGED_TOKEN })}` },
    { attackId: 'login_owner_crud', expected: 'A 로그인 뒤 내 메모 목록·추가·수정·삭제가 됨',
      observed: '미실행: 비밀번호를 점검 코드에 넣지 않아 자동으로 보내지 않음. 학생이 화면에서 직접 확인' },
    { attackId: 'cross_user_note_update', expected: '4단계에서 기록: B가 A 메모 id로 PUT하면 거부',
      observed: '미실행: 3단계는 소유자 검사가 없어 B가 A 메모를 고칠 수 있는 허점이 남아 있음(4단계에서 기록)' },
  ];
}
