// 보너스 exfiltration: Wazuh 외부 전송 경보 하나를 block·alert·record로 판단합니다.
// 이 파일 하나로 동작합니다. 다른 파일·패키지를 불러오지 않고, 파일을 읽거나 쓰지 않으며,
// 네트워크·환경변수에 묻지 않고 경보만 보고 바로 계산합니다(인터넷 없는 격리 실행용).
//
// 아래 상수는 xdr/exfiltration/patterns.json(근거: MITRE ATT&CK T1041 · T1048)을 옮겨 적은 것입니다.
// patterns.json을 고치면 이 상수도 함께 고칩니다.
//   "뚜렷하게" 맞으려면 목적지가 평소 목적지가 아니고(처음 보는 목적지) 실제 전송이 있어야 합니다.
//   크기·횟수 기준은 경보 값(data.bytes·files·count)으로, 시간 밖은 경보 시각(KST)이나 설명으로 봅니다.
//   설명 단서(descriptionHints)만 맞고 크기 기준을 넘지 않으면 일부만 맞은 것(partial)으로 봅니다.
//   평소 목적지(자료실·수업 자료 주소)로 가는 전송은 처음 보는 목적지로 세지 않습니다.
// confidence(0~1)는 경보가 패턴과 얼마나 뚜렷하게 맞는지입니다. 0.85 이상 block, 0.5 이상 alert, 그 아래 record.

const THRESHOLDS = { largeBytes: 50_000_000, bulkFiles: 100, repeatCount: 5 };
const BUSINESS_HOURS = { startHour: 8, endHour: 18, offsetMinutes: 9 * 60 };   // 08~18시 KST
const BASELINE = {
  destinations: ['192.0.2.10', '198.51.100.10'],
  descriptionHints: ['평소 목적지', '수업 자료 주소', '목적지는 자료실'],
};
const ARCHIVE = /압축|묶음/;

const PATTERNS = [
  {
    name: 'large_transfer_new_destination',
    mitre: ['T1048', 'T1041'],
    descriptionHints: ['처음 보는 목적지로', '처음 보는 주소로 나갔습니다', '처음 보는 주소에 올라갔습니다',
      '외부 주소로 복사됐습니다', '평소에 쓰지 않던 포트로'],
    // 처음 보는 목적지 + 전송량 50MB 이상 또는 파일 100건 이상
    matches: (f) => f.newDestination && (f.bytes >= THRESHOLDS.largeBytes || f.files >= THRESHOLDS.bulkFiles),
    partial: [/처음 보는|다른 주소|평소와 다른/],
    evidence: 'T1048',
  },
  {
    name: 'c2_channel_repeat_transfer',
    mitre: ['T1041'],
    descriptionHints: ['명령 통로로 큰 파일', '같은 목적지로 대용량 전송이'],
    // T1041 + 처음 보는 목적지 + 반복 5번 이상 + 전송량 50MB 이상
    matches: (f) => f.mitre.includes('T1041') && f.newDestination && f.repeat >= THRESHOLDS.repeatCount
      && f.bytes >= THRESHOLDS.largeBytes,
    partial: [/명령 통로/],
    evidence: 'T1041',
  },
  {
    name: 'off_hours_archive_exfil',
    mitre: ['T1048', 'T1041'],
    descriptionHints: ['수업 시간 밖에 압축 파일', '업무 시간 밖에 같은 목적지로 전송', '압축 파일 3개가 연속으로',
      '목적지 두 곳으로 같은 압축 파일'],
    // 처음 보는 목적지로 실제 전송 + (설명 단서, 또는 업무 시간 밖 시각의 압축·묶음 전송)
    matches: (f) => f.newDestination && f.bytes > 0
      && (f.hint('off_hours_archive_exfil') || (f.offHours && ARCHIVE.test(f.description))),
    partial: [/압축|백업/],
    evidence: 'T1048',
  },
];

// 설명이 "외부 전송은 아직 없습니다"처럼 부정하면 설명 단서로 쓰지 않습니다(patterns.json negationHints).
const NEGATION_HINTS = ['외부 전송은 아직 없습니다', '큰 파일은 아닙니다', '실패 1건으로 끝났습니다', '파일 전송은 없습니다'];
const ALERT_MIN_LEVEL = 5;   // 패턴이 뚜렷하지 않으면 이 수준 이상인 T1041·T1048 경보만 애매한 시도로 봅니다.
const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;

const round = (value) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
const toCount = (value) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

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
  const description = typeof rule.description === 'string' ? rule.description : '';
  const destination = typeof data.dstip === 'string' ? data.dstip.trim() : '';
  const negated = NEGATION_HINTS.some((hint) => description.includes(hint));
  const baselineDestination = BASELINE.destinations.includes(destination);
  return {
    description,
    negated,
    newDestination: Boolean(destination) && !baselineDestination,
    baseline: baselineDestination || BASELINE.descriptionHints.some((hint) => description.includes(hint)),
    offHours: outsideBusinessHours(alert?.timestamp),
    bytes: toCount(data.bytes),
    files: toCount(data.files),
    repeat: toCount(data.count),
    level,
    mitre: Array.isArray(rule.mitre) ? rule.mitre.map(String) : [],
    hint: (name) => !negated && PATTERNS.find((pattern) => pattern.name === name)
      .descriptionHints.some((text) => description.includes(text)),
  };
}

export function decide(alert) {
  const f = facts(alert);
  const tagged = PATTERNS.some((pattern) => pattern.mitre.some((id) => f.mitre.includes(id)));
  const strong = [];
  const partial = [];
  for (const pattern of PATTERNS) {
    if (tagged && pattern.matches(f)) strong.push(pattern.name);
    else if (f.hint(pattern.name) || pattern.partial.some((re) => re.test(f.description))) partial.push(pattern.name);
  }
  const mb = f.bytes >= 10_000_000 ? Math.round(f.bytes / 1_000_000) : Math.round(f.bytes / 100_000) / 10;

  // 1) 처음 보는 목적지로 크게·반복해서·시간 밖에 나간 전송: 명확한 자료 빼돌리기입니다.
  if (strong.length) {
    const confidence = round(0.8
      + (f.level >= 10 ? 0.06 : f.level >= 7 ? 0.03 : 0)
      + 0.03 * (strong.length - 1)
      + (f.repeat >= THRESHOLDS.repeatCount ? 0.02 : 0)
      + (tagged ? 0.02 : 0)
      - (f.baseline ? 0.1 : 0));
    const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
    return {
      action,
      confidence,
      reason: `${action === 'block' ? '명확한 자료 유출' : '자료 유출 의심'} · 패턴: ${strong.join(', ')} · ${mb}MB · 파일 ${f.files}건 · 반복 ${f.repeat}회`,
    };
  }

  // 2) T1041·T1048 경보이지만 크기·목적지·시간 중 일부만 맞음: 알림으로 남깁니다(block까지는 가지 않음).
  if (tagged && f.level >= ALERT_MIN_LEVEL) {
    const confidence = round(Math.min(0.8, 0.5
      + 0.03 * partial.length
      + (f.newDestination ? 0.03 : 0)
      + (f.level >= 7 ? 0.03 : 0)));
    const basis = partial.length ? `패턴 일부: ${partial.join(', ')}` : '근거 패턴 없음(T1041·T1048 경보만)';
    return { action: 'alert', confidence, reason: `애매한 시도 · ${basis} · ${mb}MB${f.baseline ? ' · 평소 목적지' : ''}` };
  }

  // 3) 패턴과 맞지 않는 정상 이벤트(자료실 읽기·저장, 수업 자료 동기화, 로그아웃 등).
  const confidence = round(0.05 * partial.length);
  return {
    action: 'record',
    confidence,
    reason: `정상 이벤트 · 맞는 패턴 없음${f.baseline ? ' · 평소 목적지' : ''}${partial.length ? `(종류만 비슷: ${partial.join(', ')})` : ''}`,
  };
}
