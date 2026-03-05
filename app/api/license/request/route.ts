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
        // 세션에서 사용자 정보 조회
        const session = await getServerSession(authOptions);
        const sessionUser = session?.user as { id?: string; email?: string } | undefined;
        const userId = sessionUser?.id ?? sessionUser?.email ?? "unknown";

        // DB에서 이름/소속 조회
        let userName = "";
        let userOrg  = "";
        let userEmail = sessionUser?.email ?? "";
        try {
            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true, organization: true, email: true },
            });
            userName  = dbUser?.name         ?? "";
            userOrg   = dbUser?.organization ?? "";
            userEmail = dbUser?.email        ?? userEmail;
        } catch { /* DB 오류 시 빈값으로 진행 */ }

        const machineIds  = getAllMachineIds();
        const machineId   = machineIds[0] ?? "UNKNOWN";
        const requestedAt = new Date().toISOString();

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
        const sig = crypto
            .createHmac("sha256", MASTER_SECRET)
            .update(JSON.stringify({ machineId, machineIds, requestedAt, product: PRODUCT_ID }))
            .digest("hex")
            .slice(0, 16);

        const content = Buffer.from(JSON.stringify({ ...payload, sig }, null, 2)).toString("base64");

        // 파일로도 저장
        try {
            fs.mkdirSync(path.dirname(REQUEST_FILE_PATH), { recursive: true });
            fs.writeFileSync(REQUEST_FILE_PATH, content, "utf8");
        } catch { /* 저장 실패는 무시 (다운로드는 계속 진행) */ }

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
