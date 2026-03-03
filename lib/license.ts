/**
 * license.ts
 *
 * 오프라인 모드 라이센스 시스템
 *
 * ── 전체 흐름 ──────────────────────────────────────────────
 *
 *  [사용자 PC]                         [제공자]
 *  1. 오프라인 버튼 클릭
 *  2. PC 고유코드(MachineID) 생성
 *  3. 요청 파일 생성 (*.ptzreq)
 *     → 파일 전달 (이메일 등) →
 *                                   4. scripts/issue-license.js 실행
 *                                   5. 라이센스 파일 생성 (*.ptzlic)
 *                                      - MachineID 포함 + HMAC 서명
 *                                   ← 파일 전달 ←
 *  6. 라이센스 파일 로딩
 *  7. 서명 검증 + MachineID 매칭
 *  8. 통과 시 오프라인 모드 진행
 *
 * ── 보안 원칙 ──────────────────────────────────────────────
 *  - MASTER_SECRET 은 환경변수(LICENSE_SECRET)에서 로드
 *  - 라이센스 = base64(JSON({ machineId, issuedAt, expiresAt, product, sig }))
 *  - sig = HMAC-SHA256(payload_without_sig, MASTER_SECRET) 전체 hex
 *  - MachineID = SHA256(hostname|cpu|platform|arch|mac들)[:16] 대문자
 *  - 다른 PC에서 발급된 라이센스는 MachineID 불일치로 무효
 */

import * as crypto from 'crypto';
import * as os     from 'os';
import * as fs     from 'fs';
import * as path   from 'path';

// ── 상수 ─────────────────────────────────────────────────────
// ⚠️ 반드시 .env 의 LICENSE_SECRET 를 설정할 것.
//    없으면 빌드마다 다른 기본값이 사용되어 기존 라이센스가 무효화됨.
const MASTER_SECRET  = process.env.LICENSE_SECRET ?? 'TYCHE-PTZ-LICENSE-SECRET-2024';
const PRODUCT_ID     = 'PTZ-OFFLINE';

// 라이센스 파일 저장 위치 (standalone 기준 data 폴더)
export const LICENSE_FILE_PATH = path.join(process.cwd(), 'data', 'offline.ptzlic');
// 요청 파일 저장 위치
export const REQUEST_FILE_PATH = path.join(process.cwd(), 'data', 'license.ptzreq');

// ── 타입 ─────────────────────────────────────────────────────
export interface LicensePayload {
  machineId:  string;
  issuedAt:   string;
  expiresAt:  string;  // ISO 8601 (예: '2099-12-31T23:59:59Z')
  product:    string;
}

export interface LicenseFile extends LicensePayload {
  sig: string;  // HMAC-SHA256 전체 hex
}

export interface RequestPayload {
  machineId:   string;
  requestedAt: string;
  product:     string;
  sig:         string;  // 요청 파일 위·변조 방지용 서명
}

export interface VerifyResult {
  valid:      boolean;
  reason?:    string;  // 실패 사유 (valid=false 일 때만)
  expiresAt?: string;  // 성공 시 만료일
  machineId?: string;  // 성공 시 MachineID
}

// ── PC 고유코드(MachineID) 생성 ──────────────────────────────
/**
 * 현재 PC의 고유한 식별자를 생성.
 * hostname + CPU 모델 + 플랫폼 + 아키텍처 + MAC 주소(들) 를 SHA256 해시.
 * 결과는 16자 대문자 hex (예: "07E89ACE3657A538")
 *
 * 가상머신 / VPN 환경에서는 MAC 주소가 변경될 수 있으나
 * hostname + CPU 조합으로 일정 수준 안정성 확보.
 */
export function getMachineId(): string {
  const ni = os.networkInterfaces();
  const macs: string[] = [];

  for (const addrs of Object.values(ni)) {
    for (const a of (addrs ?? [])) {
      if (!a.internal && a.mac && a.mac !== '00:00:00:00:00:00') {
        macs.push(a.mac.toLowerCase());
      }
    }
  }

  const components = [
    os.hostname(),
    os.cpus()[0]?.model ?? '',
    os.platform(),
    os.arch(),
    [...new Set(macs)].sort().join(','),
  ];

  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
}

// ── 요청 파일 생성 ────────────────────────────────────────────
/**
 * 사용자가 제공자에게 전달할 요청 파일(.ptzreq)의 내용을 생성.
 * 요청 파일에 서명을 포함시켜 위·변조 방지.
 */
export function createLicenseRequest(): RequestPayload {
  const machineId   = getMachineId();
  const requestedAt = new Date().toISOString();
  const payload     = { machineId, requestedAt, product: PRODUCT_ID };
  const sig         = crypto
    .createHmac('sha256', MASTER_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16); // 요청 서명은 16자만 사용 (파일 크기 최소화)

  return { ...payload, sig };
}

/**
 * 요청 파일을 data/license.ptzreq 로 저장.
 * JSON을 base64 인코딩하여 저장 (바이너리처럼 보이게).
 */
export function saveRequestFile(): string {
  const request = createLicenseRequest();
  const content = Buffer.from(JSON.stringify(request, null, 2)).toString('base64');
  fs.mkdirSync(path.dirname(REQUEST_FILE_PATH), { recursive: true });
  fs.writeFileSync(REQUEST_FILE_PATH, content, 'utf8');
  return REQUEST_FILE_PATH;
}

// ── 라이센스 생성 (제공자용) ──────────────────────────────────
/**
 * ⚠️ 제공자 전용 함수. 서버/스크립트에서만 사용.
 * 요청 파일을 검증하고, 해당 PC에서만 유효한 라이센스를 생성.
 *
 * @param machineId  요청 파일에서 추출한 MachineID
 * @param expiresAt  만료일 (ISO 8601, 예: '2026-12-31T23:59:59Z')
 * @returns          base64 인코딩된 라이센스 문자열
 */
export function issueLicense(machineId: string, expiresAt: string): string {
  const payload: LicensePayload = {
    machineId,
    issuedAt:  new Date().toISOString(),
    expiresAt,
    product:   PRODUCT_ID,
  };
  const sig = crypto
    .createHmac('sha256', MASTER_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex'); // 라이센스 서명은 전체 64자 사용

  const licenseFile: LicenseFile = { ...payload, sig };
  return Buffer.from(JSON.stringify(licenseFile)).toString('base64');
}

// ── 라이센스 검증 ─────────────────────────────────────────────
/**
 * base64 라이센스 문자열을 검증.
 * 1. JSON 파싱
 * 2. HMAC 서명 일치 확인
 * 3. MachineID 일치 확인 (현재 PC 와 비교)
 * 4. 만료일 확인
 */
export function verifyLicense(licenseB64: string): VerifyResult {
  try {
    const raw     = Buffer.from(licenseB64, 'base64').toString('utf8');
    const lic     = JSON.parse(raw) as LicenseFile;
    const { sig, ...payload } = lic;

    // 1. 서명 검증
    const expected = crypto
      .createHmac('sha256', MASTER_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    if (sig !== expected) {
      return { valid: false, reason: '라이센스 서명이 올바르지 않습니다' };
    }

    // 2. Product 확인
    if (payload.product !== PRODUCT_ID) {
      return { valid: false, reason: '라이센스 제품이 일치하지 않습니다' };
    }

    // 3. MachineID 검증 (현재 PC 와 비교)
    const currentMachineId = getMachineId();
    if (payload.machineId !== currentMachineId) {
      return {
        valid:  false,
        reason: `이 PC에 발급된 라이센스가 아닙니다\n현재 PC: ${currentMachineId}\n라이센스: ${payload.machineId}`,
      };
    }

    // 4. 만료일 확인
    if (new Date(payload.expiresAt) < new Date()) {
      return {
        valid:  false,
        reason: `라이센스가 만료되었습니다 (${payload.expiresAt.slice(0, 10)})`,
      };
    }

    return {
      valid:     true,
      expiresAt: payload.expiresAt,
      machineId: payload.machineId,
    };
  } catch {
    return { valid: false, reason: '라이센스 파일을 읽을 수 없습니다' };
  }
}

/**
 * 저장된 라이센스 파일을 읽어 검증.
 * 파일이 없으면 { valid: false, reason: 'NOT_FOUND' } 반환.
 */
export function verifyLicenseFile(): VerifyResult {
  if (!fs.existsSync(LICENSE_FILE_PATH)) {
    return { valid: false, reason: 'NOT_FOUND' };
  }
  try {
    const content = fs.readFileSync(LICENSE_FILE_PATH, 'utf8').trim();
    return verifyLicense(content);
  } catch {
    return { valid: false, reason: '라이센스 파일을 읽을 수 없습니다' };
  }
}
