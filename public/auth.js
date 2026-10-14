// 로그인·로그아웃과 메모 화면입니다.
// 5단계: 브라우저 코드에는 Supabase 주소와 키가 없습니다. 로그인·토큰 갱신·로그아웃은
// Vercel 서버 함수(/api/auth/login·refresh·logout)가 Supabase Auth에 대신 요청하고,
// 메모는 /api/notes 서버 함수로만 다룹니다. 비밀번호와 토큰은 화면·콘솔에 출력하지 않습니다.

// 11단계: 로그인 세션(access·refresh 토큰)은 이 화면의 메모리에만 둡니다. 브라우저 저장소에 쓰거나 읽지 않으므로
// 새로고침하면 다시 로그인합니다. 예전 단계가 남긴 세션은 남아 있지 않도록 한 번 지웁니다.
try {
  for (const old of ['vault-session', 'sb-skevbebxatwbmomeoqtx-auth-token']) localStorage.removeItem(old);
} catch {
  // 저장소를 쓸 수 없는 브라우저에서는 건너뜁니다.
}

const form = document.querySelector('#login-form');
const email = document.querySelector('#login-email');
const password = document.querySelector('#login-password');
const submit = document.querySelector('#login-submit');
const signedIn = document.querySelector('#signed-in');
const who = document.querySelector('#signed-in-email');
const logout = document.querySelector('#logout');
const status = document.querySelector('#auth-status');
const message = document.querySelector('#auth-message');
const list = document.querySelector('#notes');
const notesPanel = document.querySelector('#notes-panel');
const addForm = document.querySelector('#note-add');
const addTitle = document.querySelector('#note-title');
const addBody = document.querySelector('#note-body');
const addSubmit = document.querySelector('#note-submit');
const noteMessage = document.querySelector('#note-message');
const deviceState = document.querySelector('#device-state');
const deviceIdText = document.querySelector('#device-id');
const deviceActions = document.querySelector('#device-actions');
const deviceRequest = document.querySelector('#device-request');
const deviceCheck = document.querySelector('#device-check');
const deviceMessage = document.querySelector('#device-message');
const warRoom = document.querySelector('#war-room');
const warLoad = document.querySelector('#war-load');
const warBody = document.querySelector('#war-body');

// 11단계 기기 승인: 기기 키는 이 화면의 메모리에만 있습니다(개인키는 내보낼 수 없게 만들고, 어떤 브라우저
// 저장소에도 넣지 않습니다). 새로고침하면 새 키가 되므로 승인을 다시 받아야 합니다.
// 승인 여부는 서버(/api/devices)가 돌려준 기록만 따르고, 승인 요청 버튼을 눌렀다고 승인된 것으로 보지 않습니다.
const device = { keyPair: null, deviceId: null, status: 'none' };
const DEVICE_TEXT = {
  none: '승인 요청 전 — 이 기기는 아직 서버에 등록을 요청하지 않았습니다.',
  pending: '승인 대기 — 서버가 아직 이 기기를 승인하지 않았습니다. 승인 전에는 자료를 보여 주지 않습니다.',
  approved: '승인됨 — 서버가 이 기기를 등록 기기로 확인했습니다.',
  revoked: '승인 취소됨 — 서버가 이 기기의 승인을 거뒀습니다. 자료를 보여 주지 않습니다.',
};

function showDevice(text, kind) {
  deviceMessage.textContent = text;
  deviceMessage.dataset.kind = kind;
  deviceMessage.hidden = !text;
}

function renderDevice() {
  const loggedIn = Boolean(currentSession?.access_token);
  deviceActions.hidden = !loggedIn;
  deviceState.textContent = loggedIn ? DEVICE_TEXT[device.status] ?? DEVICE_TEXT.none
    : '로그인한 뒤 서버가 이 기기의 승인 여부를 확인합니다.';
  deviceState.dataset.state = device.status === 'approved' ? 'approved' : 'unverified';
  deviceIdText.textContent = device.deviceId ?? '로그인하면 이 화면에서만 쓰는 기기 키를 만듭니다';
  deviceCheck.disabled = !device.deviceId;
  notesPanel.hidden = !(loggedIn && device.status === 'approved');
  warRoom.hidden = !loggedIn;
  if (!loggedIn) warBody.replaceChildren();
}

function resetDevice() {
  device.keyPair = null;
  device.deviceId = null;
  device.status = 'none';
  showDevice('', 'info');
}

const REASONS = {
  invalid_credentials: '이메일 또는 비밀번호가 맞지 않습니다.',
  email_not_confirmed: '이메일 인증이 끝나지 않은 계정입니다.',
  user_banned: '사용이 정지된 계정입니다.',
  over_request_rate_limit: '요청이 너무 많습니다. 잠시 뒤 다시 시도하세요.',
  over_email_send_rate_limit: '요청이 너무 많습니다. 잠시 뒤 다시 시도하세요.',
  validation_failed: '이메일과 비밀번호 형식을 확인하세요.',
  SERVER_NOT_CONFIGURED: '서버의 로그인 설정이 아직 없습니다. 관리자에게 알려 주세요.',
  AUTH_UNAVAILABLE: '로그인 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도하세요.',
};

function showMessage(text, kind) {
  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = !text;
}

function failureReason(code) {
  if (!code) return '로그인 서버에 연결하지 못했습니다. 네트워크를 확인하세요.';
  return `${REASONS[code] ?? '로그인하지 못했습니다.'} (${code})`;
}


async function authCall(path, { payload, bearer } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  let response;
  try {
    response = await fetch(path, {
      method: 'POST', cache: 'no-store', headers, body: payload ? JSON.stringify(payload) : undefined,
    });
  } catch {
    return { ok: false, code: null };
  }
  if (response.status === 204) return { ok: true, data: null };
  let data = null;
  try {
    data = await response.json();
  } catch {
    // 본문이 JSON이 아니면 코드 없이 실패로 봅니다.
  }
  return response.ok ? { ok: true, data } : { ok: false, code: data?.error ?? null };
}

function showNotesMessage(text) {
  const item = document.createElement('li');
  item.textContent = text;
  list.replaceChildren(item);
}

function showNoteMessage(text, kind) {
  noteMessage.textContent = text;
  noteMessage.dataset.kind = kind;
  noteMessage.hidden = !text;
}

// 메모 API는 로그인 세션의 access token을 Authorization 헤더에 실어 부릅니다.
// 사용자 ID·역할·owner_id는 보내지 않습니다. 서버가 토큰만 검사해 판단합니다.
let currentSession = null;

// 만료가 가까우면(또는 force) 서버 함수로 세션을 갱신합니다. 실패하면 로그아웃 상태로 돌립니다.
let refreshing = null;
async function freshSession(force = false) {
  if (!currentSession) return null;
  if (!force && currentSession.expires_at - 60 > Date.now() / 1000) return currentSession;
  refreshing ??= authCall('/api/auth/refresh', { payload: { refresh_token: currentSession.refresh_token } })
    .then(({ ok, data }) => {
      currentSession = ok ? data : null;
      if (!ok) update(null);
      return currentSession;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function api(path, { method = 'GET', payload } = {}) {
  const send = async (session) => {
    const headers = { Authorization: `Bearer ${session.access_token}` };
    if (device.deviceId) headers['X-Device-Id'] = device.deviceId;
    if (payload) headers['Content-Type'] = 'application/json';
    return fetch(path, { method, cache: 'no-store', headers, body: payload ? JSON.stringify(payload) : undefined });
  };
  let session = await freshSession();
  if (!session?.access_token) throw new Error('로그인한 뒤에 할 수 있습니다.');
  let response = await send(session);
  if (response.status === 401) {
    session = await freshSession(true);
    if (session?.access_token) response = await send(session);
  }
  if (response.status === 401) throw new Error('로그인을 확인하지 못했습니다. 다시 로그인해 주세요.');
  if (response.status === 403 && (await response.clone().json().catch(() => ({}))).error === 'DEVICE_NOT_APPROVED') {
    device.status = device.deviceId ? 'pending' : 'none';
    renderDevice();
    throw new Error('서버가 이 기기를 승인하지 않아 자료를 보여 주지 않습니다.');
  }
  if (response.status === 404) throw new Error('메모를 찾을 수 없습니다. 이미 지워졌을 수 있습니다.');
  if (response.status === 400) throw new Error('제목(200자 이내)과 내용(5000자 이내)을 확인하세요.');
  if (!response.ok) throw new Error('서버에서 요청을 처리하지 못했습니다.');
  return response.status === 204 ? null : response.json();
}

function noteItem(note) {
  const item = document.createElement('li');
  const title = document.createElement('strong');
  const body = document.createElement('span');
  const actions = document.createElement('div');
  const edit = document.createElement('button');
  const remove = document.createElement('button');
  title.textContent = note.title;
  body.textContent = note.body;
  actions.className = 'note-actions';
  edit.type = 'button';
  edit.textContent = '수정';
  remove.type = 'button';
  remove.textContent = '삭제';
  remove.className = 'danger';
  actions.append(edit, remove);
  item.append(title, body, actions);

  edit.addEventListener('click', () => item.replaceChildren(noteEditor(note, item)));
  remove.addEventListener('click', async () => {
    if (!confirm(`「${note.title}」 메모를 삭제할까요?`)) return;
    remove.disabled = true;
    try {
      await api(`/api/notes/${encodeURIComponent(note.id)}`, { method: 'DELETE' });
      showNoteMessage('메모를 삭제했습니다.', 'ok');
      await loadNotes();
    } catch (error) {
      remove.disabled = false;
      showNoteMessage(error.message, 'error');
    }
  });
  return item;
}

function noteEditor(note, item) {
  const editor = document.createElement('form');
  const title = document.createElement('input');
  const body = document.createElement('textarea');
  const save = document.createElement('button');
  const cancel = document.createElement('button');
  const actions = document.createElement('div');
  editor.className = 'note-form';
  title.value = note.title;
  title.required = true;
  title.maxLength = 200;
  title.setAttribute('aria-label', '제목');
  body.value = note.body;
  body.maxLength = 5000;
  body.rows = 3;
  body.setAttribute('aria-label', '내용');
  save.type = 'submit';
  save.textContent = '저장';
  cancel.type = 'button';
  cancel.textContent = '취소';
  actions.className = 'note-actions';
  actions.append(save, cancel);
  editor.append(title, body, actions);
  cancel.addEventListener('click', () => item.replaceWith(noteItem(note)));
  editor.addEventListener('submit', async (event) => {
    event.preventDefault();
    save.disabled = true;
    try {
      const updated = await api(`/api/notes/${encodeURIComponent(note.id)}`, {
        method: 'PUT', payload: { title: title.value, body: body.value },
      });
      item.replaceWith(noteItem(updated));
      showNoteMessage('메모를 수정했습니다.', 'ok');
    } catch (error) {
      save.disabled = false;
      showNoteMessage(error.message, 'error');
    }
  });
  return editor;
}

let notesRequest = 0;
async function loadNotes() {
  const request = ++notesRequest;
  if (!currentSession?.access_token) {
    showNotesMessage('로그인하면 자료가 보입니다.');
    return;
  }
  if (device.status !== 'approved') {
    showNotesMessage('기기 승인 전에는 자료를 보여 주지 않습니다. 위 "이 기기"에서 승인을 요청하고 결과를 확인하세요.');
    return;
  }
  showNotesMessage('가상 자료를 불러오는 중입니다.');
  try {
    const notes = await api('/api/notes');
    if (request !== notesRequest) return;
    if (!Array.isArray(notes)) throw new Error('자료 형식이 맞지 않습니다.');
    if (!notes.length) showNotesMessage('아직 메모가 없습니다. 위에서 추가해 보세요.');
    else list.replaceChildren(...notes.map(noteItem));
  } catch (error) {
    if (request === notesRequest) showNotesMessage(error.message);
  }
}

addForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  addSubmit.disabled = true;
  try {
    await api('/api/notes', { method: 'POST', payload: { title: addTitle.value, body: addBody.value } });
    addForm.reset();
    showNoteMessage('메모를 추가했습니다.', 'ok');
    await loadNotes();
  } catch (error) {
    showNoteMessage(error.message, 'error');
  } finally {
    addSubmit.disabled = false;
  }
});

function render(session) {
  const user = session?.user;
  form.hidden = Boolean(user);
  signedIn.hidden = !user;
  who.textContent = user?.email ?? '';
  status.textContent = user ? '로그인됨' : '로그인하지 않음';
  status.dataset.state = user ? 'in' : 'out';
  if (!user) showNoteMessage('', 'info');
  renderDevice();
}

let shownToken = Symbol('not-loaded');
function update(session) {
  const sameUser = currentSession?.user?.email && currentSession.user.email === session?.user?.email;
  currentSession = session ?? null;
  if (!sameUser) resetDevice();
  render(session);
  if (session?.access_token === shownToken) return;
  shownToken = session?.access_token;
  loadNotes();
}

// 서버에 기기 승인을 요청하거나(공개키만 보냄) 서버 기록의 승인 결과를 받아 옵니다.
async function deviceCall(method) {
  const send = async (session) => {
    const headers = { Authorization: `Bearer ${session.access_token}` };
    let body;
    if (method === 'POST') {
      device.keyPair ??= await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
      const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', device.keyPair.publicKey);
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ publicKey: { kty, crv, x, y } });
    } else {
      headers['X-Device-Id'] = device.deviceId;
    }
    return fetch('/api/devices', { method, cache: 'no-store', headers, body });
  };
  let session = await freshSession();
  if (!session?.access_token) throw new Error('로그인한 뒤에 할 수 있습니다.');
  let response = await send(session);
  if (response.status === 401) {
    session = await freshSession(true);
    if (session?.access_token) response = await send(session);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`서버가 기기 요청을 처리하지 못했습니다. (${data.error ?? response.status})`);
  if (typeof data.deviceId !== 'string' || !['pending', 'approved', 'revoked'].includes(data.status)) {
    throw new Error('서버 응답 형식이 맞지 않습니다.');
  }
  device.deviceId = data.deviceId;
  device.status = data.status;
}

for (const [button, method, done] of [[deviceRequest, 'POST', '승인을 요청했습니다. 승인은 서버 쪽에서 따로 합니다.'],
  [deviceCheck, 'GET', '서버의 승인 기록을 확인했습니다.']]) {
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await deviceCall(method);
      showDevice(done, 'ok');
    } catch (error) {
      showDevice(error.message, 'error');
    } finally {
      button.disabled = false;
      renderDevice();
      loadNotes();
    }
  });
}

update(null);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submit.disabled = true;
  showMessage('로그인하는 중입니다.', 'info');
  const { ok, data, code } = await authCall('/api/auth/login', {
    payload: { email: email.value.trim(), password: password.value },
  });
  password.value = '';
  submit.disabled = false;
  if (!ok) {
    showMessage(failureReason(code), 'error');
    return;
  }
  form.reset();
  showMessage('로그인했습니다.', 'ok');
  update(data);
});

logout.addEventListener('click', async () => {
  logout.disabled = true;
  const token = currentSession?.access_token;
  const { ok } = token ? await authCall('/api/auth/logout', { bearer: token }) : { ok: true };
  logout.disabled = false;
  // 서버 로그아웃이 실패해도 이 브라우저의 세션은 지웁니다.
  update(null);
  showMessage(ok ? '로그아웃했습니다.' : '이 브라우저에서 로그아웃했습니다. 서버 세션 종료는 확인하지 못했습니다.', ok ? 'ok' : 'error');
});

// 12단계 탈환 작전실: 서버(/api/war-room)가 돌려준 요약을 그대로 보여 줍니다. 화면은 성공 여부를 스스로 정하지 않고,
// 서버가 준 가린 기록을 다시 세어 서버의 수치와 같은지만 표시합니다. 서버 값은 textContent로만 넣습니다.
const SOURCE_TEXT = { server_record: '서버 기록', local_virtual: '로컬 가상(엔진·심판 판정 아님)', not_run: '미실행' };

function el(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

function tableOf(head, rows) {
  const table = el('table');
  const tr = el('tr');
  for (const h of head) tr.append(el('th', h));
  table.append(tr);
  for (const row of rows) {
    const line = el('tr');
    for (const cell of row) line.append(el('td', cell ?? '—'));
    table.append(line);
  }
  return table;
}

function recount(records, key) {
  return records.reduce((acc, row) => ({ ...acc, [row[key]]: (acc[row[key]] ?? 0) + 1 }), {});
}

function countsLine(label, serverCounts, records, key) {
  const mine = recount(records, key);
  const names = [...new Set([...Object.keys(serverCounts), ...Object.keys(mine)])].sort();
  const match = names.every(name => (serverCounts[name] ?? 0) === (mine[name] ?? 0));
  const text = names.length ? names.map(name => `${name} ${serverCounts[name] ?? 0}`).join(' · ') : '기록 없음';
  return el('p', `${label}: ${text} — 기록 다시 세기: ${match ? '일치' : '불일치'}`, { 'data-match': String(match) });
}

function renderWarRoom(data) {
  const parts = [];
  const d = data.decider;
  parts.push(el('h3', '판정기 규칙'), el('p', `출처: ${SOURCE_TEXT[d.source]} · 규칙 ${d.ruleIds.length}개: ${d.ruleIds.join(', ')}`, { class: 'src' }),
    tableOf(['가상 요청', '결정', '이유 코드', '규칙'], d.results.map(r => [r.label, r.decision, r.reasonCode, r.ruleIds.join(', ')])),
    countsLine('결정 수', d.counts, d.results, 'decision'));
  const t = data.detection;
  parts.push(el('h3', '탐지 사건'), el('p', `출처: ${SOURCE_TEXT[t.source]} · 실제 사건 전달: ${SOURCE_TEXT[t.liveEvents.source]}`, { class: 'src' }),
    tableOf(['가상 사건', '결과', '이유 코드'], t.results.map(r => [r.label, r.action, r.reasonCode])),
    countsLine('결과 수', t.counts, t.results, 'action'),
    el('p', `기기 하나 대상 회수 제안: ${t.proposal ? `${t.proposal.action} · ${t.proposal.reasonCode} · 기기 ${t.proposal.device}` : '없음'}`));
  const v = data.revocation;
  parts.push(el('h3', '회수 상태'), el('p', `출처: ${SOURCE_TEXT[v.source]} · 회수 집행: ${SOURCE_TEXT[v.execution.source]}`, { class: 'src' }),
    tableOf(['기기', '상태', '요청 시각', '승인 시각'], v.records.map(r => [r.device, r.status, r.requestedAt, r.approvedAt])),
    countsLine('기기 상태 수', v.counts, v.records, 'status'));
  const r = data.restore;
  parts.push(el('h3', '복구 버전'),
    el('p', `정책 사본: ${r.policy.version ?? '읽지 못함'} (커밋 ${r.policy.commit ?? '—'}, 파일 ${r.policy.fileCount}개, 사본 지문 ${r.policy.digestOk ? '맞음' : '맞지 않음'}) · 출처: ${SOURCE_TEXT[r.policy.source]} · 현재 정책과 차이: ${SOURCE_TEXT[r.policy.currentDiff?.source ?? 'not_run']}`, { class: 'src' }),
    el('p', `메모 사본: ${r.backups.count}건 (출처: ${SOURCE_TEXT[r.backups.source]})`),
    tableOf(['감사 번호', '시각', '메모', '결과'], r.audit.records.map(a => [a.seq, a.at, a.note, a.result])),
    countsLine('복원 감사 결과 수', r.audit.counts, r.audit.records, 'result'),
    el('p', `불러온 시각: ${data.generatedAt}`, { class: 'src' }));
  warBody.replaceChildren(...parts);
}

warLoad.addEventListener('click', async () => {
  warLoad.disabled = true;
  warBody.replaceChildren(el('p', '작전실 요약을 불러오는 중입니다.'));
  try {
    let session = await freshSession();
    if (!session?.access_token) throw new Error('로그인한 뒤에 할 수 있습니다.');
    let response = await fetch('/api/war-room', { cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}` } });
    if (response.status === 401) {
      session = await freshSession(true);
      if (session?.access_token) response = await fetch('/api/war-room', { cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}` } });
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.schema !== 'aleph.war-room.v1') throw new Error(`작전실 요약을 받지 못했습니다. (${data.error ?? response.status})`);
    renderWarRoom(data);
  } catch (error) {
    warBody.replaceChildren(el('p', error.message));
  } finally {
    warLoad.disabled = false;
  }
});
