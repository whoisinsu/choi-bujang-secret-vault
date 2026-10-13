// 9단계에서 학생이 채우는 탐지 함수입니다. 이 기본값은 어떤 접속도 회수하지 않습니다.
// 반 엔진이 검증한 사건만 전달해야 하며, 브라우저가 보낸 사용자 번호는 받지 않습니다.

// 9단계 입력 처리: 가상 사건에서 가명 사용자·기기·요청 종류·판정·시각만 골라 읽습니다.
// - 사용자: identity.sub(엔진이 준 가명). 이메일처럼 보이거나 형식이 틀리면 그 사건은 버립니다.
// - 요청 종류: method. 시각: at(UTC ISO). 둘 중 하나라도 틀리면 그 사건은 버립니다.
// - 기기(deviceId)·판정(decision)은 현재 사건 계약(docs/DETECT_EVENTS.md)에 없습니다.
//   형식이 맞는 값이 있을 때만 읽고, 없으면 null(모름)로 둡니다. 지어낸 값으로 채우지 않습니다.
// 메모 본문·토큰·실명 등 그 밖의 값은 복사하지 않고, 저장하거나 출력하지 않습니다.
const SUBJECT = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
const DEVICE_ID = /^[0-9a-f]{16}$/u;
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const DECISIONS = new Set(['allow', 'deny', 'step_up']);

function readEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const subject = event.identity?.sub;
  const at = typeof event.at === 'string' ? Date.parse(event.at) : Number.NaN;
  if (typeof subject !== 'string' || !SUBJECT.test(subject) || !METHODS.has(event.method)
      || !Number.isFinite(at)) {
    return null;
  }
  return Object.freeze({
    at,
    method: event.method,
    subject,
    deviceId: typeof event.deviceId === 'string' && DEVICE_ID.test(event.deviceId) ? event.deviceId : null,
    decision: DECISIONS.has(event.decision) ? event.decision : null,
  });
}

// 읽을 수 있는 사건만 시각 순서로 돌려줍니다. 버린 사건은 개수만 셉니다(내용은 남기지 않음).
export function readDetectionEvents(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  const read = [];
  let dropped = 0;
  for (const event of events) {
    const item = readEvent(event);
    if (item) read.push(item);
    else dropped += 1;
  }
  read.sort((a, b) => a.at - b.at);
  return Object.freeze({ events: Object.freeze(read), dropped });
}

// 9단계 탐지 규칙 burst_read(docs/DETECT_EVENTS.md): 같은 가명 사용자의 GET이 어느 10분 구간에서든
// 120건을 넘을 때만 회수를 제안합니다. 정확히 120건, 다른 사용자끼리 합친 수, 10분 밖으로 흩어진 사건은
// 정상으로 두고 observe입니다. 지역·네트워크는 사건 계약에 없어 쓰지 않으므로 지역 하나로 확정하지 않습니다.
// 이 함수는 회수를 "제안"만 합니다. 실제 회수는 운영 반 엔진이 집행하며 이 저장소에는 연결돼 있지 않습니다.
const BURST_WINDOW_MS = 10 * 60 * 1000;
const BURST_LIMIT = 120;

// 같은 사용자의 GET 사건을 시각 순으로 모읍니다(입력 처리에서 이미 정렬됨).
function burstWindow(readEvents) {
  const bySubject = new Map();
  for (const item of readEvents) {
    if (item.method !== 'GET') continue;
    const list = bySubject.get(item.subject) ?? [];
    list.push(item);
    bySubject.set(item.subject, list);
  }
  let found = null;
  for (const [subject, list] of bySubject) {
    // [시작, 시작 + 10분) 안의 개수를 미끄러지는 창으로 셉니다. 처음 120건을 넘는 창을 돌려줍니다.
    let start = 0;
    for (let end = 0; end < list.length; end += 1) {
      while (list[end].at - list[start].at >= BURST_WINDOW_MS) start += 1;
      if (end - start + 1 > BURST_LIMIT) {
        if (!found || list[end].at < found.at) found = { subject, at: list[end].at, events: list.slice(start, end + 1) };
        break;
      }
    }
  }
  return found;
}

export function detect(events) {
  const { events: readEvents } = readDetectionEvents(events);
  const found = burstWindow(readEvents);
  if (!found) return { action: 'observe' };
  return { action: 'propose_revocation', reasonCode: 'burst_read', subject: found.subject };
}

// 9단계 회수 제안(별도 결과): detect()가 탐지한 10분 구간의 사건이 확인된 가상 기기 하나에서만 왔을 때
// 그 기기 하나를 대상으로 제안합니다. 기기 값이 없거나 둘 이상이면 대상을 하나로 확정할 수 없어 null입니다.
// 판정기의 허용·거부 응답 형식과 detect()의 계약 결과는 바꾸지 않습니다. 회수 API를 만들거나 기기 권한을
// 바꾸지 않으며, 실제 회수와 걸린 시간은 운영 엔진·심판이 확인합니다.
export function proposeRevocation(events) {
  const { events: readEvents } = readDetectionEvents(events);
  const found = burstWindow(readEvents);
  if (!found) return null;
  const devices = new Set(found.events.map(item => item.deviceId));
  if (devices.size !== 1 || devices.has(null)) return null;
  const [deviceId] = devices;
  return Object.freeze({ action: 'propose_revocation', reasonCode: 'burst_read', subject: found.subject, deviceId });
}
