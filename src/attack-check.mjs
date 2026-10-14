// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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
  if (config.step === 9) return runStep9Checks(app, config);
  if (config.step === 10) return runStep10Checks(app, config);
  if (config.step === 11) return runStep11Checks(app, config);
  if (config.step === 12) return runStep12Checks(app, config);
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
export const ANON_KEY = 'sb_publishable_zbvLeuDU_gLzfhjV-CwlFg_eXRUOOM9';
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
  // 판정기 주체·기기·경로 표(OWN_NOTE_PATHS)에 있는 연습 메모 경로로 보냅니다(8단계 마지막 수정 뒤 기준).
  const id = 'demo';
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

// 9단계: 제출 묶음의 점검 수 한도(20개)를 지키려고 8단계까지의 같은 성격 항목을 한 줄로 묶고,
// 탐지기(src/detect.mjs)에 가상 조회 사건을 넣어 본 결과를 더합니다(심판 판정 아님).
// 실제 회수 집행과 경과 시간은 운영 엔진·심판이 확인하므로 미실행으로 남깁니다.
function mergeChecks(checks, ids, attackId, expected) {
  const picked = checks.filter(item => ids.includes(item.attackId));
  if (!picked.length) return checks;
  const merged = { attackId, expected, observed: picked.map(item => `${item.attackId}: ${item.observed}`).join(' / ').slice(0, 300) };
  const first = checks.findIndex(item => ids.includes(item.attackId));
  const rest = checks.filter(item => !ids.includes(item.attackId));
  rest.splice(first, 0, merged);
  return rest;
}

async function runStep9Checks(app, config) {
  let checks = await runStep8Checks(app, config);
  checks = mergeChecks(checks, ['anonymous_api_note_create', 'anonymous_api_note_update', 'anonymous_api_note_delete'],
    'anonymous_api_note_write', '토큰 없는 POST·PUT·DELETE /api/notes는 모두 401');
  checks = mergeChecks(checks, ['anon_data_api_select', 'anon_data_api_insert', 'anon_data_api_update', 'anon_data_api_delete'],
    'anon_data_api_direct', 'anon 키로 원본 자료 API(notes) SELECT·INSERT·UPDATE·DELETE는 모두 권한 없음(401·403)');
  const { detect, proposeRevocation } = await import('./detect.mjs');
  const reads = (count, deviceId) => Array.from({ length: count }, (_, i) => ({
    at: new Date(Date.UTC(2026, 9, 1) + i * 2000).toISOString(), method: 'GET',
    identity: { sub: 'learner_fixture' }, ...(deviceId ? { deviceId } : {}),
  }));
  const show = (value) => JSON.stringify(value);
  return [
    ...checks,
    { attackId: 'detect_burst_read', expected: '같은 가명 사용자의 GET이 10분 안에 121건이면 propose_revocation·burst_read',
      observed: `로컬 탐지기 가상 사건 ${show(detect(reads(121)))} (심판 판정 아님)` },
    { attackId: 'detect_normal_reads', expected: '정확히 120건·정상 30건은 observe(정상 사건 유지)',
      observed: `로컬 탐지기 가상 사건 120건 ${show(detect(reads(120)))}, 30건 ${show(detect(reads(30)))} (심판 판정 아님)` },
    { attackId: 'revocation_proposal_device', expected: '확인된 가상 기기 하나의 폭주 조회만 그 기기를 대상으로 한 회수 제안, 정상은 제안 없음',
      observed: `로컬 탐지기 가상 사건 의심 ${show(proposeRevocation(reads(121, 'a'.repeat(16))))}, 정상 ${show(proposeRevocation(reads(30, 'a'.repeat(16))))} (심판 판정 아님)` },
    { attackId: 'live_revocation', expected: '회수된 신원·세션의 재요청과 다른 자원 이동이 거부되고 탐지·회수 시간이 측정됨',
      observed: '미실행: 운영 반 엔진의 사건 전달·회수 집행이 이 저장소에 연결돼 있지 않음. 심판이 가상 사건으로 확인' },
  ];
}

// 10단계: 한도 20개를 지키려고 7단계 가상 사건 세 줄을 한 줄로 묶고, 복원 경로·정책 사본 점검을 더합니다.
// 로그인 없는 복원 요청과 정책 사본 검증만 실제로 실행합니다. B 로그인 복원은 토큰이 필요해 미실행입니다.
async function runStep10Checks(app, config) {
  let checks = await runStep9Checks(app, config);
  checks = mergeChecks(checks, ['unusual_access_burst', 'region_only_change', 'unusual_access_after_step_up'],
    'unusual_access_step_up', '복합 이상 사건은 step_up, 지역만 바뀐 사건과 재로그인 뒤 새 요청은 allow');
  const restoreUrl = new URL('/api/restore', app);
  let anonymousRestore;
  try {
    const response = await fetch(restoreUrl, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'b0000000-0000-4000-8000-000000000001' }) });
    anonymousRestore = `토큰 없는 요청 HTTP ${response.status}`;
  } catch (error) {
    anonymousRestore = `요청 실패(${error.name})`;
  }
  let policy;
  try {
    // 12단계 격리 환경 규칙에 맞춰 다른 프로그램을 실행하지 않고 fs·crypto로 사본 지문만 다시 계산합니다.
    const { createHash } = await import('node:crypto');
    const { readFileSync } = await import('node:fs');
    const baseline = JSON.parse(readFileSync(new URL('../policy/baseline.json', import.meta.url), 'utf8'));
    const files = baseline.files ?? {};
    const digest = createHash('sha256').update(JSON.stringify(Object.keys(files).sort().map(p => [p, files[p]])), 'utf8').digest('hex');
    policy = `정책 사본 ${baseline.version} 파일 ${Object.keys(files).length}개, 사본 지문 ${digest === baseline.digest ? '맞음' : '맞지 않음'}`;
  } catch (error) {
    policy = `정책 사본을 읽지 못함(${error.name})`;
  }
  return [
    ...checks,
    { attackId: 'restore_route_anonymous', expected: '토큰 없는 POST /api/restore는 401(복원하지 않음)',
      observed: anonymousRestore },
    { attackId: 'policy_baseline_verified', expected: '침해 전 정책 사본 검증 통과, 현재 시험 정책과의 변경 범위 표시',
      observed: policy.slice(0, 300) },
    { attackId: 'restore_b_note', expected: 'B가 변조·삭제된 자기 메모를 복원하면 ID·소유자·내용 해시가 사본과 같고, A의 B 메모 복원은 404',
      observed: '미실행(자동 점검): 로그인 토큰을 점검 코드에 넣지 않음. 학생이 B·A 로그인 브라우저에서 직접 확인' },
  ];
}

// 11단계: 한도 20개를 지키려 판정기·탐지기·구역 가상 요청 항목을 둘씩 묶고, 설치형 앱·기기 승인 점검을 더합니다.
// 로그인 없는 /api/devices 요청과 manifest만 실제로 보냅니다. 승인 전후 자료 표시는 로그인이 필요해 미실행입니다.
async function runStep11Checks(app, config) {
  let checks = await runStep10Checks(app, config);
  checks = mergeChecks(checks, ['registered_device_read', 'unregistered_device_read'], 'device_registered_rule',
    '판정기: 등록 기기 GET은 allow, 미등록 기기는 deny·device_not_registered');
  checks = mergeChecks(checks, ['detect_burst_read', 'detect_normal_reads'], 'detect_burst_and_normal',
    '탐지기: 10분 안 121건은 회수 제안, 120건·30건은 observe');
  checks = mergeChecks(checks, ['zone_notice_write', 'zone_unknown_route'], 'zone_denied_routes',
    '판정기: 공지 수정·:id 자리 기능 이름·쿼리·표 밖 경로는 deny');
  const send = async (path, method) => {
    try {
      const response = await fetch(new URL(path, app), { method, redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
      return response;
    } catch (error) {
      return { status: `요청 실패(${error.name})`, headers: new Headers(), json: async () => ({}) };
    }
  };
  const getDevices = await send('/api/devices', 'GET');
  const postDevices = await send('/api/devices', 'POST');
  const manifest = await send('/manifest.webmanifest', 'GET');
  let manifestNote = `HTTP ${manifest.status}`;
  try {
    const data = await manifest.json();
    manifestNote += `, 이름 ${typeof data.name === 'string' ? '있음' : '없음'}, display ${data.display ?? '없음'}`;
  } catch {
    manifestNote += ', JSON 아님';
  }
  return [
    ...checks,
    { attackId: 'device_api_anonymous', expected: '토큰 없는 GET·POST /api/devices는 401(승인 요청·조회 불가)',
      observed: `토큰 없는 요청 GET HTTP ${getDevices.status}, POST HTTP ${postDevices.status}` },
    { attackId: 'install_manifest', expected: '설치형 앱 manifest가 제공되고, 설치 표시는 기기 승인이 아님',
      observed: `manifest ${manifestNote}` },
    { attackId: 'device_approval_gate', expected: '승인 전 기기는 메모 API 403 DEVICE_NOT_APPROVED·자료 미표시, 서버 승인 뒤 기존 화면 정상',
      observed: '미실행(자동 점검): 로그인 토큰·기기 키를 점검 코드에 넣지 않음. 학생이 브라우저에서 직접 확인' },
  ];
}

// 12단계: 심판은 npm run bundle을 격리 환경에서 다시 실행하고, 자기 점검이 실제로 보낸 요청 기록을 attackId와
// 대조합니다. 그 환경에서는 node:fs·path·url·child_process(git 읽기)·crypto만 쓸 수 있고, 요청은 공개 HTTPS 주소로
// GET·HEAD만 보낼 수 있습니다. 그래서 12단계 점검은
// - GET 요청마다 X-Request-Id(새 UUID)와 X-Aleph-Attack-Id(attackId)를 붙여 보내고 observed에 그 요청 ID를 적습니다.
// - 요청을 보내지 않는 점검(쓰기 요청·로그인 필요·엔진 연결, 판정기·탐지기·정책 사본의 로컬 계산)은 observed를 not_run으로 둡니다.
// 로그인·쓰기 요청과 판정기·탐지기 결과의 실측은 학생이 따로 실행한 retest/results.md에 있으며 여기서 대신하지 않습니다.
async function sendGet(attackId, url, headers = {}) {
  const { randomUUID } = await import('node:crypto');
  const requestId = randomUUID();
  try {
    // 격리 환경의 fetch가 기록·대조하기 쉽도록 문자열 주소와 method·headers만 넘기고, 헤더 이름은 모두 소문자로 씁니다.
    // attackId 꼬리표는 x-aleph-attack-id와 x-attack-id 두 이름에 같은 값을 넣습니다.
    const lower = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
    const response = await fetch(String(url), { method: 'GET',
      headers: { 'x-request-id': requestId, 'x-aleph-attack-id': attackId, 'x-attack-id': attackId, ...lower } });
    let body = null;
    try {
      body = await response.json();
    } catch {
      // JSON이 아니면 본문을 읽지 않습니다.
    }
    return { status: response.status, body, requestId };
  } catch (error) {
    // 요청이 나가지 못했거나 응답을 받지 못했으면 실행 기록이 없으므로 결과를 만들지 않습니다(호출한 곳에서 not_run).
    return { status: null, body: null, requestId, failed: true };
  }
}

async function runStep12Checks(app, config) {
  const rowsOf = (data) => (Array.isArray(data) ? data.length : 0);
  const gets = [
    ['anonymous_static_note_read', '비로그인 GET /data.json은 404', new URL('/data.json', app), {}, () => ''],
    ['anonymous_api_note_list', '토큰 없는 GET /api/notes는 401, 메모 0건', new URL('/api/notes', app), {}, (r) => `, 메모 ${rowsOf(r.body)}건`],
    ['forged_token_note_list', '서명이 맞지 않는 토큰의 GET /api/notes는 401, 메모 0건', new URL('/api/notes', app),
      { Authorization: FORGED_TOKEN }, (r) => `, 메모 ${rowsOf(r.body)}건`],
    ['restore_route_get', 'GET /api/restore는 복원하지 않고 405', new URL('/api/restore', app), {}, () => ''],
    ['device_api_anonymous', '토큰 없는 GET /api/devices는 401', new URL('/api/devices', app), {}, () => ''],
    ['war_room_anonymous', '토큰 없는 GET /api/war-room은 401', new URL('/api/war-room', app), {}, () => ''],
    ['install_manifest', '설치형 앱 manifest GET 200, 이름·standalone(설치는 기기 승인이 아님)', new URL('/manifest.webmanifest', app), {},
      (r) => `, 이름 ${typeof r.body?.name === 'string' ? '있음' : '없음'}, display ${r.body?.display ?? '없음'}`],
  ];
  const results = [];
  for (const [attackId, expected, base, headers, extra] of gets) {
    // 심판이 요청 기록을 attackId로 찾을 수 있게 주소에 attackId를 붙입니다. 자료실 경로들은 이 쿼리와 상관없이
    // 로그인·메서드 검사가 먼저라 결과(404·401·405·200)가 같습니다(배포 주소에서 확인).
    // 격리 환경의 URL에는 searchParams가 없을 수 있어 주소 문자열에 직접 붙입니다(기본 주소들에는 쿼리가 없음).
    const target = `${String(base)}?attackId=${encodeURIComponent(attackId)}`;
    const r = await sendGet(attackId, target, headers);
    // 응답을 실제로 받은 요청만 결과를 적고, 실패한 요청은 not_run으로 둡니다(없는 결과를 채우지 않음).
    results.push({ attackId, expected, observed: r.failed ? 'not_run'
      : `GET ${target.slice(String(app).replace(/\/$/u, '').length)} HTTP ${r.status}${extra(r)} · 요청 ID ${r.requestId}` });
  }
  const notRun = [
    ['anonymous_api_note_write', '토큰 없는 POST·PUT·DELETE /api/notes는 401(쓰기 요청이라 제출 묶음에서 보내지 않음)'],
    ['anon_data_api_write', 'anon 키로 원본 notes INSERT·UPDATE·DELETE는 401(쓰기 요청이라 보내지 않음)'],
    ['anon_data_api_select', 'anon 키로 원본 notes GET은 401: Supabase가 attackId 쿼리를 열 필터로 해석해 400이 되므로 이 묶음에서는 보내지 않음(실측은 retest/results.md)'],
    ['restore_device_write_anonymous', '토큰 없는 POST /api/restore·POST /api/devices는 401(쓰기 요청이라 보내지 않음)'],
    ['login_required_checks', 'B의 A 메모 접근 404, B 메모 복원, 승인 전후 자료, 작전실 요약(로그인 필요, retest/results.md에 따로 실측)'],
    ['engine_not_connected', '재로그인 차단·회수 집행(ALEPH SDP 엔진 연결 필요)'],
    ['decider_virtual_rules', '판정기 가상 요청(등록 allow·미등록 deny·복합 이상 step_up·구역 deny): 요청을 보내지 않는 로컬 계산이라 not_run, 결과는 retest/results.md'],
    ['detect_virtual_burst', '탐지기 가상 사건(121건 회수 제안·120건 observe·기기 하나 대상 제안): 로컬 계산이라 not_run, 결과는 retest/results.md'],
    ['policy_baseline_digest', '침해 전 정책 사본 지문 확인: 요청 없는 로컬 계산이라 not_run(npm run policy:diff로 확인)'],
  ].map(([attackId, expected]) => ({ attackId, expected, observed: 'not_run' }));
  return [...results, ...notRun];
}
