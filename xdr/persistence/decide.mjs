// 보너스 persistence: Wazuh 파일 무결성·서비스·예약 작업 경보 하나를 block·alert·record로 판단합니다.
// 이 파일 하나로 동작합니다. 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않으며,
// 네트워크·환경변수에 묻지 않고 경보만 보고 바로 계산합니다(인터넷 없는 격리 실행용).
//
// 아래 상수는 xdr/persistence/patterns.json(근거: MITRE ATT&CK T1543 · T1053)을 옮겨 적은 것입니다.
// patterns.json을 고치면 이 상수도 함께 고칩니다.
//   descriptionHints·paths·randomName이 맞으면 "뚜렷하게" 맞은 것입니다(randomName은 쓰기 가능 경로일 때만).
//   partial은 patterns.json의 notASignal에 적힌 "애매한 시도"로, 같은 종류 항목이 바뀌었지만 일부만 맞은 것입니다.
//   baseline(평소 목록)에 맞으면 확신도를 낮출 뿐, 그것만으로 통과시키지는 않습니다.
// confidence(0~1)는 경보가 패턴과 얼마나 뚜렷하게 맞는지입니다. 0.85 이상 block, 0.5 이상 alert, 그 아래 record.
// 실행 파일 경로(data.path)에는 사용자 폴더 이름이 섞여 있어 reason에 옮겨 적지 않습니다.

const USER_WRITABLE_PATHS = [/\\AppData\\Local\\Temp\\/i, /\\AppData\\Roaming\\/i, /\\Windows\\Temp\\/i];
const BASELINE = {
  paths: [/^C:\\lab\\/i],
  descriptionHints: ['기존', '평소 시각에 그대로', '평소 저장소', '서명된 채로'],
};

const PATTERNS = [
  {
    name: 'unsigned_new_service',
    mitre: ['T1543'],
    descriptionHints: ['서명 없는 새 서비스', '서명 없는 서비스 등록', '서비스 실행 파일이 바뀌었고 서명이 없습니다',
      '평소 목록에 없는 서비스가 다시 켜도 남도록'],
    paths: [],
    randomName: null,
    partial: [/서비스/, /실행 파일이 하나 생겼습니다/],
    evidence: 'T1543.003',
  },
  {
    name: 'unfamiliar_scheduled_task',
    mitre: ['T1053'],
    descriptionHints: ['처음 보는 예약 작업', '예약 작업 이름이 임의 문자열', '수업 시간 밖에 실행', '예약 작업이 같은 임시 파일'],
    paths: [],
    randomName: /\\(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{5,12}\.(exe|dll|cmd|bat|ps1)$/i,
    partial: [/예약 작업/],
    evidence: 'T1053.005',
  },
  {
    name: 'startup_folder_change',
    mitre: ['T1543'],
    descriptionHints: ['시작 폴더에 평소 목록에 없는 프로그램', '시작 프로그램과 예약 작업이 같은 임시 파일'],
    paths: [/\\Start Menu\\Programs\\Startup\\/i],
    randomName: null,
    partial: [/시작 (폴더|항목|프로그램)/],
    evidence: 'T1543 · T1547.001',
  },
];

// 설명이 "서비스 등록은 없습니다"처럼 부정하면 설명 단서로 쓰지 않습니다(patterns.json negationHints).
const NEGATION_HINTS = ['서비스 등록은 없습니다', '실행 파일은 그대로입니다', '이어서 실행된 기록은 없습니다',
  '같은 파일로 다시 시작', '읽기만 했습니다'];
// 서명을 아직 확인하지 못한 경우는 애매한 시도의 일부 신호입니다.
const UNSIGNED_UNKNOWN = /서명은 (확인되지 않았습니다|아직 모릅니다)/;
const REPEAT_BONUS_AT = 2;   // 같은 출발 주소에서 이 횟수 이상 연속이면 확신도를 조금 더합니다.
const ALERT_MIN_LEVEL = 5;   // 패턴이 뚜렷하지 않으면 이 수준 이상인 T1543·T1053 경보만 애매한 시도로 봅니다.
const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;

const round = (value) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;

function facts(alert) {
  const rule = alert && typeof alert === 'object' && alert.rule ? alert.rule : {};
  const data = alert && typeof alert === 'object' && alert.data ? alert.data : {};
  const level = Number.isFinite(Number(rule.level)) ? Number(rule.level) : 0;
  const count = Number.parseInt(data.count, 10);
  const description = typeof rule.description === 'string' ? rule.description : '';
  const path = typeof data.path === 'string' ? data.path : '';
  return {
    description,
    path,
    negated: NEGATION_HINTS.some((hint) => description.includes(hint)),
    userWritable: USER_WRITABLE_PATHS.some((re) => re.test(path)),
    baseline: BASELINE.paths.some((re) => re.test(path)) || BASELINE.descriptionHints.some((hint) => description.includes(hint)),
    level,
    repeat: Number.isFinite(count) ? count : 0,
    mitre: Array.isArray(rule.mitre) ? rule.mitre.map(String) : [],
  };
}

export function decide(alert) {
  const f = facts(alert);
  const strong = [];
  const partial = [];
  for (const pattern of PATTERNS) {
    const hint = !f.negated && pattern.descriptionHints.some((text) => f.description.includes(text));
    const path = pattern.paths.some((re) => re.test(f.path));
    const randomName = Boolean(pattern.randomName && f.userWritable && pattern.randomName.test(f.path));
    if (hint || path || randomName) strong.push(pattern.name);
    else if (pattern.partial.some((re) => re.test(f.description))) partial.push(pattern.name);
  }
  const tagged = PATTERNS.some((pattern) => pattern.mitre.some((id) => f.mitre.includes(id)));
  const repeated = f.repeat >= REPEAT_BONUS_AT;

  // 1) 패턴과 뚜렷하게 맞음: 서명 없는 서비스·낯선 예약 작업·시작 폴더 추가는 한 번이어도 명확한 지속성 심기입니다.
  if (strong.length) {
    const confidence = round(0.8
      + (f.level >= 10 ? 0.06 : f.level >= 7 ? 0.03 : 0)
      + (f.userWritable ? 0.03 : 0)
      + (repeated ? 0.04 : 0)
      + 0.03 * (strong.length - 1)
      + (tagged ? 0.02 : 0)
      - (f.baseline ? 0.1 : 0));
    const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
    return {
      action,
      confidence,
      reason: `${action === 'block' ? '명확한 지속성 심기' : '지속성 의심'} · 패턴: ${strong.join(', ')}${f.userWritable ? ' · 쓰기 가능 경로' : ''} · 반복 ${f.repeat}회`,
    };
  }

  // 2) T1543·T1053 경보이지만 패턴과 일부만 맞음: 평소 목록에 맞아도 알림으로 남깁니다(block까지는 가지 않음).
  if (tagged && f.level >= ALERT_MIN_LEVEL) {
    const confidence = round(Math.min(0.8, 0.5
      + 0.03 * partial.length
      + (f.userWritable ? 0.05 : 0)
      + (UNSIGNED_UNKNOWN.test(f.description) ? 0.04 : 0)
      + (f.level >= 7 ? 0.03 : 0)));
    const basis = partial.length ? `패턴 일부: ${partial.join(', ')}` : '근거 패턴 없음(T1543·T1053 경보만)';
    return { action: 'alert', confidence, reason: `애매한 시도 · ${basis}${f.baseline ? ' · 평소 목록' : ''}` };
  }

  // 3) 패턴과 맞지 않는 정상 이벤트(평소 목록의 업데이트·기존 작업, 로그인·화면 열람 등).
  const confidence = round(0.05 * partial.length);
  return {
    action: 'record',
    confidence,
    reason: `정상 이벤트 · 맞는 패턴 없음${f.baseline ? ' · 평소 목록' : ''}${partial.length ? `(종류만 비슷: ${partial.join(', ')})` : ''}`,
  };
}
