// 12단계: GET /api/war-room — 탈환 작전실 요약. 로그인한 사용자 본인의 기록만 모읍니다.
// 항목마다 출처를 붙입니다.
// - server_record: 서버(DB·정책 사본 파일)에서 지금 읽은 실제 기록
// - local_virtual: 서버에서 판정기·탐지기를 가상 요청·사건으로 실제 실행한 결과(운영 엔진·심판 판정 아님)
// - not_run: 이 환경에 연결이 없어 실행하지 않은 것
// 메모 본문·제목, 공개키, 토큰은 응답에 넣지 않고, 기기·메모 ID는 앞 4자리만 보여 줍니다.
// 수치(counts)는 같은 응답의 가린 기록(records)에서 센 값이라 화면이 다시 세어 대조할 수 있습니다.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { decide, RULE_IDS } from './decider.mjs';
import { detect, proposeRevocation } from './detect.mjs';
import { HttpError, requireUser, serverSettings } from './notes-api.mjs';

const mask = (value) => (typeof value === 'string' && value.length > 4 ? `${value.slice(0, 4)}…` : '…');
const countBy = (rows, key) => rows.reduce((acc, row) => ({ ...acc, [row[key]]: (acc[row[key]] ?? 0) + 1 }), {});

async function table(key, base, name, query) {
  const url = new URL(`/rest/v1/${name}`, base);
  url.search = new URLSearchParams(query).toString();
  let upstream;
  try {
    upstream = await fetch(url, { headers: { apikey: key, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  } catch (error) {
    console.error(`war-room: Supabase 요청 실패 (${error.name}, ${name})`);
    return null;
  }
  if (!upstream.ok) {
    console.error(`war-room: Supabase 응답 ${upstream.status} (${name})`);
    return null;
  }
  const rows = await upstream.json();
  return Array.isArray(rows) ? rows : null;
}

// 판정기: 연습 요청과 같은 모양의 가상 요청 다섯 개를 실제로 decide()에 넣은 결과입니다.
async function deciderSummary() {
  const base = {
    schema: 'aleph.decision.v1', classId: 'class_fixture', projectId: 'project_fixture', subjectId: 'learner_fixture',
    deviceId: 'a'.repeat(16), service: 'notes', method: 'GET', path: '/notes/demo', route: 'GET /notes/:id',
    queryLength: 0, querySha256: createHash('sha256').update('').digest('hex'), at: new Date().toISOString(),
    policyRevision: 1, deviceRegistered: true, stepUp: { verified: false, authAgeSeconds: null }, recentEvents: [],
    signals: { source: 'judge_fixture', region: 'local', network: 'usual', hour: 14 },
  };
  const cases = [
    ['등록 기기 내 메모 읽기', {}],
    ['미등록 기기', { deviceRegistered: false }],
    ['다른 사용자 메모 경로', { subjectId: 'learner_other' }],
    ['목록 조회(자료 ID 없음)', { path: '/notes', route: 'GET /notes' }],
    ['새벽·낯선 네트워크·사건 급증', { signals: { source: 'judge_fixture', region: 'foreign', network: 'unusual', hour: 3 },
      recentEvents: [{ kind: 'risk_signal', ageSeconds: 60, count: 20 }] }],
  ];
  const results = [];
  for (const [label, change] of cases) {
    const { decision, reasonCode, ruleIds } = await decide({ ...base, ...change, requestId: randomUUID() });
    results.push({ label, decision, reasonCode, ruleIds });
  }
  return { source: 'local_virtual', ruleIds: [...RULE_IDS], results, counts: countBy(results, 'decision') };
}

// 탐지기: 같은 가명 사용자의 2초 간격 GET 사건을 실제로 detect()·proposeRevocation()에 넣은 결과입니다.
function detectSummary() {
  const reads = (count, deviceId) => Array.from({ length: count }, (_, index) => ({
    at: new Date(Date.UTC(2026, 9, 1) + index * 2000).toISOString(), method: 'GET',
    identity: { sub: 'learner_fixture' }, ...(deviceId ? { deviceId } : {}),
  }));
  const results = [
    { label: '10분 안 121건', ...detect(reads(121)) },
    { label: '10분 안 120건', ...detect(reads(120)) },
    { label: '정상 30건', ...detect(reads(30)) },
  ];
  const proposal = proposeRevocation(reads(121, 'a'.repeat(16)));
  return {
    source: 'local_virtual', results: results.map(({ label, action, reasonCode }) => ({ label, action, reasonCode: reasonCode ?? null })),
    proposal: proposal ? { action: proposal.action, reasonCode: proposal.reasonCode, device: mask(proposal.deviceId) } : null,
    counts: countBy(results, 'action'),
    liveEvents: { source: 'not_run', note: '운영 반 엔진의 실제 사건 전달이 이 저장소에 연결돼 있지 않음' },
  };
}

function policySummary() {
  try {
    const baseline = JSON.parse(readFileSync(new URL('../policy/baseline.json', import.meta.url), 'utf8'));
    const files = baseline.files ?? {};
    const digest = createHash('sha256').update(JSON.stringify(Object.keys(files).sort().map(path => [path, files[path]])), 'utf8').digest('hex');
    return { source: 'server_record', version: baseline.version ?? null, commit: mask(baseline.commit),
      fileCount: Object.keys(files).length, digestOk: digest === baseline.digest,
      currentDiff: { source: 'not_run', note: '현재 정책과의 차이는 git이 필요해 서버에서 실행하지 않음(npm run policy:diff)' } };
  } catch {
    return { source: 'server_record', version: null, fileCount: 0, digestOk: false, error: 'BASELINE_UNREADABLE' };
  }
}

export async function warRoomHandler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const { base, key } = serverSettings();
    const userId = await requireUser(request, key);
    if (new URL(request.url ?? '', 'http://localhost').search) throw new HttpError(404, 'ROUTE_NOT_ALLOWED');
    const [devices, audit, backups] = await Promise.all([
      table(key, base, 'device_registrations', { select: 'device_id,status,requested_at,approved_at', owner_id: `eq.${userId}`, order: 'requested_at.desc' }),
      table(key, base, 'restore_audit', { select: 'seq,at,note_id,result', owner_id: `eq.${userId}`, order: 'seq.asc' }),
      table(key, base, 'notes_backup', { select: 'id,source', owner_id: `eq.${userId}` }),
    ]);
    const deviceRecords = devices?.map(row => ({ device: mask(row.device_id), status: row.status, requestedAt: row.requested_at,
      approvedAt: row.approved_at })) ?? null;
    const auditRecords = audit?.map(row => ({ seq: row.seq, at: row.at, note: mask(row.note_id), result: row.result })) ?? null;
    return response.status(200).json({
      schema: 'aleph.war-room.v1',
      generatedAt: new Date().toISOString(),
      decider: await deciderSummary(),
      detection: detectSummary(),
      revocation: {
        source: deviceRecords ? 'server_record' : 'not_run',
        records: deviceRecords ?? [], counts: deviceRecords ? countBy(deviceRecords, 'status') : {},
        execution: { source: 'not_run', note: '탐지기의 회수 제안을 집행하는 운영 엔진 연결이 없음' },
      },
      restore: {
        policy: policySummary(),
        backups: { source: backups ? 'server_record' : 'not_run', count: backups?.length ?? 0,
          records: backups?.map(row => ({ note: mask(row.id), source: row.source })) ?? [] },
        audit: { source: auditRecords ? 'server_record' : 'not_run', records: auditRecords ?? [],
          counts: auditRecords ? countBy(auditRecords, 'result') : {} },
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401) response.setHeader('WWW-Authenticate', 'Bearer');
      return response.status(error.status).json({ error: error.code });
    }
    console.error(`war-room: 처리 실패 (${error.name})`);
    return response.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
