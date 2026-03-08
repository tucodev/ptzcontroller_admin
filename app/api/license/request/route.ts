// ✅ 수정된 코드: ptzcontroller_admin/app/api/license/request/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAllMachineIds, REQUEST_FILE_PATH } from "@/lib/license";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

const PRODUCT_ID     = "PTZ-OFFLINE";
const MASTER_SECRET  = process.env.LICENSE_SECRET ?? "TYCHE-PTZ-GOOD-BLESS-2026";

/**
 * GET /api/license/request
 * 현재 로그인 사용자의 userId/userName/userOrg + MachineID를 포함한
 * .ptzreq 파일을 생성하여 다운로드 응답으로 반환.
 * 관리자가 이 파일을 열면 이름/소속/userId가 자동으로 채워짐.
 */
export async function GET() {
    try {
        // ───────────────────────────────────────────────────────────
        // 1단계: 세션에서 사용자 정보 추출
        // ───────────────────────────────────────────────────────────
        const session = await getServerSession(authOptions);
        const sessionUser = session?.user as { id?: string; email?: string } | undefined;
        const userEmail = sessionUser?.email ?? "";

        if (!userEmail) {
            return NextResponse.json(
                { error: "사용자 이메일을 찾을 수 없습니다" },
                { status: 401 }
            );
        }

        // ───────────────────────────────────────────────────────────
        // 2단계: DB에서 사용자 정보 조회 (이메일 기반)
        // ───────────────────────────────────────────────────────────
        let userId = sessionUser?.id ?? "unknown";
        let userName = "";
        let userOrg  = "";

        try {
            // ✅ 수정: id 대신 email으로 조회 (온/오프라인 모두 지원)
            const dbUser = await prisma.user.findUnique({
                where: { email: userEmail },  // ← id 대신 email 사용
                select: { 
                    id: true,  // ← userId도 업데이트
                    name: true, 
                    organization: true, 
                    email: true 
                },
            });
            if (dbUser) {
                userId = dbUser.id;
                userName = dbUser.name || "";
                userOrg = dbUser.organization || "";
                console.log('[License] User info loaded from DB:', userEmail);
            }
        } catch (dbErr) {
            console.warn('[License] DB lookup failed, using session data only:', dbErr);
            // DB 오류 시: 세션의 이메일만으로도 진행 가능
            // (아래에서 userId = "unknown"일 수 있으나 이메일은 확보)
        }

        // ───────────────────────────────────────────────────────────
        // 3단계: 하드웨어 ID 수집
        // ───────────────────────────────────────────────────────────
        const machineIds  = getAllMachineIds();
        const machineId   = machineIds[0] ?? "UNKNOWN";
        const requestedAt = new Date().toISOString();

        console.log('[License] Request file generation:', {
            userEmail,
            userId,
            userName,
            userOrg,
            machineId,
            machineIdCount: machineIds.length,
        });

        // ───────────────────────────────────────────────────────────
        // 4단계: 페이로드 생성 및 서명
        // ───────────────────────────────────────────────────────────
        const payload = {
            userId,
            userName,
            userOrg,
            userEmail,
            machineId,
            machineIds,
            requestedAt,
            product: PRODUCT_ID,
        };

        // HMAC 서명 (요청 파일 무결성 검증용)
        const sig = crypto
            .createHmac("sha256", MASTER_SECRET)
            .update(JSON.stringify({ machineId, machineIds, requestedAt, product: PRODUCT_ID }))
            .digest("hex")
            .slice(0, 16);

        // ───────────────────────────────────────────────────────────
        // 5단계: Base64 인코딩
        // ───────────────────────────────────────────────────────────
        const content = Buffer.from(
            JSON.stringify({ ...payload, sig }, null, 2)
        ).toString("base64");

        // ───────────────────────────────────────────────────────────
        // 6단계: 로컬 파일에도 저장 (로그 목적)
        // ───────────────────────────────────────────────────────────
        try {
            fs.mkdirSync(path.dirname(REQUEST_FILE_PATH), { recursive: true });
            fs.writeFileSync(REQUEST_FILE_PATH, content, "utf8");
            console.log('[License] Request file saved:', REQUEST_FILE_PATH);
        } catch (saveErr) {
            console.warn('[License] Failed to save request file locally:', saveErr);
            // 로컬 저장 실패는 무시 (다운로드는 계속 진행)
        }

        // ───────────────────────────────────────────────────────────
        // 7단계: 다운로드 응답
        // ───────────────────────────────────────────────────────────
        return new NextResponse(content, {
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="ptzcontroller-${machineId}.ptzreq"`,
            },
        });
    } catch (error) {
        console.error("[License] Request file creation error:", error);
        return NextResponse.json(
            { error: "요청 파일 생성에 실패했습니다" },
            { status: 500 },
        );
    }
}
