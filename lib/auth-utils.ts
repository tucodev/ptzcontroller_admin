import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { isDbAvailable, createOfflineSession, OfflineSession } from '@/lib/offline-mode';

// ─────────────────────────────────────────────────────────────
// 인증/권한 공통 헬퍼
//
//   - requireSession : 로그인 여부 확인 (오프라인 세션 허용)
//   - requireAdmin   : admin 역할 확인 (오프라인 세션 → 항상 403)
//
// 오프라인 모드 동작:
//   DB 연결 불가 시 getServerSession() 은 null 을 반환.
//   이 경우 isDbAvailable() 로 DB 상태를 재확인한 뒤
//   오프라인이면 role:'user' 세션을 반환하여 앱 사용을 허용.
//   admin API 는 오프라인 세션으로 접근 불가 (항상 403).
//
// 사용법:
//   const { session, error } = await requireSession();
//   if (error) return error;
//   → 온라인/오프라인 무관하게 session 이 확정된 상태로 계속 진행
// ─────────────────────────────────────────────────────────────

export type SessionUser = {
  id?:    string;
  email?: string | null;
  name?:  string | null;
  role?:  string;
};

type RealSession = Awaited<ReturnType<typeof getServerSession>>;

type AuthResult =
  | { session: RealSession | OfflineSession; error: null }
  | { session: null; error: NextResponse };

/** 로그인 여부 확인. DB 오프라인이면 오프라인 세션으로 통과 */
export async function requireSession(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (session) return { session, error: null };

  // DB 오프라인이면 오프라인 세션 허용
  const dbOk = await isDbAvailable();
  if (!dbOk) {
    return { session: createOfflineSession(), error: null };
  }

  return {
    session: null,
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
}

/** admin 권한 확인. 오프라인 세션은 항상 403 반환 */
export async function requireAdmin(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!session) {
    // 오프라인 모드 확인
    const dbOk = await isDbAvailable();
    if (!dbOk) {
      return {
        session: null,
        error: NextResponse.json(
          { error: 'Admin features unavailable in offline mode' },
          { status: 403 }
        ),
      };
    }
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
