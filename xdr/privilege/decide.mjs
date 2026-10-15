// 보너스 privilege: Wazuh 계정·그룹 변경과 관리자 권한 사용 경보 하나를 block·alert·record로 판단합니다.
// 이 파일 하나로 동작합니다. 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않으며,
// 네트워크·환경변수에 묻지 않고 경보만 보고 바로 계산합니다(인터넷 없는 격리 실행용).
//
// 아래 상수는 xdr/privilege/patterns.json(근거: MITRE ATT&CK T1068 · T1078)을 옮겨 적은 것입니다.
// patterns.json을 고치면 이 상수도 함께 고칩니다.
//   descriptionHints·관리자 그룹(adminGroups)·업무 시간 밖 시각이 맞으면 "뚜렷하게" 맞은 것입니다.
//   업무 시간 밖 시각은 T1068·T1078 권한 사용 경보일 때만 신호로 봅니다(로그인·로그아웃만으로는 아님).
//   partial은 patterns.json의 notASignal에 적힌 "애매한 시도"로, 권한 관련 일이 있었지만 일부만 맞은 것입니다.
//   baseline(평소 목록)에 맞으면 확신도를 낮출 뿐, 그것만으로 통과시키지는 않습니다.
// confidence(0~1)는 경보가 패턴과 얼마나 뚜렷하게 맞는지입니다. 0.85 이상 block, 0.5 이상 alert, 그 아래 record.

const ADMIN_GROUPS = [/^administrators$/i, /^domain admins$/i, /^enterprise admins$/i, /^schema admins$/i,
  /^backup operators$/i, /^remote management users$/i];
const BUSINESS_HOURS = { startHour: 8, endHour: 18, offsetMinutes: 9 * 60 };   // 08~18시 KST
const BASELINE = {
  accounts: ['admin01', 'svc-lab'],
  descriptionHints: ['평소 주소', '평소 예약 작업', '수업용 관리 계정'],
};

const PATTERNS = [
  {
    name: 'admin_group_added',
    mitre: ['T1078'],
    descriptionHints: ['관리자 그룹에 추가됐습니다', '관리자 그룹에 들어가고', '관리자 그룹 추가', '다시 관리자로 들어왔습니다'],
    adminGroup: true,
    offHours: false,
    partial: [/그룹/],
    evidence: 'T1078 · T1098.007',
  },
  {
    name: 'unfamiliar_admin_command',
    mitre: ['T1068'],
    descriptionHints: ['방금 관리자가 된', '처음 보는 주소에서 관리자 명령', '세션이 관리자 권한으로 바뀌었고',
      '다른 계정의 권한으로 관리자 명령', '곧바로 권한 명령을 실행'],
    adminGroup: false,
    offHours: false,
    partial: [/관리자 명령/, /권한 상승/],
    evidence: 'T1068',
  },
  {
    name: 'off_hours_privilege_use',
    mitre: ['T1078', 'T1068'],
    descriptionHints: ['수업 시간 밖에', '업무처럼 보이지 않는 시각'],
    adminGroup: false,
    offHours: true,
    partial: [],
    evidence: 'T1078',
  },
];

// 설명이 "관리자 그룹은 아닙니다"처럼 부정하면 설명 단서로 쓰지 않습니다(patterns.json negationHints).
const NEGATION_HINTS = ['관리자 그룹은 아닙니다', '변경은 없습니다', '이어서 명령은 없습니다', '취소됐습니다',
  '읽기만 했습니다', '설명만 바뀌었습니다'];
const REPEAT_BONUS_AT = 2;   // 같은 주소에서 이 횟수 이상(여러 계정 추가·재추가)이면 확신도를 조금 더합니다.
const ALERT_MIN_LEVEL = 5;   // 패턴이 뚜렷하지 않으면 이 수준 이상인 T1068·T1078 경보만 애매한 시도로 봅니다.
const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;

const round = (value) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;

// 경보 시각을 KST 시로 바꿔 업무 시간 밖인지 봅니다. 시각을 읽을 수 없으면 모름(false)으로 둡니다.
function outsideBusinessHours(timestamp) {
  const ms = typeof timestamp === 'string' ? Date.parse(timestamp) : Number.NaN;
  if (!Number.isFinite(ms)) return false;
  const hour = new Date(ms + BUSINESS_HOURS.offsetMinutes * 60_000).getUTCHours();
  return hour < BUSINESS_HOURS.startHour || hour >= BUSINESS_HOURS.endHour;
}

function facts(alert) {
  const rule = alert && typeof alert === 'object' && alert.rule ? alert.rule : {};
  const data = alert && typeof alert === 'object' && alert.data ? alert.data : {};
  const level = Number.isFinite(Number(rule.level)) ? Number(rule.level) : 0;
  const count = Number.parseInt(data.count, 10);
  const description = typeof rule.description === 'string' ? rule.description : '';
  const group = typeof data.group === 'string' ? data.group.trim() : '';
  const account = typeof data.srcuser === 'string' ? data.srcuser : '';
  return {
    description,
    negated: NEGATION_HINTS.some((hint) => description.includes(hint)),
    adminGroup: ADMIN_GROUPS.some((re) => re.test(group)),
    offHours: outsideBusinessHours(alert?.timestamp),
    baseline: BASELINE.accounts.includes(account) || BASELINE.descriptionHints.some((hint) => description.includes(hint)),
    level,
    repeat: Number.isFinite(count) ? count : 0,
    mitre: Array.isArray(rule.mitre) ? rule.mitre.map(String) : [],
  };
}

export function decide(alert) {
  const f = facts(alert);
  const tagged = PATTERNS.some((pattern) => pattern.mitre.some((id) => f.mitre.includes(id)));
  const strong = [];
  const partial = [];
  for (const pattern of PATTERNS) {
    const hint = !f.negated && pattern.descriptionHints.some((text) => f.description.includes(text));
    const group = pattern.adminGroup && f.adminGroup && !f.negated;
    const offHours = pattern.offHours && f.offHours && tagged;
    if (hint || group || offHours) strong.push(pattern.name);
    else if (pattern.partial.some((re) => re.test(f.description))) partial.push(pattern.name);
  }
  const repeated = f.repeat >= REPEAT_BONUS_AT;

  // 1) 패턴과 뚜렷하게 맞음: 평범한 계정의 관리자 그룹 추가·처음 보는 관리자 명령·시간 밖 권한 사용은 명확한 권한 가로채기입니다.
  if (strong.length) {
    const confidence = round(0.8
      + (f.level >= 10 ? 0.06 : f.level >= 7 ? 0.03 : 0)
      + (repeated ? 0.04 : 0)
      + 0.03 * (strong.length - 1)
      + (tagged ? 0.02 : 0)
      - (f.baseline ? 0.1 : 0));
    const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
    return {
      action,
      confidence,
      reason: `${action === 'block' ? '명확한 권한 가로채기' : '권한 상승 의심'} · 패턴: ${strong.join(', ')} · 반복 ${f.repeat}회`,
    };
  }

  // 2) T1068·T1078 경보이지만 패턴과 일부만 맞음: 알림으로 남깁니다(block까지는 가지 않음).
  if (tagged && f.level >= ALERT_MIN_LEVEL) {
    const confidence = round(Math.min(0.8, 0.5
      + 0.03 * partial.length
      + (f.level >= 7 ? 0.03 : 0)));
    const basis = partial.length ? `패턴 일부: ${partial.join(', ')}` : '근거 패턴 없음(T1068·T1078 경보만)';
    return { action: 'alert', confidence, reason: `애매한 시도 · ${basis}${f.baseline ? ' · 평소 목록' : ''}` };
  }

  // 3) 패턴과 맞지 않는 정상 이벤트(로그인·로그아웃, 그룹 소속 읽기, 평소 관리 계정 등).
  const confidence = round(0.05 * partial.length);
  return {
    action: 'record',
    confidence,
    reason: `정상 이벤트 · 맞는 패턴 없음${f.baseline ? ' · 평소 목록' : ''}${partial.length ? `(종류만 비슷: ${partial.join(', ')})` : ''}`,
  };
}
