/**
 * proxy-token.ts
 *
 * Proxy 모드 WebSocket 연결용 단기 토큰 생성/검증
 *
 * 동작 원리:
 *   1. /api/ptz/connect 가 Proxy 모드 응답 시 단기 토큰(proxyToken) 동봉
 *   2. 브라우저가 ws://proxy-host:9902?token=<proxyToken> 으로 연결
 *   3. ptz-proxy-electron 이 토큰을 /api/proxy-token/verify 로 검증
 *   4. 검증 통과 시 WebSocket 연결 허용
 *
 * 보안 특성:
 *   - HMAC-SHA256 서명 → 위변조 불가
 *   - TTL 60초 → 재사용 공격 방지
 *   - cameraId 포함 → 다른 카메라에 사용 불가
 *   - 서버리스 환경에서 외부 저장소 없이 동작 (서명 검증만으로 충분)
 *
 * 환경변수:
 *   PROXY_TOKEN_SECRET  토큰 서명 키. 미설정 시 NEXTAUTH_SECRET 을 사용.
 */

import crypto from 'crypto';

const SECRET = () =>
  process.env.PROXY_TOKEN_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'ptz-proxy-token-secret';

const TTL_MS = 60_000; // 60초

interface TokenPayload {
  cameraId: string;
  userId:   string;
  iat:      number;   // issued-at (ms)
}

/**
 * 프록시 연결용 단기 토큰 생성
 * @returns URL-safe base64 문자열
 */
export function createProxyToken(cameraId: string, userId: string): string {
  const payload: TokenPayload = {
    cameraId,
    userId,
    iat: Date.now(),
  };
  const data = JSON.stringify(payload);
  const sig  = crypto
    .createHmac('sha256', SECRET())
    .update(data)
    .digest('hex');

  // payload|sig 형태로 인코딩
  return Buffer.from(`${data}|${sig}`).toString('base64url');
}

export interface VerifyResult {
  valid:    boolean;
  cameraId?: string;
  userId?:  string;
  reason?:  string;
}

/**
 * 토큰 검증
 * 서명 확인 + TTL 체크
 */
export function verifyProxyToken(token: string): VerifyResult {
  try {
    const raw   = Buffer.from(token, 'base64url').toString('utf-8');
    const sep   = raw.lastIndexOf('|');
    if (sep < 0) return { valid: false, reason: 'malformed' };

    const data  = raw.slice(0, sep);
    const sig   = raw.slice(sep + 1);

    // 서명 검증 (timing-safe)
    const expected = crypto
      .createHmac('sha256', SECRET())
      .update(data)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      return { valid: false, reason: 'invalid_signature' };
    }

    const payload = JSON.parse(data) as TokenPayload;

    // TTL 체크
    if (Date.now() - payload.iat > TTL_MS) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true, cameraId: payload.cameraId, userId: payload.userId };
  } catch {
    return { valid: false, reason: 'parse_error' };
  }
}
