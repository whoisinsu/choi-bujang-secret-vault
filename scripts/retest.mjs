// 12단계: 1~11단계 정상·금지 요청의 실측 표를 만듭니다. 사용: npm run retest
// - 이 명령은 로그인 없이 보낼 수 있는 요청만 배포 주소에 실제로 보냅니다(비밀번호·토큰을 쓰지 않음).
// - 로그인·승인 기기가 필요한 요청은 작전실 화면의 "로그인 재시험"이 브라우저에서 실제로 보내고, 그 결과 JSON을
//   학생이 retest/browser.json에 붙여 넣으면 이 명령이 함께 표로 합칩니다. 없으면 그 줄들은 미실행입니다.
// - 판정기·탐지기(6~9단계)는 API가 아니라 로컬 가상 실행이므로 출처를 "로컬 가상"으로 따로 적습니다.
// - 실행하지 않은 시험을 통과로 적지 않습니다. 심판의 41종 공격은 심판이 실행하므로 표에 넣지 않습니다.
import { randomUUID, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { decide } from '../src/decider.mjs';
import { detect } from '../src/detect.mjs';
import { ANON_KEY } from '../src/attack-check.mjs'; // 화면에도 있던 공개용 키(5단계 자기 점검과 같은 값)

const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(readFileSync(join(root, 'aleph.config.json'), 'utf8'));
const app = new URL(config.publicAppUrl);
const MEMO_SENTENCE = /실습용 가상 [가-힣]+ 기록/u;
const rows = [];

async function send({ stage, kind, label, expected, url, method = 'GET', headers = {}, body, accept }) {
  const requestId = randomUUID();
  const at = new Date().toISOString();
  let status;
  let code = null;
  let serverId = null;
  let note = '';
  try {
    const response = await fetch(url, { method, redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { 'X-Request-Id': requestId, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined });
    status = response.status;
    serverId = response.headers.get('x-vercel-id');
    const text = await response.text();
    try {
      code = JSON.parse(text)?.error ?? null;
    } catch {
      // JSON이 아니면 오류 코드는 없습니다.
    }
    if (MEMO_SENTENCE.test(text)) note = '응답에 가상 메모 문장 있음';
  } catch (error) {
    status = `요청 실패(${error.name})`;
  }
  const ok = accept({ status, code, note });
  rows.push({ stage, kind, label, expected, actual: `${status}${code ? ` ${code}` : ''}${note ? ` · ${note}` : ''}`,
    match: ok, source: 'api', requestId, serverId, at });
}

const base = (path) => new URL(path, app);
const status = (...wanted) => ({ status, note }) => wanted.includes(status) && !note;

await send({ stage: '1', kind: '금지', label: '비로그인 GET /data.json', expected: '404', url: base('/data.json'), accept: status(404) });
await send({ stage: '2', kind: '정상', label: '비로그인 GET / (화면 틀)', expected: '200, 메모 문장 없음', url: base('/'), accept: status(200) });
await send({ stage: '2', kind: '금지', label: '비로그인 GET /aleph.json에 메모 문장', expected: '200, 메모 문장 없음', url: base('/aleph.json'), accept: status(200) });
await send({ stage: '3', kind: '금지', label: '토큰 없이 GET /api/notes', expected: '401', url: base('/api/notes'), accept: status(401) });
await send({ stage: '3', kind: '금지', label: '위조 토큰 GET /api/notes', expected: '401', url: base('/api/notes'),
  headers: { Authorization: 'Bearer aaaa.bbbb.cccc' }, accept: status(401) });
await send({ stage: '3', kind: '금지', label: '토큰 없이 POST /api/notes(role=admin)', expected: '401', url: base('/api/notes'), method: 'POST',
  body: { title: '재시험', role: 'admin' }, accept: status(401) });
await send({ stage: '3', kind: '금지', label: '토큰 없이 PUT /api/notes/:id', expected: '401', url: base('/api/notes/00000000-0000-4000-8000-000000000000'),
  method: 'PUT', body: { title: '재시험' }, accept: status(401) });
await send({ stage: '3', kind: '금지', label: '토큰 없이 DELETE /api/notes/:id', expected: '401', url: base('/api/notes/00000000-0000-4000-8000-000000000000'),
  method: 'DELETE', accept: status(401) });
await send({ stage: '5', kind: '금지', label: 'anon 키로 원본 notes SELECT', expected: '401', url: new URL(`${config.originalApiUrl}?select=id&limit=1`),
  headers: { apikey: ANON_KEY }, accept: status(401, 403) });
await send({ stage: '5', kind: '금지', label: 'anon 키로 원본 notes INSERT', expected: '401', url: new URL(config.originalApiUrl), method: 'POST',
  headers: { apikey: ANON_KEY, Prefer: 'return=minimal' }, body: { title: '재시험' }, accept: status(401, 403) });
await send({ stage: '10', kind: '금지', label: '토큰 없이 POST /api/restore', expected: '401', url: base('/api/restore'), method: 'POST',
  body: { id: 'b0000000-0000-4000-8000-000000000001' }, accept: status(401) });
await send({ stage: '11', kind: '금지', label: '토큰 없이 POST /api/devices', expected: '401', url: base('/api/devices'), method: 'POST',
  body: { publicKey: {} }, accept: status(401) });
await send({ stage: '11', kind: '정상', label: 'GET /manifest.webmanifest', expected: '200', url: base('/manifest.webmanifest'), accept: status(200) });
await send({ stage: '12', kind: '금지', label: '토큰 없이 GET /api/war-room', expected: '401', url: base('/api/war-room'), accept: status(401) });

// 6~9단계: 판정기·탐지기 로컬 가상 실행(운영 엔진·심판 판정 아님). 요청 ID는 판정 요청의 requestId입니다.
const fixture = (change) => ({ schema: 'aleph.decision.v1', requestId: randomUUID(), classId: 'class_fixture', projectId: 'project_fixture',
  subjectId: 'learner_fixture', deviceId: 'a'.repeat(16), service: 'notes', method: 'GET', path: '/notes/demo', route: 'GET /notes/:id',
  queryLength: 0, querySha256: createHash('sha256').update('').digest('hex'), at: new Date().toISOString(), policyRevision: 1,
  deviceRegistered: true, stepUp: { verified: false, authAgeSeconds: null }, recentEvents: [],
  signals: { source: 'judge_fixture', region: 'local', network: 'usual', hour: 14 }, ...change });
for (const [stage, kind, label, change, want] of [
  ['6', '정상', '등록 기기 내 메모 읽기', {}, 'allow'],
  ['6', '금지', '미등록 기기', { deviceRegistered: false }, 'deny'],
  ['7', '금지', '새벽·낯선 네트워크·사건 급증', { signals: { source: 'judge_fixture', region: 'foreign', network: 'unusual', hour: 3 },
    recentEvents: [{ kind: 'risk_signal', ageSeconds: 60, count: 20 }] }, 'step_up'],
  ['8', '금지', '다른 사용자 메모 경로', { subjectId: 'learner_other' }, 'deny'],
  ['8', '금지', '목록 조회(자료 ID 없음)', { path: '/notes', route: 'GET /notes' }, 'deny'],
]) {
  const request = fixture(change);
  const result = await decide(request);
  rows.push({ stage, kind, label: `판정기 ${label}`, expected: want, actual: `${result.decision} ${result.reasonCode}`,
    match: result.decision === want, source: 'local_virtual', requestId: request.requestId, serverId: null, at: new Date().toISOString() });
}
const reads = (n) => Array.from({ length: n }, (_, i) => ({ at: new Date(Date.UTC(2026, 9, 1) + i * 2000).toISOString(), method: 'GET',
  identity: { sub: 'learner_fixture' } }));
for (const [kind, n, want] of [['금지', 121, 'propose_revocation'], ['정상', 120, 'observe']]) {
  const result = detect(reads(n));
  rows.push({ stage: '9', kind, label: `탐지기 10분 안 GET ${n}건`, expected: want, actual: `${result.action}${result.reasonCode ? ` ${result.reasonCode}` : ''}`,
    match: result.action === want, source: 'local_virtual', requestId: null, serverId: null, at: new Date().toISOString() });
}

// 브라우저 로그인 재시험 결과(작전실 화면에서 복사해 붙여 넣은 것)를 합칩니다. 형식이 틀린 줄은 버립니다.
const browserFile = join(root, 'retest', 'browser.json');
let browserRows = [];
if (existsSync(browserFile)) {
  try {
    const data = JSON.parse(readFileSync(browserFile, 'utf8'));
    browserRows = (Array.isArray(data?.rows) ? data.rows : []).filter(r => r && typeof r.label === 'string'
      && typeof r.actual === 'string' && typeof r.at === 'string' && typeof r.match === 'boolean')
      .map(r => ({ stage: String(r.stage), kind: r.kind, label: r.label, expected: r.expected, actual: r.actual, match: r.match,
        source: 'api_browser', requestId: r.requestId ?? null, serverId: r.serverId ?? null, at: r.at }));
  } catch {
    console.error('retest/browser.json을 읽지 못했습니다. 로그인 재시험 줄은 미실행으로 둡니다.');
  }
}
const LOGIN_CASES = [
  ['4', '정상', 'A 내 메모 목록', '200, 내 메모 1건 이상'], ['4', '정상', 'A 내 메모 한 건 읽기', '200'],
  ['4', '정상', 'A 내 메모 같은 값으로 수정', '200'], ['11', '금지', 'A 미승인 기기 ID로 목록', '403 DEVICE_NOT_APPROVED'],
  ['4', '금지', 'A가 B 메모 읽기', '404 NOTE_NOT_FOUND'], ['8', '금지', 'A role 포함 수정', '403 ROLE_FIELD_REJECTED'],
  ['8', '금지', 'A 쿼리로 owner_id 지정', '404 ROUTE_NOT_ALLOWED'], ['10', '금지', 'A가 B 메모 복원', '404 BACKUP_NOT_FOUND'],
];
const missing = LOGIN_CASES.filter(([, , label]) => !browserRows.some(r => r.label === label))
  .map(([stage, kind, label, expected]) => ({ stage, kind, label, expected, actual: '미실행(로그인 필요, 작전실 "로그인 재시험"으로 실행)',
    match: null, source: 'not_run', requestId: null, serverId: null, at: null }));

const all = [...rows, ...browserRows, ...missing];
const SOURCE = { api: '배포 API(로그인 없음)', api_browser: '배포 API(브라우저 로그인)', local_virtual: '로컬 가상', not_run: '미실행' };
const md = [
  `# 1~11단계 재시험 실측 표`,
  '',
  `만든 시각: ${new Date().toISOString()} · 배포 주소: ${app.origin} · 커밋 기준: aleph.config.json step ${config.step}`,
  '',
  '| 단계 | 구분 | 요청 | 기대 | 실제 결과 | 일치 | 출처 | 요청 ID | 서버 요청 ID | 확인 시각 |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...all.map(r => `| ${r.stage} | ${r.kind} | ${r.label} | ${r.expected} | ${r.actual} | ${r.match === null ? '미실행' : r.match ? '일치' : '불일치'} | ${SOURCE[r.source]} | ${r.requestId ?? '—'} | ${r.serverId ?? '—'} | ${r.at ?? '—'} |`),
  '',
  `- 실행: ${all.filter(r => r.match !== null).length}줄(일치 ${all.filter(r => r.match === true).length}, 불일치 ${all.filter(r => r.match === false).length}) · 미실행: ${missing.length}줄`,
  '- 심판의 41종 공격: 미실행(심판이 실행하며 이 표의 결과로 대신하지 않음)',
  '- 로컬 가상 줄은 판정기·탐지기를 이 컴퓨터에서 실행한 결과이며 운영 엔진·심판 판정이 아닙니다.',
  '',
].join('\n');
mkdirSync(join(root, 'retest'), { recursive: true });
writeFileSync(join(root, 'retest', 'results.json'), `${JSON.stringify({ schema: 'aleph.retest.v1', generatedAt: new Date().toISOString(), rows: all }, null, 2)}\n`);
writeFileSync(join(root, 'retest', 'results.md'), md);
console.log(`retest/results.md 생성 · 실행 ${all.filter(r => r.match !== null).length}줄(불일치 ${all.filter(r => r.match === false).length}) · 미실행 ${missing.length}줄`);
if (all.some(r => r.match === false)) process.exitCode = 1;
