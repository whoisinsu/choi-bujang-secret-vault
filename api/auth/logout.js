// 5단계: POST /api/auth/logout (Authorization: Bearer) → Supabase Auth 세션을 서버가 대신 끝냅니다.
import { authHandler, authRequest, readBearer } from '../../src/auth-proxy.mjs';

export default authHandler(async ({ request, response }) => {
  await authRequest('logout', { bearer: readBearer(request) });
  return response.status(204).end();
});
