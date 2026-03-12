import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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

/**
 * 오프라인 세션 생성 + 라이선스 검증 게이트
 *
 * 라이선스 유효   → OfflineSession 반환
 * 라이선스 무효   → 403 반환 (오프라인 기능 완전 차단)
 *
 * 이중 방어 구조:
 *   1차: Electron main.js checkLicenseOnStartup() — 무효 시 쿠키 삭제 → 쿠키 경로 차단
 *   2차: 여기서 실제 라이선스 재검증 → 쿠키가 있더라도 무효면 차단
 */
async function makeOfflineSession(offlineEmail: string | undefined): Promise<AuthResult> {
  const offlineSession = await createOfflineSession(offlineEmail);

  if (!offlineSession.license?.valid) {
    console.warn(
      '[Auth] Offline session BLOCKED — invalid license:',
      offlineSession.license?.reason ?? 'UNKNOWN',
    );
    return {
      session: null,
      error: NextResponse.json(
        {
          error: 'OFFLINE_LICENSE_REQUIRED',
          reason: offlineSession.license?.reason ?? 'INVALID',
          message: '오프라인 라이선스가 유효하지 않습니다. 설정 화면(⚙)에서 라이선스를 발급받으세요.',
        },
        { status: 403 },
      ),
    };
  }

  return { session: offlineSession, error: null };
}

/** 로그인 여부 확인. DB 오프라인이면 오프라인 세션으로 통과 (라이선스 유효 시만) */
export async function requireSession(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (session) return { session, error: null };

  // ptz-offline-userid 쿠키에서 실제 사용자 이메일 추출
  const cookieStore = cookies();
  const rawUserId   = cookieStore.get('ptz-offline-userid')?.value;
  const offlineEmail = rawUserId ? decodeURIComponent(rawUserId) : undefined;

  // 의도적 오프라인 모드 쿠키 확인
  // - 로그인 페이지에서 "오프라인으로 진행" 클릭 시 ptz-offline-mode=1 쿠키 설정됨
  // - DB가 나중에 online 복귀해도 해당 세션은 오프라인 세션으로 유지 (LAN 복귀 시 401 방지)
  // ※ 라이선스 무효 시 makeOfflineSession() 에서 403 반환
  if (cookieStore.get('ptz-offline-mode')?.value === '1') {
    return makeOfflineSession(offlineEmail);
  }

  // DB 오프라인이면 오프라인 세션 허용 (라이선스 유효 시만)
  const dbOk = await isDbAvailable();
  if (!dbOk) {
    return makeOfflineSession(offlineEmail);
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
