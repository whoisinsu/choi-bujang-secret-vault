// 3단계: Supabase Auth 이메일·비밀번호 로그인과 로그아웃 화면입니다.
// 공식 supabase-js(서버와 같은 2.117.2)의 signInWithPassword·signOut만 씁니다.
// 비밀번호와 토큰은 화면·콘솔에 출력하지 않습니다. 세션 보관은 SDK 기본 흐름을 따릅니다.
// Project URL과 publishable key는 공개용 값입니다. 서버 전용 secret key는 여기에 넣지 않습니다.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

const SUPABASE_URL = 'https://skevbebxatwbmomeoqtx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zbvLeuDU_gLzfhjV-CwlFg_eXRUOOM9';

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

const REASONS = {
  invalid_credentials: '이메일 또는 비밀번호가 맞지 않습니다.',
  email_not_confirmed: '이메일 인증이 끝나지 않은 계정입니다.',
  user_banned: '사용이 정지된 계정입니다.',
  over_request_rate_limit: '요청이 너무 많습니다. 잠시 뒤 다시 시도하세요.',
  over_email_send_rate_limit: '요청이 너무 많습니다. 잠시 뒤 다시 시도하세요.',
  validation_failed: '이메일과 비밀번호 형식을 확인하세요.',
};

function showMessage(text, kind) {
  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = !text;
}

function failureReason(error) {
  if (!error) return '알 수 없는 이유로 로그인하지 못했습니다.';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return '로그인 서버에 연결하지 못했습니다. 네트워크를 확인하세요.';
  }
  const reason = REASONS[error.code] ?? `로그인하지 못했습니다: ${error.message}`;
  return error.code ? `${reason} (${error.code})` : reason;
}

function showNotesMessage(text) {
  const item = document.createElement('li');
  item.textContent = text;
  list.replaceChildren(item);
}

// 메모는 로그인 세션의 access token을 Authorization 헤더에 실어 서버에 요청합니다.
// 사용자 ID나 역할은 보내지 않습니다. 서버가 토큰만 검사해 판단합니다.
let notesRequest = 0;
async function loadNotes(session) {
  const request = ++notesRequest;
  if (!session?.access_token) {
    showNotesMessage('로그인하면 자료가 보입니다.');
    return;
  }
  showNotesMessage('가상 자료를 불러오는 중입니다.');
  try {
    const response = await fetch('/api/notes', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (request !== notesRequest) return;
    if (response.status === 401) throw new Error('로그인을 확인하지 못해 자료를 보여 줄 수 없습니다. 다시 로그인해 주세요.');
    if (!response.ok) throw new Error('서버에서 자료를 읽을 수 없습니다.');
    const data = await response.json();
    if (!Array.isArray(data.notes)) throw new Error('자료 형식이 맞지 않습니다.');
    list.replaceChildren(...data.notes.map((note) => {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      const content = document.createElement('span');
      title.textContent = note.title;
      content.textContent = note.content;
      item.append(title, content);
      return item;
    }));
  } catch (error) {
    if (request === notesRequest) showNotesMessage(error.message);
  }
}

function render(session) {
  const user = session?.user;
  form.hidden = Boolean(user);
  signedIn.hidden = !user;
  who.textContent = user?.email ?? '';
  status.textContent = user ? '로그인됨' : '로그인하지 않음';
  status.dataset.state = user ? 'in' : 'out';
}

let shownToken = Symbol('not-loaded');
function update(session) {
  render(session);
  if (session?.access_token === shownToken) return;
  shownToken = session?.access_token;
  loadNotes(session);
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  update(null);
  submit.disabled = true;
  showMessage('로그인 설정이 아직 없습니다. public/auth.js에 publishable key를 넣어 주세요.', 'error');
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  // 콜백 안에서 Supabase를 다시 기다리지 않도록 화면 갱신은 다음 차례로 넘깁니다.
  supabase.auth.onAuthStateChange((_event, session) => setTimeout(() => update(session), 0));
  const { data } = await supabase.auth.getSession();
  update(data.session);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    showMessage('로그인하는 중입니다.', 'info');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value,
      });
      if (error) {
        showMessage(failureReason(error), 'error');
      } else {
        showMessage('로그인했습니다.', 'ok');
        form.reset();
      }
    } catch (error) {
      showMessage(failureReason(error), 'error');
    } finally {
      password.value = '';
      submit.disabled = false;
    }
  });

  logout.addEventListener('click', async () => {
    logout.disabled = true;
    const { error } = await supabase.auth.signOut();
    logout.disabled = false;
    showMessage(error ? `로그아웃하지 못했습니다: ${error.message}` : '로그아웃했습니다.', error ? 'error' : 'ok');
  });
}
