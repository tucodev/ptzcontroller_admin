import { NextResponse, type NextRequest } from 'next/server';

// ── Rate Limiting (in-memory, 단일 프로세스) ───────────────────────────────
// output: standalone → 단일 프로세스이므로 Map 상태가 요청 간 유지됨
// 멀티 인스턴스(수평 확장) 환경에서는 Upstash Redis(@upstash/ratelimit)로 교체 필요
//
// 적용 대상: POST 요청만 (GET /api/auth/session, GET /api/license/verify 등
//            앱이 자체적으로 빈번하게 호출하는 GET은 제외)
//
// 경로별 분당 POST 허용 횟수:
//   /api/auth/*          → 10회 (로그인 브루트포스 방지)
//   /api/license/verify  →  5회 (라이선스 파일 검증, 가장 민감)
//   /api/license/*       → 20회 (라이선스 요청 등 일반 API)

interface RateEntry {
    count: number;
    reset: number; // Unix ms timestamp
}

const rateMap = new Map<string, RateEntry>();
let lastCleanup = Date.now();

/** 만료된 항목 제거 (메모리 누수 방지) */
function cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of rateMap) {
        if (now > entry.reset) rateMap.delete(key);
    }
}

/** 경로별 분당 허용 횟수 반환 */
function getLimitForPath(path: string): number {
    if (path.startsWith('/api/auth/'))      return 10;
    if (path === '/api/license/verify')     return 5;
    return 20;
}

/**
 * true 반환 시 해당 IP+경로 조합이 한도를 초과한 것.
 * method 포함 key 구성 — GET/POST를 별도 카운터로 관리.
 */
function checkRateLimit(ip: string, method: string, path: string): boolean {
    const now = Date.now();

    // 1분마다 오래된 항목 정리
    if (now - lastCleanup > 60_000) {
        cleanup();
        lastCleanup = now;
    }

    const key   = `${method}:${ip}:${path}`;
    const limit = getLimitForPath(path);
    const entry = rateMap.get(key);

    if (!entry || now > entry.reset) {
        rateMap.set(key, { count: 1, reset: now + 60_000 });
        return false; // 새 창구 열림, 통과
    }

    if (entry.count >= limit) return true; // 한도 초과 → 차단

    entry.count++;
    return false; // 통과
}

// ─────────────────────────────────────────────────────────────────────────────

export function middleware(req: NextRequest) {
    // GET 요청은 통과 (session 확인·polling 등 앱 내부 호출 보호)
    if (req.method !== 'POST') return NextResponse.next();

    // x-forwarded-for: 리버스 프록시/Nginx 환경 대응 (첫 번째 IP 사용)
    const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
        req.headers.get('x-real-ip') ??
        'unknown';

    const path = req.nextUrl.pathname;

    if (checkRateLimit(ip, req.method, path)) {
        return new NextResponse('Too Many Requests', {
            status: 429,
            headers: {
                'Retry-After': '60',
                'Content-Type': 'text/plain; charset=utf-8',
            },
        });
    }

    return NextResponse.next();
}

// 미들웨어 적용 경로 — 민감 API만 명시
export const config = {
    matcher: [
        '/api/auth/:path*',
        '/api/license/:path*',
    ],
};
