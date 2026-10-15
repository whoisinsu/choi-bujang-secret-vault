// 보너스 known-cve: Wazuh 웹 요청 경보 하나를 block·alert·record로 판단합니다.
// 이 파일 하나로 동작합니다. 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않으며,
// 네트워크·환경변수에 묻지 않고 경보만 보고 바로 계산합니다(인터넷 없는 격리 실행용).
//
// 아래 PATTERNS는 xdr/known-cve/patterns.json(근거: CVE-2021-44228 형태 요청 · MITRE ATT&CK T1190)을
// 옮겨 적은 것입니다. patterns.json을 고치면 이 상수도 함께 고칩니다.
//   knownForms가 fields 값에 맞으면 "뚜렷하게" 맞은 것입니다(완전한 ${jndi:<프로토콜>: 모양).
//   descriptionHints는 설명만 보고 맞은 것이라 형태를 직접 보지 못해 한 단계 낮게 봅니다.
//   partial은 patterns.json의 notASignal에 적힌 "단어만 비슷한 경우"로, 일부만 맞은 것입니다.
//   known_scanner_trace는 requiresWith의 조회 구문 패턴과 함께 맞을 때만 확신도를 더합니다.
// confidence(0~1)는 경보가 패턴과 얼마나 뚜렷하게 맞는지입니다. 0.85 이상 block, 0.5 이상 alert, 그 아래 record.
// 경보 속 조회 구문 문자열은 모양만 대조하고, reason에 옮겨 적거나 다른 곳에 넣지 않습니다.

const JNDI_LOOKUP = /\$\{\s*jndi\s*:\s*(ldaps?|rmi|dns|iiop|corba|nds|nis|https?)\s*:/i;

const PATTERNS = [
  {
    name: 'jndi_lookup_header',
    fields: ['useragent'],
    knownForms: [JNDI_LOOKUP],
    descriptionHints: ['머리글에 원격 조회 구문', '여러 머리글에 같은 CVE-2021-44228 표기', '조회 구문이 머리글'],
    partial: [/[{}]/, /\bjndi\b/i, /중괄호/],
    evidence: 'CVE-2021-44228 · T1190',
  },
  {
    name: 'jndi_lookup_param',
    fields: ['url'],
    knownForms: [JNDI_LOOKUP],
    descriptionHints: ['주소 인자에 원격 조회 구문', '요청 인자의 원격 조회 구문', '로그인 요청에 CVE-2021-44228 형태', '조회 구문이 머리글과 주소'],
    partial: [/\bCVE-\d{4}-\d{4,}/i, /\bjndi\b/i, /\blookup\b/i, /\blog\b/i, /조회 형태|라이브러리|취약점 이름/],
    evidence: 'CVE-2021-44228 · T1190',
  },
  {
    name: 'known_scanner_trace',
    fields: [],
    knownForms: [],
    descriptionHints: ['알려진 취약점 점검 흔적'],
    requiresWith: ['jndi_lookup_header', 'jndi_lookup_param'],
    partial: [/\bcheck\b/i, /\bcve\b/i, /점검 도구|취약점 목록/],
    evidence: 'CVE-2021-44228 · T1190',
  },
];

// 설명이 "조회 구문은 없습니다"처럼 부정하면 설명 단서(descriptionHints)로 쓰지 않습니다(patterns.json negationHints).
const NEGATION_HINTS = ['조회 구문은 없습니다', '원격 조회 구문은 없습니다', '악용 구문은 없습니다', '완전한 구문은 아닙니다', '글자만 있습니다'];
const REPEAT_BONUS_AT = 2;   // 같은 주소에서 이 횟수 이상 반복되면 확신도를 조금 더합니다.
const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;

const round = (value) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;

function decodeArgs(value) {
  const text = typeof value === 'string' ? value.replace(/\+/g, ' ') : '';
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function facts(alert) {
  const rule = alert && typeof alert === 'object' && alert.rule ? alert.rule : {};
  const data = alert && typeof alert === 'object' && alert.data ? alert.data : {};
  const level = Number.isFinite(Number(rule.level)) ? Number(rule.level) : 0;
  const count = Number.parseInt(data.count, 10);
  const description = typeof rule.description === 'string' ? rule.description : '';
  return {
    values: { useragent: decodeArgs(data.useragent), url: decodeArgs(data.url) },
    description,
    negated: NEGATION_HINTS.some((hint) => description.includes(hint)),
    level,
    repeat: Number.isFinite(count) ? count : 0,
    t1190: Array.isArray(rule.mitre) && rule.mitre.map(String).includes('T1190'),
  };
}

export function decide(alert) {
  const f = facts(alert);
  const formHits = [];
  const hintHits = [];
  const partial = [];
  for (const pattern of PATTERNS) {
    const form = pattern.fields.some((field) => pattern.knownForms.some((re) => re.test(f.values[field])));
    const hint = !f.negated && pattern.descriptionHints.some((text) => f.description.includes(text));
    if (form) formHits.push(pattern.name);
    else if (hint) hintHits.push(pattern.name);
    else if (pattern.partial.some((re) => re.test(f.values.url) || re.test(f.values.useragent) || re.test(f.description))) {
      partial.push(pattern.name);
    }
  }
  // 점검 도구 흔적은 혼자서는 악용으로 보지 않습니다. 조회 구문 패턴이 형태로 맞았을 때만 함께 셉니다.
  const scanner = hintHits.includes('known_scanner_trace');
  const lookupHits = [...formHits, ...hintHits].filter((name) => name !== 'known_scanner_trace');
  const scannerWith = scanner && formHits.length > 0;
  const repeated = f.repeat >= REPEAT_BONUS_AT;

  // 1) 완전한 조회 구문 형태가 머리글·인자에 있음: 한 번이어도 명확한 공격입니다(로그에 남는 순간 악용).
  if (formHits.length) {
    const confidence = round(0.8
      + (f.level >= 10 ? 0.06 : f.level >= 7 ? 0.03 : 0)
      + (f.t1190 ? 0.02 : 0)
      + (repeated ? 0.04 : 0)
      + 0.03 * (formHits.length - 1)
      + (scannerWith ? 0.03 : 0));
    const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
    const names = scannerWith ? [...formHits, 'known_scanner_trace'] : formHits;
    return { action, confidence, reason: `명확한 알려진 취약점 악용 · 패턴: ${names.join(', ')} · 반복 ${f.repeat}회` };
  }

  // 2) 설명만 조회 구문을 말하고 형태는 직접 보이지 않음: block까지 가지 않고 alert로 둡니다.
  if (lookupHits.length) {
    const confidence = round(Math.min(0.8, 0.65 + (f.level >= 10 ? 0.06 : 0) + (f.t1190 ? 0.02 : 0)));
    return { action: 'alert', confidence, reason: `조회 구문 설명만 있음(형태 미확인) · 패턴: ${lookupHits.join(', ')}` };
  }

  // 3) T1190 경보이거나 단어만 비슷함: 애매한 시도로 alert(0.5 이상, block까지는 가지 않음).
  if ((f.t1190 || partial.length || scanner) && f.level >= 5) {
    const signals = scanner ? [...partial, 'known_scanner_trace(조회 구문 없음)'] : partial;
    const confidence = round(Math.min(0.8, 0.5
      + 0.04 * partial.length
      + (f.level >= 7 ? 0.03 : 0)
      + (repeated ? 0.03 : 0)));
    const basis = signals.length ? `패턴 일부: ${signals.join(', ')}` : '근거 패턴 없음(T1190 경보만)';
    return { action: 'alert', confidence, reason: `애매한 시도 · ${basis} · 반복 ${f.repeat}회` };
  }

  // 4) 패턴과 맞지 않는 정상 이벤트.
  const confidence = round(0.05 * partial.length);
  return { action: 'record', confidence, reason: `정상 이벤트 · 맞는 패턴 없음${partial.length ? `(단어만 비슷: ${partial.join(', ')})` : ''}` };
}
