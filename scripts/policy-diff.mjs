// 10단계: 침해 전에 검증한 안전 정책 사본(policy/baseline.json)과 현재 시험 정책의 차이만 보여 줍니다.
// - 사본은 심판을 통과한 저장점 커밋의 정책 파일별 SHA-256 지문입니다. 메모 본문·비밀값은 담지 않습니다.
// - 사본이 없거나, 사본 자체의 지문이 맞지 않거나, 기준 커밋의 파일이 기록과 다르면 아무것도 비교하지 않고 중단합니다.
// - 차이 보기는 읽기만 합니다. 복원(--restore --confirm)도 이 저장소의 시험 정책 파일만 바꾸며,
//   DB·배포·커밋 같은 실제 운영 정책은 바꾸지 않습니다.
// 사용: npm run policy:diff [-- --baseline <사본 경로>]
//       npm run policy:diff -- --record <커밋>   (사본이 없을 때만 그 커밋으로 사본을 만듭니다)
//       npm run policy:restore                    (바뀔 항목만 보여 주고 아무것도 바꾸지 않습니다)
//       npm run policy:restore -- --confirm <버전> (확인한 버전으로 사본과 다른 정책 파일만 되돌립니다)
// 복원은 사본 목록의 정책 파일만 기준 커밋 내용으로 덮어씁니다. 다른 파일·Git 이력은 건드리지 않고,
// policy/restore-log.jsonl에 복원 기록을 한 줄씩 덧붙입니다(기존 기록은 지우거나 고치지 않음).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const DEFAULT_BASELINE = join(root, 'policy', 'baseline.json');
const SCHEMA = 'aleph.policy.baseline.v1';
const RESTORE_LOG = join(root, 'policy', 'restore-log.jsonl');
// 접근을 결정하는 정책 파일만 대상입니다. 화면·README·연습 명령은 넣지 않습니다.
const POLICY_FILES = Object.freeze([
  'src/decider.mjs', 'src/detect.mjs', 'src/verify-login.mjs', 'src/auth-proxy.mjs', 'src/notes-api.mjs',
  'src/resources.mjs', 'api/notes/index.js', 'api/notes/[id].js', 'aleph.config.json', 'vercel.json',
  'supabase/step4_rls.sql', 'supabase/step5_revoke.sql',
]);
const COMMIT = /^[0-9a-f]{7,40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

class Stop extends Error {}
const stop = (message) => { throw new Stop(message); };
const git = (...args) => execFileSync('git', ['-C', root, ...args], {
  encoding: 'buffer', timeout: 10000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
  stdio: ['ignore', 'pipe', 'ignore'],
});
// Windows 줄바꿈(CRLF)과 Git 저장본(LF)을 같은 내용으로 보도록 LF로 맞춘 뒤 지문을 냅니다.
const normalize = (buffer) => buffer.toString('utf8').replace(/\r\n/gu, '\n');
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const filesDigest = (files) => sha256(JSON.stringify(Object.keys(files).sort().map(path => [path, files[path]])));

function committed(commit, path) {
  try {
    return normalize(git('show', `${commit}:${path}`));
  } catch {
    return null;
  }
}

function record(commit) {
  if (existsSync(DEFAULT_BASELINE)) stop('policy/baseline.json이 이미 있습니다. 검증한 사본은 덮어쓰지 않습니다.');
  if (!COMMIT.test(commit ?? '')) stop('사본으로 기록할 커밋을 적어 주세요.');
  const full = git('rev-parse', '--verify', `${commit}^{commit}`).toString('utf8').trim();
  const files = {};
  for (const path of POLICY_FILES) {
    const text = committed(full, path);
    if (text === null) stop(`기준 커밋에 정책 파일이 없습니다: ${path}`);
    files[path] = sha256(text);
  }
  const baseline = { schema: SCHEMA, version: `policy@${full.slice(0, 7)}`, commit: full,
    note: '침해 전 심판 통과 저장점의 정책 파일 지문(본문·비밀값 없음)', files, digest: filesDigest(files) };
  mkdirSync(dirname(DEFAULT_BASELINE), { recursive: true });
  writeFileSync(DEFAULT_BASELINE, `${JSON.stringify(baseline, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`검증한 정책 사본을 기록했습니다: ${baseline.version} (파일 ${POLICY_FILES.length}개)\n`);
}

// 사본을 읽고 세 가지를 검증합니다. 하나라도 틀리면 중단합니다.
function loadVerifiedBaseline(path) {
  if (!existsSync(path)) stop('검증한 정책 사본이 없습니다. 비교하지 않고 중단합니다.');
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    stop('정책 사본을 읽을 수 없습니다(JSON 형식 오류). 비교하지 않고 중단합니다.');
  }
  if (baseline?.schema !== SCHEMA || !COMMIT.test(baseline.commit ?? '') || typeof baseline.version !== 'string'
      || !baseline.files || typeof baseline.files !== 'object' || !SHA256.test(baseline.digest ?? '')) {
    stop('정책 사본의 형식이 맞지 않습니다. 비교하지 않고 중단합니다.');
  }
  const paths = Object.keys(baseline.files).sort();
  if (paths.join('\n') !== [...POLICY_FILES].sort().join('\n')
      || paths.some(file => !SHA256.test(baseline.files[file]))) {
    stop('정책 사본의 대상 파일 목록이나 지문 형식이 다릅니다. 비교하지 않고 중단합니다.');
  }
  // 1) 사본 전체 지문: 파일 지문 중 하나라도 바뀌면 맞지 않습니다.
  if (filesDigest(baseline.files) !== baseline.digest) stop('검증 실패: 정책 사본의 전체 지문이 맞지 않습니다. 중단합니다.');
  // 2) 기준 커밋이 이 저장소에 있어야 합니다.
  try {
    git('cat-file', '-e', `${baseline.commit}^{commit}`);
  } catch {
    stop('검증 실패: 정책 사본의 기준 커밋을 이 저장소에서 찾을 수 없습니다. 중단합니다.');
  }
  // 3) 기준 커밋의 각 정책 파일이 사본에 기록된 지문과 같아야 합니다.
  for (const file of paths) {
    const text = committed(baseline.commit, file);
    if (text === null || sha256(text) !== baseline.files[file]) {
      stop(`검증 실패: 기준 커밋의 ${file}이(가) 사본 지문과 다릅니다. 중단합니다.`);
    }
  }
  return baseline;
}

function diffLines(commit, file) {
  try {
    const out = execFileSync('git', ['-C', root, 'diff', '--no-color', '--numstat', commit, '--', file],
      { encoding: 'utf8', timeout: 10000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const [added, removed] = out.split(/\s+/u);
    return out ? `+${added} -${removed}줄` : '줄 차이 없음(줄바꿈만 다름)';
  } catch {
    return '줄 수 확인 불가';
  }
}

// 사본과 다른 정책 파일 목록입니다. before는 현재 파일 지문(파일이 없으면 null)입니다.
function changedFiles(baseline) {
  const changed = [];
  for (const file of Object.keys(baseline.files).sort()) {
    const current = join(root, file);
    const before = existsSync(current) ? sha256(normalize(readFileSync(current))) : null;
    if (before !== baseline.files[file]) changed.push({ file, before });
  }
  return changed;
}

function planLines(baseline, changed) {
  return [
    `복원할 정책 버전: ${baseline.version} (커밋 ${baseline.commit.slice(0, 12)}) · 사본 검증 통과`,
    `비교 대상: 현재 작업 폴더의 시험 정책 파일 ${Object.keys(baseline.files).length}개`,
    changed.length ? `변경 범위: ${changed.length}개 파일` : '변경 범위: 없음(현재 시험 정책이 사본과 같습니다)',
    ...changed.map(({ file, before }) => (before === null ? `  - 없어짐  ${file}`
      : `  - 바뀜    ${file} (${diffLines(baseline.commit, file)})`)),
  ];
}

function showDiff(baseline) {
  process.stdout.write([...planLines(baseline, changedFiles(baseline)),
    '이 명령은 차이만 보여 줍니다. 운영 정책을 복원하거나 바꾸지 않았습니다.'].join('\n') + '\n');
}

// 10단계 복원: 확인한 버전일 때만, 사본과 다른 정책 파일을 기준 커밋 내용으로 되돌립니다.
function restore(baseline, confirm) {
  const changed = changedFiles(baseline);
  const plan = planLines(baseline, changed);
  if (!changed.length) {
    process.stdout.write([...plan, '되돌릴 항목이 없습니다. 아무것도 바꾸지 않았습니다.'].join('\n') + '\n');
    return;
  }
  if (confirm !== baseline.version) {
    process.stdout.write([...plan,
      '위 파일만 사본 버전으로 되돌립니다. 다른 파일·Git 이력·감사 기록은 그대로 둡니다.',
      `확인했다면 다음 명령으로 실행하세요: npm run policy:restore -- --confirm ${baseline.version}`,
      '아직 아무것도 바꾸지 않았습니다.'].join('\n') + '\n');
    if (confirm !== undefined) process.exitCode = 1;
    return;
  }
  // 쓰기 전에 기준 커밋 내용을 모두 꺼내 지문을 다시 확인합니다. 하나라도 다르면 아무것도 쓰지 않습니다.
  const contents = changed.map(({ file }) => {
    const text = committed(baseline.commit, file);
    if (text === null || sha256(text) !== baseline.files[file]) {
      stop(`검증 실패: ${file}의 사본 내용이 지문과 다릅니다. 복원하지 않았습니다.`);
    }
    return text;
  });
  changed.forEach(({ file }, index) => {
    const target = join(root, file);
    // 원래 파일이 CRLF였으면 CRLF로 씁니다(내용은 같고 줄바꿈 때문에 바뀐 파일로 보이지 않게).
    const crlf = existsSync(target) && readFileSync(target, 'utf8').includes('\r\n');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, crlf ? contents[index].replace(/\n/gu, '\r\n') : contents[index], 'utf8');
  });
  const after = changedFiles(baseline);
  if (after.length) stop(`복원 뒤에도 사본과 다른 파일이 있습니다: ${after.map(item => item.file).join(', ')}`);
  // 감사 기록: 기존 줄은 그대로 두고 한 줄만 덧붙입니다. 파일 지문만 남기고 내용·비밀값은 남기지 않습니다.
  const entry = { at: new Date().toISOString(), action: 'policy_restore', version: baseline.version,
    commit: baseline.commit, files: changed.map(({ file, before }) => ({ file, before, after: baseline.files[file] })) };
  mkdirSync(dirname(RESTORE_LOG), { recursive: true });
  appendFileSync(RESTORE_LOG, `${JSON.stringify(entry)}\n`, 'utf8');
  process.stdout.write([...plan, `되돌림 완료: ${changed.length}개 파일이 ${baseline.version}과 같아졌습니다.`,
    '감사 기록: policy/restore-log.jsonl에 한 줄 덧붙였습니다.',
    '배포에 반영하려면 커밋·push가 필요합니다(이 명령은 커밋·배포·DB를 바꾸지 않습니다).'].join('\n') + '\n');
}

try {
  const args = process.argv.slice(2);
  const at = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const baselinePath = at('--baseline') ? resolve(at('--baseline')) : DEFAULT_BASELINE;
  if (args.includes('--record')) record(at('--record'));
  else if (args.includes('--restore')) restore(loadVerifiedBaseline(baselinePath), at('--confirm'));
  else showDiff(loadVerifiedBaseline(baselinePath));
} catch (error) {
  process.stderr.write(`${error instanceof Stop ? error.message : `정책 비교 중 오류: ${error.message}`}\n`);
  process.exitCode = 1;
}
