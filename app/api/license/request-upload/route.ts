/**
 * app/api/license/request-upload/route.ts (P-48)
 * 
 * 역할: 오프라인 상태에서 발급받은 라이선스 파일 업로드 및 저장
 * 
 * POST /api/license/request-upload
 * 
 * 요청: multipart/form-data
 *   - license: .ptzlic 파일 (Base64 인코딩된 JSON)
 * 
 * 응답 성공:
 *   {
 *     success: true,
 *     expiresAt: "2027-03-07T23:59:59Z",
 *     machineId: "HWID-xxxxx",
 *     savedPath: "C:\\ProgramData\\PTZController\\offline.ptzlic",
 *     message: "라이선스가 저장되었습니다"
 *   }
 * 
 * 응답 실패:
 *   {
 *     error: "오류 메시지"
 *   }
 * 
 * 특징:
 * - 인증 불필요 (오프라인 모드에서는 로그인 불가)
 * - 파일 유효성 검증 (lib/license.ts 의 verifyLicense 사용)
 * - 크로스 플랫폼 저장 (Windows/macOS/Linux)
 * - 저장 경로: C:\ProgramData\PTZController\offline.ptzlic
 * 
 * P-48 흐름:
 * 1. 오프라인 모드에서 요청 파일(.ptzreq) 다운로드
 * 2. 관리자가 요청 파일을 라이선스 서버에 제출
 * 3. 라이선스 파일(.ptzlic) 발급 받음
 * 4. 로그인 페이지에서 라이선스 파일 업로드
 * 5. 이 API가 호출되어 파일 검증 및 저장
 * 6. 저장 완료 후 오프라인 모드 진입
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyLicense, getLicenseDir } from '@/lib/license';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[P-48] License upload request received');

    // FormData 파싱
    const formData = await request.formData();
    const file = formData.get('license') as File | null;

    // 파일 존재 여부 확인
    if (!file) {
      console.warn('[P-48] No file provided');
      return NextResponse.json(
        { error: '라이선스 파일이 업로드되지 않았습니다' },
        { status: 400 }
      );
    }

    console.log('[P-48] File received:', file.name, `(${file.size} bytes)`);

    // 파일 확장자 확인
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.ptzlic')) {
      console.warn('[P-48] Invalid file extension:', file.name);
      return NextResponse.json(
        { error: '유효하지 않은 파일 형식입니다 (.ptzlic 파일만 가능)' },
        { status: 400 }
      );
    }

    // 파일 내용 읽기
    const buffer = await file.arrayBuffer();
    const content = Buffer.from(buffer).toString('utf-8').trim();

    // 빈 파일 확인
    if (!content) {
      console.warn('[P-48] File is empty');
      return NextResponse.json(
        { error: '파일이 비어있습니다' },
        { status: 400 }
      );
    }

    console.log('[P-48] File content length:', content.length);

    // ─────────────────────────────────────────────────────────
    // 라이선스 유효성 검증 (lib/license.ts)
    // ─────────────────────────────────────────────────────────
    console.log('[P-48] Verifying license...');
    const verifyResult = verifyLicense(content);

    if (!verifyResult.valid) {
      console.warn('[P-48] Verification failed:', verifyResult.reason);
      return NextResponse.json(
        { 
          error: `라이선스 검증 실패: ${verifyResult.reason}`,
          reason: verifyResult.reason
        },
        { status: 400 }
      );
    }

    console.log('[P-48] License verified successfully');
    console.log('[P-48] - machineId:', verifyResult.machineId);
    console.log('[P-48] - expiresAt:', verifyResult.expiresAt);

    // ─────────────────────────────────────────────────────────
    // 로컬 저장
    // ─────────────────────────────────────────────────────────
    console.log('[P-48] Saving license to local path...');
    
    const licenseDir = getLicenseDir();
    const licenseFilePath = path.join(licenseDir, 'offline.ptzlic');

    // 디렉토리 생성 (없으면)
    try {
      fs.mkdirSync(licenseDir, { recursive: true });
      console.log('[P-48] License directory ensured:', licenseDir);
    } catch (mkdirErr) {
      console.error('[P-48] Failed to create directory:', mkdirErr);
      throw new Error(`디렉토리 생성 실패: ${(mkdirErr as Error).message}`);
    }

    // 파일 저장
    try {
      fs.writeFileSync(licenseFilePath, content, 'utf-8');
      console.log('[P-48] License saved successfully:', licenseFilePath);
    } catch (writeErr) {
      console.error('[P-48] Failed to write file:', writeErr);
      throw new Error(`파일 저장 실패: ${(writeErr as Error).message}`);
    }

    // ─────────────────────────────────────────────────────────
    // 성공 응답
    // ─────────────────────────────────────────────────────────
    const successMsg = `라이선스가 저장되었습니다 (만료: ${verifyResult.expiresAt})`;
    console.log('[P-48] ✅', successMsg);

    return NextResponse.json({
      success: true,
      expiresAt: verifyResult.expiresAt,
      machineId: verifyResult.machineId,
      savedPath: licenseFilePath,
      message: successMsg,
    });

  } catch (error) {
    const errorMsg = (error as Error).message || 'Unknown error';
    console.error('[P-48] ❌ Error:', errorMsg);
    
    return NextResponse.json(
      { 
        error: `업로드 중 오류가 발생했습니다: ${errorMsg}`,
        details: errorMsg
      },
      { status: 500 }
    );
  }
}
