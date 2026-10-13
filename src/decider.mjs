// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 규칙에 맞지 않는 요청은 시작 틀처럼 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered', 'step_up_required']);

const respond = (request, decision, reasonCode, ruleId) => ({
  schema: 'aleph.decision.v1',
  requestId: request.requestId,
  decision,
  reasonCode,
  ruleIds: [ruleId],
});

// 7단계 입력 검사: 엔진이 넘긴 signals·recentEvents·stepUp만 읽고 출처를 구분합니다.
// - source 'judge_fixture': 엔진이 심판의 가상 사건으로 검증해 넘긴 값. 실제 위치 증거는 아닙니다.
// - source 'none': 현재 실제 경로. 지역·시각·네트워크 정보가 없습니다.
// - 그 밖의 출처나 형식이 틀린 signals: 'untrusted'. 값이 있어도 쓰지 않습니다.
// 없거나 믿을 수 없는 값은 null(모름)로 두고 'local'·'usual' 같은 정상값으로 채우지 않습니다.
// 브라우저 헤더나 계약에 없는 request.geo·request.headers 등은 읽지 않습니다.
const SIGNAL_KEYS = 'hour,network,region,source';
const EVENT_KEYS = 'ageSeconds,count,kind';
const LABEL = /^[a-z][a-z0-9_-]{0,31}$/u;
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const label = value => (typeof value === 'string' && LABEL.test(value) && value !== 'unknown' ? value : null);

export function readAccessContext(request) {
  const signals = request?.signals;
  const shaped = plainObject(signals) && Object.keys(signals).sort().join(',') === SIGNAL_KEYS;
  const source = !shaped ? 'untrusted'
    : signals.source === 'judge_fixture' ? 'judge_fixture'
      : signals.source === 'none' ? 'none' : 'untrusted';
  const fixture = source === 'judge_fixture';
  const hour = fixture && Number.isInteger(signals.hour) && signals.hour >= 0 && signals.hour <= 23
    ? signals.hour : null;

  // 행동: 엔진이 준 최근 사건. 배열·12건·항목 모양이 하나라도 틀리면 전체를 모름(null)으로 둡니다.
  const raw = request?.recentEvents;
  const events = Array.isArray(raw) && raw.length <= 12 && raw.every(item => plainObject(item)
    && Object.keys(item).sort().join(',') === EVENT_KEYS && LABEL.test(item.kind ?? '')
    && Number.isFinite(item.ageSeconds) && item.ageSeconds >= 0
    && Number.isInteger(item.count) && item.count >= 0)
    ? raw.map(({ kind, ageSeconds, count }) => Object.freeze({ kind, ageSeconds, count })) : null;

  // 재로그인: verified가 정확히 true이고 나이가 계약 범위(0~900초)일 때만 확인된 것으로 봅니다.
  const stepUp = request?.stepUp;
  const stepUpVerified = plainObject(stepUp) && stepUp.verified === true
    && Number.isInteger(stepUp.authAgeSeconds) && stepUp.authAgeSeconds >= 0
    && stepUp.authAgeSeconds <= 900;

  return Object.freeze({
    source,
    region: fixture ? label(signals.region) : null,
    network: fixture ? label(signals.network) : null,
    hour,
    events: events && Object.freeze(events),
    stepUpVerified,
    authAgeSeconds: stepUpVerified ? stepUp.authAgeSeconds : null,
  });
}

// 평소와 다른 시각: 00~05시. 처음 보는 네트워크: 출처가 확인된 값이 'usual'이 아님.
// 갑자기 많은 사건: 최근 10분 안 사건 수 합계 10건 이상. 모르는 값(null)은 조건을 채우지 않습니다.
const UNUSUAL_HOURS = Object.freeze([0, 1, 2, 3, 4, 5]);
const BURST_WINDOW_SECONDS = 600;
const BURST_MIN_COUNT = 10;

function unusualAccessBurst({ source, hour, network, events }) {
  if (source !== 'judge_fixture' || hour === null || network === null || events === null) return false;
  const recent = events.filter(item => item.ageSeconds <= BURST_WINDOW_SECONDS)
    .reduce((sum, item) => sum + item.count, 0);
  return UNUSUAL_HOURS.includes(hour) && network !== 'usual' && recent >= BURST_MIN_COUNT;
}

export async function decide(request) {
  // 6단계 device_registered: 엔진이 전달한 deviceRegistered가 정확히 true일 때만 통과합니다.
  // false, 값 없음, 문자열 'true' 같은 다른 값은 모두 미등록으로 거부합니다.
  if (request.deviceRegistered !== true) {
    return respond(request, 'deny', 'device_not_registered', 'device_registered');
  }
  // 7단계 step_up_required: 평소와 다른 시각 + 처음 보는 네트워크 + 갑자기 많은 사건이 함께 있을 때만
  // 차단 대신 추가 확인(다시 로그인)을 요구합니다. 지역은 조건에 넣지 않아 지역 하나로는 막지 않습니다.
  // 사유는 reasonCode step_up_required와 ruleIds로 남고, 재로그인이 확인되면 아래 기존 규칙으로 갑니다.
  const context = readAccessContext(request);
  if (unusualAccessBurst(context) && !context.stepUpVerified) {
    return respond(request, 'step_up', 'step_up_required', 'step_up_required');
  }
  // 등록 기기의 내 자료실 읽기(GET)만 허용합니다.
  if (request.method === 'GET') {
    return respond(request, 'allow', 'approved', 'device_registered');
  }
  return respond(request, 'deny', 'starter_not_ready', 'starter.deny');
}
