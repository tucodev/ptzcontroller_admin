/**
 * offline-mode.ts
 *
 * Standalone EXE 환경에서 인터넷 DB에 연결할 수 없을 때
 * 인증 없이 user 권한으로 앱을 사용할 수 있도록 한다.
 *
 * 동작 원리:
 *   1. DB 연결 테스트 (prisma.$queryRaw `SELECT 1`)
 *   2. 실패 시 오프라인 세션 객체를 반환 → role: 'user', admin 기능 비활성화
 *   3. 카메라 제어·설정은 로컬 JSON 파일 기반이므로 DB 없이도 정상 동작
 *
 * 오프라인 모드 제약:
 *   - 로그인/회원가입 불가 (DB 없음)
 *   - admin 기능 전체 비활성화
 *   - 카메라 제어(PTZ), 카메라/프리셋/설정 조회·수정은 정상 동작
 */

import { prisma } from './db';

// ── 오프라인 세션 타입 ───────────────────────────────────────
export interface OfflineSession {
  user: {
    id:    string;
    name:  string;
    email: string;
    role:  'user'; // 오프라인은 항상 user 고정
  };
  offline: true;   // 오프라인 세션 식별 플래그
}

// ── DB 연결 상태 캐시 ────────────────────────────────────────
// 프로세스가 살아있는 동안 캐시 (매 요청마다 DB 테스트하지 않음)
let _dbAvailable: boolean | null = null;
let _lastCheckTime = 0;
const CACHE_TTL_MS = 30_000; // 30초마다 재확인

/**
 * DB 연결 가능 여부 확인
 * 결과는 30초간 캐시되므로 반복 호출에도 성능 영향 없음
 */
export async function isDbAvailable(): Promise<boolean> {
  const now = Date.now();
  // 캐시 유효 시간 내라면 캐시된 결과 반환
  if (_dbAvailable !== null && now - _lastCheckTime < CACHE_TTL_MS) {
    return _dbAvailable;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    _dbAvailable = true;
  } catch {
    _dbAvailable = false;
    console.warn('[OfflineMode] DB connection failed — offline mode activated');
  }

  _lastCheckTime = Date.now();
  return _dbAvailable;
}

/**
 * DB 연결 캐시 강제 초기화 (재연결 시도 버튼에서 사용)
 */
export function resetDbCache(): void {
  _dbAvailable   = null;
  _lastCheckTime = 0;
}

/**
 * 오프라인 세션 객체 반환
 * API 라우트에서 getServerSession() 이 null 을 반환할 때 폴백으로 사용
 */
export function createOfflineSession(): OfflineSession {
  return {
    user: {
      id:    'offline',
      name:  'Offline User',
      email: 'offline@local',
      role:  'user',
    },
    offline: true,
  };
}

/**
 * 주어진 세션이 오프라인 세션인지 확인
 */
export function isOfflineSession(session: unknown): session is OfflineSession {
  return (
    typeof session === 'object' &&
    session !== null &&
    (session as OfflineSession).offline === true
  );
}
