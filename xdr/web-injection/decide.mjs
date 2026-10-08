// 보너스 web-injection: Wazuh 웹 접근 경보 하나를 block·alert·record로 판단합니다.
// 이 파일 하나로 동작합니다. 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않으며,
// 네트워크·환경변수에 묻지 않고 경보만 보고 바로 계산합니다(인터넷 없는 격리 실행용).
//
// 아래 PATTERNS는 xdr/web-injection/patterns.json(근거: MITRE ATT&CK T1190)을 옮겨 적은 것입니다.
// patterns.json을 고치면 이 상수도 함께 고칩니다.
//   knownForms·fixtureNotation·descriptionHints가 맞으면 "뚜렷하게" 맞은 것입니다.
//   partial은 patterns.json의 notASignal에 적힌 "단어만 비슷한 경우"로, 일부만 맞은 것입니다.
// confidence(0~1)는 경보가 패턴과 얼마나 뚜렷하게 맞는지입니다. 0.85 이상 block, 0.5 이상 alert, 그 아래 record.
// 막는 것은 같은 주소에서 반복되는 명확한 주입 시도뿐입니다. 한 번뿐인 주입 표기는 alert로 남깁니다.

const PATTERNS = [
  {
    name: 'sql_injection',
    knownForms: [
      /'\s*(or|and)\s+[\w']+\s*=\s*[\w']+/i,
      /\bunion\s+(all\s+)?select\b/i,
      /;\s*(drop|delete|insert|update|select)\b/i,
      /'\s*;?\s*(--|#|\/\*)/i,
    ],
    fixtureNotation: [/\bdoc-sql-[a-z-]+/i, /\bdoc-mixed-marker\b/i],
    descriptionHints: ['SQL 구문', 'SQL 표식', 'SQL 구문 표기', '데이터베이스 조회를 이어 붙이는'],
    partial: [/\b(sql|select|union)\b/i, /'/, /따옴표|SQL/],
    evidence: 'T1190 · CWE-89',
  },
  {
    name: 'script_injection',
    knownForms: [
      /<\s*\/?\s*script\b/i,
      /\bjavascript\s*:/i,
      /<[^>]+\son(error|load|mouseover|focus)\s*=/i,
    ],
    fixtureNotation: [/\bdoc-script-marker\b/i, /\bdoc-mixed-marker\b/i],
    descriptionHints: ['스크립트 삽입 표기', '스크립트 표식'],
    partial: [/\bscript\b/i, /스크립트/],
    evidence: 'T1190 · CWE-79',
  },
  {
    name: 'path_traversal_repeat',
    knownForms: [
      /(\.\.[/\\]){2,}/,
      /((%2e|\.){2}(%2f|%5c|\/|\\)){2,}/i,
    ],
    fixtureNotation: [/\bdoc-up-repeat\b/i],
    descriptionHints: ['거슬러 올라가는 표기', '경로 이탈 표기'],
    partial: [/\.\.[/\\]/, /\bup\b/i],
    evidence: 'T1190 · CWE-22',
  },
];

// 패턴 이름이 없을 때도 T1190 경보가 "주입처럼 보인다"고 적은 경우를 일부 신호로 봅니다.
const INJECTION_LIKE = /주입처럼|이상한 검색|구분 문자|명령 구분자|공격 표기/;
const REPEAT_FOR_BLOCK = 5;   // 같은 주소에서 이 횟수 이상 반복되어야 block 후보입니다.
const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;

const round = (value) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;

function decodeArgs(url) {
  const text = typeof url === 'string' ? url.replace(/\+/g, ' ') : '';
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
  return {
    args: decodeArgs(data.url),
    description: typeof rule.description === 'string' ? rule.description : '',
    level,
    repeat: Number.isFinite(count) ? count : 0,
    t1190: Array.isArray(rule.mitre) && rule.mitre.map(String).includes('T1190'),
  };
}

export function decide(alert) {
  const f = facts(alert);
  const strong = [];
  const partial = [];
  for (const pattern of PATTERNS) {
    const clear = pattern.knownForms.some((form) => form.test(f.args))
      || pattern.fixtureNotation.some((form) => form.test(f.args))
      || pattern.descriptionHints.some((hint) => f.description.includes(hint));
    if (clear) strong.push(pattern.name);
    else if (pattern.partial.some((form) => form.test(f.args) || form.test(f.description))) partial.push(pattern.name);
  }
  const repeated = f.repeat >= REPEAT_FOR_BLOCK;

  // 1) 패턴과 뚜렷하게 맞음: 반복·높은 수준이면 block, 한 번뿐이면 alert에 머뭅니다.
  if (strong.length) {
    const confidence = round(0.7
      + (repeated ? 0.12 : 0)
      + (f.level >= 10 ? 0.06 : f.level >= 7 ? 0.03 : 0)
      + (f.t1190 ? 0.02 : 0)
      + 0.02 * (strong.length - 1));
    const action = confidence >= BLOCK_AT ? 'block' : 'alert';
    return {
      action,
      confidence,
      reason: `${action === 'block' ? '명확한 주입' : '주입 표기(반복 없음)'} · 패턴: ${strong.join(', ')} · 반복 ${f.repeat}회`,
    };
  }

  // 2) T1190 경보이지만 패턴과 일부만 맞거나 맞는 패턴이 없음: alert(0.5 이상, block까지는 가지 않음).
  if (f.t1190 && f.level >= 5) {
    const confidence = round(Math.min(0.8, 0.5
      + 0.04 * partial.length
      + (INJECTION_LIKE.test(f.description) ? 0.04 : 0)
      + (f.level >= 7 ? 0.03 : 0)
      + (repeated && f.level >= 10 ? 0.1 : 0)));
    const basis = partial.length ? `패턴 일부: ${partial.join(', ')}` : '근거 패턴 없음(T1190 경보만)';
    return { action: 'alert', confidence, reason: `애매한 시도 · ${basis} · 반복 ${f.repeat}회` };
  }

  // 3) 패턴과 맞지 않는 정상 이벤트.
  const confidence = round(0.05 * partial.length);
  return { action: 'record', confidence, reason: `정상 이벤트 · 맞는 패턴 없음${partial.length ? `(단어만 비슷: ${partial.join(', ')})` : ''}` };
}
