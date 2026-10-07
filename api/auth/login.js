// 5단계: POST /api/auth/login {email,password} → Supabase Auth 비밀번호 로그인을 서버가 대신 합니다.
// 비밀번호는 Supabase로 넘기기만 하고 저장하거나 로그에 남기지 않습니다.
import { authHandler, authRequest, publicSession, readLogin } from '../../src/auth-proxy.mjs';

export default authHandler(async ({ request, response }) => {
  const { email, password } = readLogin(request);
  const data = await authRequest('token', { query: { grant_type: 'password' }, payload: { email, password } });
  return response.status(200).json(publicSession(data));
});
