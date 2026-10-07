// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (config.step !== 1 && config.step !== 2) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  if (config.step === 2) return runStep2Checks(app);
  const response = await fetch(new URL('/data.json', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let visible = false;
  if (response.ok) {
    try {
      const data = await response.json();
      visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
        && data.notes.length > 0;
    } catch {
      // A non-JSON response is a failed check, not a successful deployment.
    }
  }
  return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
    observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
}

// 2단계: 실제로 보낸 비로그인 요청의 결과만 기록합니다. 메모 본문은 남기지 않고 건수만 셉니다.
async function anonymousNoteCount(app, path) {
  try {
    const response = await fetch(new URL(path, app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    let count = null;
    if (response.ok) {
      try {
        const data = await response.json();
        if (Array.isArray(data?.notes)) count = data.notes.length;
      } catch {
        // JSON이 아니면 메모 건수를 읽을 수 없습니다.
      }
    }
    return { status: response.status, count };
  } catch (error) {
    return { status: `요청 실패(${error.name})`, count: null };
  }
}

async function runStep2Checks(app) {
  const staticFile = await anonymousNoteCount(app, '/data.json');
  const api = await anonymousNoteCount(app, '/api/notes');
  return [
    { attackId: 'anonymous_static_note_read', expected: '비로그인으로 /data.json을 열면 404이거나 가상 메모가 없음',
      observed: staticFile.status === 404 ? '비로그인 요청 HTTP 404, 정적 자료 파일 없음'
        : `비로그인 요청 HTTP ${staticFile.status}, 메모 ${staticFile.count ?? '확인 불가'}건` },
    { attackId: 'anonymous_api_note_read', expected: '3단계 전까지 남은 약점: 비로그인 /api/notes 요청이 아직 거부되지 않음',
      observed: `비로그인 요청 HTTP ${api.status}, 메모 ${api.count ?? '확인 불가'}건` },
  ];
}
