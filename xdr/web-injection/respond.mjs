// 보너스 web-injection: decide 결과에서 차단 후보만 ZTNA 판정기용 거부 규칙으로 넣고, 알림을 기록합니다.
// decide.mjs는 판단만 하고, 파일 쓰기와 판정기 연결은 이 파일만 합니다(심판의 격리 실행 대상 아님).
//
// 거부 규칙(xdr/web-injection/deny-rules.json)
//   - block 판정 경보의 출발 주소(srcip)만 막습니다. 계정(srcuser)은 막지 않습니다.
//   - 같은 묶음에서 정상(record)·애매(alert) 이벤트에 나온 주소는 막지 않습니다(정상 사용자 보호).
//   - 규칙마다 만료 시각(expiresAt)과 근거 경보 번호(evidence)를 붙입니다. 만료된 규칙은 적용하지 않습니다.
//   - 판정기 src/decider.mjs와 기존 규칙(RULE_IDS)은 고치지 않습니다. 판정기는 isDenied()로 확인할 수 있습니다.
//     단, 현재 판정기 요청 계약(docs/DECIDER_REQUEST.md)에는 출발 주소가 없어 실제 요청에는 아직 적용되지 않습니다.
// 알림(xdr/alerts.log): block·alert 판정을 한 줄(JSON)씩 덧붙입니다. brute-force와 같은 파일이므로 moduleKey를 붙입니다.
//   요청 주소(data.url)의 주입 문자열은 알림에 남기지 않습니다. record는 남기지 않습니다.
//
// 실행: node xdr/web-injection/respond.mjs            (시험 경보를 흘려 규칙·알림을 만들고 다시 대조)
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

export const MODULE_KEY = 'web-injection';
export const RULES_FILE = fileURLToPath(new URL('./deny-rules.json', import.meta.url));
export const ALERT_LOG = fileURLToPath(new URL('../alerts.log', import.meta.url));
const FIXTURE = fileURLToPath(new URL('../fixtures/web-injection.json', import.meta.url));
export const DEFAULT_TTL_MINUTES = 60;
const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/u;
const ONE_LINE = (value) => String(value ?? '').replace(/[\r\n]+/gu, ' ').slice(0, 300);

// 경보마다 decide를 불러 판정을 모읍니다.
export async function judgeAlerts(alerts) {
  const judged = [];
  for (const alert of alerts) {
    const decision = await decide(alert);
    judged.push({ alert, decision });
  }
  return judged;
}

// 판정 결과에서 거부 규칙을 만듭니다. 기존 규칙과 합치고, 만료된 규칙은 버립니다.
export function buildDenyRules(judged, { now = new Date(), ttlMinutes = DEFAULT_TTL_MINUTES, existing = [] } = {}) {
  const nowMs = now.getTime();
  const expiresAt = new Date(nowMs + ttlMinutes * 60_000).toISOString();
  const normalSources = new Set(judged
    .filter(({ decision }) => decision.action !== 'block')
    .map(({ alert }) => alert?.data?.srcip));

  const rules = new Map(existing
    .filter((rule) => Date.parse(rule.expiresAt) > nowMs && !normalSources.has(rule.match?.srcip))
    .map((rule) => [rule.match.srcip, { ...rule, evidence: [...rule.evidence] }]));
  const skipped = [];

  for (const { alert, decision } of judged) {
    if (decision.action !== 'block') continue;
    const srcip = alert?.data?.srcip;
    if (typeof srcip !== 'string' || !IPV4.test(srcip)) {
      skipped.push({ alertId: alert?.id ?? '', why: '출발 주소 없음' });
      continue;
    }
    if (normalSources.has(srcip)) {
      skipped.push({ alertId: alert.id, why: '정상·애매 이벤트에도 나온 주소' });
      continue;
    }
    const rule = rules.get(srcip) ?? {
      id: `xdr-wi-deny-${srcip}`, action: 'deny', match: { srcip }, source: `xdr/${MODULE_KEY}`,
      createdAt: now.toISOString(), evidence: [], reason: '',
    };
    if (!rule.evidence.includes(alert.id)) rule.evidence.push(alert.id);
    rule.expiresAt = expiresAt;
    rule.reason = ONE_LINE(decision.reason);
    rules.set(srcip, rule);
  }
  return { rules: [...rules.values()], skipped };
}

// 판정기 확인 단계용: 이 출발 주소를 지금 막아야 하는지 돌려줍니다. 계정은 보지 않습니다.
export function isDenied(rules, { srcip, at = new Date() } = {}) {
  const atMs = at instanceof Date ? at.getTime() : Date.parse(at);
  const rule = rules.find((item) => item.action === 'deny' && item.match?.srcip === srcip
    && Date.parse(item.expiresAt) > atMs);
  return rule ? { denied: true, ruleId: rule.id, evidence: rule.evidence } : { denied: false };
}

export function alertLines(judged, now = new Date()) {
  return judged
    .filter(({ decision }) => decision.action !== 'record')
    .map(({ alert, decision }) => `${JSON.stringify({
      loggedAt: now.toISOString(), moduleKey: MODULE_KEY, alertId: alert.id, action: decision.action,
      confidence: decision.confidence, srcip: alert.data?.srcip ?? '', srcuser: alert.data?.srcuser ?? '',
      reason: ONE_LINE(decision.reason),
    })}\n`)
    .join('');
}

async function readRules() {
  try {
    const saved = JSON.parse(await readFile(RULES_FILE, 'utf8'));
    return Array.isArray(saved?.rules) ? saved.rules : [];
  } catch {
    return [];
  }
}

// 경보 묶음을 흘려 규칙 파일을 갱신하고 알림을 덧붙입니다.
export async function respond(alerts, { now = new Date(), ttlMinutes = DEFAULT_TTL_MINUTES } = {}) {
  const judged = await judgeAlerts(alerts);
  const { rules, skipped } = buildDenyRules(judged, { now, ttlMinutes, existing: await readRules() });
  await writeFile(RULES_FILE, `${JSON.stringify({
    schema: 'aleph.xdr.deny-rules.v1', moduleKey: MODULE_KEY, updatedAt: now.toISOString(), rules,
  }, null, 2)}\n`, 'utf8');
  const lines = alertLines(judged, now);
  if (lines) await appendFile(ALERT_LOG, lines, 'utf8');
  return { judged, rules, skipped, logged: lines ? lines.trimEnd().split('\n').length : 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { alerts } = JSON.parse(await readFile(FIXTURE, 'utf8'));
    const now = new Date();
    const { judged, rules, skipped, logged } = await respond(alerts, { now });
    process.stdout.write(`거부 규칙 ${rules.length}개 (만료 ${DEFAULT_TTL_MINUTES}분) · 알림 ${logged}줄 추가 · 건너뜀 ${skipped.length}건\n`);
    for (const rule of rules) process.stdout.write(`  막음 ${rule.match.srcip} · 근거 ${rule.evidence.join(',')} · 만료 ${rule.expiresAt}\n`);

    // 같은 시험 경보를 다시 흘려, 각 경보의 출발 주소가 막히는지 대조합니다.
    let wrong = 0;
    for (const { alert, decision } of judged) {
      const { denied } = isDenied(rules, { srcip: alert.data?.srcip, at: now });
      const expected = decision.action === 'block';
      if (denied !== expected) wrong += 1;
      process.stdout.write(`  ${alert.id} ${decision.action.padEnd(6)} ${alert.data?.srcip ?? '-'} → ${denied ? '거부' : '통과'}${denied === expected ? '' : '  ← 확인 필요'}\n`);
    }
    process.stdout.write(wrong ? `확인 필요 ${wrong}건\n` : '명확한 공격 주소만 거부되고 나머지는 통과합니다.\n');
    if (wrong) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`대응 연결 첫 오류: ${error.message}\n`);
    process.exitCode = 1;
  }
}
