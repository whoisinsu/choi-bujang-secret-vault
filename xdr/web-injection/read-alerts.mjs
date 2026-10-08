// 보너스 web-injection 확인용 읽기 모듈입니다. decide.mjs는 이 파일을 불러오지 않습니다.
// xdr/fixtures/web-injection.json(수업용 Wazuh 모양 경보)을 읽어 시각·출발 주소·계정·규칙 수준·설명만 뽑습니다.
// 원본 경보는 읽기만 하고 고치지 않습니다. 비밀값처럼 보이는 값은 출력 전에 가립니다.
// 요청 주소(data.url)의 주입 문자열은 뽑지 않습니다. 계정이 없는 웹 요청 경보는 계정을 '-'로 적습니다.
// 실행: node xdr/web-injection/read-alerts.mjs
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE = fileURLToPath(new URL('../fixtures/web-injection.json', import.meta.url));
const SECRET_LIKE = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
  /\b(?:password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|session)\s*[:=]\s*\S+/giu,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gu,
  /\b(?:sb_secret|sb_publishable|sk|pk)_[A-Za-z0-9_-]{8,}/gu,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]+)?/gu,
  /\b[A-Za-z0-9+/_-]{32,}={0,2}/gu,
];

export function maskSecrets(value) {
  if (value === undefined || value === null) return '';
  return SECRET_LIKE.reduce((text, pattern) => text.replace(pattern, '[가림]'), String(value));
}

// 경보 하나에서 다섯 값만 뽑습니다. 값이 없으면 빈 문자열(수준은 null)로 둡니다.
export function pickAlert(alert) {
  const level = Number(alert?.rule?.level);
  return {
    at: maskSecrets(alert?.timestamp),
    srcip: maskSecrets(alert?.data?.srcip),
    srcuser: maskSecrets(alert?.data?.srcuser),
    level: Number.isFinite(level) ? level : null,
    description: maskSecrets(alert?.rule?.description),
  };
}

export async function readAlerts(path = FIXTURE) {
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'web-injection' || !Array.isArray(fixture.alerts)) {
    throw new Error('web-injection 경보 묶음 형식이 아닙니다.');
  }
  return { total: fixture.alerts.length, rows: fixture.alerts.map(pickAlert) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { total, rows } = await readAlerts();
    for (const [index, row] of rows.entries()) {
      process.stdout.write(`${String(index + 1).padStart(2)} | ${row.at} | ${row.srcip || '-'} | ${row.srcuser || '-'} | ${row.level ?? '-'} | ${row.description}\n`);
    }
    const same = total === rows.length;
    process.stdout.write(`경보 ${total}건 · 뽑은 줄 ${rows.length}줄 · ${same ? '일치' : '불일치'}\n`);
    if (!same) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`경보 읽기 첫 오류: ${error.message}\n`);
    process.exitCode = 1;
  }
}
