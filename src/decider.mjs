// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 규칙에 맞지 않는 요청은 시작 틀처럼 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze([
  'starter.deny', 'device_registered', 'step_up_required', 'route_exact', 'zone_my_notes', 'zone_class_notices',
]);

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
// 브라우저 헤더나 계약(docs/DECIDER_REQUEST.md)에 없는 이름은 읽지 않습니다.
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

// 8단계 구역 규칙: 엔진이 확인한 사용자(subjectId)·기기(deviceId)·메서드·정확한 경로(route·path)만 씁니다.
// - route_exact: route가 아래 표에 있고, method가 route의 메서드와 같고, path가 route 모양과 정확히 맞아야 합니다.
//   쿼리로 기능을 고르지 않으므로 쿼리가 있으면(queryLength > 0) 거부합니다. :id 자리에는 자료 ID만 오며
//   export·admin 같은 기능 이름은 자료 ID로 받지 않습니다. 표에 없는 경로는 모두 거부합니다.
// - zone_my_notes: 자료 ID로 고른 내 메모 한 건 읽기와 수정만 허용합니다. 자료를 고르지 않는 목록(GET /notes)은
//   어느 구역의 메모가 섞일지 판정기가 알 수 없으므로 거부합니다. 메모의 소유자는 요청에 없으므로
//   "내 메모인지"는 최종 자료 API가 owner_id로 다시 확인합니다(다른 사람 메모는 404).
// - zone_class_notices: 강사 공지 수정은 거부합니다. 계약에 역할(role)이 없어 강사를 가릴 수 없으므로
//   학생 자료실 판정기에서는 누구의 공지 수정도 허용하지 않습니다.
// 추가(POST)·삭제(DELETE)는 아직 구역 규칙이 없어 이전처럼 starter.deny로 거부됩니다.
// 각 경로는 엔진이 확인한 service와 묶습니다. 내 메모 경로라도 service가 'notes'가 아니면 다른 구역으로 보고 거부합니다.
const ROUTES = Object.freeze({
  'GET /notes': { service: 'notes', ruleId: 'zone_my_notes', decision: 'deny', reasonCode: 'starter_not_ready' },
  'GET /notes/:id': { service: 'notes', ruleId: 'zone_my_notes', decision: 'allow', reasonCode: 'approved' },
  'PUT /notes/:id': { service: 'notes', ruleId: 'zone_my_notes', decision: 'allow', reasonCode: 'approved' },
  'POST /notes': { service: 'notes', ruleId: 'starter.deny', decision: 'deny', reasonCode: 'starter_not_ready' },
  'DELETE /notes/:id': { service: 'notes', ruleId: 'starter.deny', decision: 'deny', reasonCode: 'starter_not_ready' },
  'PUT /notices/:id': { service: 'notices', ruleId: 'zone_class_notices', decision: 'deny', reasonCode: 'starter_not_ready' },
});
const RECORD_ID = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const FEATURE_NAMES = new Set(['export', 'import', 'download', 'backup', 'bulk', 'all', 'admin', 'search',
  'list', 'batch', 'dump', 'raw', 'debug', 'internal', 'new', 'edit']);
const DEVICE_ID = /^[0-9a-f]{16}$/u;

// zone_my_notes의 정확한 자원 경로 표: 엔진이 확인한 주체(subjectId)와 기기(deviceId)마다 들어갈 수 있는
// 내 메모 경로를 정확히 적습니다. 경로 모양이 맞아도 이 표에 없는 주체·기기·경로 조합은 거부하므로,
// 다른 사용자의 메모나 다른 기기로 들고 온 요청은 열리지 않습니다.
// 지금은 엔진 연습 요청(scripts/fixture-7.mjs)의 주체·기기·메모만 있습니다. 실제 학생 주체의 항목은
// 운영 엔진이 주체·메모 경로를 제공하면 그 값으로 더합니다(지어낸 값을 넣지 않습니다).
const OWN_NOTE_PATHS = Object.freeze([
  Object.freeze({ subjectId: 'learner_fixture', deviceId: 'aaaaaaaaaaaaaaaa', paths: Object.freeze(['/notes/demo']) }),
]);
const ownsPath = ({ subjectId, deviceId, path }) => OWN_NOTE_PATHS.some(entry => entry.subjectId === subjectId
  && entry.deviceId === deviceId && entry.paths.includes(path));

function exactRoute(request) {
  const { route, method, path, subjectId, deviceId, queryLength } = request;
  if (typeof subjectId !== 'string' || !subjectId || typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) {
    return null;
  }
  if (typeof route !== 'string' || !Object.hasOwn(ROUTES, route) || queryLength !== 0) return null;
  const [routeMethod, routePath] = route.split(' ');
  if (method !== routeMethod || typeof path !== 'string') return null;
  const want = routePath.split('/');
  const got = path.split('/');
  if (got.length !== want.length) return null;
  const matches = want.every((part, index) => (part === ':id'
    ? RECORD_ID.test(got[index]) && !FEATURE_NAMES.has(got[index])
    : part === got[index]));
  return matches && request.service === ROUTES[route].service ? ROUTES[route] : null;
}

export async function decide(input) {
  // 요청이 객체가 아니면(null·undefined·문자열 등) 빈 요청으로 보고 거부합니다. 예외 없이 형식이 맞는 응답을 돌려줍니다.
  const request = input !== null && typeof input === 'object' ? input : {};
  // 6단계 device_registered: 엔진이 전달한 deviceRegistered가 정확히 true일 때만 통과합니다.
  // false, 값 없음, 문자열 'true' 같은 다른 값은 모두 미등록으로 거부합니다.
  if (request.deviceRegistered !== true) {
    return respond(request, 'deny', 'device_not_registered', 'device_registered');
  }
  // 8단계 route_exact: 표에 없는 경로·메서드가 다른 경로·모양이 틀린 경로·쿼리가 있는 요청은 거부합니다.
  const zoneRule = exactRoute(request);
  if (!zoneRule) return respond(request, 'deny', 'starter_not_ready', 'route_exact');
  // 거부로 정한 경로(공지 수정, 아직 규칙 없는 추가·삭제)는 다시 로그인해도 바뀌지 않으므로 바로 거부합니다.
  if (zoneRule.decision === 'deny') {
    return respond(request, 'deny', zoneRule.reasonCode, zoneRule.ruleId);
  }
  // 8단계 zone_my_notes: 주체·기기·정확한 경로가 표에 있을 때만 통과합니다. 다른 사용자의 메모 경로는
  // 다시 로그인해도 열리면 안 되므로 추가 확인보다 먼저 거부합니다.
  if (!ownsPath(request)) return respond(request, 'deny', 'starter_not_ready', zoneRule.ruleId);
  // 7단계 step_up_required: 평소와 다른 시각 + 처음 보는 네트워크 + 갑자기 많은 사건이 함께 있을 때만
  // 차단 대신 추가 확인(다시 로그인)을 요구합니다. 지역은 조건에 넣지 않아 지역 하나로는 막지 않습니다.
  // 사유는 reasonCode step_up_required와 ruleIds로 남고, 재로그인이 확인되면 아래 기존 규칙으로 갑니다.
  const context = readAccessContext(request);
  if (unusualAccessBurst(context) && !context.stepUpVerified) {
    return respond(request, 'step_up', 'step_up_required', 'step_up_required');
  }
  // 8단계 zone_my_notes: 자료 ID로 고른 내 메모 한 건 읽기와 수정만 여기까지 옵니다.
  return respond(request, 'allow', zoneRule.reasonCode, zoneRule.ruleId);
}
