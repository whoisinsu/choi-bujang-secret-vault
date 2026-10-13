// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 2, 3, 4, 5, 6, 7, 8].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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
  if (config.step === 4) return runStep4Checks(app, config);
  if (config.step === 5) return runStep4Checks(app, config);
  if (config.step === 6) return runStep6Checks(app, config);
  if (config.step === 7) return runStep7Checks(app, config);
  if (config.step === 8) return runStep8Checks(app, config);
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

// 4단계: 3단계의 로그인 없는 요청 점검에 더해, 공개용 anon(publishable) 키로 Supabase Data API의
// notes 테이블에 직접 읽기·쓰기를 보내 HTTP 상태만 기록합니다. anon 키는 화면 코드에도 있는 공개 값입니다.
// A·B 로그인 토큰은 점검 코드에 넣지 않으므로 상대 메모 접근은 자동으로 보내지 않고 미실행으로 남깁니다.
const ANON_KEY = 'sb_publishable_zbvLeuDU_gLzfhjV-CwlFg_eXRUOOM9';
const A_NOTE_ID = 'ca9ea280-7182-4291-96ab-9aeedb38c32b';

// 5단계부터는 aleph.config.json의 originalApiUrl(원본 자료 경로)에 그대로 보냅니다.
async function anonDataApi(config, method) {
  let url;
  try {
    url = config.originalApiUrl ? new URL(config.originalApiUrl)
      : new URL('/rest/v1/notes', new URL(config.identityProvider.issuer).origin);
  } catch {
    return '요청 실패(원본 자료 주소 없음)';
  }
  url.search = method === 'POST' ? '' : method === 'GET' ? 'select=id&limit=1' : `id=eq.${A_NOTE_ID}`;
  try {
    const response = await fetch(url, {
      method,
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: method === 'POST' || method === 'PATCH' ? JSON.stringify({ title: '자기 점검' }) : undefined,
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    let rows = 0;
    try {
      const data = await response.json();
      if (Array.isArray(data)) rows = data.length;
    } catch {
      // 본문이 없거나 JSON이 아니면 0행으로 셉니다.
    }
    return `HTTP ${response.status}, 행 ${rows}개`;
  } catch (error) {
    return `요청 실패(${error.name})`;
  }
}

async function runStep4Checks(app, config) {
  const step3 = (await runStep3Checks(app)).filter(({ attackId }) => !['login_owner_crud', 'cross_user_note_update'].includes(attackId));
  const anon = {};
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) anon[method] = await anonDataApi(config, method);
  return [
    ...step3,
    { attackId: 'anon_data_api_select', expected: 'anon 키로 원본 자료 API(notes) SELECT는 권한 없음(401·403)',
      observed: `anon 키 직접 요청 ${anon.GET}` },
    { attackId: 'anon_data_api_insert', expected: 'anon 키로 Data API notes INSERT는 권한 없음(401·403)',
      observed: `anon 키 직접 요청 ${anon.POST}` },
    { attackId: 'anon_data_api_update', expected: 'anon 키로 Data API A 메모 UPDATE는 권한 없음(401·403)',
      observed: `anon 키 직접 요청 ${anon.PATCH}` },
    { attackId: 'anon_data_api_delete', expected: 'anon 키로 Data API A 메모 DELETE는 권한 없음(401·403)',
      observed: `anon 키 직접 요청 ${anon.DELETE}` },
    { attackId: 'cross_user_note_access', expected: 'B 로그인으로 A 메모 id에 GET·PUT·DELETE하면 404, A 메모 그대로',
      observed: '미실행(자동 점검): 로그인 토큰을 점검 코드에 넣지 않음. 학생이 B 로그인 브라우저에서 직접 확인' },
  ];
}

// 6단계: 5단계 점검에 더해 src/decider.mjs에 등록 기기·미등록 기기 가상 요청을 넣어 본 결과를 기록합니다.
// 로컬 판정기 연습일 뿐 반 엔진이나 심판의 판정이 아니며, 실제 미등록 기기 접속은 보내지 않습니다.
async function runStep6Checks(app, config) {
  const { decide } = await import('./decider.mjs');
  const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
  const { normal } = fixtureRequests();
  const practice = async (deviceRegistered) => {
    try {
      const { decision, reasonCode } = await decide({ ...normal, deviceRegistered });
      return `로컬 판정기 가상 요청 ${decision}·${reasonCode}`;
    } catch (error) {
      return `로컬 판정기 오류(${error.name})`;
    }
  };
  return [
    ...await runStep4Checks(app, config),
    { attackId: 'registered_device_read', expected: '등록 기기(deviceRegistered: true)의 GET 요청은 allow',
      observed: `${await practice(true)} (심판 판정 아님)` },
    { attackId: 'unregistered_device_read', expected: '미등록 기기(deviceRegistered: false)의 요청은 deny·device_not_registered',
      observed: `${await practice(false)} (심판 판정 아님, 실제 미등록 기기 접속은 미실행)` },
  ];
}

// 7단계: 6단계 점검에 더해 판정기에 복합 이상 가상 사건을 재로그인 전·후로 넣어 본 결과를 기록합니다.
// 제공 엔진이 새 로그인 시각을 검증하는 연결이 이 환경에 없어 실제 자료 차단은 미실행으로 남깁니다.
async function runStep7Checks(app, config) {
  const { decide } = await import('./decider.mjs');
  const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
  const { normal, suspicious } = fixtureRequests();
  const practice = async (request) => {
    try {
      const { decision, reasonCode } = await decide(request);
      return `로컬 판정기 가상 사건 ${decision}·${reasonCode} (심판 판정 아님)`;
    } catch (error) {
      return `로컬 판정기 오류(${error.name})`;
    }
  };
  return [
    ...await runStep6Checks(app, config),
    { attackId: 'unusual_access_burst', expected: '새벽 시각+처음 보는 네트워크+최근 10분 사건 10건 이상은 step_up·step_up_required',
      observed: await practice(suspicious) },
    { attackId: 'region_only_change', expected: '지역만 바뀐 사건은 차단하지 않고 allow',
      observed: await practice({ ...normal, signals: { ...normal.signals, region: 'foreign' } }) },
    { attackId: 'unusual_access_after_step_up', expected: '같은 복합 사건이라도 재로그인 60초 뒤 새 요청은 allow',
      observed: await practice({ ...suspicious, requestId: crypto.randomUUID(), stepUp: { verified: true, authAgeSeconds: 60 } }) },
    { attackId: 'live_step_up_block', expected: '실제 자료 요청이 재로그인 전 막히고 새 로그인 뒤 허용됨',
      observed: '미실행: 제공 엔진의 새 로그인 시각 검증 연결이 이 환경에 없음. 자료 API는 판정기를 부르지 않음' },
  ];
}

// 8단계: 7단계 점검에 더해 판정기의 구역 규칙에 가상 요청을 넣어 본 결과를 기록합니다(심판 판정 아님).
// B의 A 메모 접근은 로그인 토큰이 필요해 위 cross_user_note_access처럼 자동 점검에서는 미실행입니다.
async function runStep8Checks(app, config) {
  const { decide } = await import('./decider.mjs');
  const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
  const { normal } = fixtureRequests();
  const practice = async (method, path, route, extra = {}) => {
    try {
      const { decision, reasonCode } = await decide({ ...normal, requestId: crypto.randomUUID(), method, path, route, ...extra });
      return `${decision}·${reasonCode}`;
    } catch (error) {
      return `오류(${error.name})`;
    }
  };
  const id = 'ca9ea280-7182-4291-96ab-9aeedb38c32b';
  return [
    ...await runStep7Checks(app, config),
    { attackId: 'zone_own_note_read_update', expected: '내 메모 한 건 읽기·수정 경로는 allow(소유자는 자료 API가 다시 대조)',
      observed: `로컬 판정기 가상 요청 GET ${await practice('GET', `/notes/${id}`, 'GET /notes/:id')}, PUT ${await practice('PUT', `/notes/${id}`, 'PUT /notes/:id')} (심판 판정 아님)` },
    { attackId: 'zone_notice_write', expected: '학생 자료실에서 강사 공지 수정은 deny',
      observed: `로컬 판정기 가상 요청 ${await practice('PUT', '/notices/n1', 'PUT /notices/:id')} (심판 판정 아님)` },
    { attackId: 'zone_unknown_route', expected: ':id 자리 export·쿼리로 기능 선택·표에 없는 경로는 deny',
      observed: `로컬 판정기 가상 요청 export ${await practice('GET', '/notes/export', 'GET /notes/:id')}, 쿼리 ${await practice('GET', '/notes', 'GET /notes', { queryLength: 9 })}, 표 밖 ${await practice('GET', '/ai', 'GET /ai')} (심판 판정 아님)` },
  ];
}
