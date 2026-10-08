// 보너스 brute-force: Wazuh 로그인 실패 경보 하나를 block·alert·record로 판단합니다.
// 같은 폴더의 patterns.mjs만 불러옵니다. 내장 모듈·npm 패키지·JSON·네트워크·환경변수를 쓰지 않으므로
// 인터넷과 API 키가 없는 격리 환경에서도 같은 결과가 나오고, 경보 하나를 즉시(2초 제한 안에) 판단합니다.
//
// - block (0.85~0.97): 수준 BLOCK_MIN_LEVEL 이상의 실패 경보가 strong 패턴과 뚜렷하게 맞을 때. Jev 없이 정합니다.
// - alert (0.50~0.70): 실패 경보가 weak 패턴과 일부만 맞을 때.
// - record: 실패 패턴과 맞지 않는 정상 이벤트(로그인 성공, 로그아웃, 실패 1건 등).
//
// Jev(애매한 건의 확신도를 더 받아 보는 외부 도우미)는 이 저장소에 연결 정보(주소·요청 형식·키)가 없어
// 부르지 않습니다. 그래서 애매한 건은 언제나 묻지 않고 alert로 둡니다(키가 없을 때와 같은 동작).
import { ALERT_MIN_LEVEL, BLOCK_MIN_LEVEL, PATTERNS, features } from './patterns.mjs';

const round = (value) => Math.round(value * 100) / 100;

export function decide(alert) {
  const f = features(alert);
  const matched = PATTERNS.filter((pattern) => pattern.test(f));
  const strong = matched.filter((pattern) => pattern.kind === 'strong').map((pattern) => pattern.name);
  const weak = matched.filter((pattern) => pattern.kind === 'weak').map((pattern) => pattern.name);
  // "실패"라는 말이 없어도 비밀번호 뿌리기처럼 strong 패턴이 맞으면 로그인 공격 경보로 봅니다.
  const failureAlert = (f.hasFailure || strong.length > 0) && (f.bruteForceTechnique || f.level >= ALERT_MIN_LEVEL);

  if (failureAlert && f.level >= BLOCK_MIN_LEVEL && strong.length) {
    const confidence = round(Math.min(0.97, 0.85 + 0.04 * (strong.length - 1) + 0.01 * (f.level - BLOCK_MIN_LEVEL)));
    return { action: 'block', confidence, reason: `명확한 공격 · 패턴: ${strong.join(', ')}` };
  }

  if (failureAlert && f.level >= ALERT_MIN_LEVEL && (strong.length || weak.length)) {
    const names = [...strong, ...weak];
    const confidence = round(Math.min(0.7, 0.5 + 0.05 * (names.length - 1) + 0.01 * (f.level - ALERT_MIN_LEVEL)));
    return { action: 'alert', confidence, reason: `애매한 시도 · 패턴: ${names.join(', ')} (Jev 미연결, 묻지 않음)` };
  }

  const confidence = f.hasFailure ? 0.7 : 0.9;
  return { action: 'record', confidence, reason: `정상 이벤트 · 맞는 실패 패턴 없음${f.hasFailure ? ' (실패 1건 이하)' : ''}` };
}
