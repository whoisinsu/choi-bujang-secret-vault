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

function render(session) {
  const user = session?.user;
  form.hidden = Boolean(user);
  signedIn.hidden = !user;
  who.textContent = user?.email ?? '';
  status.textContent = user ? '로그인됨' : '로그인하지 않음';
  status.dataset.state = user ? 'in' : 'out';
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  render(null);
  submit.disabled = true;
  showMessage('로그인 설정이 아직 없습니다. public/auth.js에 publishable key를 넣어 주세요.', 'error');
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  supabase.auth.onAuthStateChange((_event, session) => render(session));
  const { data } = await supabase.auth.getSession();
  render(data.session);

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
