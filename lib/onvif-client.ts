/**
 * lib/onvif-client.ts
 *
 * ONVIF SOAP 클라이언트 (GetProfiles / PTZ 명령)
 *
 * 외부 의존성 없이 Node.js 내장 fetch 만으로 구현.
 * ONVIF 표준 WS-Security UsernameToken 인증 사용.
 */

import crypto from 'crypto';

// ──────────────────────────────────────────
// HTTP Digest Auth 계산 (삼성 iPolis 등)
// ──────────────────────────────────────────
function calcDigestAuth(
  username: string, password: string,
  method: string, uri: string, wwwAuth: string,
): string {
  const realm  = (wwwAuth.match(/realm="([^"]*)"/)  || [])[1] || '';
  const nonce  = (wwwAuth.match(/nonce="([^"]*)"/)  || [])[1] || '';
  const opaque = (wwwAuth.match(/opaque="([^"]*)"/) || [])[1] || '';
  const qop    = (wwwAuth.match(/qop="([^"]*)"/)    || [])[1] || '';
  const nc     = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex');
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);
  let hdr = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  if (qop)    hdr += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  if (opaque) hdr += `, opaque="${opaque}"`;
  return hdr;
}

// ──────────────────────────────────────────
// WS-Security 헤더 생성
// ──────────────────────────────────────────

function wsSecHeader(username: string, password: string): string {
  const nonce   = crypto.randomBytes(16).toString('base64');
  const created = new Date().toISOString();
  // PasswordDigest = Base64(SHA1(nonce + created + password))
  const digest  = crypto
    .createHash('sha1')
    .update(Buffer.from(nonce, 'base64'))
    .update(created)
    .update(password)
    .digest('base64');

  return `
  <s:Header>
    <Security s:mustUnderstand="1"
      xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <UsernameToken>
        <Username>${escXml(username)}</Username>
        <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</Password>
        <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce}</Nonce>
        <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-utility-1.0.xsd">${created}</Created>
      </UsernameToken>
    </Security>
  </s:Header>`;
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ──────────────────────────────────────────
// SOAP 전송 공통 함수
// ──────────────────────────────────────────

async function soapRequest(
  url: string,
  body: string,
  timeoutMs = 5000,
  opts: { username?: string; password?: string } = {},
): Promise<string> {
  const doFetch = async (b: string, extraHeaders: Record<string,string> = {}) => {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/soap+xml; charset=utf-8',
                   'Accept': 'application/soap+xml, text/xml', ...extraHeaders },
        body: b,
        signal: controller.signal,
      });
    } finally { clearTimeout(tid); }
  };

  // 1차: plain 시도
  const r1 = await doFetch(body);
  if (r1.ok) return r1.text();

  if (opts.username) {
    const wwwAuth = r1.headers.get('www-authenticate') || '';

    // 2차: HTTP Digest Auth (삼성 iPolis)
    if (r1.status === 401 && wwwAuth.toLowerCase().startsWith('digest')) {
      const u   = new URL(url);
      const hdr = calcDigestAuth(opts.username, opts.password || '', 'POST', u.pathname, wwwAuth);
      const r2  = await doFetch(body, { Authorization: hdr });
      if (r2.ok) return r2.text();
      throw new Error(`HTTP ${r2.status} (Digest Auth 실패)`);
    }

    // 3차: HTTP Basic Auth
    if (r1.status === 401 && wwwAuth.toLowerCase().startsWith('basic')) {
      const hdr = 'Basic ' + Buffer.from(`${opts.username}:${opts.password || ''}`).toString('base64');
      const r2  = await doFetch(body, { Authorization: hdr });
      if (r2.ok) return r2.text();
    }
  }

  throw new Error(`HTTP ${r1.status} ${r1.statusText}`);
}

// ──────────────────────────────────────────
// XML 파싱 헬퍼 (정규식 기반 — 외부 파서 없음)
// ──────────────────────────────────────────

function extractAll(xml: string, tag: string): string[] {
  // 네임스페이스 접두사 무시하고 태그 이름만 매칭
  const re = new RegExp(`<[^>]*:?${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tag}>`, 'gi');
  const results: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[0]);
  return results;
}

function attr(xml: string, name: string): string {
  const m = xml.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

function text(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<[^>]*:?${tag}[^>]*>([^<]*)<`, 'i'));
  return m ? m[1].trim() : '';
}

// ──────────────────────────────────────────
// GetProfiles
// ──────────────────────────────────────────

export interface OnvifProfile {
  token:       string;
  name:        string;
  encoding?:   string;
  resolution?: string;
  hasPtz:      boolean;
}

export interface GetProfilesResult {
  success:  boolean;
  profiles: OnvifProfile[];
  error?:   string;
}

export async function getOnvifProfiles(opts: {
  host:      string;
  port:      number;
  username?: string;
  password?: string;
}): Promise<GetProfilesResult> {
  const { host, port, username = '', password = '' } = opts;
  const url = `http://${host}:${port}/onvif/media_service`;

  const authHeader = username ? wsSecHeader(username, password) : '';

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope
  xmlns:s="http://www.w3.org/2003/05/soap-envelope"
  xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
  ${authHeader}
  <s:Body>
    <trt:GetProfiles/>
  </s:Body>
</s:Envelope>`;

  try {
    const xml = await soapRequest(url, envelope, 5000, { username, password });

    // GetProfiles 응답에서 Profiles 파싱
    const profileBlocks = extractAll(xml, 'Profiles');
    if (profileBlocks.length === 0) {
      // 일부 카메라는 다른 경로 사용
      return await getOnvifProfilesFallback(host, port, username, password);
    }

    const profiles: OnvifProfile[] = profileBlocks.map((block) => {
      const token      = attr(block, 'token');
      const name       = text(block, 'Name');
      const encoding   = text(block, 'Encoding');
      const width      = text(block, 'Width');
      const height     = text(block, 'Height');
      const hasPtz     = /PTZConfiguration/i.test(block);

      return {
        token:       token || 'Profile_1',
        name:        name  || token,
        encoding:    encoding || undefined,
        resolution:  width && height ? `${width}x${height}` : undefined,
        hasPtz,
      };
    });

    // PTZ 가능한 프로필 우선 정렬
    profiles.sort((a, b) => (b.hasPtz ? 1 : 0) - (a.hasPtz ? 1 : 0));

    return { success: true, profiles };
  } catch (err) {
    return {
      success:  false,
      profiles: [],
      error:    (err as Error).message,
    };
  }
}

// 일부 카메라는 /onvif/device_service 경로 사용 — fallback
async function getOnvifProfilesFallback(
  host: string,
  port: number,
  username: string,
  password: string,
): Promise<GetProfilesResult> {
  const url = `http://${host}:${port}/onvif/device_service`;
  const authHeader = username ? wsSecHeader(username, password) : '';

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope
  xmlns:s="http://www.w3.org/2003/05/soap-envelope"
  xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
  ${authHeader}
  <s:Body>
    <trt:GetProfiles/>
  </s:Body>
</s:Envelope>`;

  try {
    const xml      = await soapRequest(url, envelope, 4000, { username, password });
    const blocks   = extractAll(xml, 'Profiles');
    const profiles = blocks.map((block) => ({
      token:   attr(block, 'token') || 'Profile_1',
      name:    text(block, 'Name')  || 'Default',
      hasPtz:  /PTZConfiguration/i.test(block),
    }));
    return { success: true, profiles };
  } catch {
    // 두 경로 모두 실패 — 기본 토큰 반환
    return {
      success:  true,
      profiles: [{ token: 'Profile_1', name: 'Profile_1 (기본값)', hasPtz: true }],
      error:    '자동 탐색 실패. 기본 토큰을 사용합니다.',
    };
  }
}

// ──────────────────────────────────────────
// ONVIF PTZ 명령 (ptz-proxy-electron 에서 사용)
// HTTP SOAP over fetch — 단, proxy 환경에서는 proxy main.js 에서 직접 호출
// ──────────────────────────────────────────

export interface OnvifPtzConfig {
  host:         string;
  port:         number;
  username:     string;
  password:     string;
  profileToken: string;
}

export interface OnvifCommandResult {
  success: boolean;
  error?:  string;
}

/**
 * ContinuousMove — 방향키를 누르는 동안 지속 이동
 */
export async function onvifContinuousMove(
  cfg:       OnvifPtzConfig,
  panSpeed:  number,   // -1.0 ~ 1.0
  tiltSpeed: number,   // -1.0 ~ 1.0
  zoomSpeed: number,   // -1.0 ~ 1.0
): Promise<OnvifCommandResult> {
  const url     = `http://${cfg.host}:${cfg.port}/onvif/ptz_service`;
  const auth    = wsSecHeader(cfg.username, cfg.password);
  const token   = escXml(cfg.profileToken);

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope
  xmlns:s="http://www.w3.org/2003/05/soap-envelope"
  xmlns:ptz="http://www.onvif.org/ver20/ptz/wsdl"
  xmlns:tt="http://www.onvif.org/ver10/schema">
  ${auth}
  <s:Body>
    <ptz:ContinuousMove>
      <ptz:ProfileToken>${token}</ptz:ProfileToken>
      <ptz:Velocity>
        <tt:PanTilt x="${panSpeed.toFixed(4)}" y="${tiltSpeed.toFixed(4)}"/>
        <tt:Zoom x="${zoomSpeed.toFixed(4)}"/>
      </ptz:Velocity>
    </ptz:ContinuousMove>
  </s:Body>
</s:Envelope>`;

  try {
    await soapRequest(url, envelope);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Stop — 모든 움직임 정지
 */
export async function onvifStop(cfg: OnvifPtzConfig): Promise<OnvifCommandResult> {
  const url   = `http://${cfg.host}:${cfg.port}/onvif/ptz_service`;
  const auth  = wsSecHeader(cfg.username, cfg.password);
  const token = escXml(cfg.profileToken);

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope
  xmlns:s="http://www.w3.org/2003/05/soap-envelope"
  xmlns:ptz="http://www.onvif.org/ver20/ptz/wsdl">
  ${auth}
  <s:Body>
    <ptz:Stop>
      <ptz:ProfileToken>${token}</ptz:ProfileToken>
      <ptz:PanTilt>true</ptz:PanTilt>
      <ptz:Zoom>true</ptz:Zoom>
    </ptz:Stop>
  </s:Body>
</s:Envelope>`;

  try {
    await soapRequest(url, envelope);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * GotoPreset — 프리셋 이동
 */
export async function onvifGotoPreset(
  cfg:          OnvifPtzConfig,
  presetToken:  string,
): Promise<OnvifCommandResult> {
  const url   = `http://${cfg.host}:${cfg.port}/onvif/ptz_service`;
  const auth  = wsSecHeader(cfg.username, cfg.password);
  const token = escXml(cfg.profileToken);

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope
  xmlns:s="http://www.w3.org/2003/05/soap-envelope"
  xmlns:ptz="http://www.onvif.org/ver20/ptz/wsdl">
  ${auth}
  <s:Body>
    <ptz:GotoPreset>
      <ptz:ProfileToken>${token}</ptz:ProfileToken>
      <ptz:PresetToken>${escXml(presetToken)}</ptz:PresetToken>
    </ptz:GotoPreset>
  </s:Body>
</s:Envelope>`;

  try {
    await soapRequest(url, envelope);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
