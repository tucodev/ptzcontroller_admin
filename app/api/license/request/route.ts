// app/api/license/request/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllMachineIds } from "@/lib/license";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

const PRODUCT_ID = "PTZ-OFFLINE";
const MASTER_SECRET = process.env.LICENSE_SECRET ?? "TYCHE-PTZ-GOOD-BLESS-2026";

/**
 * GET /api/license/request
 * 
 * 완전 오프라인 대응:
 * 1. 세션에서 사용자 정보 읽기 (온라인)
 * 2. 쿼리 파라미터에서 읽기 (오프라인)
 * 3. 머신ID 수집 (실패해도 무시하고 UNKNOWN 사용)
 * 4. 요청 파일 생성 및 다운로드 제공
 */
export async function GET(request: NextRequest) {
    try {
        console.log('[License] Request file generation started');
        
        const searchParams = request.nextUrl.searchParams;

        // ──────────────────────────────────────────────────────────
        // 1단계: 사용자 정보 수집 (다중 경로)
        // ──────────────────────────────────────────────────────────
        
        let userEmail = "";
        let userName = "";
        let userOrg = "";
        let userId = "offline";

        // ✅ 경로 1: 세션에서 사용자 정보 추출 (온라인)
        try {
            const session = await getServerSession(authOptions);
            if (session?.user?.email) {
                userEmail = session.user.email;
                userName = (session.user as any)?.name || "";
                userOrg = (session.user as any)?.organization || "";
                userId = (session.user as any)?.id || "offline";
                console.log('[License] User info from session:', userEmail);
            }
        } catch (sessionErr) {
            console.warn('[License] Session fetch failed (expected in offline):', 
                (sessionErr as Error).message);
        }

        // ✅ 경로 2: 쿼리 파라미터에서 사용자 정보 읽기 (오프라인 다이얼로그)
        if (!userEmail) {
            const paramEmail = searchParams.get("email");
            const paramName = searchParams.get("name");
            const paramOrg = searchParams.get("org");

            if (paramEmail) {
                userEmail = paramEmail;
                userName = paramName || "";
                userOrg = paramOrg || "";
                userId = "offline";
                console.log('[License] User info from query params:', userEmail);
            }
        }

        // ✅ 경로 3: 최후의 수단 (기본값)
        if (!userEmail) {
            console.warn('[License] No user email provided, using defaults');
            userEmail = "unknown@localhost";
            userName = "Unknown User";
            userOrg = "Unknown Organization";
            userId = "offline";
        }

        // ✅ 경로 4: session/param에 name/org가 없으면 DB 조회 (온라인 환경)
        if ((!userName || !userOrg) && userEmail !== "unknown@localhost") {
            try {
                const { prisma } = await import('@/lib/db');
                const dbUser = await prisma.user.findUnique({
                    where: { email: userEmail },
                    select: { name: true, organization: true },
                });
                if (!userName && dbUser?.name)         userName = dbUser.name;
                if (!userOrg  && dbUser?.organization) userOrg  = dbUser.organization;
                console.log('[License] User info from DB:', { userName, userOrg });
            } catch (dbErr) {
                console.warn('[License] DB lookup failed (non-critical):', (dbErr as Error).message);
            }
        }

        // ──────────────────────────────────────────────────────────
        // 2단계: 머신ID 수집 (실패해도 계속)
        // ──────────────────────────────────────────────────────────
        let machineIds: string[] = [];
        let machineId = "UNKNOWN";
        
        try {
            machineIds = getAllMachineIds();
            machineId = machineIds[0] ?? "UNKNOWN";
            console.log('[License] Machine IDs collected:', {
                count: machineIds.length,
                primary: machineId,
            });
        } catch (machineErr) {
            console.error('[License] Failed to get machine IDs:', 
                (machineErr as Error).message);
            console.warn('[License] Using fallback machine ID: UNKNOWN');
            machineIds = ["UNKNOWN"];
            machineId = "UNKNOWN";
        }

        // ──────────────────────────────────────────────────────────
        // 3단계: 요청 페이로드 생성 및 서명
        // ──────────────────────────────────────────────────────────
        const requestedAt = new Date().toISOString();
        
        const payload = {
            userId,
            userName: userName || "Unknown",
            userOrg: userOrg || "Unknown",
            userEmail,
            machineId,
            machineIds: machineIds.length > 0 ? machineIds : ["UNKNOWN"],
            requestedAt,
            product: PRODUCT_ID,
        };

        // HMAC 서명 (머신ID와 시간기반, userId 제외)
        const signatureData = {
            machineId,
            machineIds: machineIds.length > 0 ? machineIds : ["UNKNOWN"],
            requestedAt,
            product: PRODUCT_ID,
        };

        const sig = crypto
            .createHmac("sha256", MASTER_SECRET)
            .update(JSON.stringify(signatureData))
            .digest("hex")
            .slice(0, 16);

        console.log('[License] Payload generated:', {
            userEmail,
            userName,
            userOrg,
            machineId,
            machineIdCount: machineIds.length,
        });

        // ──────────────────────────────────────────────────────────
        // 4단계: Base64 인코딩
        // ──────────────────────────────────────────────────────────
        const content = Buffer.from(
            JSON.stringify({ ...payload, sig }, null, 2)
        ).toString("base64");

        console.log('[License] Request file content generated (Base64, size:', 
            content.length, 'bytes)');

        // ──────────────────────────────────────────────────────────
        // 5단계: 로컬 파일 저장 시도 (선택사항)
        // ──────────────────────────────────────────────────────────
        try {
            const { getLicenseDir } = await import("@/lib/license");
            const licenseDir = getLicenseDir();
            const requestFilePath = path.join(licenseDir, "license.ptzreq");

            // 디렉토리 생성 (없으면)
            if (!fs.existsSync(licenseDir)) {
                fs.mkdirSync(licenseDir, { recursive: true });
                console.log('[License] Created license directory:', licenseDir);
            }

            // 파일 저장
            fs.writeFileSync(requestFilePath, content, "utf8");
            console.log('[License] Request file saved locally:', requestFilePath);
        } catch (saveErr) {
            console.warn('[License] Failed to save request file locally:', 
                (saveErr as Error).message);
            console.log('[License] Continuing without local save...');
            // 로컬 저장 실패는 무시하고 계속 진행
        }

        // ──────────────────────────────────────────────────────────
        // 6단계: 다운로드 응답 제공
        // ──────────────────────────────────────────────────────────
        console.log('[License] Sending download response:', {
            filename: `ptzcontroller-${machineId}.ptzreq`,
            size: content.length,
        });

        return new NextResponse(content, {
            status: 200,
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="ptzcontroller-${machineId}.ptzreq"`,
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
            },
        });
    } catch (error) {
        console.error("[License] Request file creation error:", error);
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        return NextResponse.json(
            {
                error: "요청 파일 생성에 실패했습니다",
                detail: errorMessage,
                code: "LICENSE_REQUEST_FAILED",
            },
            { status: 500 }
        );
    }
}


