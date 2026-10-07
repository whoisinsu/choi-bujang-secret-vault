// 로그인·로그아웃과 메모 화면입니다.
// 5단계: 브라우저 코드에는 Supabase 주소와 키가 없습니다. 로그인·토큰 갱신·로그아웃은
// Vercel 서버 함수(/api/auth/login·refresh·logout)가 Supabase Auth에 대신 요청하고,
// 메모는 /api/notes 서버 함수로만 다룹니다. 비밀번호와 토큰은 화면·콘솔에 출력하지 않습니다.

const SESSION_KEY = 'vault-session';
// 3·4단계의 Supabase SDK가 남긴 옛 세션은 더 쓰지 않으므로 지웁니다.
try {
  localStorage.removeItem('sb-skevbebxatwbmomeoqtx-auth-token');
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

function loadStoredSession() {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY));
    return typeof stored?.access_token === 'string' && typeof stored?.refresh_token === 'string' ? stored : null;
  } catch {
    return null;
  }
}

function storeSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 이 창에서만 로그인 상태를 유지합니다.
  }
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
      storeSession(currentSession);
      if (!ok) update(null);
      return currentSession;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function api(path, { method = 'GET', payload } = {}) {
  const send = async (session) => {
    const headers = { Authorization: `Bearer ${session.access_token}` };
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
  notesPanel.hidden = !user;
  if (!user) showNoteMessage('', 'info');
}

let shownToken = Symbol('not-loaded');
function update(session) {
  render(session);
  currentSession = session ?? null;
  if (session?.access_token === shownToken) return;
  shownToken = session?.access_token;
  loadNotes();
}

update(loadStoredSession());

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
  storeSession(data);
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
  storeSession(null);
  update(null);
  showMessage(ok ? '로그아웃했습니다.' : '이 브라우저에서 로그아웃했습니다. 서버 세션 종료는 확인하지 못했습니다.', ok ? 'ok' : 'error');
});
