// 보너스 brute-force: 로그인 실패 경보를 판단하는 패턴 정의입니다.
// 격리 실행 환경에서도 돌도록 import가 하나도 없습니다(내장 모듈·npm 패키지·JSON·환경변수 없음).
// 각 패턴은 경보에서 뽑은 사실(features)을 보고 맞으면 true를 돌려줍니다.
//   strong: 뚜렷한 공격 신호. 실패 묶음 경보에서 하나라도 맞으면 block 후보입니다.
//   weak:   일부만 맞는 신호. 실패가 있지만 공격이라 단정하기 어려우면 alert 후보입니다.
// 규칙 수준이 높다는 것만으로는 block 하지 않습니다(burst_failures 등 실제 패턴과 함께 볼 때만).

export const BLOCK_MIN_LEVEL = 10;   // block 후보가 되려면 Wazuh 규칙 수준이 이 이상이어야 합니다.
export const ALERT_MIN_LEVEL = 5;    // 이보다 낮은 수준은 정상 기록으로 봅니다.
export const BURST_FAILURES = 30;    // 짧은 시간 같은 출처의 실패가 이 건수 이상이면 폭주입니다.
export const SPRAY_ACCOUNTS = 5;     // 한 주소가 이 개수 이상의 계정에 실패를 넣으면 비밀번호 뿌리기입니다.
export const SOME_FAILURES = 2;      // 실패가 이 건수 이상이면 지켜볼 만한 신호입니다.

const FAILURE_WORD = /실패/u;
const FAILURE_COUNT = /실패[^0-9]{0,6}(\d+)\s*건|(\d+)\s*건[^.]{0,6}실패/u;
const ACCOUNT_COUNT = /계정\s*(\d+)\s*개/u;

// 경보 하나에서 판단에 쓸 사실만 뽑습니다. 값이 없거나 형식이 틀려도 오류를 내지 않습니다.
export function features(alert) {
  const rule = alert && typeof alert === 'object' ? alert.rule ?? {} : {};
  const data = alert && typeof alert === 'object' ? alert.data ?? {} : {};
  const description = typeof rule.description === 'string' ? rule.description : '';
  const level = Number.isFinite(Number(rule.level)) ? Number(rule.level) : 0;
  const mitre = Array.isArray(rule.mitre) ? rule.mitre.map(String) : [];

  const fromData = Number.parseInt(data.count, 10);
  const match = FAILURE_COUNT.exec(description);
  const fromText = match ? Number.parseInt(match[1] ?? match[2], 10) : NaN;
  const failures = Number.isFinite(fromData) ? fromData : Number.isFinite(fromText) ? fromText : 0;

  const listed = Array.isArray(data.accounts) ? data.accounts
    : typeof data.accounts === 'string' ? data.accounts.split(',').map((item) => item.trim()).filter(Boolean) : [];
  const counted = Number.parseInt(ACCOUNT_COUNT.exec(description)?.[1] ?? '', 10);
  const accounts = Math.max(listed.length, Number.isFinite(counted) ? counted : 0);

  return {
    description,
    level,
    bruteForceTechnique: mitre.includes('T1110'),
    hasFailure: FAILURE_WORD.test(description) || failures > 0,
    failures,
    accounts,
    succeededAfter: /뒤에?\s*성공/u.test(description),
  };
}

export const PATTERNS = [
  // ── strong: 뚜렷한 공격 ──
  { name: 'burst_failures', kind: 'strong',
    test: (f) => f.failures >= BURST_FAILURES },
  { name: 'password_spray', kind: 'strong',
    test: (f) => f.accounts >= SPRAY_ACCOUNTS
      || /여러\s*계정에\s*같은\s*비밀번호|같은\s*비밀번호\s*실패|계정\s*이름을\s*바꿔/u.test(f.description) },
  { name: 'password_mutation', kind: 'strong',
    test: (f) => /한\s*글자씩\s*바꿔/u.test(f.description) && f.hasFailure },
  { name: 'no_success_after_burst', kind: 'strong',
    test: (f) => /성공은\s*없/u.test(f.description) && f.failures >= BURST_FAILURES },

  // ── weak: 일부만 맞는 애매한 시도 ──
  { name: 'repeated_failures', kind: 'weak',
    test: (f) => f.failures >= SOME_FAILURES && f.failures < BURST_FAILURES },
  { name: 'failures_then_success', kind: 'weak',
    test: (f) => f.hasFailure && f.failures >= SOME_FAILURES && f.succeededAfter },
  { name: 'unusual_source', kind: 'weak',
    test: (f) => /평소와\s*다른\s*주소/u.test(f.description) && f.hasFailure },
  { name: 'few_accounts_same_source', kind: 'weak',
    test: (f) => f.hasFailure && /두\s*계정|계정\s*[2-4]\s*개/u.test(f.description) },
  { name: 'retry_after_lockout', kind: 'weak',
    test: (f) => /잠금\s*뒤/u.test(f.description) && f.hasFailure },
  { name: 'irregular_failures', kind: 'weak',
    test: (f) => /간격은\s*고르지\s*않/u.test(f.description) && f.hasFailure },
];
