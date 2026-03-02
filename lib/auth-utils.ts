import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

// ─────────────────────────────────────────────
// 인증/권한 공통 헬퍼
//   - requireSession : 로그인 여부만 확인 (401)
//   - requireAdmin   : admin 역할까지 확인 (401 / 403)
//
// 사용법:
//   const { session, error } = await requireSession();
//   if (error) return error;
//   → session 이 확정된 상태로 계속 진행
// ─────────────────────────────────────────────

type SessionUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
  role?: string;
};

type AuthResult =
  | { session: Awaited<ReturnType<typeof getServerSession>>; error: null }
  | { session: null; error: NextResponse };

/** 로그인 여부 확인. 미인증이면 401 Response 반환 */
export async function requireSession(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { session, error: null };
}

/** admin 권한 확인. 미인증 401 / 권한 부족 403 */
export async function requireAdmin(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  const user = session.user as SessionUser;
  if (user?.role !== 'admin') {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { session, error: null };
}

/** session.user 를 SessionUser 타입으로 안전하게 캐스팅 */
export function getSessionUser(session: { user?: unknown }): SessionUser {
  return (session.user ?? {}) as SessionUser;
}
