// 5단계: POST /api/auth/refresh {refresh_token} → 만료가 가까운 로그인 세션을 서버가 갱신합니다.
import { authHandler, authRequest, publicSession, readRefreshToken } from '../../src/auth-proxy.mjs';

export default authHandler(async ({ request, response }) => {
  const refreshToken = readRefreshToken(request);
  const data = await authRequest('token', { query: { grant_type: 'refresh_token' }, payload: { refresh_token: refreshToken } });
  return response.status(200).json(publicSession(data));
});
